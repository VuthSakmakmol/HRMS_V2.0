import ExcelJS from "exceljs"
import mongoose from "mongoose"

import Employee from "../../employee/models/Employee.js"
import { evaluateAbandonmentForWorkspace } from "../../employee/services/employeeLifecycle.service.js"
import Shift from "../../shift/models/Shift.js"
import AttendanceImportIssue from "../models/AttendanceImportIssue.js"
import AttendancePolicy from "../models/AttendancePolicy.js"
import AttendanceRecord from "../models/AttendanceRecord.js"
import { invalidateAttendanceCaches } from "./attendance.service.js"
import { calculateAttendanceResult } from "./attendanceCalculation.service.js"
import { addBusinessDays, startOfBusinessDay, toBusinessDateKey } from "../utils/attendanceDate.util.js"
import { assertAttendanceScope } from "../utils/attendanceScope.util.js"

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

function normalizedEmployeeCode(value) {
    return String(value || "").trim().toUpperCase()
}

function attendanceKey(employeeId, attendanceDate) {
    return `${String(employeeId)}|${toBusinessDateKey(attendanceDate)}`
}

function policySnapshot(policy) {
    if (!policy) return {}
    return {
        policyId: policy._id,
        name: policy.name,
        code: policy.code,
        graceInMinutes: policy.graceInMinutes,
        graceOutMinutes: policy.graceOutMinutes,
        minimumWorkedMinutes: policy.minimumWorkedMinutes,
        lateRoundUnitMinutes: policy.lateRoundUnitMinutes,
        lateRoundMethod: policy.lateRoundMethod,
        earlyLeaveRoundUnitMinutes: policy.earlyLeaveRoundUnitMinutes,
        earlyLeaveRoundMethod: policy.earlyLeaveRoundMethod,
        autoGenerateAbsent: policy.autoGenerateAbsent,
        treatSundayAsRestDay: policy.treatSundayAsRestDay,
    }
}

function hasConfirmedHrCorrection(record) {
    return record?.lockStatus === "HR_VERIFIED" || (
        record?.verificationStatus === "CORRECTED" &&
        record?.correction?.reason &&
        record.correction.reason !== "Manual correction"
    )
}

function assertRecordUnlocked(record) {
    return !["PAYROLL_LOCKED", "FINALIZED"].includes(record?.lockStatus)
}

function buildImportMutations(row, employee, shift) {
    const common = {
        sourceRow: row.rowNumber,
        employee,
        shift,
        leaveCode: row.payload.leaveCode || null,
        note: row.payload.note || "",
    }

    if (!isOvernightShift(shift)) {
        return [{
            ...common,
            attendanceDate: startOfBusinessDay(toBusinessDateKey(row.payload.attendanceDate)),
            firstInAt: row.payload.time1At || null,
            lastOutAt: row.payload.time2At || null,
        }]
    }

    const mutations = []
    if (row.payload.time1At) {
        mutations.push({
            ...common,
            attendanceDate: startOfBusinessDay(toBusinessDateKey(addDays(row.payload.attendanceDate, -1))),
            firstInAt: null,
            lastOutAt: row.payload.time1At,
            leaveCode: null,
        })
    }
    if (row.payload.time2At || row.payload.leaveCode) {
        mutations.push({
            ...common,
            attendanceDate: startOfBusinessDay(toBusinessDateKey(row.payload.attendanceDate)),
            firstInAt: row.payload.time2At || null,
            lastOutAt: null,
        })
    }
    return mutations
}

async function loadPoliciesForWorkspace(workspace) {
    return AttendancePolicy.find({
        companyId: workspace.companyId,
        branchId: workspace.branchId,
        status: "ACTIVE",
    })
        .sort({ effectiveFrom: -1, updatedAt: -1 })
        .lean()
}

function policyForDate(policies, attendanceDate) {
    const time = new Date(attendanceDate).getTime()
    return policies.find((policy) => {
        const from = policy.effectiveFrom ? new Date(policy.effectiveFrom).getTime() : -Infinity
        const to = policy.effectiveTo ? new Date(policy.effectiveTo).getTime() : Infinity
        return from <= time && to >= time
    }) || null
}

function toBulkValues({ mutation, existing, user, policy }) {
    const preserveFirstIn = mutation.firstInAt || existing?.firstInAt || null
    const preserveLastOut = mutation.lastOutAt || existing?.lastOutAt || null
    const calculated = calculateAttendanceResult({
        workDate: toBusinessDateKey(mutation.attendanceDate),
        shift: mutation.shift,
        policy,
        dayType: existing?.dayType || "WORKING_DAY",
        correctedTimes: {
            firstInAt: preserveFirstIn,
            lastOutAt: preserveLastOut,
        },
    })

    if (!calculated) return null

    const employee = mutation.employee
    return {
        employeeCode: employee.employeeCode,
        companyId: employee.companyId,
        branchId: employee.branchId,
        departmentId: employee.departmentId,
        positionId: employee.positionId,
        lineId: employee.lineId,
        shiftId: employee.shiftId,
        source: "EXCEL_IMPORT",
        leaveCode: mutation.leaveCode || existing?.leaveCode || null,
        note: mutation.note || existing?.note || "",
        policySnapshot: policySnapshot(policy),
        calculationVersion: "ATTENDANCE_ENGINE_V2",
        updatedByAccountId: user.accountId,
        ...calculated,
        verificationStatus: calculated.verificationStatus,
        lockStatus: existing?.lockStatus || "OPEN",
        correction: {
            correctedByAccountId: null,
            correctedAt: null,
            reason: "",
            previousValues: null,
        },
    }
}

async function bulkWriteInChunks(Model, operations, chunkSize = 2000) {
    for (let index = 0; index < operations.length; index += chunkSize) {
        await Model.bulkWrite(operations.slice(index, index + chunkSize), { ordered: false })
    }
}

function countSummaryRecord(summary, current) {
    if (!current) return
    if (current.status === "ABSENT" && !current.leaveCode) summary.absentCount += 1
    if (current.leaveCode === "AL") summary.annualLeaveCount += 1
    if (current.leaveCode === "ML") summary.maternityLeaveCount += 1
    if (current.leaveCode === "SL") summary.sickLeaveCount += 1
    if (current.leaveCode === "UL") summary.unpaidLeaveCount += 1
    if (current.status === "MISSING_IN") summary.missingInCount += 1
    if (current.status === "MISSING_OUT") summary.missingOutCount += 1
}

async function runLifecycleAfterAttendanceImport({ rows, workspace, summary }) {
    const importedKeys = rows
        .map((row) => {
            try {
                return toBusinessDateKey(row?.payload?.attendanceDate)
            } catch {
                return ""
            }
        })
        .filter(Boolean)
        .sort()

    const latestImportedKey = importedKeys.at(-1) || ""
    if (!latestImportedKey) {
        summary.lifecycle = { abandonmentChecked: false, reason: "NO_VALID_ATTENDANCE_DATE" }
        return
    }

    // Never decide abandonment from today's unfinished attendance. A payroll
    // file can be imported more than once during the current workday.
    const todayKey = toBusinessDateKey(new Date())
    const yesterdayKey = addBusinessDays(todayKey, -1)
    const throughDate = latestImportedKey < todayKey ? latestImportedKey : yesterdayKey

    if (!throughDate) {
        summary.lifecycle = { abandonmentChecked: false, reason: "NO_COMPLETED_ATTENDANCE_DATE" }
        return
    }

    const result = await evaluateAbandonmentForWorkspace({
        companyId: workspace.companyId,
        branchId: workspace.branchId,
        throughDate,
    })

    summary.lifecycle = {
        abandonmentChecked: true,
        throughDate: result.throughDate || throughDate,
        employeesChecked: result.checked || 0,
        abandoned: result.abandoned || 0,
        updates: result.updates || [],
    }

    console.log(
        `[attendance][lifecycle] ${workspace.companyId}/${workspace.branchId} `
        + `through ${summary.lifecycle.throughDate}: checked=${summary.lifecycle.employeesChecked}, `
        + `abandoned=${summary.lifecycle.abandoned}`,
    )
}

/**
 * High-throughput attendance import.
 *
 * The old importer queried Employee -> Shift -> Attendance -> Policy and then
 * updated Attendance once per source row. For a 3,500-row payroll file that
 * caused tens of thousands of MongoDB round trips. This version performs the
 * same attendance rules with batched lookups and bulkWrite operations.
 */
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

    if (!workspace?.companyId || !workspace?.branchId) {
        throw new Error("Company and branch workspace are required for attendance import.")
    }
    assertAttendanceScope(user, workspace.companyId, workspace.branchId)
    if (!rows.length) return summary

    onProgress?.({
        phase: "LOADING_MASTER_DATA",
        percent: 35,
        processedRows: 0,
        totalRows: summary.totalRows,
    })

    const employeeCodes = [...new Set(rows.map((row) => normalizedEmployeeCode(row.payload.employeeCode)).filter(Boolean))]
    const employees = await Employee.find({
        employeeCode: { $in: employeeCodes },
        recordStatus: "ACTIVE",
        companyId: workspace.companyId,
        branchId: workspace.branchId,
    }).lean()
    const employeeByCode = new Map(employees.map((employee) => [normalizedEmployeeCode(employee.employeeCode), employee]))

    const shiftIds = [...new Set(employees.map((employee) => String(employee.shiftId || "")).filter(Boolean))]
    const shifts = shiftIds.length
        ? await Shift.find({ _id: { $in: shiftIds }, status: "ACTIVE" }).lean()
        : []
    const shiftById = new Map(shifts.map((shift) => [String(shift._id), shift]))
    const policies = await loadPoliciesForWorkspace(workspace)

    onProgress?.({
        phase: "MATCHING_EMPLOYEES",
        percent: 45,
        processedRows: 0,
        totalRows: summary.totalRows,
    })

    const issueOperations = []
    const validRows = []
    const mutations = []

    for (const row of rows) {
        const code = normalizedEmployeeCode(row.payload.employeeCode)
        const employee = employeeByCode.get(code)
        if (!employee) {
            summary.unmatchedCount += 1
            summary.issues.push({
                row: row.rowNumber,
                code: "NO_EMPLOYEE_MATCH",
                employeeCode: row.payload.employeeCode,
                message: `Employee No ${row.payload.employeeCode} was not found. The row was saved to Unmatched Attendance.`,
            })
            issueOperations.push({
                updateOne: {
                    filter: {
                        companyId: workspace.companyId,
                        branchId: workspace.branchId,
                        employeeCode: code,
                        attendanceDate: row.payload.attendanceDate,
                        status: "NO_EMPLOYEE_MATCH",
                    },
                    update: {
                        $set: {
                            importBatchId,
                            sourceRow: row.rowNumber,
                            firstInAt: row.payload.time1At,
                            lastOutAt: row.payload.time2At,
                            leaveCode: row.payload.leaveCode || null,
                            createdByAccountId: user.accountId,
                        },
                        $setOnInsert: {
                            companyId: workspace.companyId,
                            branchId: workspace.branchId,
                            employeeCode: code,
                            attendanceDate: row.payload.attendanceDate,
                            status: "NO_EMPLOYEE_MATCH",
                        },
                    },
                    upsert: true,
                },
            })
            continue
        }

        const shift = shiftById.get(String(employee.shiftId || ""))
        if (!shift) {
            summary.errorCount += 1
            summary.errors.push({
                row: row.rowNumber,
                code: "ATTENDANCE_SHIFT_NOT_FOUND",
                message: "Employee has no active shift assignment.",
            })
            continue
        }

        const rowMutations = buildImportMutations(row, employee, shift)
        validRows.push({ row, mutations: rowMutations })
        mutations.push(...rowMutations)
    }

    if (issueOperations.length) {
        await bulkWriteInChunks(AttendanceImportIssue, issueOperations)
    }

    if (!mutations.length) {
        summary.successCount += validRows.length
        onProgress?.({
            phase: "EVALUATING_LIFECYCLE",
            percent: 98,
            processedRows: rows.length,
            totalRows: summary.totalRows,
        })
        await runLifecycleAfterAttendanceImport({ rows, workspace, summary })
        onProgress?.({
            phase: "COMPLETED",
            percent: 100,
            processedRows: rows.length,
            totalRows: summary.totalRows,
        })
        return summary
    }

    onProgress?.({
        phase: "LOADING_EXISTING_ATTENDANCE",
        percent: 55,
        processedRows: 0,
        totalRows: summary.totalRows,
    })

    const employeeIds = [...new Set(mutations.map((mutation) => String(mutation.employee._id)))]
    const attendanceDates = [...new Map(mutations.map((mutation) => [toBusinessDateKey(mutation.attendanceDate), mutation.attendanceDate])).values()]
    const existingRecords = await AttendanceRecord.find({
        employeeId: { $in: employeeIds },
        attendanceDate: { $in: attendanceDates },
    }).lean()
    const stateByKey = new Map(existingRecords.map((record) => [attendanceKey(record.employeeId, record.attendanceDate), record]))

    const attendanceOperationByKey = new Map()
    let processedRows = 0

    for (const item of validRows) {
        let rowFailed = false
        let current = null

        for (const mutation of item.mutations) {
            const key = attendanceKey(mutation.employee._id, mutation.attendanceDate)
            const existing = stateByKey.get(key) || null

            if (!assertRecordUnlocked(existing)) {
                summary.errorCount += 1
                summary.errors.push({
                    row: item.row.rowNumber,
                    code: "ATTENDANCE_RECORD_LOCKED",
                    message: "Attendance is payroll-locked or finalized.",
                })
                rowFailed = true
                break
            }

            if (hasConfirmedHrCorrection(existing)) {
                current = existing
                continue
            }

            const policy = policyForDate(policies, mutation.attendanceDate)
            const values = toBulkValues({ mutation, existing, user, policy })
            if (!values) continue

            attendanceOperationByKey.set(key, {
                updateOne: {
                    filter: {
                        employeeId: mutation.employee._id,
                        attendanceDate: mutation.attendanceDate,
                    },
                    update: {
                        $set: values,
                        $setOnInsert: {
                            employeeId: mutation.employee._id,
                            attendanceDate: mutation.attendanceDate,
                            createdByAccountId: user.accountId,
                        },
                    },
                    upsert: true,
                },
            })

            current = {
                ...existing,
                ...values,
                employeeId: mutation.employee._id,
                attendanceDate: mutation.attendanceDate,
            }
            stateByKey.set(key, current)
        }

        if (!rowFailed) {
            summary.successCount += 1
            countSummaryRecord(summary, current)
        }

        processedRows += 1
        if (processedRows % 250 === 0 || processedRows === validRows.length) {
            onProgress?.({
                phase: "BUILDING_BATCH",
                percent: 55 + Math.round((processedRows / Math.max(validRows.length, 1)) * 20),
                processedRows,
                totalRows: summary.totalRows,
            })
        }
    }

    onProgress?.({
        phase: "SAVING_BATCH",
        percent: 80,
        processedRows,
        totalRows: summary.totalRows,
    })
    const attendanceOperations = [...attendanceOperationByKey.values()]
    if (attendanceOperations.length) {
        await bulkWriteInChunks(AttendanceRecord, attendanceOperations)
    }

    invalidateAttendanceCaches()
    onProgress?.({
        phase: "EVALUATING_LIFECYCLE",
        percent: 98,
        processedRows: rows.length,
        totalRows: summary.totalRows,
    })
    await runLifecycleAfterAttendanceImport({ rows, workspace, summary })
    onProgress?.({
        phase: "COMPLETED",
        percent: 100,
        processedRows: rows.length,
        totalRows: summary.totalRows,
    })
    return summary
}
