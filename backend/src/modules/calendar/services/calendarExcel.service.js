import ExcelJS from "exceljs"

import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"
import Branch from "../../organization/models/Branch.js"
import Company from "../../organization/models/Company.js"
import CalendarDay from "../models/CalendarDay.js"
import { getExportCalendarDays } from "./calendar.service.js"

const TEMPLATE_HEADERS = [
    "date",
    "scopeLevel",
    "companyCode",
    "branchCode",
    "dayType",
    "name",
    "holidayCategory",
    "isPaidHoliday",
    "status",
    "description",
]

const DAY_TYPES = [
    "WORKING_DAY",
    "WEEKEND",
    "HOLIDAY",
    "SPECIAL_WORKING_DAY",
    "COMPANY_EVENT",
    "CLOSED_DAY",
]

const SCOPE_LEVELS = ["GLOBAL", "COMPANY", "BRANCH"]
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

function normalizeDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10)
    }

    const raw = String(value || "").trim()

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw
    }

    return null
}

function normalizeBoolean(value) {
    const raw = normalizeCode(value)

    if (["TRUE", "YES", "Y", "1"].includes(raw)) {
        return true
    }

    if (["FALSE", "NO", "N", "0", ""].includes(raw)) {
        return false
    }

    return null
}

function getCellValue(row, index) {
    const cell = row.getCell(index)
    const value = cell.value

    if (value === null || value === undefined) {
        return ""
    }

    if (typeof value === "object") {
        if (value instanceof Date) {
            return value
        }

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
            code: "CALENDAR_IMPORT_INVALID_TEMPLATE",
            messageKey: "errors.calendar.import.invalidTemplate",
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
        { header: "date", key: "date", width: 16 },
        { header: "scopeLevel", key: "scopeLevel", width: 16 },
        { header: "companyCode", key: "companyCode", width: 18 },
        { header: "branchCode", key: "branchCode", width: 18 },
        { header: "dayType", key: "dayType", width: 24 },
        { header: "name", key: "name", width: 30 },
        { header: "holidayCategory", key: "holidayCategory", width: 22 },
        { header: "isPaidHoliday", key: "isPaidHoliday", width: 18 },
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

    return {
        workbook,
        worksheet,
    }
}

export async function buildCalendarImportTemplateWorkbook() {
    const { workbook, worksheet } = buildWorkbookBase("Calendar Import")

    worksheet.addRow({
        date: "2026-01-01",
        scopeLevel: "GLOBAL",
        companyCode: "",
        branchCode: "",
        dayType: "HOLIDAY",
        name: "International New Year Day",
        holidayCategory: "Public Holiday",
        isPaidHoliday: "YES",
        status: "ACTIVE",
        description: "Global holiday used by all companies and branches.",
    })

    worksheet.addRow({
        date: "2026-03-08",
        scopeLevel: "BRANCH",
        companyCode: "TRAX",
        branchCode: "PP-HQ",
        dayType: "SPECIAL_WORKING_DAY",
        name: "Special Working Sunday",
        holidayCategory: "Working Override",
        isPaidHoliday: "NO",
        status: "ACTIVE",
        description: "Branch override. This date becomes working day for this branch.",
    })

    const instructionSheet = workbook.addWorksheet("Instructions")
    instructionSheet.columns = [
        { header: "Field", key: "field", width: 26 },
        { header: "Required", key: "required", width: 14 },
        { header: "Rule", key: "rule", width: 100 },
    ]

    instructionSheet.addRows([
        { field: "date", required: "Yes", rule: "Use YYYY-MM-DD." },
        { field: "scopeLevel", required: "Yes", rule: "GLOBAL, COMPANY, or BRANCH." },
        { field: "companyCode", required: "For COMPANY/BRANCH", rule: "Must match existing active company code." },
        { field: "branchCode", required: "For BRANCH", rule: "Must match existing active branch code in company." },
        { field: "dayType", required: "Yes", rule: DAY_TYPES.join(", ") },
        { field: "name", required: "Yes", rule: "Holiday/calendar name." },
        { field: "holidayCategory", required: "No", rule: "Example: Public Holiday, Factory Event, Working Override." },
        { field: "isPaidHoliday", required: "No", rule: "YES/NO. Blank means NO." },
        { field: "status", required: "No", rule: "ACTIVE or INACTIVE. Blank means ACTIVE." },
        { field: "description", required: "No", rule: "Optional notes." },
    ])

    instructionSheet.getRow(1).font = { bold: true }

    return workbook
}

export async function buildCalendarExportWorkbook({ days }) {
    const { workbook, worksheet } = buildWorkbookBase("Calendar Days")

    for (const day of days) {
        worksheet.addRow({
            date: day.dateKey,
            scopeLevel: day.scopeLevel,
            companyCode: day.company?.code || "",
            branchCode: day.branch?.code || "",
            dayType: day.dayType,
            name: day.name,
            holidayCategory: day.holidayCategory || "",
            isPaidHoliday: day.isPaidHoliday ? "YES" : "NO",
            status: day.status,
            description: day.description || "",
        })
    }

    return workbook
}

export async function parseCalendarImportWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const worksheet = workbook.worksheets[0]

    if (!worksheet) {
        throw new AppError({
            statusCode: 422,
            code: "CALENDAR_IMPORT_EMPTY_FILE",
            messageKey: "errors.calendar.import.emptyFile",
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
            dateKey: normalizeDate(raw.date),
            scopeLevel: normalizeCode(raw.scopeLevel || "GLOBAL"),
            companyCode: normalizeCode(raw.companyCode),
            branchCode: normalizeCode(raw.branchCode),
            dayType: normalizeCode(raw.dayType),
            name: normalizeText(raw.name),
            holidayCategory: normalizeText(raw.holidayCategory),
            isPaidHoliday: normalizeBoolean(raw.isPaidHoliday),
            status: normalizeCode(raw.status || "ACTIVE"),
            description: normalizeText(raw.description),
        }

        if (!normalized.dateKey) {
            errors.push(buildImportError(rowNumber, "date", "errors.calendar.import.dateInvalid"))
        }

        if (!SCOPE_LEVELS.includes(normalized.scopeLevel)) {
            errors.push(buildImportError(rowNumber, "scopeLevel", "errors.calendar.import.scopeLevelInvalid"))
        }

        if (normalized.scopeLevel !== "GLOBAL" && !normalized.companyCode) {
            errors.push(buildImportError(rowNumber, "companyCode", "errors.calendar.import.companyCodeRequired"))
        }

        if (normalized.scopeLevel === "BRANCH" && !normalized.branchCode) {
            errors.push(buildImportError(rowNumber, "branchCode", "errors.calendar.import.branchCodeRequired"))
        }

        if (!DAY_TYPES.includes(normalized.dayType)) {
            errors.push(buildImportError(rowNumber, "dayType", "errors.calendar.import.dayTypeInvalid"))
        }

        if (!normalized.name) {
            errors.push(buildImportError(rowNumber, "name", "errors.calendar.import.nameRequired"))
        }

        if (normalized.isPaidHoliday === null) {
            errors.push(buildImportError(rowNumber, "isPaidHoliday", "errors.calendar.import.paidHolidayInvalid"))
        }

        if (!STATUS_VALUES.includes(normalized.status)) {
            errors.push(buildImportError(rowNumber, "status", "errors.calendar.import.statusInvalid"))
        }

        rows.push(normalized)
    })

    if (rows.length === 0) {
        errors.push(buildImportError(1, "file", "errors.calendar.import.noDataRows"))
    }

    return { rows, errors }
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

function makeScopeKey(row) {
    if (row.scopeLevel === "GLOBAL") {
        return "GLOBAL"
    }

    if (row.scopeLevel === "COMPANY") {
        return `COMPANY:${row.company._id.toString()}`
    }

    return `BRANCH:${row.branch._id.toString()}`
}

function makeCalendarKey(scopeKey, dateKey) {
    return `${scopeKey}::${dateKey}`
}

function hasGlobalScope(user) {
    return Boolean(user?.isRootAdmin) || (user?.roleAssignments || []).some(
        (assignment) => assignment.roleScope === "GLOBAL",
    )
}

export async function importCalendarDaysFromRows({
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

    const companyCodes = new Set(rows.map((row) => row.companyCode).filter(Boolean))
    const branchCodes = new Set(rows.map((row) => row.branchCode).filter(Boolean))
    const companyMap = await buildCompanyMap(companyCodes)

    for (const row of rows) {
        const company = companyMap.get(row.companyCode)

        if (row.scopeLevel === "GLOBAL" && !hasGlobalScope(user)) {
            summary.errors.push(buildImportError(row.rowNumber, "scopeLevel", "errors.organization.calendar.import.globalScopeForbidden"))
        } else if (
            row.scopeLevel !== "GLOBAL" &&
            (!company || company._id.toString() !== workspace.companyId.toString())
        ) {
            summary.errors.push(buildImportError(row.rowNumber, "companyCode", "errors.calendar.import.companyNotFound"))
        }
    }

    if (summary.errors.length > 0) {
        summary.skipped = rows.length
        return summary
    }

    const companyIds = new Set([...companyMap.values()].map((company) => company._id))
    const branchMap = await buildBranchMap({ branchCodes, companyIds })

    const resolvedRows = rows.map((row) => {
        if (row.scopeLevel === "GLOBAL") {
            return { ...row, company: null, branch: null }
        }

        const company = companyMap.get(row.companyCode)

        if (row.scopeLevel === "COMPANY") {
            return { ...row, company, branch: null }
        }

        const branch = branchMap.get(`${company._id.toString()}::${row.branchCode}`)

        if (
            !branch ||
            branch._id.toString() !== workspace.branchId.toString()
        ) {
            summary.errors.push(buildImportError(row.rowNumber, "branchCode", "errors.calendar.import.branchNotFound"))
        }

        return { ...row, company, branch }
    })

    if (summary.errors.length > 0) {
        summary.skipped = rows.length
        return summary
    }

    const seenKeys = new Set()
    const scopeKeys = []

    for (const row of resolvedRows) {
        row.scopeKey = makeScopeKey(row)
        const key = makeCalendarKey(row.scopeKey, row.dateKey)

        if (seenKeys.has(key)) {
            summary.errors.push(buildImportError(row.rowNumber, "date", "errors.calendar.import.duplicateInFile"))
        }

        seenKeys.add(key)
        scopeKeys.push(row.scopeKey)
    }

    if (summary.errors.length > 0) {
        summary.skipped = rows.length
        return summary
    }

    const existingDays = await CalendarDay.find({
        scopeKey: { $in: [...new Set(scopeKeys)] },
        dateKey: { $in: resolvedRows.map((row) => row.dateKey) },
        status: { $ne: "ARCHIVED" },
    }).lean()

    const existingMap = new Map(existingDays.map((day) => [makeCalendarKey(day.scopeKey, day.dateKey), day]))

    for (const row of resolvedRows) {
        const key = makeCalendarKey(row.scopeKey, row.dateKey)
        const existing = existingMap.get(key)

        if (existing) {
            const updated = await CalendarDay.findByIdAndUpdate(
                existing._id,
                {
                    $set: {
                        dayType: row.dayType,
                        name: row.name,
                        holidayCategory: row.holidayCategory,
                        isPaidHoliday: row.isPaidHoliday,
                        description: row.description,
                        status: row.status,
                        updatedByAccountId: user.accountId,
                    },
                },
                { new: true, runValidators: true, context: "query" },
            ).lean()

            existingMap.set(key, updated)
            summary.updated += 1
        } else {
            const created = await CalendarDay.create({
                scopeLevel: row.scopeLevel,
                scopeKey: row.scopeKey,
                companyId: row.company?._id || null,
                branchId: row.branch?._id || null,
                dateKey: row.dateKey,
                dayType: row.dayType,
                name: row.name,
                holidayCategory: row.holidayCategory,
                isPaidHoliday: row.isPaidHoliday,
                description: row.description,
                status: row.status,
                createdByAccountId: user.accountId,
                updatedByAccountId: user.accountId,
            })

            existingMap.set(key, created.toObject())
            summary.created += 1
        }
    }

    clearCacheByPrefix("calendar:")

    return summary
}

export async function getCalendarExportRows({ query, user }) {
    return getExportCalendarDays({ query, user })
}
