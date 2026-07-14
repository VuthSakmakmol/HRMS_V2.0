import ExcelJS from "exceljs"

import { upsertAttendanceRecord } from "./attendance.service.js"

const HEADERS = [
    "Employee ID",
    "Attendance Date",
    "First In",
    "Last Out",
    "Note",
]

function excelDateToDate(value) {
    if (!value) {
        return null
    }

    if (value instanceof Date) {
        return value
    }

    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function combineDateAndTime(dateValue, timeValue) {
    if (!dateValue || !timeValue) {
        return null
    }

    if (timeValue instanceof Date) {
        const date = new Date(dateValue)
        date.setHours(timeValue.getHours(), timeValue.getMinutes(), 0, 0)
        return date
    }

    const match = String(timeValue).trim().match(/^(\d{1,2}):(\d{2})$/)

    if (!match) {
        return null
    }

    const date = new Date(dateValue)
    date.setHours(Number(match[1]), Number(match[2]), 0, 0)
    return date
}

export async function buildAttendanceImportTemplate() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Attendance Import")

    sheet.addRow(HEADERS)
    sheet.addRow(["EMP001", new Date(), "07:00", "16:00", ""])
    sheet.getRow(1).font = { bold: true }
    sheet.columns = [
        { width: 18 },
        { width: 18 },
        { width: 14 },
        { width: 14 },
        { width: 40 },
    ]
    sheet.getColumn(2).numFmt = "yyyy-mm-dd"

    return workbook
}

export async function parseAttendanceWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const sheet = workbook.worksheets[0]
    const rows = []
    const errors = []

    if (!sheet) {
        return {
            rows,
            errors: [{ row: 0, message: "Workbook does not contain a worksheet." }],
        }
    }

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
            return
        }

        const employeeCode = String(row.getCell(1).value || "").trim()
        const attendanceDate = excelDateToDate(row.getCell(2).value)

        if (!employeeCode && !attendanceDate) {
            return
        }

        if (!employeeCode || !attendanceDate) {
            errors.push({
                row: rowNumber,
                message: "Employee ID and Attendance Date are required.",
            })
            return
        }

        rows.push({
            rowNumber,
            payload: {
                employeeCode,
                attendanceDate,
                firstInAt: combineDateAndTime(
                    attendanceDate,
                    row.getCell(3).value,
                ),
                lastOutAt: combineDateAndTime(
                    attendanceDate,
                    row.getCell(4).value,
                ),
                note: String(row.getCell(5).value || "").trim(),
            },
        })
    })

    return { rows, errors }
}

export async function importAttendanceRows({ rows, parseErrors, user }) {
    const summary = {
        totalRows: rows.length + parseErrors.length,
        successCount: 0,
        errorCount: parseErrors.length,
        errors: [...parseErrors],
    }

    for (const row of rows) {
        try {
            await upsertAttendanceRecord({
                payload: row.payload,
                user,
                source: "EXCEL_IMPORT",
            })
            summary.successCount += 1
        } catch (error) {
            summary.errorCount += 1
            summary.errors.push({
                row: row.rowNumber,
                message: error.message || "Import failed.",
            })
        }
    }

    return summary
}
