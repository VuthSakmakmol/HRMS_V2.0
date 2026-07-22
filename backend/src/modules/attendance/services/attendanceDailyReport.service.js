import ExcelJS from "exceljs"

import Employee from "../../employee/models/Employee.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"
import CalendarDay from "../../calendar/models/CalendarDay.js"
import HrDashboardTarget from "../../hrDashboardTarget/models/HrDashboardTarget.js"
import AttendanceRecord from "../models/AttendanceRecord.js"
import { AppError } from "../../../shared/errors/AppError.js"
import { attendanceScopeFilter, assertAttendanceScope } from "../utils/attendanceScope.util.js"
import {
    endOfBusinessDay,
    startOfBusinessDay,
    toBusinessDateKey,
} from "../utils/attendanceDate.util.js"

const LEAVE_CODES = ["ML", "AL", "UL", "SL"]
const CODE_ALIASES = {
    MATERNITY: "ML", MATERNITY_LEAVE: "ML", ML: "ML",
    ANNUAL: "AL", ANNUAL_LEAVE: "AL", AL: "AL",
    UNPAID: "UL", UNPAID_LEAVE: "UL", UL: "UL",
    SICK: "SL", SICK_LEAVE: "SL", SL: "SL",
}

function dateKey(date) {
    return toBusinessDateKey(date)
}

function monthRange(month) {
    if (!/^\d{4}-\d{2}$/.test(month || "")) {
        throw new AppError({ statusCode: 422, code: "VALIDATION_FAILED", messageKey: "errors.validationFailed" })
    }
    const [year, monthNumber] = month.split("-").map(Number)
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
    const firstKey = `${year}-${String(monthNumber).padStart(2, "0")}-01`
    const lastKey = `${year}-${String(monthNumber).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    const start = startOfBusinessDay(firstKey)
    const end = endOfBusinessDay(lastKey)
    const days = Array.from({ length: lastDay }, (_, index) => {
        const date = new Date(Date.UTC(year, monthNumber - 1, index + 1))
        const key = `${year}-${String(monthNumber).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`
        return { key, day: index + 1, weekday: date.getUTCDay() }
    })
    return { start, end, days }
}

function normalizedCode(record) {
    const value = record.absenceCode || record.leaveCode || record.leaveTypeCode || record.attendanceCode || record.correctionCode
    return CODE_ALIASES[String(value || "").trim().replace(/[\s-]+/g, "_").toUpperCase()] || (record.status === "ABSENT" ? "AB" : "")
}

function average(values, workingIndexes) {
    const actual = workingIndexes.map((index) => Number(values[index] || 0))
    return actual.length ? actual.reduce((sum, value) => sum + value, 0) / actual.length : 0
}

export async function buildAttendanceDailyReport({ query, user, onProgress = () => {} }) {
    const companyId = query.companyId
    const branchId = query.branchId
    if (!companyId || !branchId) {
        throw new AppError({ statusCode: 422, code: "WORKSPACE_REQUIRED", messageKey: "errors.workspaceRequired" })
    }
    assertAttendanceScope(user, companyId, branchId)
    onProgress({ phase: "PREPARING", percent: 5, processedRows: 0, totalRows: 0 })
    const { start, end, days } = monthRange(query.month)
    const dimension = { companyId, branchId }
    for (const key of ["departmentId", "positionId", "lineId"]) if (query[key]) dimension[key] = query[key]

    let loadedSources = 0
    const trackSource = async (promise) => {
        const value = await promise
        loadedSources += 1
        onProgress({
            phase: "LOADING_DATA",
            percent: 5 + (loadedSources * 6),
            processedRows: loadedSources,
            totalRows: 5,
        })
        return value
    }

    const [year, monthNumber] = query.month.split("-").map(Number)
    const [employees, records, calendarDays, departments, positions, attendanceTargetRecords] = await Promise.all([
        trackSource(Employee.find({ ...dimension, ...attendanceScopeFilter(user), recordStatus: { $ne: "ARCHIVED" }, joinDate: { $lte: end }, $or: [{ resignDate: null }, { resignDate: { $gte: start } }] })
            .select("_id joinDate resignDate departmentId positionId employeeTypeId").lean()),
        trackSource(AttendanceRecord.find({ ...dimension, ...attendanceScopeFilter(user), attendanceDate: { $gte: start, $lte: end } })
            .select("employeeId attendanceDate departmentId positionId status firstInAt lastOutAt attendanceCode absenceCode leaveCode leaveTypeCode correctionCode").lean()),
        trackSource(CalendarDay.find({ status: "ACTIVE", dateKey: { $gte: days[0].key, $lte: days.at(-1).key }, $or: [{ scopeLevel: "GLOBAL" }, { companyId }, { branchId }] }).lean()),
        trackSource(Department.find({ companyId, branchId, status: { $ne: "ARCHIVED" } }).select("code name").lean()),
        trackSource(Position.find({ companyId, branchId, status: { $ne: "ARCHIVED" } }).select("code title departmentId").lean()),
        HrDashboardTarget.find({
            companyId,
            branchId,
            metric: "ABSENCE_RATE",
            year,
            month: { $in: [monthNumber, 0] },
            status: "ACTIVE",
            employeeTypeId: { $ne: null },
            departmentId: null,
            positionId: null,
            lineId: null,
            employeeTypeChildId: null,
        }).sort({ employeeTypeId: 1, month: -1, updatedAt: -1 })
            .select("employeeTypeId targetRate month")
            .lean(),
    ])
    onProgress({ phase: "LOADING_DATA", percent: 35, processedRows: 5, totalRows: 5 })

    const targetByEmployeeType = new Map()
    for (const target of attendanceTargetRecords) {
        const employeeTypeId = String(target.employeeTypeId || "")
        if (employeeTypeId && !targetByEmployeeType.has(employeeTypeId)) {
            targetByEmployeeType.set(employeeTypeId, target)
        }
    }
    const employeeTypeCounts = new Map()
    for (const employee of employees) {
        const employeeTypeId = String(employee.employeeTypeId || "")
        if (employeeTypeId) {
            employeeTypeCounts.set(employeeTypeId, (employeeTypeCounts.get(employeeTypeId) || 0) + 1)
        }
    }
    const targetSources = [...targetByEmployeeType.entries()]
        .map(([employeeTypeId, target]) => ({
            employeeTypeId,
            rate: Number(target.targetRate),
            month: Number(target.month),
            employeeCount: employeeTypeCounts.get(employeeTypeId) || 0,
        }))
        .filter((item) => item.employeeCount > 0)
    const coveredEmployees = targetSources.reduce((sum, item) => sum + item.employeeCount, 0)
    const weightedTargetRate = coveredEmployees
        ? targetSources.reduce((sum, item) => sum + (item.rate * item.employeeCount), 0) / coveredEmployees
        : null

    const calendarByDate = new Map()
    const scopeRank = { GLOBAL: 1, COMPANY: 2, BRANCH: 3 }
    for (const item of calendarDays) {
        const current = calendarByDate.get(item.dateKey)
        if (!current || (scopeRank[item.scopeLevel] || 0) > (scopeRank[current.scopeLevel] || 0)) {
            calendarByDate.set(item.dateKey, item)
        }
    }
    const reportDays = days.map((day) => {
        const calendar = calendarByDate.get(day.key)
        const dayType = calendar?.dayType || (day.weekday === 0 ? "WEEKEND" : "WORKING_DAY")
        return { ...day, dayType, name: calendar?.name || "", working: !["WEEKEND", "HOLIDAY", "CLOSED_DAY"].includes(dayType) }
    })
    const workingIndexes = reportDays.map((day, index) => day.working ? index : -1).filter((index) => index >= 0)
    const recordsByDay = new Map(reportDays.map((day) => [day.key, []]))
    for (const record of records) recordsByDay.get(dateKey(record.attendanceDate))?.push(record)

    const employeesByDepartment = new Map()
    const employeesByPosition = new Map()
    for (const employee of employees) {
        const departmentKey = String(employee.departmentId || "")
        const positionKey = String(employee.positionId || "")
        if (!employeesByDepartment.has(departmentKey)) employeesByDepartment.set(departmentKey, [])
        if (!employeesByPosition.has(positionKey)) employeesByPosition.set(positionKey, [])
        employeesByDepartment.get(departmentKey).push(employee)
        employeesByPosition.get(positionKey).push(employee)
    }

    const daily = reportDays.map((day) => {
        const dayStart = startOfBusinessDay(day.key)
        const dayEnd = endOfBusinessDay(day.key)
        const activeEmployees = employees.filter((employee) => employee.joinDate <= dayEnd && (!employee.resignDate || employee.resignDate >= dayStart))
        const rows = recordsByDay.get(day.key) || []
        const leave = Object.fromEntries(LEAVE_CODES.map((code) => [code, rows.filter((row) => normalizedCode(row) === code).length]))
        const absent = rows.filter((row) => row.status === "ABSENT" || normalizedCode(row)).length
        return {
            totalEmployees: activeEmployees.length,
            faceScans: rows.filter((row) => row.firstInAt || row.lastOutAt).length,
            absent,
            leave,
            absentRate: activeEmployees.length ? (absent / activeEmployees.length) * 100 : 0,
        }
    })
    onProgress({ phase: "CALCULATING_SUMMARY", percent: 55, processedRows: reportDays.length, totalRows: reportDays.length })

    const departmentMap = new Map(departments.map((item) => [String(item._id), item]))
    const isSewingDepartment = (department) => {
        const identity = `${department?.code || ""} ${department?.name || ""}`.trim().toUpperCase()
        return /(^|[\s_-])SEW(?:ING)?([\s_-]|$)/.test(identity) || identity.includes("SEWING")
    }
    const sewingDepartmentIds = new Set(
        departments.filter(isSewingDepartment).map((item) => String(item._id)),
    )

    const sewerDaily = reportDays.map((day) => {
        if (!day.working) {
            return {
                totalSewer: null,
                maternityLeaveRate: null,
                annualUnpaidLeaveRate: null,
                sickLeaveRate: null,
                absentWithoutInformRate: null,
                sewerCome: null,
                totalAbsentRate: null,
            }
        }

        const dayStart = startOfBusinessDay(day.key)
        const dayEnd = endOfBusinessDay(day.key)
        const activeSewerEmployees = employees.filter((employee) => (
            sewingDepartmentIds.has(String(employee.departmentId || ""))
            && employee.joinDate <= dayEnd
            && (!employee.resignDate || employee.resignDate >= dayStart)
        ))
        const sewerEmployeeIds = new Set(activeSewerEmployees.map((employee) => String(employee._id)))
        const sewerRecords = (recordsByDay.get(day.key) || []).filter((record) => (
            sewerEmployeeIds.has(String(record.employeeId))
        ))
        const scannedEmployeeIds = new Set(
            sewerRecords
                .filter((record) => record.firstInAt || record.lastOutAt)
                .map((record) => String(record.employeeId)),
        )
        const leaveEmployeeIds = Object.fromEntries(LEAVE_CODES.map((code) => [
            code,
            new Set(
                sewerRecords
                    .filter((record) => normalizedCode(record) === code)
                    .map((record) => String(record.employeeId)),
            ),
        ]))
        const informedAbsentIds = new Set([
            ...leaveEmployeeIds.ML,
            ...leaveEmployeeIds.AL,
            ...leaveEmployeeIds.UL,
            ...leaveEmployeeIds.SL,
        ])
        const totalSewer = activeSewerEmployees.length
        const sewerCome = scannedEmployeeIds.size
        const missingEmployeeIds = new Set(
            [...sewerEmployeeIds].filter((employeeId) => !scannedEmployeeIds.has(employeeId)),
        )
        const informedMissingCount = [...informedAbsentIds].filter((employeeId) => (
            missingEmployeeIds.has(employeeId)
        )).length
        const missingScan = missingEmployeeIds.size
        const absentWithoutInform = Math.max(missingScan - informedMissingCount, 0)
        const rate = (value) => totalSewer ? (value / totalSewer) * 100 : 0

        return {
            totalSewer,
            maternityLeaveRate: rate(leaveEmployeeIds.ML.size),
            annualUnpaidLeaveRate: rate(new Set([...leaveEmployeeIds.AL, ...leaveEmployeeIds.UL]).size),
            sickLeaveRate: rate(leaveEmployeeIds.SL.size),
            absentWithoutInformRate: rate(absentWithoutInform),
            sewerCome,
            totalAbsentRate: rate(missingScan),
        }
    })

    const sewerMetric = (field) => sewerDaily.map((item) => item[field])
    const sewerAverage = (field) => average(sewerMetric(field), workingIndexes)
    const groupDefinitions = [
        ...departments.map((item) => ({ key: `D:${item._id}`, level: 0, label: item.name, departmentId: String(item._id) })),
        ...positions
            .filter((item) => sewingDepartmentIds.has(String(item.departmentId)))
            .map((item) => ({ key: `P:${item._id}`, level: 1, label: `- ${item.title}`, departmentId: String(item.departmentId), positionId: String(item._id) })),
    ].sort((a, b) => {
        const aIsSewing = sewingDepartmentIds.has(a.departmentId)
        const bIsSewing = sewingDepartmentIds.has(b.departmentId)
        if (aIsSewing !== bIsSewing) return aIsSewing ? -1 : 1

        const departmentCompare = (departmentMap.get(a.departmentId)?.name || "").localeCompare(departmentMap.get(b.departmentId)?.name || "")
        if (departmentCompare) return departmentCompare
        return a.level - b.level || a.label.localeCompare(b.label)
    })
    const groupRows = []
    for (const [groupIndex, group] of groupDefinitions.entries()) {
        const groupEmployees = group.positionId
            ? (employeesByPosition.get(group.positionId) || [])
            : (employeesByDepartment.get(group.departmentId) || [])
        const employeeIds = new Set(groupEmployees.map((employee) => String(employee._id)))
        const values = reportDays.map((day) => {
            if (!day.working) return null
            const groupRecords = (recordsByDay.get(day.key) || []).filter((record) => employeeIds.has(String(record.employeeId)))
            const absent = groupRecords.filter((record) => record.status === "ABSENT" || normalizedCode(record)).length
            return groupEmployees.length ? (absent / groupEmployees.length) * 100 : 0
        })
        onProgress({
            phase: "CALCULATING_DEPARTMENTS",
            percent: 55 + Math.round(((groupIndex + 1) / Math.max(groupDefinitions.length, 1)) * 40),
            processedRows: groupIndex + 1,
            totalRows: groupDefinitions.length,
        })
        const row = { ...group, values, average: average(values, workingIndexes) }
        if (row.values.some((value) => value !== 0 && value !== null) || row.level === 0) {
            groupRows.push(row)
        }
        await new Promise((resolve) => setImmediate(resolve))
    }

    return {
        month: query.month,
        attendanceTarget: weightedTargetRate !== null
            ? {
                rate: weightedTargetRate,
                method: targetSources.length === 1 ? "EMPLOYEE_TYPE" : "HEADCOUNT_WEIGHTED",
                coveredEmployees,
                totalEmployees: employees.length,
                sources: targetSources,
            }
            : null,
        days: reportDays,
        summary: {
            totalEmployees: daily.map((item) => item.totalEmployees),
            faceScans: daily.map((item) => item.faceScans),
            leaves: Object.fromEntries(LEAVE_CODES.map((code) => [code, daily.map((item) => item.leave[code])])),
            absentRate: daily.map((item) => item.absentRate),
            averages: {
                totalEmployees: average(daily.map((item) => item.totalEmployees), workingIndexes),
                faceScans: average(daily.map((item) => item.faceScans), workingIndexes),
                leaves: Object.fromEntries(LEAVE_CODES.map((code) => [code, average(daily.map((item) => item.leave[code]), workingIndexes)])),
                absentRate: average(daily.map((item) => item.absentRate), workingIndexes),
            },
        },
        sewerAbsentRate: {
            totalSewer: sewerMetric("totalSewer"),
            maternityLeaveRate: sewerMetric("maternityLeaveRate"),
            annualUnpaidLeaveRate: sewerMetric("annualUnpaidLeaveRate"),
            sickLeaveRate: sewerMetric("sickLeaveRate"),
            absentWithoutInformRate: sewerMetric("absentWithoutInformRate"),
            sewerCome: sewerMetric("sewerCome"),
            totalAbsentRate: sewerMetric("totalAbsentRate"),
            averages: {
                totalSewer: sewerAverage("totalSewer"),
                maternityLeaveRate: sewerAverage("maternityLeaveRate"),
                annualUnpaidLeaveRate: sewerAverage("annualUnpaidLeaveRate"),
                sickLeaveRate: sewerAverage("sickLeaveRate"),
                absentWithoutInformRate: sewerAverage("absentWithoutInformRate"),
                sewerCome: sewerAverage("sewerCome"),
                totalAbsentRate: sewerAverage("totalAbsentRate"),
            },
        },
        groupRows,
    }
}

function percentFill(value, targetRate) {
    if (targetRate === null) return "C6EFCE"
    if (value < Math.max(targetRate - 2, 0)) return "C6EFCE"
    if (value < targetRate) return "FFEB9C"
    return "FFC7CE"
}

export async function buildAttendanceDailyReportWorkbook(report, onProgress = () => {}) {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Daily Attendance")
    sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }]
    sheet.columns = [{ width: 24 }, ...report.days.map(() => ({ width: 6 })), { width: 7 }]
    const addRow = (label, values, avg, percent = false) => {
        const row = sheet.addRow([label, ...values.map((value) => value === null ? "" : percent ? value / 100 : value), percent ? avg / 100 : avg])
        if (percent) row.eachCell((cell, column) => { if (column > 1 && typeof cell.value === "number") { cell.numFmt = "0.0%"; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: percentFill(cell.value * 100, report.attendanceTarget?.rate ?? null) } } } })
        return row
    }
    sheet.addRow(["Attendance Daily Report", ...report.days.map((day) => day.day), "Avg"])
    addRow("TOTAL EMPLOYEE", report.summary.totalEmployees, report.summary.averages.totalEmployees)
    addRow("FACE SCAN", report.summary.faceScans, report.summary.averages.faceScans)
    addRow("- MATERNITY LEAVE", report.summary.leaves.ML, report.summary.averages.leaves.ML)
    addRow("- ANNUAL LEAVE", report.summary.leaves.AL, report.summary.averages.leaves.AL)
    addRow("- UNPAID LEAVE", report.summary.leaves.UL, report.summary.averages.leaves.UL)
    addRow("- SICK LEAVE", report.summary.leaves.SL, report.summary.averages.leaves.SL)
    addRow("ABSENT RATE", report.summary.absentRate, report.summary.averages.absentRate, true)
    sheet.addRow([])
    sheet.addRow(["FORGET FINGER SCAN"])
    for (const [index, item] of report.groupRows.entries()) {
        addRow(item.label, item.values, item.average, true)
        onProgress({
            phase: "BUILDING_EXCEL",
            percent: 70 + Math.round(((index + 1) / Math.max(report.groupRows.length, 1)) * 25),
            processedRows: index + 1,
            totalRows: report.groupRows.length,
        })
        await new Promise((resolve) => setImmediate(resolve))
    }
    sheet.addRow([])
    sheet.addRow(["SEWER ABSENT RATE"])
    addRow("TOTAL SEWER", report.sewerAbsentRate.totalSewer, report.sewerAbsentRate.averages.totalSewer)
    addRow("- MATERNITY LEAVE", report.sewerAbsentRate.maternityLeaveRate, report.sewerAbsentRate.averages.maternityLeaveRate, true)
    addRow("- ANNUAL LEAVE / UNPAID", report.sewerAbsentRate.annualUnpaidLeaveRate, report.sewerAbsentRate.averages.annualUnpaidLeaveRate, true)
    addRow("- SICK LEAVE", report.sewerAbsentRate.sickLeaveRate, report.sewerAbsentRate.averages.sickLeaveRate, true)
    addRow("- ABSENT WITHOUT INFORM", report.sewerAbsentRate.absentWithoutInformRate, report.sewerAbsentRate.averages.absentWithoutInformRate, true)
    addRow("SEWER COME", report.sewerAbsentRate.sewerCome, report.sewerAbsentRate.averages.sewerCome)
    addRow("TOTAL ABSENT RATE", report.sewerAbsentRate.totalAbsentRate, report.sewerAbsentRate.averages.totalAbsentRate, true)
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } }
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1F4E78" } }
    sheet.eachRow((row) => row.eachCell((cell) => { cell.border = { top: { style: "thin", color: { argb: "9EADBD" } }, left: { style: "thin", color: { argb: "9EADBD" } }, bottom: { style: "thin", color: { argb: "9EADBD" } }, right: { style: "thin", color: { argb: "9EADBD" } } }; cell.alignment = { vertical: "middle", horizontal: cell.col === 1 ? "left" : "center" } }))
    return workbook
}
