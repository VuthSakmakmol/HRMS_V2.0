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
import { startOfBusinessDay, toBusinessDateKey } from "../utils/attendanceDate.util.js"
import { assertAttendanceScope } from "../utils/attendanceScope.util.js"

const LEGACY_HEADERS = ["Record Date", "Employee No", "Time1", "Time2", "Vacation"]
const MONTHLY_HEADERS = ["Record Date", "Employee No", "Working Hours"]
const MONTHLY_TEMPLATE_HEADERS = [...MONTHLY_HEADERS, "Vacation"]
const VACATION_OPTIONS = [
    "Absent",
    "Annual Leave",
    "Annual Leave (Hours)",
    "Special Permission",
    "forget scan finger",
    "Her Maternity Leave",
    "Her Maternity Leave(0%)",
    "Paid Leave 50%",
    "Sick Leave",
    "Sick Leave (60%)",
    "Sick Leave (Hours)",
    "Unpaid Leave",
]
const VACATION_CODE_BY_VALUE = new Map([
    ["annual leave", "AL"],
    ["annual leave (hours)", "AL"],
    ["special permission", "SP"],
    ["special leave", "SP"],
    ["special permission leave", "SP"],
    ["her maternity leave", "ML"],
    ["maternity leave", "ML"],
    ["her maternity leave(0%)", "ML"],
    ["her maternity leave (0%)", "ML"],
    ["sick leave", "SL"],
    ["sick leave (60%)", "SL"],
    ["sick leave (hours)", "SL"],
    ["unpaid leave", "UL"],
])

function normalizedVacationText(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLowerCase()
}

function isBlankVacation(value) {
    const normalized = normalizedVacationText(value)
    return !normalized || normalized === "(blanks)" || normalized === "blanks"
}

function isExplicitAbsentVacation(value) {
    const normalized = normalizedVacationText(value)
    return normalized === "absent" || normalized === "absence"
}

function isForgotScanVacation(value) {
    const normalized = normalizedVacationText(value)
    return [
        "forget scan finger",
        "forgot scan finger",
        "forget finger scan",
        "forgot finger scan",
    ].includes(normalized)
}

function isInformedVacation(value) {
    return !isBlankVacation(value) && !isExplicitAbsentVacation(value)
}

function normalizeHeader(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLowerCase()
}

function normalizeVacation(value) {
    if (isBlankVacation(value)) {
        return { leaveCode: null, vacation: "" }
    }
    const normalized = normalizedVacationText(value)
    return {
        leaveCode: VACATION_CODE_BY_VALUE.get(normalized) || null,
        vacation: String(value).trim(),
    }
}

function vacationLabel(code) {
    return {
        AL: "Annual Leave",
        SP: "Special Permission",
        ML: "Maternity Leave",
        SL: "Sick Leave",
        UL: "Unpaid Leave",
    }[code] || ""
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
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Phnom_Penh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(value)
    const v = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]))
    return (Date.UTC(v.year, v.month - 1, v.day) - Date.UTC(1899, 11, 30)) / 86_400_000
}

function normalizeFourDigitTime(value) {
    if (value === null || value === undefined || value === "") return null
    if (value instanceof Date) return { hours: value.getHours(), minutes: value.getMinutes() }
    const raw = String(value).trim()
    const digits = /^\d{1,4}$/.test(raw) ? raw.padStart(4, "0") : null
    if (!digits) return null
    const hours = Number(digits.slice(0, 2))
    const minutes = Number(digits.slice(2, 4))
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
    const date = new Date(value)
    date.setDate(date.getDate() + days)
    return date
}

function minutesOf(time) {
    const [h, m] = String(time || "00:00").split(":").map(Number)
    return h * 60 + m
}

function isOvernightShift(shift) {
    return Boolean(shift?.isOvernight) || minutesOf(shift?.endTime) <= minutesOf(shift?.startTime)
}

function headerMap(sheet) {
    const map = new Map()
    const headerRow = sheet.getRow(1)
    const maxColumn = Math.max(headerRow.cellCount || 0, headerRow.actualCellCount || 0)
    for (let column = 1; column <= maxColumn; column += 1) {
        const normalized = normalizeHeader(headerRow.getCell(column).value)
        if (normalized && !map.has(normalized)) map.set(normalized, column)
    }
    return map
}

function hasHeaders(map, headers) {
    return headers.every((header) => map.has(normalizeHeader(header)))
}

function getCellByHeader(row, map, header) {
    const column = map.get(normalizeHeader(header))
    return column ? row.getCell(column).value : null
}

function parseWorkingHours(value) {
    if (value === null || value === undefined || value === "") return null
    const numeric = Number(String(value).trim())
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 24) return null
    return numeric
}

function monthlyAbsenceDayValue(workingHours, vacationDescription = "") {
    if (isForgotScanVacation(vacationDescription)) return 0
    return Math.max(0, Number(workingHours) || 0) <= 0 ? 1 : 0
}

function detectAttendanceSheet(workbook) {
    let legacyCandidate = null
    for (const sheet of workbook.worksheets) {
        const map = headerMap(sheet)
        if (hasHeaders(map, MONTHLY_HEADERS)) {
            return { sheet, map, mode: "MONTHLY_SUMMARY" }
        }
        if (!legacyCandidate && hasHeaders(map, LEGACY_HEADERS)) {
            legacyCandidate = { sheet, map, mode: "LEGACY_SCAN" }
        }
    }
    return legacyCandidate || {
        error: `No supported attendance sheet found. Monthly format: ${MONTHLY_HEADERS.join(", ")}.`,
    }
}

export async function buildAttendanceImportTemplate() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Monthly Attendance")
    sheet.addRow(MONTHLY_TEMPLATE_HEADERS)
    sheet.addRow([getPhnomPenhExcelDateSerial(), "EMP001", 8, ""])
    sheet.addRow([getPhnomPenhExcelDateSerial(), "EMP002", 0, "Annual Leave"])
    sheet.addRow([getPhnomPenhExcelDateSerial(), "EMP003", 0, "forget scan finger"])

    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } }
    sheet.views = [{ state: "frozen", ySplit: 1 }]
    sheet.autoFilter = { from: "A1", to: "D1" }
    sheet.columns = [{ width: 18 }, { width: 20 }, { width: 18 }, { width: 28 }]
    sheet.getColumn(1).numFmt = "dd/mm/yyyy"
    sheet.getColumn(3).numFmt = "0.00"
    sheet.dataValidations.add("C2:C150000", {
        type: "decimal",
        operator: "between",
        allowBlank: false,
        formulae: [0, 24],
    })
    sheet.dataValidations.add("D2:D150000", {
        type: "list",
        allowBlank: true,
        formulae: [`"${VACATION_OPTIONS.join(",")}"`],
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
            vacation: record.vacationDescription || vacationLabel(record.leaveCode),
            workedMinutes: record.workedMinutes,
            lateMinutes: record.lateMinutes,
            earlyLeaveMinutes: record.earlyLeaveMinutes,
            status: record.status,
            source: record.source,
            issues: (record.issueCodes || []).join(", "),
            note: record.note || "",
        })
    }
    sheet.getRow(1).font = { bold: true }
    sheet.views = [{ state: "frozen", ySplit: 1 }]
    sheet.autoFilter = { from: "A1", to: "Q1" }
    return workbook
}

export async function buildAttendanceImportIssueWorkbook(issues = []) {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Unmatched Attendance")
    sheet.columns = [
        { header: "Record Date", key: "attendanceDate", width: 16 },
        { header: "Employee No", key: "employeeCode", width: 18 },
        { header: "Working Hours", key: "workingHours", width: 16 },
        { header: "Vacation", key: "vacation", width: 22 },
        { header: "Time1", key: "firstInAt", width: 12 },
        { header: "Time2", key: "lastOutAt", width: 12 },
        { header: "Excel Row", key: "sourceRow", width: 12 },
        { header: "Status", key: "status", width: 22 },
    ]
    for (const issue of issues) {
        sheet.addRow({ ...issue, vacation: issue.vacationDescription || vacationLabel(issue.leaveCode) })
    }
    sheet.getRow(1).font = { bold: true }
    return workbook
}

export async function parseAttendanceWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const rows = []
    const errors = []
    const detected = detectAttendanceSheet(workbook)
    if (detected.error) {
        return { rows, errors: [{ row: 1, code: "INVALID_ATTENDANCE_TEMPLATE", message: detected.error }], mode: null }
    }

    const { sheet, map, mode } = detected
    const duplicateKeys = new Set()
    let duplicateCount = 0

    // Do not use worksheet.eachRow() here. With a 95k-150k row monthly file,
    // one long synchronous callback loop can block Express long enough for the
    // browser's job-status request to appear frozen. Yield periodically so the
    // import remains a true background job and progress/status endpoints stay
    // responsive while rows are being normalized.
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber)
        const rawDate = getCellByHeader(row, map, "Record Date")
        const attendanceDate = excelDateToDate(rawDate)
        const employeeCode = String(getCellByHeader(row, map, "Employee No") || "").trim()

        if (mode === "MONTHLY_SUMMARY") {
            const rawWorkingHours = getCellByHeader(row, map, "Working Hours")
            const rawVacation = getCellByHeader(row, map, "Vacation")
            const vacation = normalizeVacation(rawVacation)
            const isBlankRow = !employeeCode
                && !attendanceDate
                && (rawWorkingHours === null || rawWorkingHours === undefined || rawWorkingHours === "")
                && isBlankVacation(rawVacation)

            if (!isBlankRow) {
                if (!employeeCode || !attendanceDate) {
                    errors.push({ row: rowNumber, code: "MONTHLY_REQUIRED_FIELDS", message: "Record Date and Employee No are required." })
                } else {
                    const workingHours = parseWorkingHours(rawWorkingHours)
                    if (workingHours === null) {
                        errors.push({ row: rowNumber, code: "INVALID_WORKING_HOURS", message: "Working Hours is required and must be a number from 0 to 24." })
                    } else {
                        const dateKey = toBusinessDateKey(attendanceDate)
                        const uniqueKey = `${normalizedEmployeeCode(employeeCode)}|${dateKey}`
                        if (duplicateKeys.has(uniqueKey)) {
                            duplicateCount += 1
                            errors.push({ row: rowNumber, code: "DUPLICATE_EMPLOYEE_DATE", message: `Duplicate Employee No + Record Date: ${employeeCode} on ${dateKey}.` })
                        } else {
                            duplicateKeys.add(uniqueKey)
                            rows.push({
                                rowNumber,
                                payload: {
                                    importMode: "MONTHLY_SUMMARY",
                                    employeeCode,
                                    attendanceDate,
                                    workingHours,
                                    leaveCode: vacation.leaveCode,
                                    vacationDescription: vacation.vacation,
                                    expectedDayValue: 1,
                                    absenceDayValue: monthlyAbsenceDayValue(workingHours, vacation.vacation),
                                    note: "",
                                },
                            })
                        }
                    }
                }
            }
        } else {
            const rawTime1 = getCellByHeader(row, map, "Time1")
            const rawTime2 = getCellByHeader(row, map, "Time2")
            const rawVacation = getCellByHeader(row, map, "Vacation")
            const isBlankRow = !employeeCode && !attendanceDate && !rawTime1 && !rawTime2 && !rawVacation

            if (!isBlankRow) {
                if (!employeeCode || !attendanceDate) {
                    errors.push({ row: rowNumber, message: "Record Date and Employee No are required." })
                } else {
                    const time1 = normalizeFourDigitTime(rawTime1)
                    const time2 = normalizeFourDigitTime(rawTime2)
                    if ((rawTime1 !== null && rawTime1 !== undefined && rawTime1 !== "" && !time1) || (rawTime2 !== null && rawTime2 !== undefined && rawTime2 !== "" && !time2)) {
                        errors.push({ row: rowNumber, message: "Time1 and Time2 must use valid HHmm values." })
                    } else {
                        const vacation = normalizeVacation(rawVacation)
                        rows.push({
                            rowNumber,
                            payload: {
                                importMode: "LEGACY_SCAN",
                                employeeCode,
                                attendanceDate,
                                time1At: time1 ? combineDateAndTime(attendanceDate, rawTime1) : null,
                                time2At: time2 ? combineDateAndTime(attendanceDate, rawTime2) : null,
                                leaveCode: vacation.leaveCode,
                                vacationDescription: vacation.vacation,
                                note: "",
                            },
                        })
                    }
                }
            }
        }

        if (rowNumber % 2000 === 0) {
            await new Promise((resolve) => setImmediate(resolve))
        }
    }

    return { rows, errors, mode, duplicateCount, worksheetName: sheet.name }
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

function buildImportMutations(row, employee, shift = null) {
    const common = {
        sourceRow: row.rowNumber,
        employee,
        shift,
        importMode: row.payload.importMode || "LEGACY_SCAN",
        leaveCode: row.payload.leaveCode || null,
        vacationDescription: row.payload.vacationDescription || "",
        note: row.payload.note || "",
    }

    if (common.importMode === "MONTHLY_SUMMARY") {
        return [{
            ...common,
            attendanceDate: startOfBusinessDay(toBusinessDateKey(row.payload.attendanceDate)),
            workingHours: Number(row.payload.workingHours) || 0,
            expectedDayValue: Number(row.payload.expectedDayValue ?? 1),
            absenceDayValue: Number(row.payload.absenceDayValue ?? 0),
            firstInAt: null,
            lastOutAt: null,
        }]
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
    const employee = mutation.employee

    if (mutation.importMode === "MONTHLY_SUMMARY") {
        const workingHours = Math.max(0, Number(mutation.workingHours) || 0)
        const workedMinutes = Math.round(workingHours * 60)
        const forgotScan = isForgotScanVacation(mutation.vacationDescription)
        const status = (workingHours > 0 || forgotScan) ? "PRESENT" : "ABSENT"

        return {
            employeeCode: employee.employeeCode,
            companyId: employee.companyId,
            branchId: employee.branchId,
            departmentId: employee.departmentId,
            positionId: employee.positionId,
            lineId: employee.lineId,
            shiftId: employee.shiftId,
            source: "EXCEL_IMPORT",
            firstInAt: null,
            lastOutAt: null,
            workedMinutes,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            leaveCode: mutation.leaveCode || null,
            vacationDescription: mutation.vacationDescription || "",
            dayType: existing?.dayType || "WORKING_DAY",
            status,
            verificationStatus: "VERIFIED",
            issueCodes: [],
            rawScanIds: [],
            expectedDayValue: Math.max(0, Math.min(1, Number(mutation.expectedDayValue ?? 1))),
            absenceDayValue: forgotScan
                ? 0
                : Math.max(0, Math.min(1, Number(mutation.absenceDayValue ?? 0))),
            note: mutation.note || "Monthly payroll attendance import",
            policySnapshot: existing?.policySnapshot || {},
            calculationVersion: "MONTHLY_PAYROLL_V1",
            updatedByAccountId: user.accountId,
            lockStatus: existing?.lockStatus || "OPEN",
            correction: {
                correctedByAccountId: null,
                correctedAt: null,
                reason: "",
                previousValues: null,
            },
        }
    }

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
        vacationDescription: mutation.vacationDescription || existing?.vacationDescription || "",
        expectedDayValue: 1,
        absenceDayValue: (mutation.leaveCode || calculated.status === "ABSENT") ? 1 : 0,
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

async function bulkWriteInChunks(Model, operations, chunkSize = 2000, onChunk = null) {
    for (let index = 0; index < operations.length; index += chunkSize) {
        await Model.bulkWrite(operations.slice(index, index + chunkSize), { ordered: false })
        onChunk?.({
            processed: Math.min(index + chunkSize, operations.length),
            total: operations.length,
        })
    }
}

function recordHasInformedVacation(record) {
    return isInformedVacation(record?.vacationDescription)
}

function countSummaryRecord(summary, current) {
    if (!current) return
    const absenceValue = Number.isFinite(Number(current.absenceDayValue))
        ? Number(current.absenceDayValue)
        : ((current.status === "ABSENT" || current.leaveCode) ? 1 : 0)

    if (current.status === "PRESENT") summary.presentCount += 1
    if (current.status === "ABSENT" && !current.leaveCode && !recordHasInformedVacation(current)) summary.absentCount += absenceValue
    if (current.leaveCode === "AL") summary.annualLeaveCount += absenceValue
    if (current.leaveCode === "SP") summary.specialPermissionCount += absenceValue
    if (current.leaveCode === "ML") summary.maternityLeaveCount += absenceValue
    if (current.leaveCode === "SL") summary.sickLeaveCount += absenceValue
    if (current.leaveCode === "UL") summary.unpaidLeaveCount += absenceValue
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

    // Evaluate immediately through the newest imported attendance date.
    // employeeLifecycle.service.js performs per-employee shift-completion
    // protection, so a current-day morning import cannot count as a completed
    // absence before that employee's shift has ended.
    const throughDate = latestImportedKey

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
export async function importAttendanceRows({ rows, parseErrors, user, workspace, onProgress, importMeta = {} }) {
    const importBatchId = new mongoose.Types.ObjectId()
    const summary = {
        importBatchId: importBatchId.toString(),
        totalRows: rows.length + parseErrors.length,
        successCount: 0,
        presentCount: 0,
        absentCount: 0,
        annualLeaveCount: 0,
        specialPermissionCount: 0,
        maternityLeaveCount: 0,
        sickLeaveCount: 0,
        unpaidLeaveCount: 0,
        missingInCount: 0,
        missingOutCount: 0,
        unmatchedCount: 0,
        errorCount: parseErrors.length,
        errors: [...parseErrors],
        issues: [],
        importMode: importMeta.mode || rows[0]?.payload?.importMode || "UNKNOWN",
        worksheetName: importMeta.worksheetName || "",
        duplicateCount: Number(importMeta.duplicateCount) || 0,
        uniqueEmployeeCount: new Set(rows.map((row) => normalizedEmployeeCode(row.payload.employeeCode)).filter(Boolean)).size,
        dateFrom: rows.length ? [...rows].map((row) => toBusinessDateKey(row.payload.attendanceDate)).sort()[0] : null,
        dateTo: rows.length ? [...rows].map((row) => toBusinessDateKey(row.payload.attendanceDate)).sort().at(-1) : null,
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

    const hasLegacyRows = rows.some((row) => row.payload.importMode !== "MONTHLY_SUMMARY")
    const shiftIds = hasLegacyRows
        ? [...new Set(employees.map((employee) => String(employee.shiftId || "")).filter(Boolean))]
        : []
    const shifts = shiftIds.length
        ? await Shift.find({ _id: { $in: shiftIds }, status: "ACTIVE" }).lean()
        : []
    const shiftById = new Map(shifts.map((shift) => [String(shift._id), shift]))
    const policies = hasLegacyRows ? await loadPoliciesForWorkspace(workspace) : []

    onProgress?.({
        phase: "MATCHING_EMPLOYEES",
        percent: 45,
        processedRows: 0,
        totalRows: summary.totalRows,
    })

    const issueOperations = []
    const validRows = []
    const mutations = []

    let matchingRowIndex = 0
    for (const row of rows) {
        matchingRowIndex += 1
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
                            inputMode: row.payload.importMode || "LEGACY_SCAN",
                            firstInAt: row.payload.time1At || null,
                            lastOutAt: row.payload.time2At || null,
                            workingHours: row.payload.importMode === "MONTHLY_SUMMARY" ? Number(row.payload.workingHours) || 0 : null,
                            expectedDayValue: row.payload.importMode === "MONTHLY_SUMMARY" ? Number(row.payload.expectedDayValue ?? 1) : null,
                            absenceDayValue: row.payload.importMode === "MONTHLY_SUMMARY" ? Number(row.payload.absenceDayValue ?? 0) : null,
                            leaveCode: row.payload.leaveCode || null,
                            vacationDescription: row.payload.vacationDescription || "",
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

        let shift = null
        if (row.payload.importMode === "MONTHLY_SUMMARY") {
            if (!employee.shiftId || !employee.lineId || !employee.positionId || !employee.departmentId) {
                summary.errorCount += 1
                summary.errors.push({
                    row: row.rowNumber,
                    code: "ATTENDANCE_EMPLOYEE_ORG_INCOMPLETE",
                    message: "Employee Master must have Department, Position, Line, and Shift before monthly attendance can be imported.",
                })
                continue
            }
        } else {
            shift = shiftById.get(String(employee.shiftId || ""))
            if (!shift) {
                summary.errorCount += 1
                summary.errors.push({
                    row: row.rowNumber,
                    code: "ATTENDANCE_SHIFT_NOT_FOUND",
                    message: "Employee has no active shift assignment.",
                })
                continue
            }
        }

        const rowMutations = buildImportMutations(row, employee, shift)
        validRows.push({ row, mutations: rowMutations })
        mutations.push(...rowMutations)

        if (matchingRowIndex % 2000 === 0) {
            onProgress?.({
                phase: "MATCHING_EMPLOYEES",
                percent: 45 + Math.round((matchingRowIndex / Math.max(rows.length, 1)) * 8),
                processedRows: matchingRowIndex,
                totalRows: summary.totalRows,
            })
            await new Promise((resolve) => setImmediate(resolve))
        }
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
        if (processedRows % 2000 === 0) {
            await new Promise((resolve) => setImmediate(resolve))
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
        await bulkWriteInChunks(AttendanceRecord, attendanceOperations, 2000, ({ processed, total }) => {
            onProgress?.({
                phase: "SAVING_BATCH",
                percent: 80 + Math.round((processed / Math.max(total, 1)) * 16),
                processedRows: processed,
                totalRows: total,
            })
        })
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
