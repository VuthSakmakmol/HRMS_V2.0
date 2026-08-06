import Employee from "../../employee/models/Employee.js"
import AttendanceImportIssue from "../models/AttendanceImportIssue.js"
import { upsertAttendanceRecord } from "./attendance.service.js"
import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { assertAttendanceScope } from "../utils/attendanceScope.util.js"

function normalizeEmployeeCode(value) {
    return String(value || "").trim().toUpperCase()
}

function uniqueCodes(values = []) {
    return [...new Set(values.map(normalizeEmployeeCode).filter(Boolean))]
}

function buildIssueFilter({ companyId, branchId, employeeCodes }) {
    const filter = {
        companyId,
        branchId,
        status: "NO_EMPLOYEE_MATCH",
    }

    const codes = uniqueCodes(employeeCodes)
    if (codes.length) filter.employeeCode = { $in: codes }

    return filter
}

function clearAttendanceCaches() {
    clearCacheByPrefix("attendance:")
    clearCacheByPrefix("hr-dashboard:")
}

/**
 * Converts saved NO_EMPLOYEE_MATCH rows into real AttendanceRecord rows.
 * Existing scan times are preserved and attendance is recalculated by the
 * normal attendance engine. A row is marked RESOLVED only after the real
 * attendance record has been created or updated successfully.
 */
export async function syncUnmatchedAttendance({
    companyId,
    branchId,
    employeeCodes = [],
    user,
}) {
    assertAttendanceScope(user, companyId, branchId)

    const filter = buildIssueFilter({ companyId, branchId, employeeCodes })
    const issues = await AttendanceImportIssue.find(filter)
        .sort({ attendanceDate: 1, sourceRow: 1 })
        .lean()

    const summary = {
        checkedCount: issues.length,
        matchedCount: 0,
        stillUnmatchedCount: 0,
        failedCount: 0,
        resolvedIssueIds: [],
        errors: [],
    }

    if (!issues.length) return summary

    const codes = uniqueCodes(issues.map((issue) => issue.employeeCode))
    const employees = await Employee.find({
        companyId,
        branchId,
        employeeCode: { $in: codes },
        recordStatus: { $ne: "ARCHIVED" },
    })
        .select("_id employeeCode")
        .lean()

    const employeeByCode = new Map(
        employees.map((employee) => [normalizeEmployeeCode(employee.employeeCode), employee]),
    )

    for (const issue of issues) {
        const employeeCode = normalizeEmployeeCode(issue.employeeCode)
        const employee = employeeByCode.get(employeeCode)

        if (!employee) {
            summary.stillUnmatchedCount += 1
            continue
        }

        try {
            await upsertAttendanceRecord({
                payload: {
                    companyId,
                    branchId,
                    employeeCode,
                    attendanceDate: issue.attendanceDate,
                    firstInAt: issue.firstInAt || null,
                    lastOutAt: issue.lastOutAt || null,
                    leaveCode: issue.leaveCode || null,
                    note: "Automatically matched from Unmatched Attendance",
                },
                user,
                source: "EXCEL_IMPORT",
                manualCorrection: false,
                invalidateCache: false,
            })

            await AttendanceImportIssue.updateOne(
                { _id: issue._id, status: "NO_EMPLOYEE_MATCH" },
                {
                    $set: {
                        status: "RESOLVED",
                        resolvedEmployeeId: employee._id,
                        resolvedAt: new Date(),
                    },
                },
            )

            summary.matchedCount += 1
            summary.resolvedIssueIds.push(issue._id.toString())
        } catch (error) {
            summary.failedCount += 1
            summary.errors.push({
                issueId: issue._id.toString(),
                employeeCode,
                attendanceDate: issue.attendanceDate,
                code: error.code || "ATTENDANCE_UNMATCHED_SYNC_FAILED",
                message: error.message || "Unable to convert unmatched attendance.",
            })
        }
    }

    if (summary.matchedCount > 0) clearAttendanceCaches()
    return summary
}

export async function syncUnmatchedAttendanceForEmployee({ employee, user }) {
    if (!employee?.companyId || !employee?.branchId || !employee?.employeeCode) {
        return {
            checkedCount: 0,
            matchedCount: 0,
            stillUnmatchedCount: 0,
            failedCount: 0,
            resolvedIssueIds: [],
            errors: [],
        }
    }

    return syncUnmatchedAttendance({
        companyId: employee.companyId,
        branchId: employee.branchId,
        employeeCodes: [employee.employeeCode],
        user,
    })
}
