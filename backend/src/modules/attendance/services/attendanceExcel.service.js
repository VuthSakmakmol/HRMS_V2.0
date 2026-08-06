import ExcelJS from "exceljs"
import mongoose from "mongoose"

import Employee from "../../employee/models/Employee.js"
import Shift from "../../shift/models/Shift.js"
import AttendanceImportIssue from "../models/AttendanceImportIssue.js"
import { invalidateAttendanceCaches, upsertAttendanceRecord } from "./attendance.service.js"

const HEADERS = ["Record Date", "Employee No", "Time1", "Time2", "Vacation"]
const VACATION_OPTIONS = [
    "Annual Leave", "Her Maternity Leave", "Her Maternity Leave(0%)",
    "Sick Leave", "Sick Leave (60%)", "Sick Leave (Hours)", "Unpaid Leave",
]
const VACATION_CODE_BY_VALUE = new Map([
    ["annual leave", "AL"], ["her maternity leave", "ML"],
    ["her maternity leave(0%)", "ML"], ["her maternity leave (0%)", "ML"],
    ["sick leave", "SL"], ["sick leave (60%)", "SL"],
    ["sick leave (hours)", "SL"], ["unpaid leave", "UL"],
])

function normalizeVacation(value) {
    const normalized = String(value || "").trim().replace(/\s+/g, " ").toLowerCase()
    if (!normalized || normalized === "(blanks)" || normalized === "blanks") {
        return { leaveCode: null, vacation: "" }
    }
    const leaveCode = VACATION_CODE_BY_VALUE.get(normalized)
    return leaveCode ? { leaveCode, vacation: String(value).trim() } : null
}
function vacationLabel(code) {
    return { AL: "Annual Leave", ML: "Maternity Leave", SL: "Sick Leave", UL: "Unpaid Leave" }[code] || ""
}
function excelDateToDate(value) {
    if (!value) return null
    if (value instanceof Date) return value
    if (typeof value === "number" && Number.isFinite(value)) {
        return new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86_400_000))
    }
    const match = String(value).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}
function getPhnomPenhExcelDateSerial(value = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Phnom_Penh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value)
    const v = Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, Number(p.value)]))
    return (Date.UTC(v.year, v.month - 1, v.day) - Date.UTC(1899, 11, 30)) / 86_400_000
}
function normalizeFourDigitTime(value) {
    if (value === null || value === undefined || value === "") return null
    if (value instanceof Date) return { hours: value.getHours(), minutes: value.getMinutes() }
    const raw = String(value).trim()
    const digits = /^\d{1,4}$/.test(raw) ? raw.padStart(4, "0") : null
    if (!digits) return null
    const hours = Number(digits.slice(0, 2)); const minutes = Number(digits.slice(2, 4))
    return hours <= 23 && minutes <= 59 ? { hours, minutes } : null
}
function combineDateAndTime(dateValue, timeValue) {
    const time = normalizeFourDigitTime(timeValue)
    if (!dateValue || !time) return null
    const date = new Date(dateValue)
    date.setHours(time.hours, time.minutes, 0, 0)
    return date
}
function addDays(value, days) {
    const date = new Date(value); date.setDate(date.getDate() + days); return date
}
function minutesOf(time) {
    const [h, m] = String(time || "00:00").split(":").map(Number)
    return h * 60 + m
}
function isOvernightShift(shift) {
    return Boolean(shift?.isOvernight) || minutesOf(shift?.endTime) <= minutesOf(shift?.startTime)
}
function headerValue(cell) { return String(cell.value || "").trim() }

export async function buildAttendanceImportTemplate() {
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Attendance Import")
    sheet.addRow(HEADERS); sheet.addRow([getPhnomPenhExcelDateSerial(), "EMP001", 729, 1625, ""])
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } }
    sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.autoFilter = { from: "A1", to: "E1" }
    sheet.columns = [{ width: 18 }, { width: 20 }, { width: 12 }, { width: 12 }, { width: 26 }]
    sheet.getColumn(1).numFmt = "dd/mm/yyyy"; sheet.getColumn(3).numFmt = "0000"; sheet.getColumn(4).numFmt = "0000"
    sheet.dataValidations.add("E2:E50000", { type: "list", allowBlank: true, formulae: [`"${VACATION_OPTIONS.join(",")}"`] })
    return workbook
}

export async function buildAttendanceExportWorkbook(records = []) {
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Attendance Records")
    sheet.columns = [
        { header: "Date", key: "date", width: 14 }, { header: "Employee ID", key: "employeeCode", width: 16 },
        { header: "Employee", key: "employeeName", width: 24 }, { header: "Department", key: "department", width: 22 },
        { header: "Position", key: "position", width: 22 }, { header: "Line", key: "line", width: 18 },
        { header: "Shift", key: "shift", width: 16 }, { header: "First In", key: "firstIn", width: 20 },
        { header: "Last Out", key: "lastOut", width: 20 }, { header: "Vacation", key: "vacation", width: 20 },
        { header: "Worked Minutes", key: "workedMinutes", width: 16 }, { header: "Late Minutes", key: "lateMinutes", width: 14 },
        { header: "Early Leave Minutes", key: "earlyLeaveMinutes", width: 18 }, { header: "Status", key: "status", width: 20 },
        { header: "Source", key: "source", width: 16 }, { header: "Issues", key: "issues", width: 30 }, { header: "Note", key: "note", width: 36 },
    ]
    for (const r of records) sheet.addRow({ date: r.attendanceDate, employeeCode: r.employeeCode, employeeName: r.employeeId?.displayName || "", department: r.departmentId?.name || "", position: r.positionId?.title || r.positionId?.name || "", line: r.lineId?.name || "", shift: r.shiftId?.name || r.shiftId?.code || "", firstIn: r.firstInAt, lastOut: r.lastOutAt, vacation: vacationLabel(r.leaveCode), workedMinutes: r.workedMinutes, lateMinutes: r.lateMinutes, earlyLeaveMinutes: r.earlyLeaveMinutes, status: r.status, source: r.source, issues: (r.issueCodes || []).join(", "), note: r.note || "" })
    sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.autoFilter = { from: "A1", to: "Q1" }
    return workbook
}

export async function buildAttendanceImportIssueWorkbook(issues = []) {
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Unmatched Attendance")
    sheet.columns = [{ header: "Record Date", key: "attendanceDate", width: 16 }, { header: "Employee No", key: "employeeCode", width: 18 }, { header: "Time1", key: "firstInAt", width: 12 }, { header: "Time2", key: "lastOutAt", width: 12 }, { header: "Excel Row", key: "sourceRow", width: 12 }, { header: "Status", key: "status", width: 22 }]
    for (const issue of issues) sheet.addRow(issue)
    sheet.getRow(1).font = { bold: true }; return workbook
}

export async function parseAttendanceWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]; const rows = []; const errors = []
    if (!sheet) return { rows, errors: [{ row: 0, message: "Workbook does not contain a worksheet." }] }
    const actualHeaders = HEADERS.map((_, i) => headerValue(sheet.getRow(1).getCell(i + 1)))
    if (actualHeaders.some((h, i) => h !== HEADERS[i])) return { rows, errors: [{ row: 1, message: `Invalid headers. Expected exactly: ${HEADERS.join(", ")}.` }] }
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const attendanceDate = excelDateToDate(row.getCell(1).value)
        const employeeCode = String(row.getCell(2).value || "").trim()
        const rawTime1 = row.getCell(3).value; const rawTime2 = row.getCell(4).value
        const rawVacation = row.getCell(5).value; const vacation = normalizeVacation(rawVacation)
        if (!employeeCode && !attendanceDate && !rawTime1 && !rawTime2 && !rawVacation) return
        if (!employeeCode || !attendanceDate) { errors.push({ row: rowNumber, message: "Record Date and Employee No are required." }); return }
        const time1 = normalizeFourDigitTime(rawTime1); const time2 = normalizeFourDigitTime(rawTime2)
        if ((rawTime1 !== null && rawTime1 !== undefined && rawTime1 !== "" && !time1) || (rawTime2 !== null && rawTime2 !== undefined && rawTime2 !== "" && !time2)) { errors.push({ row: rowNumber, message: "Time1 and Time2 must use valid HHmm values." }); return }
        if (!vacation) { errors.push({ row: rowNumber, code: "INVALID_VACATION", message: `Vacation must be blank or one of: ${VACATION_OPTIONS.join(", ")}.` }); return }
        rows.push({ rowNumber, payload: { employeeCode, attendanceDate, time1At: time1 ? combineDateAndTime(attendanceDate, rawTime1) : null, time2At: time2 ? combineDateAndTime(attendanceDate, rawTime2) : null, leaveCode: vacation.leaveCode, note: "" } })
    })
    return { rows, errors }
}

async function resolveEmployeeShift(row, workspace) {
    const employee = await Employee.findOne({ employeeCode: row.payload.employeeCode.trim().toUpperCase(), recordStatus: "ACTIVE", companyId: workspace.companyId, branchId: workspace.branchId }).lean()
    if (!employee) return { employee: null, shift: null }
    const shift = await Shift.findOne({ _id: employee.shiftId, status: "ACTIVE" }).lean()
    return { employee, shift }
}

async function saveImportIssue({ row, user, workspace, importBatchId }) {
    await AttendanceImportIssue.findOneAndUpdate(
        { companyId: workspace.companyId, branchId: workspace.branchId, employeeCode: row.payload.employeeCode.trim().toUpperCase(), attendanceDate: row.payload.attendanceDate, status: "NO_EMPLOYEE_MATCH" },
        { $set: { importBatchId, sourceRow: row.rowNumber, firstInAt: row.payload.time1At, lastOutAt: row.payload.time2At, leaveCode: row.payload.leaveCode || null, createdByAccountId: user.accountId }, $setOnInsert: { companyId: workspace.companyId, branchId: workspace.branchId, employeeCode: row.payload.employeeCode, attendanceDate: row.payload.attendanceDate, status: "NO_EMPLOYEE_MATCH" } },
        { upsert: true, runValidators: true },
    )
}

async function importOneSourceRow({ row, user, workspace, shift }) {
    const common = { employeeCode: row.payload.employeeCode, ...workspace, note: row.payload.note || "" }
    if (!isOvernightShift(shift)) {
        return [await upsertAttendanceRecord({ payload: { ...common, attendanceDate: row.payload.attendanceDate, firstInAt: row.payload.time1At, lastOutAt: row.payload.time2At, leaveCode: row.payload.leaveCode }, user, source: "EXCEL_IMPORT", invalidateCache: false })]
    }
    const records = []
    // Payroll overnight rule:
    // Time1 on date D = OUT for the shift that started on D-1.
    if (row.payload.time1At) {
        records.push(await upsertAttendanceRecord({ payload: { ...common, attendanceDate: addDays(row.payload.attendanceDate, -1), lastOutAt: row.payload.time1At }, user, source: "EXCEL_IMPORT", invalidateCache: false }))
    }
    // Time2 on date D = IN for the shift starting on D.
    if (row.payload.time2At || row.payload.leaveCode) {
        records.push(await upsertAttendanceRecord({ payload: { ...common, attendanceDate: row.payload.attendanceDate, firstInAt: row.payload.time2At, leaveCode: row.payload.leaveCode }, user, source: "EXCEL_IMPORT", invalidateCache: false }))
    }
    return records
}

export async function importAttendanceRows({ rows, parseErrors, user, workspace, onProgress }) {
    const importBatchId = new mongoose.Types.ObjectId()
    const summary = { importBatchId: importBatchId.toString(), totalRows: rows.length + parseErrors.length, successCount: 0, absentCount: 0, annualLeaveCount: 0, maternityLeaveCount: 0, sickLeaveCount: 0, unpaidLeaveCount: 0, missingInCount: 0, missingOutCount: 0, unmatchedCount: 0, errorCount: parseErrors.length, errors: [...parseErrors], issues: [] }
    let completedRows = 0
    const groups = new Map()
    for (const row of rows) {
        const key = row.payload.employeeCode.trim().toUpperCase()
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(row)
    }
    for (const group of groups.values()) group.sort((a, b) => new Date(a.payload.attendanceDate) - new Date(b.payload.attendanceDate))
    const queue = [...groups.values()]; let cursor = 0
    const worker = async () => {
        while (cursor < queue.length) {
            const group = queue[cursor++]
            for (const row of group) {
                try {
                    const { employee, shift } = await resolveEmployeeShift(row, workspace)
                    if (!employee) {
                        await saveImportIssue({ row, user, workspace, importBatchId })
                        summary.unmatchedCount += 1
                        summary.issues.push({ row: row.rowNumber, code: "NO_EMPLOYEE_MATCH", employeeCode: row.payload.employeeCode, message: `Employee No ${row.payload.employeeCode} was not found. The row was saved to Unmatched Attendance.` })
                    } else if (!shift) {
                        throw Object.assign(new Error("Employee has no active shift assignment."), { code: "ATTENDANCE_SHIFT_NOT_FOUND" })
                    } else {
                        const records = await importOneSourceRow({ row, user, workspace, shift })
                        summary.successCount += 1
                        const current = records.at(-1)
                        if (current?.status === "ABSENT" && !current.leaveCode) summary.absentCount += 1
                        if (current?.leaveCode === "AL") summary.annualLeaveCount += 1
                        if (current?.leaveCode === "ML") summary.maternityLeaveCount += 1
                        if (current?.leaveCode === "SL") summary.sickLeaveCount += 1
                        if (current?.leaveCode === "UL") summary.unpaidLeaveCount += 1
                        if (current?.status === "MISSING_IN") summary.missingInCount += 1
                        if (current?.status === "MISSING_OUT") summary.missingOutCount += 1
                    }
                } catch (error) {
                    summary.errorCount += 1
                    summary.errors.push({ row: row.rowNumber, code: error.code || "IMPORT_FAILED", message: error.code === "ATTENDANCE_RECORD_LOCKED" ? "Attendance is payroll-locked or finalized." : error.message || "Attendance row could not be imported." })
                } finally {
                    completedRows += 1
                    onProgress?.({ phase: "SAVING_ROWS", percent: 35 + Math.round((completedRows / Math.max(rows.length, 1)) * 60), processedRows: completedRows, totalRows: summary.totalRows })
                }
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(12, Math.max(1, queue.length)) }, worker))
    if (rows.length) invalidateAttendanceCaches()
    return summary
}
