import crypto from "node:crypto"
import ExcelJS from "exceljs"

import AttendanceRawScan from "../models/AttendanceRawScan.js"
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

export async function importRawScans({ buffer, user }) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const sheet = workbook.worksheets[0]
    const importBatchId = crypto.randomUUID()
    const operations = []
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

        operations.push({
            updateOne: {
                filter: {
                    employeeCode,
                    scannedAt,
                    deviceCode,
                },
                update: {
                    $setOnInsert: {
                        employeeCode,
                        scannedAt,
                        direction,
                        deviceCode,
                        source: "EXCEL_IMPORT",
                        importBatchId,
                        createdByAccountId: user.accountId,
                    },
                },
                upsert: true,
            },
        })
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
        totalRows: operations.length + errors.length,
        importedCount,
        duplicateCount: Math.max(0, operations.length - importedCount),
        errorCount: errors.length,
        errors,
    }
}

export async function listRawScans({ query }) {
    const start = startOfBusinessDay(query.dateFrom)
    const end = endOfBusinessDay(query.dateTo)
    const filter = {
        scannedAt: {
            $gte: start,
            $lte: end,
        },
    }

    if (query.search) {
        filter.employeeCode = {
            $regex: query.search,
            $options: "i",
        }
    }

    const skip = (query.page - 1) * query.limit
    const [items, total] = await Promise.all([
        AttendanceRawScan.find(filter)
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
