import ExcelJS from "exceljs"
import mongoose from "mongoose"

import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Company from "../../organization/models/Company.js"
import Branch from "../../organization/models/Branch.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"
import Line from "../models/Line.js"
import { listLines } from "./line.service.js"

const TEMPLATE_HEADERS = [
    "companyCode",
    "branchCode",
    "departmentCode",
    "positionCode",
    "lineCode",
    "lineName",
    "status",
    "description",
]

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

function getCellValue(row, index) {
    const value = row.getCell(index).value

    if (value === null || value === undefined) {
        return ""
    }

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
    const result = {}

    TEMPLATE_HEADERS.forEach((header, index) => {
        result[header] = getCellValue(row, index + 1)
    })

    return result
}

function buildImportError(
    rowNumber,
    field,
    messageKey,
    {
        received = "",
        expected = "",
        reason = "",
    } = {},
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

    const valid = TEMPLATE_HEADERS.every(
        (header, index) => actualHeaders[index] === header,
    )

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
        { header: "departmentCode", key: "departmentCode", width: 22 },
        { header: "positionCode", key: "positionCode", width: 22 },
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
    headerRow.alignment = {
        vertical: "middle",
        horizontal: "center",
    }

    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.border = {
                top: { style: "thin", color: { argb: "FFE5E7EB" } },
                left: { style: "thin", color: { argb: "FFE5E7EB" } },
                bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
                right: { style: "thin", color: { argb: "FFE5E7EB" } },
            }
        })
    })

    return { workbook, worksheet }
}

export async function buildLineImportTemplateWorkbook() {
    const { workbook, worksheet } = buildWorkbookBase("Line Import")

    worksheet.addRow({
        companyCode: "TRAX",
        branchCode: "PP-HQ",
        departmentCode: "SEWING",
        positionCode: "SEWER",
        lineCode: "LINE_A",
        lineName: "Sewing Line A",
        status: "ACTIVE",
        description: "Line A for Sewer position",
    })

    const instructionSheet = workbook.addWorksheet("Instructions")
    instructionSheet.columns = [
        { header: "Field", key: "field", width: 28 },
        { header: "Required", key: "required", width: 14 },
        { header: "Rule", key: "rule", width: 94 },
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
            field: "departmentCode",
            required: "Yes",
            rule: "Must exactly match an ACTIVE Department Code inside the selected branch.",
        },
        {
            field: "positionCode",
            required: "Yes",
            rule: "Must exactly match an ACTIVE Position Code inside the selected Department. Every Line belongs to one Position.",
        },
        {
            field: "lineCode",
            required: "Yes",
            rule: "2-30 characters. Letters, numbers, dash, and underscore only. Unique under the selected Position. Existing matching rows are updated.",
        },
        {
            field: "lineName",
            required: "Yes",
            rule: "2-160 characters. This is the display name shown in HRMS.",
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
        worksheet.addRow({
            companyCode: line.company?.code || "",
            branchCode: line.branch?.code || "",
            departmentCode: line.department?.code || "",
            positionCode: line.position?.code || "",
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
            details: {
                reason: error?.message || "The workbook could not be read.",
            },
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
        const isEmpty = Object.values(raw).every(
            (value) => normalizeText(value) === "",
        )

        if (isEmpty) return

        const normalized = {
            rowNumber,
            companyCode: normalizeCode(raw.companyCode),
            branchCode: normalizeCode(raw.branchCode),
            departmentCode: normalizeCode(raw.departmentCode),
            positionCode: normalizeCode(raw.positionCode),
            lineCode: normalizeCode(raw.lineCode),
            lineName: normalizeText(raw.lineName),
            status: normalizeStatus(raw.status),
            description: normalizeText(raw.description),
        }

        if (!normalized.companyCode) {
            errors.push(buildImportError(
                rowNumber,
                "companyCode",
                "errors.organization.lineImport.companyCodeRequired",
                { received: raw.companyCode },
            ))
        }

        if (!normalized.branchCode) {
            errors.push(buildImportError(
                rowNumber,
                "branchCode",
                "errors.organization.lineImport.branchCodeRequired",
                { received: raw.branchCode },
            ))
        }

        if (!normalized.departmentCode) {
            errors.push(buildImportError(
                rowNumber,
                "departmentCode",
                "errors.organization.lineImport.departmentCodeRequired",
                { received: raw.departmentCode },
            ))
        }

        if (!normalized.positionCode) {
            errors.push(buildImportError(
                rowNumber,
                "positionCode",
                "errors.organization.lineImport.positionCodeRequired",
                { received: raw.positionCode },
            ))
        }

        if (!normalized.lineCode) {
            errors.push(buildImportError(
                rowNumber,
                "lineCode",
                "errors.organization.lineImport.lineCodeRequired",
                { received: raw.lineCode },
            ))
        } else if (
            normalized.lineCode.length < 2 ||
            normalized.lineCode.length > 30 ||
            !/^[A-Z0-9_-]+$/.test(normalized.lineCode)
        ) {
            errors.push(buildImportError(
                rowNumber,
                "lineCode",
                "errors.organization.lineImport.lineCodeInvalid",
                {
                    received: raw.lineCode,
                    expected: "2-30 characters: A-Z, 0-9, - or _",
                },
            ))
        }

        if (!normalized.lineName) {
            errors.push(buildImportError(
                rowNumber,
                "lineName",
                "errors.organization.lineImport.lineNameRequired",
                { received: raw.lineName },
            ))
        } else if (
            normalized.lineName.length < 2 ||
            normalized.lineName.length > 160
        ) {
            errors.push(buildImportError(
                rowNumber,
                "lineName",
                "errors.organization.lineImport.lineNameInvalid",
                {
                    received: raw.lineName,
                    expected: "2-160 characters",
                },
            ))
        }

        if (!normalized.status) {
            errors.push(buildImportError(
                rowNumber,
                "status",
                "errors.organization.lineImport.statusInvalid",
                {
                    received: raw.status,
                    expected: "ACTIVE or INACTIVE",
                },
            ))
        }

        if (normalized.description.length > 500) {
            errors.push(buildImportError(
                rowNumber,
                "description",
                "errors.organization.lineImport.descriptionTooLong",
                {
                    received: raw.description,
                    expected: "Maximum 500 characters",
                },
            ))
        }

        rows.push(normalized)
    })

    if (!rows.length) {
        errors.push(buildImportError(
            1,
            "file",
            "errors.organization.lineImport.noDataRows",
        ))
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
            {
                received: item.value ?? "",
                reason: item.message || "",
            },
        ),
    )
}

async function validateResolvedRows({ rows, user }) {
    const errors = []

    for (const [index, row] of rows.entries()) {
        const candidate = new Line({
            companyId: row.company._id,
            branchId: row.branch._id,
            departmentId: row.department._id,
            positionId: row.position._id,
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

function mapByCode(documents) {
    const map = new Map()

    for (const document of documents) {
        map.set(normalizeCode(document.code), document)
    }

    return map
}

function makePositionKey(departmentId, positionCode) {
    return `${departmentId.toString()}::${normalizeCode(positionCode)}`
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

    // Atomic import: validation errors prevent every row from being saved.
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
        Company.findOne({
            _id: workspace.companyId,
            status: "ACTIVE",
        }).lean(),
        Branch.findOne({
            _id: workspace.branchId,
            companyId: workspace.companyId,
            status: "ACTIVE",
        }).lean(),
    ])

    if (!company || !branch) {
        summary.errors.push(buildImportError(
            1,
            "workspace",
            "errors.organization.line.workspaceRequired",
        ))
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
                {
                    received: row.companyCode,
                    expected: expectedCompanyCode,
                },
            ))
        }

        if (row.branchCode !== expectedBranchCode) {
            summary.errors.push(buildImportError(
                row.rowNumber,
                "branchCode",
                "errors.organization.lineImport.branchWorkspaceMismatch",
                {
                    received: row.branchCode,
                    expected: expectedBranchCode,
                },
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

    const departmentMap = mapByCode(departments)
    const positionMap = new Map()

    for (const position of positions) {
        positionMap.set(
            makePositionKey(position.departmentId, position.code),
            position,
        )
    }

    const resolvedRows = rows.map((row) => {
        const department = departmentMap.get(row.departmentCode) || null

        if (!department) {
            summary.errors.push(buildImportError(
                row.rowNumber,
                "departmentCode",
                "errors.organization.lineImport.departmentNotFound",
                {
                    received: row.departmentCode,
                    expected: "An ACTIVE Department Code in the selected branch",
                },
            ))
        }

        const position = department
            ? positionMap.get(makePositionKey(department._id, row.positionCode)) || null
            : null

        if (!position) {
            summary.errors.push(buildImportError(
                row.rowNumber,
                "positionCode",
                "errors.organization.lineImport.positionNotFound",
                {
                    received: row.positionCode,
                    expected: department
                        ? `An ACTIVE Position Code inside ${department.code}`
                        : "A Position inside a valid Department",
                },
            ))
        }

        return {
            ...row,
            company,
            branch,
            department,
            position,
        }
    })

    if (summary.errors.length) {
        summary.skipped = rows.length
        return summary
    }

    const seenLineKeys = new Map()

    for (const row of resolvedRows) {
        const lineKey = `${row.position._id.toString()}::${row.lineCode}`
        const firstRowNumber = seenLineKeys.get(lineKey)

        if (firstRowNumber) {
            summary.errors.push(buildImportError(
                row.rowNumber,
                "lineCode",
                "errors.organization.lineImport.duplicateInFile",
                {
                    received: row.lineCode,
                    expected: `Unique under Position ${row.position.code}; first used on row ${firstRowNumber}`,
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

    const modelErrors = await validateResolvedRows({
        rows: resolvedRows,
        user,
    })

    if (modelErrors.length) {
        summary.errors.push(...modelErrors)
        summary.skipped = rows.length
        return summary
    }

    const existingLines = await Line.find({
        companyId: company._id,
        branchId: branch._id,
        positionId: { $in: resolvedRows.map((row) => row.position._id) },
        status: { $ne: "ARCHIVED" },
    })
        .select("_id positionId code")
        .lean()

    const existingKeys = new Set(
        existingLines.map(
            (line) => `${line.positionId.toString()}::${normalizeCode(line.code)}`,
        ),
    )

    const operations = resolvedRows.map((row) => ({
        updateOne: {
            filter: {
                companyId: company._id,
                branchId: branch._id,
                departmentId: row.department._id,
                positionId: row.position._id,
                code: row.lineCode,
            },
            update: {
                $set: {
                    departmentId: row.department._id,
                    positionId: row.position._id,
                    name: row.lineName,
                    status: row.status,
                    description: row.description,
                    updatedByAccountId: user.accountId,
                },
                $setOnInsert: {
                    companyId: company._id,
                    branchId: branch._id,
                    code: row.lineCode,
                    createdByAccountId: user.accountId,
                },
            },
            upsert: true,
        },
    }))

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
            await Line.bulkWrite(operations, {
                ordered: true,
                session,
            })
        })
    } catch (error) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_LINE_IMPORT_SAVE_FAILED",
            messageKey: "errors.organization.lineImport.saveFailed",
            details: {
                reason: error?.message || "The database rejected the Line import.",
            },
        })
    } finally {
        await session.endSession()
    }

    summary.created = resolvedRows.reduce((count, row) => {
        const key = `${row.position._id.toString()}::${row.lineCode}`
        return count + (existingKeys.has(key) ? 0 : 1)
    }, 0)
    summary.updated = resolvedRows.length - summary.created

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
