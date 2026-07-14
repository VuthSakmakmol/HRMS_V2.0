import ExcelJS from "exceljs"

import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"
import Branch from "../models/Branch.js"
import Company from "../models/Company.js"
import Department from "../models/Department.js"
import Position from "../models/Position.js"
import { listPositions } from "./position.service.js"

const TEMPLATE_HEADERS = [
    "companyCode",
    "branchCode",
    "departmentCode",
    "positionCode",
    "positionTitle",
    "shortName",
    "reportsToPositionCode",
    "level",
    "isManager",
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

    if (!STATUS_VALUES.includes(status)) {
        return null
    }

    return status
}

function normalizeBoolean(value) {
    const normalized = normalizeCode(value)

    if (["YES", "Y", "TRUE", "1"].includes(normalized)) {
        return true
    }

    if (["NO", "N", "FALSE", "0", ""].includes(normalized)) {
        return false
    }

    return null
}

function normalizeLevel(value) {
    const raw = String(value || "").trim()

    if (!raw) {
        return 0
    }

    const numberValue = Number(raw)

    if (!Number.isInteger(numberValue) || numberValue < 0 || numberValue > 99) {
        return null
    }

    return numberValue
}

function getCellValue(row, index) {
    const cell = row.getCell(index)
    const value = cell.value

    if (value === null || value === undefined) {
        return ""
    }

    if (typeof value === "object") {
        if (value.text) {
            return String(value.text)
        }

        if (value.result) {
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

function validateHeaderRow(worksheet) {
    const headerRow = worksheet.getRow(1)

    const actualHeaders = TEMPLATE_HEADERS.map((_, index) =>
        normalizeText(getCellValue(headerRow, index + 1)),
    )

    const isValid = TEMPLATE_HEADERS.every(
        (header, index) => actualHeaders[index] === header,
    )

    if (!isValid) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_POSITION_IMPORT_INVALID_TEMPLATE",
            messageKey: "errors.organization.positionImport.invalidTemplate",
        })
    }
}

function buildImportError(rowNumber, field, messageKey) {
    return {
        rowNumber,
        field,
        messageKey,
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
        { header: "departmentCode", key: "departmentCode", width: 20 },
        { header: "positionCode", key: "positionCode", width: 18 },
        { header: "positionTitle", key: "positionTitle", width: 30 },
        { header: "shortName", key: "shortName", width: 18 },
        {
            header: "reportsToPositionCode",
            key: "reportsToPositionCode",
            width: 26,
        },
        { header: "level", key: "level", width: 10 },
        { header: "isManager", key: "isManager", width: 12 },
        { header: "status", key: "status", width: 14 },
        { header: "description", key: "description", width: 42 },
    ]

    const headerRow = worksheet.getRow(1)
    headerRow.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
    }
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

    return {
        workbook,
        worksheet,
    }
}

export async function buildPositionImportTemplateWorkbook() {
    const { workbook, worksheet } = buildWorkbookBase("Position Import")

    worksheet.addRow({
        companyCode: "TRAX",
        branchCode: "PP-HQ",
        departmentCode: "HR",
        positionCode: "HR_MANAGER",
        positionTitle: "HR Manager",
        shortName: "HR Manager",
        reportsToPositionCode: "",
        level: 1,
        isManager: "YES",
        status: "ACTIVE",
        description: "Human Resources manager",
    })

    worksheet.addRow({
        companyCode: "TRAX",
        branchCode: "PP-HQ",
        departmentCode: "HR",
        positionCode: "HR_OFFICER",
        positionTitle: "HR Officer",
        shortName: "HR Officer",
        reportsToPositionCode: "HR_MANAGER",
        level: 2,
        isManager: "NO",
        status: "ACTIVE",
        description: "Human Resources officer",
    })

    const instructionSheet = workbook.addWorksheet("Instructions")

    instructionSheet.columns = [
        { header: "Field", key: "field", width: 28 },
        { header: "Required", key: "required", width: 14 },
        { header: "Rule", key: "rule", width: 86 },
    ]

    instructionSheet.addRows([
        {
            field: "companyCode",
            required: "Yes",
            rule: "Must match an existing active company code.",
        },
        {
            field: "branchCode",
            required: "Yes",
            rule: "Must match an existing active branch code inside the company.",
        },
        {
            field: "departmentCode",
            required: "Yes",
            rule: "Must match an existing active department code inside the branch.",
        },
        {
            field: "positionCode",
            required: "Yes",
            rule: "Unique inside the selected company, branch, and department.",
        },
        {
            field: "positionTitle",
            required: "Yes",
            rule: "Position display title.",
        },
        {
            field: "shortName",
            required: "No",
            rule: "Optional short name.",
        },
        {
            field: "reportsToPositionCode",
            required: "No",
            rule: "Optional. Must exist in the same company and branch, or be included in this same import file.",
        },
        {
            field: "level",
            required: "No",
            rule: "Number from 0 to 99. Lower number usually means higher position level.",
        },
        {
            field: "isManager",
            required: "No",
            rule: "Allowed values: YES, NO, TRUE, FALSE, 1, 0. Blank means NO.",
        },
        {
            field: "status",
            required: "No",
            rule: "Allowed values: ACTIVE, INACTIVE. Blank means ACTIVE.",
        },
        {
            field: "description",
            required: "No",
            rule: "Optional description.",
        },
    ])

    instructionSheet.getRow(1).font = {
        bold: true,
    }

    return workbook
}

export async function buildPositionExportWorkbook({ positions }) {
    const { workbook, worksheet } = buildWorkbookBase("Positions")

    for (const position of positions) {
        worksheet.addRow({
            companyCode: position.company?.code || "",
            branchCode: position.branch?.code || "",
            departmentCode: position.department?.code || "",
            positionCode: position.code || "",
            positionTitle: position.title || "",
            shortName: position.shortName || "",
            reportsToPositionCode: position.reportsToPosition?.code || "",
            level: position.level ?? 0,
            isManager: position.isManager ? "YES" : "NO",
            status: position.status || "",
            description: position.description || "",
        })
    }

    return workbook
}

export async function parsePositionImportWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()

    await workbook.xlsx.load(buffer)

    const worksheet = workbook.worksheets[0]

    if (!worksheet) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_POSITION_IMPORT_EMPTY_FILE",
            messageKey: "errors.organization.positionImport.emptyFile",
        })
    }

    validateHeaderRow(worksheet)

    const rows = []
    const errors = []

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
            return
        }

        const raw = getRowObject(row)

        const normalized = {
            rowNumber,
            companyCode: normalizeCode(raw.companyCode),
            branchCode: normalizeCode(raw.branchCode),
            departmentCode: normalizeCode(raw.departmentCode),
            positionCode: normalizeCode(raw.positionCode),
            positionTitle: normalizeText(raw.positionTitle),
            shortName: normalizeText(raw.shortName),
            reportsToPositionCode: normalizeCode(raw.reportsToPositionCode),
            level: normalizeLevel(raw.level),
            isManager: normalizeBoolean(raw.isManager),
            status: normalizeStatus(raw.status),
            description: normalizeText(raw.description),
        }

        const isEmpty = Object.values(raw).every(
            (value) => normalizeText(value) === "",
        )

        if (isEmpty) {
            return
        }

        if (!normalized.companyCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "companyCode",
                    "errors.organization.positionImport.companyCodeRequired",
                ),
            )
        }

        if (!normalized.branchCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "branchCode",
                    "errors.organization.positionImport.branchCodeRequired",
                ),
            )
        }

        if (!normalized.departmentCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "departmentCode",
                    "errors.organization.positionImport.departmentCodeRequired",
                ),
            )
        }

        if (!normalized.positionCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "positionCode",
                    "errors.organization.positionImport.positionCodeRequired",
                ),
            )
        }

        if (!/^[A-Z0-9_-]{2,30}$/.test(normalized.positionCode)) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "positionCode",
                    "errors.organization.positionImport.positionCodeInvalid",
                ),
            )
        }

        if (!normalized.positionTitle) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "positionTitle",
                    "errors.organization.positionImport.positionTitleRequired",
                ),
            )
        }

        if (normalized.level === null) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "level",
                    "errors.organization.positionImport.levelInvalid",
                ),
            )
        }

        if (normalized.isManager === null) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "isManager",
                    "errors.organization.positionImport.isManagerInvalid",
                ),
            )
        }

        if (!normalized.status) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "status",
                    "errors.organization.positionImport.statusInvalid",
                ),
            )
        }

        rows.push(normalized)
    })

    if (rows.length === 0) {
        errors.push(
            buildImportError(
                2,
                "file",
                "errors.organization.positionImport.noDataRows",
            ),
        )
    }

    return {
        rows,
        errors,
    }
}

async function buildCompanyMap({ companyCodes }) {
    const companies = await Company.find({
        code: { $in: [...companyCodes] },
        status: { $ne: "ARCHIVED" },
    }).lean()

    return new Map(companies.map((company) => [company.code, company]))
}

async function buildBranchMap({ branchCodes, companyIds }) {
    const branches = await Branch.find({
        companyId: { $in: [...companyIds] },
        code: { $in: [...branchCodes] },
        status: { $ne: "ARCHIVED" },
    }).lean()

    return new Map(
        branches.map((branch) => [
            `${branch.companyId.toString()}::${branch.code}`,
            branch,
        ]),
    )
}

async function buildDepartmentMap({ departmentCodes, branchIds }) {
    const departments = await Department.find({
        branchId: { $in: [...branchIds] },
        code: { $in: [...departmentCodes] },
        status: { $ne: "ARCHIVED" },
    }).lean()

    return new Map(
        departments.map((department) => [
            `${department.branchId.toString()}::${department.code}`,
            department,
        ]),
    )
}

async function buildPositionMap({ branchIds }) {
    const positions = await Position.find({
        branchId: { $in: [...branchIds] },
        status: { $ne: "ARCHIVED" },
    }).lean()

    return new Map(
        positions.map((position) => [
            `${position.branchId.toString()}::${position.code}`,
            position,
        ]),
    )
}

function makePositionDepartmentKey(departmentId, positionCode) {
    return `${departmentId.toString()}::${positionCode}`
}

function makePositionBranchKey(branchId, positionCode) {
    return `${branchId.toString()}::${positionCode}`
}

function buildImportSummary() {
    return {
        totalRows: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
    }
}

export async function importPositionsFromRows({ rows, parseErrors, user }) {
    const summary = buildImportSummary()
    summary.totalRows = rows.length

    const errors = [...parseErrors]

    if (parseErrors.length > 0) {
        summary.skipped = rows.length
        summary.errors = errors
        return summary
    }

    const companyCodes = new Set(rows.map((row) => row.companyCode))
    const branchCodes = new Set(rows.map((row) => row.branchCode))
    const departmentCodes = new Set(rows.map((row) => row.departmentCode))

    const companyMap = await buildCompanyMap({ companyCodes })

    for (const row of rows) {
        if (!companyMap.has(row.companyCode)) {
            errors.push(
                buildImportError(
                    row.rowNumber,
                    "companyCode",
                    "errors.organization.positionImport.companyNotFound",
                ),
            )
        }
    }

    if (errors.length > 0) {
        summary.skipped = rows.length
        summary.errors = errors
        return summary
    }

    const companyIds = new Set(
        [...companyMap.values()].map((company) => company._id),
    )

    const branchMap = await buildBranchMap({
        branchCodes,
        companyIds,
    })

    const resolvedBranchRows = rows.map((row) => {
        const company = companyMap.get(row.companyCode)
        const branchKey = `${company._id.toString()}::${row.branchCode}`
        const branch = branchMap.get(branchKey)

        if (!branch) {
            errors.push(
                buildImportError(
                    row.rowNumber,
                    "branchCode",
                    "errors.organization.positionImport.branchNotFound",
                ),
            )
        }

        return {
            ...row,
            company,
            branch,
        }
    })

    if (errors.length > 0) {
        summary.skipped = rows.length
        summary.errors = errors
        return summary
    }

    const branchIds = new Set(resolvedBranchRows.map((row) => row.branch._id))

    const departmentMap = await buildDepartmentMap({
        departmentCodes,
        branchIds,
    })

    const resolvedRows = resolvedBranchRows.map((row) => {
        const departmentKey = `${row.branch._id.toString()}::${row.departmentCode}`
        const department = departmentMap.get(departmentKey)

        if (!department) {
            errors.push(
                buildImportError(
                    row.rowNumber,
                    "departmentCode",
                    "errors.organization.positionImport.departmentNotFound",
                ),
            )
        }

        return {
            ...row,
            department,
        }
    })

    if (errors.length > 0) {
        summary.skipped = rows.length
        summary.errors = errors
        return summary
    }

    const positionByBranchMap = await buildPositionMap({
        branchIds,
    })

    const existingPositionByDepartmentMap = new Map()

    for (const position of positionByBranchMap.values()) {
        existingPositionByDepartmentMap.set(
            makePositionDepartmentKey(position.departmentId, position.code),
            position,
        )
    }

    const seenDepartmentPositionKeys = new Set()

    for (const row of resolvedRows) {
        const positionKey = makePositionDepartmentKey(
            row.department._id,
            row.positionCode,
        )

        if (seenDepartmentPositionKeys.has(positionKey)) {
            errors.push(
                buildImportError(
                    row.rowNumber,
                    "positionCode",
                    "errors.organization.positionImport.duplicateInFile",
                ),
            )
        }

        seenDepartmentPositionKeys.add(positionKey)
    }

    if (errors.length > 0) {
        summary.skipped = rows.length
        summary.errors = errors
        return summary
    }

    for (const row of resolvedRows) {
        const positionDepartmentKey = makePositionDepartmentKey(
            row.department._id,
            row.positionCode,
        )

        const positionBranchKey = makePositionBranchKey(
            row.branch._id,
            row.positionCode,
        )

        const existingPosition =
            existingPositionByDepartmentMap.get(positionDepartmentKey)

        if (existingPosition) {
            const updatedPosition = await Position.findByIdAndUpdate(
                existingPosition._id,
                {
                    $set: {
                        title: row.positionTitle,
                        shortName: row.shortName,
                        level: row.level,
                        isManager: row.isManager,
                        description: row.description,
                        status: row.status,
                        updatedByAccountId: user.accountId,
                    },
                },
                {
                    new: true,
                    runValidators: true,
                    context: "query",
                },
            ).lean()

            existingPositionByDepartmentMap.set(
                positionDepartmentKey,
                updatedPosition,
            )
            positionByBranchMap.set(positionBranchKey, updatedPosition)
            summary.updated += 1
        } else {
            const createdPosition = await Position.create({
                companyId: row.company._id,
                branchId: row.branch._id,
                departmentId: row.department._id,
                reportsToPositionId: null,
                code: row.positionCode,
                title: row.positionTitle,
                shortName: row.shortName,
                level: row.level,
                isManager: row.isManager,
                description: row.description,
                status: row.status,
                createdByAccountId: user.accountId,
                updatedByAccountId: user.accountId,
            })

            existingPositionByDepartmentMap.set(
                positionDepartmentKey,
                createdPosition.toObject(),
            )
            positionByBranchMap.set(positionBranchKey, createdPosition.toObject())
            summary.created += 1
        }
    }

    for (const row of resolvedRows) {
        const positionDepartmentKey = makePositionDepartmentKey(
            row.department._id,
            row.positionCode,
        )

        const position = existingPositionByDepartmentMap.get(
            positionDepartmentKey,
        )

        if (!row.reportsToPositionCode) {
            await Position.findByIdAndUpdate(position._id, {
                $set: {
                    reportsToPositionId: null,
                    updatedByAccountId: user.accountId,
                },
            })

            continue
        }

        if (row.reportsToPositionCode === row.positionCode) {
            errors.push(
                buildImportError(
                    row.rowNumber,
                    "reportsToPositionCode",
                    "errors.organization.position.reportsToSelf",
                ),
            )
            continue
        }

        const reportsToKey = makePositionBranchKey(
            row.branch._id,
            row.reportsToPositionCode,
        )

        const reportsToPosition = positionByBranchMap.get(reportsToKey)

        if (!reportsToPosition) {
            errors.push(
                buildImportError(
                    row.rowNumber,
                    "reportsToPositionCode",
                    "errors.organization.position.reportsToNotFound",
                ),
            )
            continue
        }

        await Position.findByIdAndUpdate(position._id, {
            $set: {
                reportsToPositionId: reportsToPosition._id,
                updatedByAccountId: user.accountId,
            },
        })
    }

    if (errors.length > 0) {
        summary.errors = errors
    }

    clearCacheByPrefix("position:list:")

    return summary
}

export async function getExportPositions({ query, user }) {
    const result = await listPositions({
        query: {
            ...query,
            page: 1,
            limit: 10000,
        },
        user,
    })

    return result.items
}