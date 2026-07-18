import ExcelJS from "exceljs"

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
    "lineCode",
    "lineName",
    "leaderPositionCode",
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

function buildImportError(rowNumber, field, messageKey) {
    return {
        rowNumber,
        field,
        messageKey,
    }
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
            code: "ORGANIZATION_LINE_IMPORT_INVALID_TEMPLATE",
            messageKey: "errors.organization.lineImport.invalidTemplate",
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
        { header: "departmentCode", key: "departmentCode", width: 20 },
        { header: "lineCode", key: "lineCode", width: 18 },
        { header: "lineName", key: "lineName", width: 30 },
        {
            header: "leaderPositionCode",
            key: "leaderPositionCode",
            width: 24,
        },
        { header: "status", key: "status", width: 14 },
        { header: "description", key: "description", width: 44 },
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

    return {
        workbook,
        worksheet,
    }
}

export async function buildLineImportTemplateWorkbook() {
    const { workbook, worksheet } = buildWorkbookBase("Line Import")

    worksheet.addRow({
        companyCode: "TRAX",
        branchCode: "PP-HQ",
        departmentCode: "SEWING",
        lineCode: "LINE_A",
        lineName: "Sewing Line A",
        leaderPositionCode: "LINE_LEADER",
        status: "ACTIVE",
        description: "Main sewing production line A",
    })

    worksheet.addRow({
        companyCode: "TRAX",
        branchCode: "PP-HQ",
        departmentCode: "SEWING",
        lineCode: "LINE_B",
        lineName: "Sewing Line B",
        leaderPositionCode: "",
        status: "ACTIVE",
        description: "All active positions in this department are automatically allowed.",
    })

    const instructionSheet = workbook.addWorksheet("Instructions")

    instructionSheet.columns = [
        { header: "Field", key: "field", width: 28 },
        { header: "Required", key: "required", width: 14 },
        { header: "Rule", key: "rule", width: 90 },
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
            field: "lineCode",
            required: "Yes",
            rule: "Unique inside selected company, branch, and department.",
        },
        {
            field: "lineName",
            required: "Yes",
            rule: "Line display name.",
        },
        {
            field: "leaderPositionCode",
            required: "No",
            rule: "Optional. Must be an active position in the same department. All department positions are automatically allowed.",
        },
        {
            field: "status",
            required: "No",
            rule: "ACTIVE or INACTIVE. Blank means ACTIVE.",
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

export async function buildLineExportWorkbook({ lines }) {
    const { workbook, worksheet } = buildWorkbookBase("Lines")

    for (const line of lines) {
        worksheet.addRow({
            companyCode: line.company?.code || "",
            branchCode: line.branch?.code || "",
            departmentCode: line.department?.code || "",
            lineCode: line.code || "",
            lineName: line.name || "",
            leaderPositionCode: line.leaderPosition?.code || "",
            status: line.status || "",
            description: line.description || "",
        })
    }

    return workbook
}

export async function parseLineImportWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

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
        if (rowNumber === 1) {
            return
        }

        const raw = getRowObject(row)

        const isEmptyRow = Object.entries(raw).every(([, value]) => {
            return String(value || "").trim() === ""
        })

        if (isEmptyRow) {
            return
        }

        const normalized = {
            rowNumber,
            companyCode: normalizeCode(raw.companyCode),
            branchCode: normalizeCode(raw.branchCode),
            departmentCode: normalizeCode(raw.departmentCode),
            lineCode: normalizeCode(raw.lineCode),
            lineName: normalizeText(raw.lineName),
            leaderPositionCode: normalizeCode(raw.leaderPositionCode),
            status: normalizeStatus(raw.status),
            description: normalizeText(raw.description),
        }

        if (!normalized.companyCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "companyCode",
                    "errors.organization.lineImport.companyCodeRequired",
                ),
            )
        }

        if (!normalized.branchCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "branchCode",
                    "errors.organization.lineImport.branchCodeRequired",
                ),
            )
        }

        if (!normalized.departmentCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "departmentCode",
                    "errors.organization.lineImport.departmentCodeRequired",
                ),
            )
        }

        if (!normalized.lineCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "lineCode",
                    "errors.organization.lineImport.lineCodeRequired",
                ),
            )
        }

        if (!normalized.lineName) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "lineName",
                    "errors.organization.lineImport.lineNameRequired",
                ),
            )
        }

        if (!normalized.status) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "status",
                    "errors.organization.lineImport.statusInvalid",
                ),
            )
        }

        rows.push(normalized)
    })

    if (rows.length === 0) {
        errors.push(
            buildImportError(
                1,
                "file",
                "errors.organization.lineImport.noDataRows",
            ),
        )
    }

    return {
        rows,
        errors,
    }
}

async function buildCompanyMap(companyCodes) {
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

async function buildPositionMap(departmentIds) {
    const positions = await Position.find({
        departmentId: { $in: [...departmentIds] },
        status: { $ne: "ARCHIVED" },
    }).lean()

    return new Map(
        positions.map((position) => [
            `${position.departmentId.toString()}::${position.code}`,
            position,
        ]),
    )
}

async function buildLineMap(departmentIds) {
    const lines = await Line.find({
        departmentId: { $in: [...departmentIds] },
        status: { $ne: "ARCHIVED" },
    }).lean()

    return new Map(
        lines.map((line) => [
            `${line.departmentId.toString()}::${line.code}`,
            line,
        ]),
    )
}

function makeDepartmentLineKey(departmentId, lineCode) {
    return `${departmentId.toString()}::${lineCode}`
}

function makeDepartmentPositionKey(departmentId, positionCode) {
    return `${departmentId.toString()}::${positionCode}`
}

export async function importLinesFromRows({
    rows,
    parseErrors,
    user,
    workspace,
}) {
    const summary = {
        totalRows: rows.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [...parseErrors],
    }

    if (summary.errors.length > 0) {
        summary.skipped = rows.length
        return summary
    }

    const companyCodes = new Set(rows.map((row) => row.companyCode))
    const branchCodes = new Set(rows.map((row) => row.branchCode))
    const departmentCodes = new Set(rows.map((row) => row.departmentCode))

    const companyMap = await buildCompanyMap(companyCodes)

    for (const row of rows) {
        const company = companyMap.get(row.companyCode)

        if (
            !company ||
            company._id.toString() !== workspace.companyId.toString()
        ) {
            summary.errors.push(
                buildImportError(
                    row.rowNumber,
                    "companyCode",
                    "errors.organization.lineImport.companyNotFound",
                ),
            )
        }
    }

    if (summary.errors.length > 0) {
        summary.skipped = rows.length
        return summary
    }

    const companyIds = new Set(
        [...companyMap.values()].map((company) => company._id),
    )

    const branchMap = await buildBranchMap({
        branchCodes,
        companyIds,
    })

    const branchRows = rows.map((row) => {
        const company = companyMap.get(row.companyCode)
        const branch = branchMap.get(
            `${company._id.toString()}::${row.branchCode}`,
        )

        if (
            !branch ||
            branch._id.toString() !== workspace.branchId.toString()
        ) {
            summary.errors.push(
                buildImportError(
                    row.rowNumber,
                    "branchCode",
                    "errors.organization.lineImport.branchNotFound",
                ),
            )
        }

        return {
            ...row,
            company,
            branch,
        }
    })

    if (summary.errors.length > 0) {
        summary.skipped = rows.length
        return summary
    }

    const branchIds = new Set(branchRows.map((row) => row.branch._id))

    const departmentMap = await buildDepartmentMap({
        departmentCodes,
        branchIds,
    })

    const resolvedRows = branchRows.map((row) => {
        const department = departmentMap.get(
            `${row.branch._id.toString()}::${row.departmentCode}`,
        )

        if (!department) {
            summary.errors.push(
                buildImportError(
                    row.rowNumber,
                    "departmentCode",
                    "errors.organization.lineImport.departmentNotFound",
                ),
            )
        }

        return {
            ...row,
            department,
        }
    })

    if (summary.errors.length > 0) {
        summary.skipped = rows.length
        return summary
    }

    const departmentIds = new Set(resolvedRows.map((row) => row.department._id))
    const positionMap = await buildPositionMap(departmentIds)
    const lineMap = await buildLineMap(departmentIds)
    const seenLineKeys = new Set()

    for (const row of resolvedRows) {
        const lineKey = makeDepartmentLineKey(row.department._id, row.lineCode)

        if (seenLineKeys.has(lineKey)) {
            summary.errors.push(
                buildImportError(
                    row.rowNumber,
                    "lineCode",
                    "errors.organization.lineImport.duplicateInFile",
                ),
            )
        }

        seenLineKeys.add(lineKey)

        if (row.leaderPositionCode) {
            const leaderPosition = positionMap.get(
                makeDepartmentPositionKey(
                    row.department._id,
                    row.leaderPositionCode,
                ),
            )

            if (!leaderPosition) {
                summary.errors.push(
                    buildImportError(
                        row.rowNumber,
                        "leaderPositionCode",
                        "errors.organization.lineImport.leaderPositionNotFound",
                    ),
                )
            } else {
                row.leaderPositionId = leaderPosition._id
            }

        } else {
            row.leaderPositionId = null
        }
    }

    if (summary.errors.length > 0) {
        summary.skipped = rows.length
        return summary
    }

    for (const row of resolvedRows) {
        const lineKey = makeDepartmentLineKey(row.department._id, row.lineCode)
        const existingLine = lineMap.get(lineKey)

        if (existingLine) {
            const updatedLine = await Line.findByIdAndUpdate(
                existingLine._id,
                {
                    $set: {
                        name: row.lineName,
                        allowedPositionIds: [],
                        leaderPositionId: row.leaderPositionId,
                        status: row.status,
                        description: row.description,
                        updatedByAccountId: user.accountId,
                    },
                },
                {
                    new: true,
                    runValidators: true,
                    context: "query",
                },
            ).lean()

            lineMap.set(lineKey, updatedLine)
            summary.updated += 1
        } else {
            const createdLine = await Line.create({
                companyId: row.company._id,
                branchId: row.branch._id,
                departmentId: row.department._id,
                code: row.lineCode,
                name: row.lineName,
                allowedPositionIds: [],
                leaderPositionId: row.leaderPositionId,
                status: row.status,
                description: row.description,
                createdByAccountId: user.accountId,
                updatedByAccountId: user.accountId,
            })

            lineMap.set(lineKey, createdLine.toObject())
            summary.created += 1
        }
    }

    clearCacheByPrefix("line:list:")

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
