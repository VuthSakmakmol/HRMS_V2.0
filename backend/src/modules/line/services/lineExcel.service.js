import ExcelJS from "exceljs"
import mongoose from "mongoose"

import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Company from "../../organization/models/Company.js"
import Branch from "../../organization/models/Branch.js"
import Line from "../models/Line.js"
import { listLines } from "./line.service.js"

const TEMPLATE_HEADERS = [
    "companyCode",
    "branchCode",
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

function buildImportError(rowNumber, field, messageKey, details = {}) {
    return {
        rowNumber,
        field,
        messageKey,
        ...details,
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
        { header: "lineCode", key: "lineCode", width: 18 },
        { header: "lineName", key: "lineName", width: 30 },
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
        lineCode: "LINE_A",
        lineName: "Sewing Line A",
        status: "ACTIVE",
        description: "Main sewing production line A",
    })

    worksheet.addRow({
        companyCode: "TRAX",
        branchCode: "PP-HQ",
        lineCode: "LINE_B",
        lineName: "Sewing Line B",
        status: "ACTIVE",
        description: "Available to every employee in the selected branch.",
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
            field: "lineCode",
            required: "Yes",
            rule: "Unique inside the selected company and branch.",
        },
        {
            field: "lineName",
            required: "Yes",
            rule: "Line display name.",
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
            lineCode: normalizeCode(raw.lineCode),
            lineName: normalizeText(raw.lineName),
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

function mongooseValidationErrors(error, row) {
    if (!error?.errors) {
        return [
            buildImportError(
                row.rowNumber,
                "row",
                "errors.organization.lineImport.rowInvalid",
                { received: row.lineCode },
            ),
        ]
    }

    return Object.values(error.errors).map((item) =>
        buildImportError(
            row.rowNumber,
            item.path || "row",
            "errors.organization.lineImport.fieldInvalid",
            {
                received: item.value ?? "",
                reason: item.message,
            },
        ),
    )
}

async function validateResolvedRows({ rows, company, branch, user }) {
    const errors = []

    for (const [index, row] of rows.entries()) {
        const candidate = new Line({
            companyId: company._id,
            branchId: branch._id,
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

    if (summary.errors.length > 0) {
        summary.skipped = rows.length
        onProgress?.({ phase: "VALIDATED", percent: 55, processedRows: rows.length, totalRows: rows.length })
        return summary
    }

    const [company, branch, existingLines] = await Promise.all([
        Company.findOne({ _id: workspace.companyId, status: { $ne: "ARCHIVED" } }).lean(),
        Branch.findOne({ _id: workspace.branchId, companyId: workspace.companyId, status: { $ne: "ARCHIVED" } }).lean(),
        Line.find({ companyId: workspace.companyId, branchId: workspace.branchId, status: { $ne: "ARCHIVED" } }).lean(),
    ])

    if (!company || !branch) {
        summary.errors.push(buildImportError(1, "workspace", "errors.organization.line.workspaceRequired"))
        summary.skipped = rows.length
        return summary
    }

    const resolvedRows = rows.map((row) => {
        if (row.companyCode !== company.code) {
            summary.errors.push(buildImportError(row.rowNumber, "companyCode", "errors.organization.lineImport.companyNotFound"))
        }
        if (row.branchCode !== branch.code) {
            summary.errors.push(buildImportError(row.rowNumber, "branchCode", "errors.organization.lineImport.branchNotFound"))
        }
        return { ...row, company, branch }
    })

    if (summary.errors.length > 0) {
        summary.skipped = rows.length
        return summary
    }
    const lineMap = new Map(existingLines.map((line) => [line.code, line]))
    const seenLineKeys = new Set()

    for (const row of resolvedRows) {
        const lineKey = row.lineCode

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

    }

    if (summary.errors.length > 0) {
        summary.skipped = rows.length
        return summary
    }

    onProgress?.({
        phase: "VALIDATING_ROWS",
        percent: 35,
        processedRows: 0,
        totalRows: resolvedRows.length,
        messageKey: "organization.line.importPhaseValidatingRows",
    })

    const modelErrors = await validateResolvedRows({
        rows: resolvedRows,
        company,
        branch,
        user,
    })

    if (modelErrors.length > 0) {
        summary.errors.push(...modelErrors)
        summary.skipped = rows.length
        return summary
    }

    const operations = resolvedRows.map((row) => ({
        updateOne: {
            filter: {
                companyId: company._id,
                branchId: branch._id,
                code: row.lineCode,
            },
            update: {
                $set: {
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
        percent: 75,
        processedRows: 0,
        totalRows: resolvedRows.length,
        messageKey: "organization.line.importPhaseSavingRows",
    })

    const session = await mongoose.startSession()
    let writeResult

    try {
        await session.withTransaction(async () => {
            writeResult = await Line.bulkWrite(operations, {
                ordered: true,
                session,
            })
        })
    } finally {
        await session.endSession()
    }

    summary.created = Number(writeResult?.upsertedCount ?? 0)
    summary.updated = resolvedRows.length - summary.created

    onProgress?.({
        phase: "SAVING_ROWS",
        percent: 95,
        processedRows: resolvedRows.length,
        totalRows: resolvedRows.length,
        messageKey: "organization.line.importPhaseSavingRows",
    })

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
