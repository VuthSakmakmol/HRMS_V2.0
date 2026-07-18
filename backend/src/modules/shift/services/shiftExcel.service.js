import ExcelJS from "exceljs"

import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Company from "../../organization/models/Company.js"
import Branch from "../../organization/models/Branch.js"

import Shift from "../models/Shift.js"
import { listShifts } from "./shift.service.js"

const TEMPLATE_HEADERS = [
    "companyCode",
    "branchCode",
    "shiftCode",
    "shiftName",
    "shortName",
    "startTime",
    "endTime",
    "breakStartTime",
    "breakEndTime",
    "graceInMinutes",
    "graceOutMinutes",
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

function normalizeTime(value) {
    const raw = String(value || "").trim()

    if (!raw) {
        return ""
    }

    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) {
        return raw
    }

    return null
}

function normalizeStatus(value) {
    const status = normalizeCode(value || "ACTIVE")
    return STATUS_VALUES.includes(status) ? status : null
}

function normalizeInteger(value, defaultValue = 0) {
    const raw = String(value ?? "").trim()

    if (!raw) {
        return defaultValue
    }

    const numberValue = Number(raw)

    if (!Number.isInteger(numberValue) || numberValue < 0 || numberValue > 240) {
        return null
    }

    return numberValue
}

function parseTimeToMinutes(time) {
    const [hour, minute] = String(time).split(":").map(Number)
    return hour * 60 + minute
}

function calculateDurationMinutes(startTime, endTime) {
    const startMinutes = parseTimeToMinutes(startTime)
    let endMinutes = parseTimeToMinutes(endTime)

    if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60
    }

    return endMinutes - startMinutes
}

function calculateShiftTiming(row) {
    const totalMinutes = calculateDurationMinutes(row.startTime, row.endTime)

    if (totalMinutes <= 0 || totalMinutes > 1440) {
        return null
    }

    let breakMinutes = 0

    if (row.breakStartTime && row.breakEndTime) {
        breakMinutes = calculateDurationMinutes(
            row.breakStartTime,
            row.breakEndTime,
        )

        if (breakMinutes < 0 || breakMinutes >= totalMinutes) {
            return null
        }
    }

    return {
        totalMinutes,
        breakMinutes,
        workingMinutes: totalMinutes - breakMinutes,
        isOvernight:
            parseTimeToMinutes(row.endTime) <= parseTimeToMinutes(row.startTime),
    }
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
            code: "ORGANIZATION_SHIFT_IMPORT_INVALID_TEMPLATE",
            messageKey: "errors.organization.shiftImport.invalidTemplate",
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
        { header: "shiftCode", key: "shiftCode", width: 18 },
        { header: "shiftName", key: "shiftName", width: 28 },
        { header: "shortName", key: "shortName", width: 18 },
        { header: "startTime", key: "startTime", width: 14 },
        { header: "endTime", key: "endTime", width: 14 },
        { header: "breakStartTime", key: "breakStartTime", width: 18 },
        { header: "breakEndTime", key: "breakEndTime", width: 18 },
        { header: "graceInMinutes", key: "graceInMinutes", width: 18 },
        { header: "graceOutMinutes", key: "graceOutMinutes", width: 18 },
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

export async function buildShiftImportTemplateWorkbook() {
    const { workbook, worksheet } = buildWorkbookBase("Shift Import")

    worksheet.addRow({
        companyCode: "TRAX",
        branchCode: "PP-HQ",
        shiftCode: "DAY",
        shiftName: "Day Shift",
        shortName: "Day",
        startTime: "07:00",
        endTime: "16:00",
        breakStartTime: "12:00",
        breakEndTime: "13:00",
        graceInMinutes: 5,
        graceOutMinutes: 0,
        status: "ACTIVE",
        description: "Normal day shift",
    })

    worksheet.addRow({
        companyCode: "TRAX",
        branchCode: "PP-HQ",
        shiftCode: "NIGHT",
        shiftName: "Night Shift",
        shortName: "Night",
        startTime: "19:00",
        endTime: "04:00",
        breakStartTime: "00:00",
        breakEndTime: "01:00",
        graceInMinutes: 5,
        graceOutMinutes: 0,
        status: "ACTIVE",
        description: "Night shift crossing midnight",
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
            field: "shiftCode",
            required: "Yes",
            rule: "Unique inside selected company and branch.",
        },
        {
            field: "shiftName",
            required: "Yes",
            rule: "Shift display name.",
        },
        {
            field: "shortName",
            required: "No",
            rule: "Optional short name.",
        },
        {
            field: "startTime",
            required: "Yes",
            rule: "Use HH:mm format. Example: 07:00.",
        },
        {
            field: "endTime",
            required: "Yes",
            rule: "Use HH:mm format. If end time is earlier than start time, backend treats it as overnight shift.",
        },
        {
            field: "breakStartTime",
            required: "No",
            rule: "Use HH:mm format. Must be filled together with breakEndTime.",
        },
        {
            field: "breakEndTime",
            required: "No",
            rule: "Use HH:mm format. Must be filled together with breakStartTime.",
        },
        {
            field: "graceInMinutes",
            required: "No",
            rule: "0-240. Blank means 0.",
        },
        {
            field: "graceOutMinutes",
            required: "No",
            rule: "0-240. Blank means 0.",
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

export async function buildShiftExportWorkbook({ shifts }) {
    const { workbook, worksheet } = buildWorkbookBase("Shifts")

    for (const shift of shifts) {
        worksheet.addRow({
            companyCode: shift.company?.code || "",
            branchCode: shift.branch?.code || "",
            shiftCode: shift.code || "",
            shiftName: shift.name || "",
            shortName: shift.shortName || "",
            startTime: shift.startTime || "",
            endTime: shift.endTime || "",
            breakStartTime: shift.breakStartTime || "",
            breakEndTime: shift.breakEndTime || "",
            graceInMinutes: shift.graceInMinutes ?? 0,
            graceOutMinutes: shift.graceOutMinutes ?? 0,
            status: shift.status || "",
            description: shift.description || "",
        })
    }

    return workbook
}

export async function parseShiftImportWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const worksheet = workbook.worksheets[0]

    if (!worksheet) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_SHIFT_IMPORT_EMPTY_FILE",
            messageKey: "errors.organization.shiftImport.emptyFile",
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
            shiftCode: normalizeCode(raw.shiftCode),
            shiftName: normalizeText(raw.shiftName),
            shortName: normalizeText(raw.shortName),
            startTime: normalizeTime(raw.startTime),
            endTime: normalizeTime(raw.endTime),
            breakStartTime: normalizeTime(raw.breakStartTime),
            breakEndTime: normalizeTime(raw.breakEndTime),
            graceInMinutes: normalizeInteger(raw.graceInMinutes, 0),
            graceOutMinutes: normalizeInteger(raw.graceOutMinutes, 0),
            status: normalizeStatus(raw.status),
            description: normalizeText(raw.description),
        }

        if (!normalized.companyCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "companyCode",
                    "errors.organization.shiftImport.companyCodeRequired",
                ),
            )
        }

        if (!normalized.branchCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "branchCode",
                    "errors.organization.shiftImport.branchCodeRequired",
                ),
            )
        }

        if (!normalized.shiftCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "shiftCode",
                    "errors.organization.shiftImport.shiftCodeRequired",
                ),
            )
        }

        if (!normalized.shiftName) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "shiftName",
                    "errors.organization.shiftImport.shiftNameRequired",
                ),
            )
        }

        if (!normalized.startTime) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "startTime",
                    "errors.organization.shiftImport.startTimeInvalid",
                ),
            )
        }

        if (!normalized.endTime) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "endTime",
                    "errors.organization.shiftImport.endTimeInvalid",
                ),
            )
        }

        const hasBreakStart = Boolean(normalized.breakStartTime)
        const hasBreakEnd = Boolean(normalized.breakEndTime)

        if (hasBreakStart !== hasBreakEnd) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "breakStartTime",
                    "errors.organization.shiftImport.breakTimePairRequired",
                ),
            )
        }

        if (normalized.graceInMinutes === null) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "graceInMinutes",
                    "errors.organization.shiftImport.graceMinutesInvalid",
                ),
            )
        }

        if (normalized.graceOutMinutes === null) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "graceOutMinutes",
                    "errors.organization.shiftImport.graceMinutesInvalid",
                ),
            )
        }

        if (!normalized.status) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "status",
                    "errors.organization.shiftImport.statusInvalid",
                ),
            )
        }

        const canCalculateTiming =
            normalized.startTime &&
            normalized.endTime &&
            hasBreakStart === hasBreakEnd

        if (canCalculateTiming) {
            const timing = calculateShiftTiming(normalized)

            if (!timing) {
                errors.push(
                    buildImportError(
                        rowNumber,
                        "endTime",
                        "errors.organization.shiftImport.invalidTimeRange",
                    ),
                )
            } else {
                normalized.timing = timing
            }
        }

        rows.push(normalized)
    })

    if (rows.length === 0) {
        errors.push(
            buildImportError(
                1,
                "file",
                "errors.organization.shiftImport.noDataRows",
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

async function buildShiftMap(branchIds) {
    const shifts = await Shift.find({
        branchId: { $in: [...branchIds] },
        status: { $ne: "ARCHIVED" },
    }).lean()

    return new Map(
        shifts.map((shift) => [
            `${shift.branchId.toString()}::${shift.code}`,
            shift,
        ]),
    )
}

function makeBranchShiftKey(branchId, shiftCode) {
    return `${branchId.toString()}::${shiftCode}`
}

export async function importShiftsFromRows({
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
                    "errors.organization.shiftImport.companyNotFound",
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

    const resolvedRows = rows.map((row) => {
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
                    "errors.organization.shiftImport.branchNotFound",
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

    const branchIds = new Set(resolvedRows.map((row) => row.branch._id))
    const shiftMap = await buildShiftMap(branchIds)
    const seenShiftKeys = new Set()

    for (const row of resolvedRows) {
        const shiftKey = makeBranchShiftKey(row.branch._id, row.shiftCode)

        if (seenShiftKeys.has(shiftKey)) {
            summary.errors.push(
                buildImportError(
                    row.rowNumber,
                    "shiftCode",
                    "errors.organization.shiftImport.duplicateInFile",
                ),
            )
        }

        seenShiftKeys.add(shiftKey)
    }

    if (summary.errors.length > 0) {
        summary.skipped = rows.length
        return summary
    }

    for (const row of resolvedRows) {
        const shiftKey = makeBranchShiftKey(row.branch._id, row.shiftCode)
        const existingShift = shiftMap.get(shiftKey)

        if (existingShift) {
            const updatedShift = await Shift.findByIdAndUpdate(
                existingShift._id,
                {
                    $set: {
                        name: row.shiftName,
                        shortName: row.shortName,
                        startTime: row.startTime,
                        endTime: row.endTime,
                        breakStartTime: row.breakStartTime || "",
                        breakEndTime: row.breakEndTime || "",
                        totalMinutes: row.timing.totalMinutes,
                        breakMinutes: row.timing.breakMinutes,
                        workingMinutes: row.timing.workingMinutes,
                        isOvernight: row.timing.isOvernight,
                        graceInMinutes: row.graceInMinutes,
                        graceOutMinutes: row.graceOutMinutes,
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

            shiftMap.set(shiftKey, updatedShift)
            summary.updated += 1
        } else {
            const createdShift = await Shift.create({
                companyId: row.company._id,
                branchId: row.branch._id,
                code: row.shiftCode,
                name: row.shiftName,
                shortName: row.shortName,
                startTime: row.startTime,
                endTime: row.endTime,
                breakStartTime: row.breakStartTime || "",
                breakEndTime: row.breakEndTime || "",
                totalMinutes: row.timing.totalMinutes,
                breakMinutes: row.timing.breakMinutes,
                workingMinutes: row.timing.workingMinutes,
                isOvernight: row.timing.isOvernight,
                graceInMinutes: row.graceInMinutes,
                graceOutMinutes: row.graceOutMinutes,
                status: row.status,
                description: row.description,
                createdByAccountId: user.accountId,
                updatedByAccountId: user.accountId,
            })

            shiftMap.set(shiftKey, createdShift.toObject())
            summary.created += 1
        }
    }

    clearCacheByPrefix("shift:list:")

    return summary
}

export async function getExportShifts({ query, user }) {
    const result = await listShifts({
        query: {
            ...query,
            page: 1,
            limit: 10000,
        },
        user,
    })

    return result.items
}
