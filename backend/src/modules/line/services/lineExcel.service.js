import ExcelJS from "exceljs"
import mongoose from "mongoose"

import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Company from "../../organization/models/Company.js"
import Branch from "../../organization/models/Branch.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"
import Employee from "../../employee/models/Employee.js"
import Line from "../models/Line.js"
import { listLines } from "./line.service.js"

const TEMPLATE_HEADERS = [
    "companyCode",
    "branchCode",
    "positionCodes",
    "lineCode",
    "lineName",
    "status",
    "description",
]

const LEGACY_POSITION_HEADER = "positionCode"
const STATUS_VALUES = ["ACTIVE", "INACTIVE"]

function normalizeCode(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase()
}

function normalizeText(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
}

function normalizeStatus(value) {
    const status = normalizeCode(value || "ACTIVE")
    return STATUS_VALUES.includes(status) ? status : null
}

function normalizeId(value) {
    return value?._id?.toString?.() || value?.id || value?.toString?.() || ""
}

function uniqueIds(values = []) {
    return [...new Set((values || []).map(normalizeId).filter(Boolean))]
}

function effectivePositionIds(line) {
    const current = Array.isArray(line?.positionIds)
        ? uniqueIds(line.positionIds)
        : []
    if (current.length) return current
    const legacy = normalizeId(line?.positionId)
    return legacy ? [legacy] : []
}

function normalizePositionReference(value) {
    const raw = String(value || "").trim()
    if (!raw) return ""

    const parts = raw.split(":")
    if (parts.length === 1) return normalizeCode(parts[0])
    if (parts.length === 2) {
        const departmentCode = normalizeCode(parts[0])
        const positionCode = normalizeCode(parts[1])
        if (!departmentCode || !positionCode) return ""
        return `${departmentCode}:${positionCode}`
    }
    return normalizeCode(raw)
}

function parsePositionCodes(value) {
    return [
        ...new Set(
            String(value || "")
                .split(/[\n,;|]+/)
                .map(normalizePositionReference)
                .filter(Boolean),
        ),
    ]
}

function isValidPositionReference(value) {
    return /^[A-Z0-9_-]+(?::[A-Z0-9_-]+)?$/.test(String(value || ""))
}

function getCellValue(row, index) {
    const value = row.getCell(index).value

    if (value === null || value === undefined) return ""

    if (typeof value === "object") {
        if (value.text) return String(value.text)
        if (value.result !== undefined && value.result !== null) {
            return String(value.result)
        }
        if (value.richText) {
            return value.richText.map((item) => item.text).join("")
        }
    }

    return String(value)
}

function getRowObject(row) {
    return {
        companyCode: getCellValue(row, 1),
        branchCode: getCellValue(row, 2),
        positionCodes: getCellValue(row, 3),
        lineCode: getCellValue(row, 4),
        lineName: getCellValue(row, 5),
        status: getCellValue(row, 6),
        description: getCellValue(row, 7),
    }
}

function buildImportError(
    rowNumber,
    field,
    messageKey,
    { received = "", expected = "", reason = "" } = {},
) {
    return {
        rowNumber,
        field,
        messageKey,
        received: String(received ?? ""),
        expected: String(expected ?? ""),
        reason: String(reason ?? ""),
    }
}

function validateHeaderRow(worksheet) {
    const headerRow = worksheet.getRow(1)
    const actualHeaders = TEMPLATE_HEADERS.map((_, index) =>
        normalizeText(getCellValue(headerRow, index + 1)),
    )

    const valid = TEMPLATE_HEADERS.every((header, index) => {
        if (index === 2) {
            return ["positionCodes", LEGACY_POSITION_HEADER].includes(actualHeaders[index])
        }
        return actualHeaders[index] === header
    })

    if (!valid) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_LINE_IMPORT_INVALID_TEMPLATE",
            messageKey: "errors.organization.lineImport.invalidTemplate",
            details: {
                expectedHeaders: TEMPLATE_HEADERS.join(", "),
                actualHeaders: actualHeaders.filter(Boolean).join(", ") || "(blank)",
            },
        })
    }
}

function buildWorkbookBase(title) {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "HRMS Enterprise"
    workbook.created = new Date()
    workbook.modified = new Date()

    const worksheet = workbook.addWorksheet(title, {
        views: [{ state: "frozen", ySplit: 1 }],
    })

    worksheet.columns = [
        { header: "companyCode", key: "companyCode", width: 18 },
        { header: "branchCode", key: "branchCode", width: 18 },
        { header: "positionCodes", key: "positionCodes", width: 44 },
        { header: "lineCode", key: "lineCode", width: 18 },
        { header: "lineName", key: "lineName", width: 30 },
        { header: "status", key: "status", width: 14 },
        { header: "description", key: "description", width: 44 },
    ]

    const headerRow = worksheet.getRow(1)
    headerRow.height = 24
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D4ED8" },
    }
    headerRow.alignment = { vertical: "middle", horizontal: "center" }

    return { workbook, worksheet }
}

export async function buildLineImportTemplateWorkbook() {
    const { workbook, worksheet } = buildWorkbookBase("Line Import")

    worksheet.addRow({
        companyCode: "TRAX",
        branchCode: "PP-HQ",
        positionCodes: "SEWING:SEWER,PACKING:HELPER",
        lineCode: "LINE_A",
        lineName: "Line A",
        status: "ACTIVE",
        description: "One Line can support Positions from multiple Departments",
    })

    const instructionSheet = workbook.addWorksheet("Instructions")
    instructionSheet.columns = [
        { header: "Field", key: "field", width: 28 },
        { header: "Required", key: "required", width: 14 },
        { header: "Rule", key: "rule", width: 100 },
    ]

    instructionSheet.addRows([
        {
            field: "companyCode",
            required: "Yes",
            rule: "Must exactly match the ACTIVE company selected in the HRMS top bar.",
        },
        {
            field: "branchCode",
            required: "Yes",
            rule: "Must exactly match the ACTIVE branch selected in the HRMS top bar.",
        },
        {
            field: "positionCodes",
            required: "Yes",
            rule: "Enter one or more ACTIVE Position Codes from any Department in the selected branch. Separate multiple values with commas. If the same Position Code exists in more than one Department, use DEPARTMENT_CODE:POSITION_CODE, for example SEWING:HELPER,PACKING:HELPER.",
        },
        {
            field: "lineCode",
            required: "Yes",
            rule: "2-30 characters. Letters, numbers, dash, and underscore only. Unique inside the selected Company + Branch. Existing matching rows are updated.",
        },
        {
            field: "lineName",
            required: "Yes",
            rule: "2-160 characters. This is the Line display name shown in HRMS.",
        },
        {
            field: "status",
            required: "No",
            rule: "Allowed values: ACTIVE or INACTIVE. Blank means ACTIVE.",
        },
        {
            field: "description",
            required: "No",
            rule: "Optional description, maximum 500 characters.",
        },
    ])

    instructionSheet.getRow(1).font = { bold: true }
    return workbook
}

export async function buildLineExportWorkbook({ lines }) {
    const { workbook, worksheet } = buildWorkbookBase("Lines")

    for (const line of lines) {
        const positionCodes = Array.isArray(line.positions)
            ? line.positions
                .map((position) => {
                    const positionCode = position?.code || ""
                    const departmentCode = position?.department?.code || ""
                    return positionCode
                        ? departmentCode
                            ? `${departmentCode}:${positionCode}`
                            : positionCode
                        : ""
                })
                .filter(Boolean)
            : []

        worksheet.addRow({
            companyCode: line.company?.code || "",
            branchCode: line.branch?.code || "",
            positionCodes: positionCodes.join(","),
            lineCode: line.code || "",
            lineName: line.name || "",
            status: line.status || "",
            description: line.description || "",
        })
    }

    return workbook
}

export async function parseLineImportWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()

    try {
        await workbook.xlsx.load(buffer)
    } catch (error) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_LINE_IMPORT_INVALID_FILE",
            messageKey: "errors.organization.lineImport.invalidFile",
            details: { reason: error?.message || "The workbook could not be read." },
        })
    }

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_LINE_IMPORT_EMPTY_FILE",
            messageKey: "errors.organization.lineImport.emptyFile",
        })
    }

    validateHeaderRow(worksheet)

    const rows = []
    const errors = []

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return

        const raw = getRowObject(row)
        const isEmpty = Object.values(raw).every((value) => normalizeText(value) === "")
        if (isEmpty) return

        const normalized = {
            rowNumber,
            companyCode: normalizeCode(raw.companyCode),
            branchCode: normalizeCode(raw.branchCode),
            positionCodes: parsePositionCodes(raw.positionCodes),
            lineCode: normalizeCode(raw.lineCode),
            lineName: normalizeText(raw.lineName),
            status: normalizeStatus(raw.status),
            description: normalizeText(raw.description),
        }

        if (!normalized.companyCode) {
            errors.push(buildImportError(rowNumber, "companyCode", "errors.organization.lineImport.companyCodeRequired", { received: raw.companyCode }))
        }
        if (!normalized.branchCode) {
            errors.push(buildImportError(rowNumber, "branchCode", "errors.organization.lineImport.branchCodeRequired", { received: raw.branchCode }))
        }
        if (!normalized.positionCodes.length) {
            errors.push(buildImportError(rowNumber, "positionCodes", "errors.organization.lineImport.positionCodesRequired", { received: raw.positionCodes }))
        } else {
            const invalidPositionCodes = normalized.positionCodes.filter(
                (code) => code.length < 2 || code.length > 65 || !isValidPositionReference(code),
            )
            if (invalidPositionCodes.length) {
                errors.push(buildImportError(
                    rowNumber,
                    "positionCodes",
                    "errors.organization.lineImport.positionCodesInvalid",
                    {
                        received: raw.positionCodes,
                        expected: "Position Codes like SEWER or qualified references like SEWING:HELPER, separated by commas",
                    },
                ))
            }
        }

        if (!normalized.lineCode) {
            errors.push(buildImportError(rowNumber, "lineCode", "errors.organization.lineImport.lineCodeRequired", { received: raw.lineCode }))
        } else if (
            normalized.lineCode.length < 2 ||
            normalized.lineCode.length > 30 ||
            !/^[A-Z0-9_-]+$/.test(normalized.lineCode)
        ) {
            errors.push(buildImportError(
                rowNumber,
                "lineCode",
                "errors.organization.lineImport.lineCodeInvalid",
                { received: raw.lineCode, expected: "2-30 characters: A-Z, 0-9, - or _" },
            ))
        }

        if (!normalized.lineName) {
            errors.push(buildImportError(rowNumber, "lineName", "errors.organization.lineImport.lineNameRequired", { received: raw.lineName }))
        } else if (normalized.lineName.length < 2 || normalized.lineName.length > 160) {
            errors.push(buildImportError(
                rowNumber,
                "lineName",
                "errors.organization.lineImport.lineNameInvalid",
                { received: raw.lineName, expected: "2-160 characters" },
            ))
        }

        if (!normalized.status) {
            errors.push(buildImportError(
                rowNumber,
                "status",
                "errors.organization.lineImport.statusInvalid",
                { received: raw.status, expected: "ACTIVE or INACTIVE" },
            ))
        }

        if (normalized.description.length > 500) {
            errors.push(buildImportError(
                rowNumber,
                "description",
                "errors.organization.lineImport.descriptionTooLong",
                { received: raw.description, expected: "Maximum 500 characters" },
            ))
        }

        rows.push(normalized)
    })

    if (!rows.length) {
        errors.push(buildImportError(1, "file", "errors.organization.lineImport.noDataRows"))
    }

    return { rows, errors }
}

function mongooseValidationErrors(error, row) {
    if (!error?.errors) {
        return [buildImportError(
            row.rowNumber,
            "row",
            "errors.organization.lineImport.rowInvalid",
            {
                received: row.lineCode,
                reason: error?.message || "Line validation failed.",
            },
        )]
    }

    return Object.values(error.errors).map((item) =>
        buildImportError(
            row.rowNumber,
            item.path || "row",
            "errors.organization.lineImport.fieldInvalid",
            { received: item.value ?? "", reason: item.message || "" },
        ),
    )
}

async function validateResolvedRows({ rows, user }) {
    const errors = []

    for (const [index, row] of rows.entries()) {
        const candidate = new Line({
            companyId: row.company._id,
            branchId: row.branch._id,
            positionIds: row.positions.map((position) => position._id),
            code: row.lineCode,
            name: row.lineName,
            status: row.status,
            description: row.description,
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        try {
            await candidate.validate()
        } catch (error) {
            errors.push(...mongooseValidationErrors(error, row))
        }

        if ((index + 1) % 25 === 0) {
            await new Promise((resolve) => setImmediate(resolve))
        }
    }

    return errors
}

function makeLineKey(lineCode) {
    return normalizeCode(lineCode)
}

function buildPositionReferenceMaps({ positions, departments }) {
    const departmentsById = new Map(
        departments.map((department) => [department._id.toString(), department]),
    )
    const byCode = new Map()
    const byQualifiedCode = new Map()

    for (const position of positions) {
        const positionCode = normalizeCode(position.code)
        const department = departmentsById.get(normalizeId(position.departmentId)) || null
        const departmentCode = normalizeCode(department?.code)

        const bucket = byCode.get(positionCode) || []
        bucket.push({ position, department })
        byCode.set(positionCode, bucket)

        if (departmentCode) {
            byQualifiedCode.set(`${departmentCode}:${positionCode}`, { position, department })
        }
    }

    return { byCode, byQualifiedCode }
}

function resolvePositionReference(reference, maps) {
    if (reference.includes(":")) {
        const match = maps.byQualifiedCode.get(reference) || null
        return match
            ? { state: "FOUND", ...match }
            : { state: "NOT_FOUND", reference }
    }

    const matches = maps.byCode.get(reference) || []
    if (matches.length === 0) return { state: "NOT_FOUND", reference }
    if (matches.length === 1) return { state: "FOUND", ...matches[0] }

    return {
        state: "AMBIGUOUS",
        reference,
        matches,
    }
}

export async function importLinesFromRows({
    rows,
    parseErrors,
    user,
    workspace,
    onProgress,
}) {
    const summary = {
        totalRows: rows.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [...parseErrors],
    }

    if (summary.errors.length) {
        summary.skipped = rows.length
        onProgress?.({
            phase: "VALIDATION_FAILED",
            percent: 55,
            processedRows: rows.length,
            totalRows: rows.length,
            messageKey: "organization.line.importPhaseValidationFailed",
        })
        return summary
    }

    onProgress?.({
        phase: "VALIDATING_WORKSPACE",
        percent: 25,
        processedRows: 0,
        totalRows: rows.length,
        messageKey: "organization.line.importPhaseValidatingWorkspace",
    })

    const [company, branch] = await Promise.all([
        Company.findOne({ _id: workspace.companyId, status: "ACTIVE" }).lean(),
        Branch.findOne({
            _id: workspace.branchId,
            companyId: workspace.companyId,
            status: "ACTIVE",
        }).lean(),
    ])

    if (!company || !branch) {
        summary.errors.push(buildImportError(1, "workspace", "errors.organization.line.workspaceRequired"))
        summary.skipped = rows.length
        return summary
    }

    const expectedCompanyCode = normalizeCode(company.code)
    const expectedBranchCode = normalizeCode(branch.code)

    for (const row of rows) {
        if (row.companyCode !== expectedCompanyCode) {
            summary.errors.push(buildImportError(
                row.rowNumber,
                "companyCode",
                "errors.organization.lineImport.companyWorkspaceMismatch",
                { received: row.companyCode, expected: expectedCompanyCode },
            ))
        }
        if (row.branchCode !== expectedBranchCode) {
            summary.errors.push(buildImportError(
                row.rowNumber,
                "branchCode",
                "errors.organization.lineImport.branchWorkspaceMismatch",
                { received: row.branchCode, expected: expectedBranchCode },
            ))
        }
    }

    if (summary.errors.length) {
        summary.skipped = rows.length
        return summary
    }

    onProgress?.({
        phase: "VALIDATING_REFERENCES",
        percent: 35,
        processedRows: 0,
        totalRows: rows.length,
        messageKey: "organization.line.importPhaseValidatingReferences",
    })

    const [departments, positions] = await Promise.all([
        Department.find({
            companyId: workspace.companyId,
            branchId: workspace.branchId,
            status: "ACTIVE",
        }).lean(),
        Position.find({
            companyId: workspace.companyId,
            branchId: workspace.branchId,
            status: "ACTIVE",
        }).lean(),
    ])

    const positionMaps = buildPositionReferenceMaps({ positions, departments })

    const resolvedRows = rows.map((row) => {
        const rowPositions = []
        const seenPositionIds = new Set()

        for (const reference of row.positionCodes) {
            const resolved = resolvePositionReference(reference, positionMaps)

            if (resolved.state === "NOT_FOUND") {
                summary.errors.push(buildImportError(
                    row.rowNumber,
                    "positionCodes",
                    "errors.organization.lineImport.positionNotFound",
                    {
                        received: reference,
                        expected: "An ACTIVE Position Code in the selected branch",
                    },
                ))
                continue
            }

            if (resolved.state === "AMBIGUOUS") {
                const matches = resolved.matches
                    .map(({ position, department }) => {
                        const departmentCode = normalizeCode(department?.code)
                        const positionCode = normalizeCode(position?.code)
                        return departmentCode && positionCode
                            ? `${departmentCode}:${positionCode}`
                            : positionCode
                    })
                    .filter(Boolean)

                summary.errors.push(buildImportError(
                    row.rowNumber,
                    "positionCodes",
                    "errors.organization.lineImport.positionAmbiguous",
                    {
                        received: reference,
                        expected: `Use DEPARTMENT_CODE:POSITION_CODE. Matches: ${matches.join(", ")}`,
                    },
                ))
                continue
            }

            const positionId = resolved.position._id.toString()
            if (seenPositionIds.has(positionId)) continue
            seenPositionIds.add(positionId)
            rowPositions.push(resolved.position)
        }

        return {
            ...row,
            company,
            branch,
            positions: rowPositions,
        }
    })

    if (summary.errors.length) {
        summary.skipped = rows.length
        return summary
    }

    const seenLineKeys = new Map()
    for (const row of resolvedRows) {
        const lineKey = makeLineKey(row.lineCode)
        const firstRowNumber = seenLineKeys.get(lineKey)
        if (firstRowNumber) {
            summary.errors.push(buildImportError(
                row.rowNumber,
                "lineCode",
                "errors.organization.lineImport.duplicateInFile",
                {
                    received: row.lineCode,
                    expected: `Unique inside the selected Company + Branch; first used on row ${firstRowNumber}`,
                },
            ))
        } else {
            seenLineKeys.set(lineKey, row.rowNumber)
        }
    }

    if (summary.errors.length) {
        summary.skipped = rows.length
        return summary
    }

    onProgress?.({
        phase: "VALIDATING_ROWS",
        percent: 50,
        processedRows: 0,
        totalRows: resolvedRows.length,
        messageKey: "organization.line.importPhaseValidatingRows",
    })

    const modelErrors = await validateResolvedRows({ rows: resolvedRows, user })
    if (modelErrors.length) {
        summary.errors.push(...modelErrors)
        summary.skipped = rows.length
        return summary
    }

    const existingLines = await Line.find({
        companyId: company._id,
        branchId: branch._id,
        status: { $ne: "ARCHIVED" },
    })
        .select("_id departmentId positionIds positionId code")
        .lean()

    const existingByKey = new Map()
    for (const line of existingLines) {
        const key = makeLineKey(line.code)
        const bucket = existingByKey.get(key) || []
        bucket.push(line)
        existingByKey.set(key, bucket)
    }

    for (const row of resolvedRows) {
        const key = makeLineKey(row.lineCode)
        const matches = existingByKey.get(key) || []
        if (matches.length > 1) {
            summary.errors.push(buildImportError(
                row.rowNumber,
                "lineCode",
                "errors.organization.lineImport.existingDuplicateConflict",
                {
                    received: row.lineCode,
                    expected: "Only one active Line record for this Company + Branch + Line Code",
                    reason: "Legacy data contains duplicate Line records. Delete/recreate the duplicate development records first.",
                },
            ))
        }
    }

    if (summary.errors.length) {
        summary.skipped = rows.length
        return summary
    }

    const existingMatched = resolvedRows
        .map((row) => (existingByKey.get(makeLineKey(row.lineCode)) || [])[0])
        .filter(Boolean)

    const employeeRows = existingMatched.length
        ? await Employee.find({
            lineId: { $in: existingMatched.map((line) => line._id) },
            recordStatus: "ACTIVE",
        })
            .select("lineId positionId")
            .lean()
        : []

    const usedPositionsByLine = new Map()
    for (const employee of employeeRows) {
        const lineId = normalizeId(employee.lineId)
        const positionId = normalizeId(employee.positionId)
        if (!lineId || !positionId) continue
        const set = usedPositionsByLine.get(lineId) || new Set()
        set.add(positionId)
        usedPositionsByLine.set(lineId, set)
    }

    for (const row of resolvedRows) {
        const key = makeLineKey(row.lineCode)
        const existing = (existingByKey.get(key) || [])[0] || null
        if (!existing) continue

        const newPositionIds = new Set(row.positions.map((position) => position._id.toString()))
        const usedPositionIds = usedPositionsByLine.get(existing._id.toString()) || new Set()
        const removingUsedPosition = [...usedPositionIds].some((positionId) => !newPositionIds.has(positionId))

        if (removingUsedPosition) {
            summary.errors.push(buildImportError(
                row.rowNumber,
                "positionCodes",
                "errors.organization.line.inUseCannotRemovePosition",
                {
                    received: row.positionCodes.join(","),
                    expected: "Keep every Position currently used by active employees on this Line",
                },
            ))
        }
    }

    if (summary.errors.length) {
        summary.skipped = rows.length
        return summary
    }

    const operations = resolvedRows.map((row) => {
        const key = makeLineKey(row.lineCode)
        const existing = (existingByKey.get(key) || [])[0] || null
        const filter = existing
            ? { _id: existing._id }
            : {
                companyId: company._id,
                branchId: branch._id,
                code: row.lineCode,
            }

        return {
            updateOne: {
                filter,
                update: {
                    $set: {
                        positionIds: row.positions.map((position) => position._id),
                        name: row.lineName,
                        status: row.status,
                        description: row.description,
                        updatedByAccountId: user.accountId,
                    },
                    $unset: { positionId: "", departmentId: "" },
                    $setOnInsert: {
                        companyId: company._id,
                        branchId: branch._id,
                        code: row.lineCode,
                        createdByAccountId: user.accountId,
                    },
                },
                upsert: true,
            },
        }
    })

    onProgress?.({
        phase: "SAVING_ROWS",
        percent: 78,
        processedRows: 0,
        totalRows: resolvedRows.length,
        messageKey: "organization.line.importPhaseSavingRows",
    })

    const session = await mongoose.startSession()
    try {
        await session.withTransaction(async () => {
            await Line.bulkWrite(operations, { ordered: true, session })
        })
    } catch (error) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_LINE_IMPORT_SAVE_FAILED",
            messageKey: "errors.organization.lineImport.saveFailed",
            details: { reason: error?.message || "The database rejected the Line import." },
        })
    } finally {
        await session.endSession()
    }

    summary.updated = existingMatched.length
    summary.created = resolvedRows.length - summary.updated

    onProgress?.({
        phase: "SAVING_ROWS",
        percent: 96,
        processedRows: resolvedRows.length,
        totalRows: resolvedRows.length,
        messageKey: "organization.line.importPhaseSavingRows",
    })

    clearCacheByPrefix("line:list:")
    clearCacheByPrefix("excome:")

    return summary
}

export async function getExportLines({ query, user }) {
    const result = await listLines({
        query: {
            ...query,
            page: 1,
            limit: 10000,
        },
        user,
    })

    return result.items
}
