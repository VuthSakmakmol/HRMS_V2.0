import ExcelJS from "exceljs"
import mongoose from "mongoose"

import AttendanceImportIssue from "../models/AttendanceImportIssue.js"
import { invalidateAttendanceCaches, upsertAttendanceRecord } from "./attendance.service.js"

const HEADERS = [
    "Record Date",
    "Employee No",
    "Time1",
    "Time2",
    "Vacation",
]

const VACATION_OPTIONS = [
    "Annual Leave",
    "Her Maternity Leave",
    "Her Maternity Leave(0%)",
    "Sick Leave",
    "Sick Leave (60%)",
    "Sick Leave (Hours)",
    "Unpaid Leave",
]

const VACATION_CODE_BY_VALUE = new Map([
    ["annual leave", "AL"],
    ["her maternity leave", "ML"],
    ["her maternity leave(0%)", "ML"],
    ["her maternity leave (0%)", "ML"],
    ["sick leave", "SL"],
    ["sick leave (60%)", "SL"],
    ["sick leave (hours)", "SL"],
    ["unpaid leave", "UL"],
])

function normalizeVacation(value) {
    const normalized = String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase()

    if (!normalized || normalized === "(blanks)" || normalized === "blanks") {
        return { leaveCode: null, vacation: "" }
    }

    const leaveCode = VACATION_CODE_BY_VALUE.get(normalized)
    return leaveCode
        ? { leaveCode, vacation: String(value).trim() }
        : null
}

function vacationLabel(leaveCode) {
    return {
        AL: "Annual Leave",
        ML: "Maternity Leave",
        SL: "Sick Leave",
        UL: "Unpaid Leave",
    }[leaveCode] || ""
}

function excelDateToDate(value) {
    if (!value) {
        return null
    }

    if (value instanceof Date) {
        return value
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        const excelEpoch = Date.UTC(1899, 11, 30)
        const milliseconds = Math.round(value * 86_400_000)
        const parsedSerialDate = new Date(excelEpoch + milliseconds)

        return Number.isNaN(parsedSerialDate.getTime())
            ? null
            : parsedSerialDate
    }

    const displayDateMatch = String(value)
        .trim()
        .match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

    if (displayDateMatch) {
        const [, day, month, year] = displayDateMatch
        const parsedDisplayDate = new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
        )

        if (
            parsedDisplayDate.getFullYear() === Number(year) &&
            parsedDisplayDate.getMonth() === Number(month) - 1 &&
            parsedDisplayDate.getDate() === Number(day)
        ) {
            return parsedDisplayDate
        }

        return null
    }

    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getPhnomPenhExcelDateSerial(value = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Phnom_Penh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(value)
    const values = Object.fromEntries(
        parts
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, Number(part.value)]),
    )
    const excelEpoch = Date.UTC(1899, 11, 30)
    const selectedDate = Date.UTC(values.year, values.month - 1, values.day)

    return (selectedDate - excelEpoch) / 86_400_000
}

function normalizeFourDigitTime(value) {
    if (value === null || value === undefined || value === "") {
        return null
    }

    if (value instanceof Date) {
        return {
            hours: value.getHours(),
            minutes: value.getMinutes(),
        }
    }

    const raw = String(value).trim()
    const digits = /^\d{1,4}$/.test(raw) ? raw.padStart(4, "0") : null

    if (!digits) {
        return null
    }

    const hours = Number(digits.slice(0, 2))
    const minutes = Number(digits.slice(2, 4))

    if (hours > 23 || minutes > 59) {
        return null
    }

    return { hours, minutes }
}

function combineDateAndTime(dateValue, timeValue, addDay = false) {
    const time = normalizeFourDigitTime(timeValue)

    if (!dateValue || !time) {
        return null
    }

    const date = new Date(dateValue)
    date.setHours(time.hours, time.minutes, 0, 0)

    if (addDay) {
        date.setDate(date.getDate() + 1)
    }

    return date
}

function headerValue(cell) {
    return String(cell.value || "").trim()
}

export async function buildAttendanceImportTemplate() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Attendance Import")

    sheet.addRow(HEADERS)
    sheet.addRow([getPhnomPenhExcelDateSerial(), "EMP001", 729, 1625, ""])
    sheet.addRow([getPhnomPenhExcelDateSerial(), "EMP002", "", "", "Annual Leave"])
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
    sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
    }
    sheet.views = [{ state: "frozen", ySplit: 1 }]
    sheet.autoFilter = { from: "A1", to: "E1" }
    sheet.columns = [
        { width: 18 },
        { width: 20 },
        { width: 12 },
        { width: 12 },
        { width: 26 },
    ]
    sheet.getColumn(1).numFmt = "dd/mm/yyyy"
    sheet.getCell("A2").numFmt = "dd/mm/yyyy"
    sheet.getColumn(3).numFmt = "0000"
    sheet.getColumn(4).numFmt = "0000"
    sheet.dataValidations.add("E2:E50000", {
        type: "list",
        allowBlank: true,
        formulae: [`"${VACATION_OPTIONS.join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Invalid Vacation",
        error: "Choose a Vacation value from the list.",
    })

    return workbook
}

export async function buildAttendanceExportWorkbook(records = []) {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Attendance Records")
    sheet.columns = [
        { header: "Date", key: "date", width: 14 },
        { header: "Employee ID", key: "employeeCode", width: 16 },
        { header: "Employee", key: "employeeName", width: 24 },
        { header: "Department", key: "department", width: 22 },
        { header: "Position", key: "position", width: 22 },
        { header: "Line", key: "line", width: 18 },
        { header: "Shift", key: "shift", width: 16 },
        { header: "First In", key: "firstIn", width: 20 },
        { header: "Last Out", key: "lastOut", width: 20 },
        { header: "Vacation", key: "vacation", width: 20 },
        { header: "Worked Minutes", key: "workedMinutes", width: 16 },
        { header: "Late Minutes", key: "lateMinutes", width: 14 },
        { header: "Early Leave Minutes", key: "earlyLeaveMinutes", width: 18 },
        { header: "Status", key: "status", width: 20 },
        { header: "Verification", key: "verificationStatus", width: 18 },
        { header: "Source", key: "source", width: 16 },
        { header: "Issues", key: "issues", width: 30 },
        { header: "Note", key: "note", width: 36 },
    ]
    for (const record of records) {
        sheet.addRow({
            date: record.attendanceDate,
            employeeCode: record.employeeCode,
            employeeName: record.employeeId?.displayName || "",
            department: record.departmentId?.name || "",
            position: record.positionId?.title || record.positionId?.name || "",
            line: record.lineId?.name || "",
            shift: record.shiftId?.name || record.shiftId?.code || "",
            firstIn: record.firstInAt,
            lastOut: record.lastOutAt,
            vacation: vacationLabel(record.leaveCode),
            workedMinutes: record.workedMinutes,
            lateMinutes: record.lateMinutes,
            earlyLeaveMinutes: record.earlyLeaveMinutes,
            status: record.status,
            verificationStatus: record.verificationStatus,
            source: record.source,
            issues: (record.issueCodes || []).join(", "),
            note: record.note || "",
        })
    }
    sheet.getRow(1).font = { bold: true }
    sheet.views = [{ state: "frozen", ySplit: 1 }]
    sheet.autoFilter = { from: "A1", to: "R1" }
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

    const actualHeaders = HEADERS.map((_, index) =>
        headerValue(sheet.getRow(1).getCell(index + 1)),
    )

    if (actualHeaders.some((header, index) => header !== HEADERS[index])) {
        return {
            rows,
            errors: [{
                row: 1,
                message: `Invalid headers. Expected exactly: ${HEADERS.join(", ")}.`,
            }],
        }
    }

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
            return
        }

        const attendanceDate = excelDateToDate(row.getCell(1).value)
        const employeeCode = String(row.getCell(2).value || "").trim()
        const rawTime1 = row.getCell(3).value
        const rawTime2 = row.getCell(4).value
        const rawVacation = row.getCell(5).value
        const vacation = normalizeVacation(rawVacation)
        const hasTime1 = rawTime1 !== null && rawTime1 !== undefined && rawTime1 !== ""
        const hasTime2 = rawTime2 !== null && rawTime2 !== undefined && rawTime2 !== ""
        const time1 = hasTime1 ? normalizeFourDigitTime(rawTime1) : null
        const time2 = hasTime2 ? normalizeFourDigitTime(rawTime2) : null

        if (!employeeCode && !attendanceDate && !row.getCell(3).value && !row.getCell(4).value && !rawVacation) {
            return
        }

        if (!employeeCode || !attendanceDate) {
            errors.push({
                row: rowNumber,
                message: "Record Date and Employee No are required.",
            })
            return
        }

        if ((hasTime1 && !time1) || (hasTime2 && !time2)) {
            errors.push({
                row: rowNumber,
                message: "Time1 and Time2 must use valid HHmm values, for example 0729 or 1625.",
            })
            return
        }

        if (!vacation) {
            errors.push({
                row: rowNumber,
                code: "INVALID_VACATION",
                message: `Vacation must be blank or one of: ${VACATION_OPTIONS.join(", ")}.`,
            })
            return
        }

        const time1Minutes = time1
            ? time1.hours * 60 + time1.minutes
            : null
        const time2Minutes = time2
            ? time2.hours * 60 + time2.minutes
            : null

        rows.push({
            rowNumber,
            payload: {
                employeeCode,
                attendanceDate,
                firstInAt: time1
                    ? combineDateAndTime(attendanceDate, rawTime1)
                    : null,
                lastOutAt: time2
                    ? combineDateAndTime(
                          attendanceDate,
                          rawTime2,
                          time1Minutes !== null && time2Minutes <= time1Minutes,
                      )
                    : null,
                leaveCode: vacation.leaveCode,
                note: "",
            },
        })
    })

    return { rows, errors }
}

export async function importAttendanceRows({ rows, parseErrors, user, workspace, onProgress }) {
    const importBatchId = new mongoose.Types.ObjectId()
    const summary = {
        importBatchId: importBatchId.toString(),
        totalRows: rows.length + parseErrors.length,
        successCount: 0,
        absentCount: 0,
        annualLeaveCount: 0,
        maternityLeaveCount: 0,
        sickLeaveCount: 0,
        unpaidLeaveCount: 0,
        missingInCount: 0,
        missingOutCount: 0,
        unmatchedCount: 0,
        errorCount: parseErrors.length,
        errors: [...parseErrors],
        issues: [],
    }

    let completedRows = 0
    const processRow = async (row) => {
        try {
            const record = await upsertAttendanceRecord({
                payload: { ...row.payload, ...workspace },
                user,
                source: "EXCEL_IMPORT",
                invalidateCache: false,
            })

            summary.successCount += 1
            if (record.status === "ABSENT" && !record.leaveCode) summary.absentCount += 1
            if (record.leaveCode === "AL") summary.annualLeaveCount += 1
            if (record.leaveCode === "ML") summary.maternityLeaveCount += 1
            if (record.leaveCode === "SL") summary.sickLeaveCount += 1
            if (record.leaveCode === "UL") summary.unpaidLeaveCount += 1
            if (record.status === "MISSING_IN") summary.missingInCount += 1
            if (record.status === "MISSING_OUT") summary.missingOutCount += 1
        } catch (error) {
            if (error.code === "ATTENDANCE_EMPLOYEE_NOT_FOUND") {
                await AttendanceImportIssue.findOneAndUpdate(
                    {
                        companyId: workspace.companyId,
                        branchId: workspace.branchId,
                        employeeCode: row.payload.employeeCode.trim().toUpperCase(),
                        attendanceDate: row.payload.attendanceDate,
                        status: "NO_EMPLOYEE_MATCH",
                    },
                    {
                        $set: {
                            importBatchId,
                            sourceRow: row.rowNumber,
                            firstInAt: row.payload.firstInAt,
                            lastOutAt: row.payload.lastOutAt,
                            leaveCode: row.payload.leaveCode || null,
                            createdByAccountId: user.accountId,
                        },
                        $setOnInsert: {
                            companyId: workspace.companyId,
                            branchId: workspace.branchId,
                            employeeCode: row.payload.employeeCode,
                            attendanceDate: row.payload.attendanceDate,
                            status: "NO_EMPLOYEE_MATCH",
                        },
                    },
                    { upsert: true, runValidators: true },
                )
                summary.unmatchedCount += 1
                summary.issues.push({
                    row: row.rowNumber,
                    code: "NO_EMPLOYEE_MATCH",
                    employeeCode: row.payload.employeeCode,
                    message: `Employee No ${row.payload.employeeCode} was not found. The row was saved to Unmatched Attendance.`,
                })
                return
            }

            const messages = {
                ATTENDANCE_SHIFT_NOT_FOUND: "Employee has no active shift assignment.",
                ATTENDANCE_RECORD_LOCKED: "Attendance is payroll-locked or finalized.",
            }
            summary.errorCount += 1
            summary.errors.push({
                row: row.rowNumber,
                code: error.code || "IMPORT_FAILED",
                message: messages[error.code] || "Attendance row could not be imported.",
            })
        }

        finally {
            completedRows += 1
        }
    }

    // Keep enough parallelism to saturate MongoDB without flooding the pool.
    const concurrency = Math.min(16, Math.max(1, rows.length))
    let cursor = 0
    const workers = Array.from({ length: concurrency }, async () => {
        while (cursor < rows.length) {
            const index = cursor++
            await processRow(rows[index])
            onProgress?.({
                phase: "SAVING_ROWS",
                percent: 35 + Math.round((completedRows / Math.max(rows.length, 1)) * 60),
                processedRows: completedRows,
                totalRows: summary.totalRows,
            })
        }
    })
    await Promise.all(workers)
    if (rows.length) {
        invalidateAttendanceCaches()
    }

    return summary
}
