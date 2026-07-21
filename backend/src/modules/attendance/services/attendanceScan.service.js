import crypto from "node:crypto"
import ExcelJS from "exceljs"

import AttendanceRawScan from "../models/AttendanceRawScan.js"
import Employee from "../../employee/models/Employee.js"
import { AppError } from "../../../shared/errors/AppError.js"
import { attendanceScopeFilter } from "../utils/attendanceScope.util.js"
import { endOfBusinessDay, startOfBusinessDay } from "../utils/attendanceDate.util.js"

function normalizeDirection(value) {
    const normalized = String(value || "").trim().toUpperCase()
    return ["IN", "OUT"].includes(normalized) ? normalized : "UNKNOWN"
}

function parseDateTime(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value
    }

    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function buildRawScanTemplate() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Raw Scans")

    sheet.columns = [
        { header: "Employee ID", key: "employeeCode", width: 18 },
        { header: "Scanned At", key: "scannedAt", width: 24 },
        { header: "Direction", key: "direction", width: 14 },
        { header: "Device Code", key: "deviceCode", width: 18 },
    ]

    sheet.addRow({
        employeeCode: "EMP001",
        scannedAt: "2026-07-11 07:55:00",
        direction: "IN",
        deviceCode: "GATE-01",
    })

    sheet.getRow(1).font = { bold: true }
    sheet.views = [{ state: "frozen", ySplit: 1 }]

    return workbook
}

export async function importRawScans({ buffer, user, companyId, branchId }) {
    if (!companyId || !branchId) {
        throw new AppError({
            statusCode: 422,
            code: "ATTENDANCE_WORKSPACE_REQUIRED",
            messageKey: "errors.attendance.workspaceRequired",
        })
    }
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const sheet = workbook.worksheets[0]
    const importBatchId = crypto.randomUUID()
    const parsedRows = []
    const errors = []

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
            return
        }

        const employeeCode = String(row.getCell(1).value || "")
            .trim()
            .toUpperCase()
        const scannedAt = parseDateTime(row.getCell(2).value)
        const direction = normalizeDirection(row.getCell(3).value)
        const deviceCode = String(row.getCell(4).value || "").trim()

        if (!employeeCode || !scannedAt) {
            errors.push({
                row: rowNumber,
                message: "Employee ID and a valid scan date/time are required.",
            })
            return
        }

        parsedRows.push({ employeeCode, scannedAt, direction, deviceCode, rowNumber })
    })

    const parseErrorCount = errors.length
    const totalRows = parsedRows.length + parseErrorCount
    const codes = [...new Set(parsedRows.map((row) => row.employeeCode))]
    const employees = await Employee.find({
        employeeCode: { $in: codes },
        companyId,
        branchId,
        recordStatus: "ACTIVE",
        ...attendanceScopeFilter(user),
    }).select("_id employeeCode companyId branchId").lean()
    const employeeMap = new Map(employees.map((employee) => [employee.employeeCode, employee]))

    for (const row of parsedRows) {
        if (!employeeMap.has(row.employeeCode)) {
            errors.push({ row: row.rowNumber, message: `Employee ${row.employeeCode} was not found in the active workspace.` })
        }
    }

    if (errors.length) {
        throw new AppError({
            statusCode: 422,
            code: "ATTENDANCE_SCAN_IMPORT_VALIDATION_FAILED",
            messageKey: "errors.attendance.importValidationFailed",
            details: { importSummary: { totalRows, importedCount: 0, duplicateCount: 0, errorCount: errors.length, errors } },
        })
    }

    const operations = parsedRows.map((row) => {
        const employee = employeeMap.get(row.employeeCode)
        return {
            updateOne: {
                filter: {
                    employeeCode: row.employeeCode,
                    scannedAt: row.scannedAt,
                    deviceCode: row.deviceCode,
                },
                update: {
                    $setOnInsert: {
                        employeeId: employee._id,
                        companyId: employee.companyId,
                        branchId: employee.branchId,
                        employeeCode: row.employeeCode,
                        scannedAt: row.scannedAt,
                        direction: row.direction,
                        deviceCode: row.deviceCode,
                        source: "EXCEL_IMPORT",
                        importBatchId,
                        createdByAccountId: user.accountId,
                    },
                },
                upsert: true,
            },
        }
    })

    let importedCount = 0

    if (operations.length > 0) {
        const result = await AttendanceRawScan.bulkWrite(operations, {
            ordered: false,
        })
        importedCount = result.upsertedCount || 0
    }

    return {
        importBatchId,
        totalRows,
        importedCount,
        duplicateCount: Math.max(0, operations.length - importedCount),
        errorCount: errors.length,
        errors,
    }
}

export async function listRawScans({ query, user }) {
    const start = startOfBusinessDay(query.dateFrom)
    const end = endOfBusinessDay(query.dateTo)
    const filter = {
        ...attendanceScopeFilter(user),
        scannedAt: {
            $gte: start,
            $lte: end,
        },
    }

    if (query.companyId) filter.companyId = query.companyId
    if (query.branchId) filter.branchId = query.branchId

    if (query.search) {
        filter.employeeCode = {
            $regex: query.search,
            $options: "i",
        }
    }

    const skip = (query.page - 1) * query.limit
    const [items, total] = await Promise.all([
        AttendanceRawScan.find(filter)
            .populate("employeeId", "employeeCode displayName")
            .sort({ scannedAt: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        AttendanceRawScan.countDocuments(filter),
    ])

    return {
        items: items.map((item) => ({
            ...item,
            id: item._id.toString(),
            _id: undefined,
        })),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
    }
}
