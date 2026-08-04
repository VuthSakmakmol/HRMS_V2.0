import Employee from "../../employee/models/Employee.js"
import EmployeeMovement from "../../employeeMovement/models/EmployeeMovement.js"
import { createAutomaticMovementForEmployeeUpdate } from "../../employeeMovement/services/employeeMovement.service.js"
import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { assertAttendanceScope } from "../utils/attendanceScope.util.js"

const PAYROLL_STATUS_BY_LINE_CODE = Object.freeze({
    "1011": {
        employmentStatus: "ABANDONED",
        label: "Abandoned",
        priority: 3,
    },
    "5144": {
        employmentStatus: "RESIGNED",
        label: "Resign",
        priority: 3,
    },
    "5152": {
        employmentStatus: "MATERNITY_LEAVE",
        label: "Maternity Leave",
        priority: 1,
    },
    "5174": {
        employmentStatus: "RESIGNED",
        label: "Return Advance Worker Resigned",
        priority: 3,
    },
})

function normalizeEmployeeCode(value) {
    return String(value || "").trim().toUpperCase()
}

function extractLineCode(value) {
    const lineNo = String(value || "").trim()
    const match = lineNo.match(/^(\d{4})(?:\D|$)/)
    return match?.[1] || ""
}

function startOfReportDate(value) {
    const date = new Date(value)
    return new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
    ))
}

function sameBusinessDate(left, right) {
    if (!left || !right) return false
    return new Date(left).toISOString().slice(0, 10)
        === new Date(right).toISOString().slice(0, 10)
}

function chooseStatusRows(rows) {
    const selected = new Map()
    const conflictedEmployeeCodes = new Set()
    const conflicts = []
    let ignoredCount = 0

    for (const row of rows) {
        const employeeCode = normalizeEmployeeCode(row.employeeCode)
        const lineNo = String(row.lineNo || "").trim()
        const lineCode = extractLineCode(lineNo)
        const rule = PAYROLL_STATUS_BY_LINE_CODE[lineCode]

        if (!employeeCode || !rule) {
            ignoredCount += 1
            continue
        }

        if (conflictedEmployeeCodes.has(employeeCode)) {
            continue
        }

        const candidate = {
            employeeCode,
            lineNo,
            lineCode,
            ...rule,
        }
        const existing = selected.get(employeeCode)

        if (!existing) {
            selected.set(employeeCode, candidate)
            continue
        }

        if (existing.employmentStatus === candidate.employmentStatus) {
            if (candidate.priority > existing.priority) {
                selected.set(employeeCode, candidate)
            }
            continue
        }

        conflicts.push({
            employeeCode,
            lineNos: [existing.lineNo, candidate.lineNo],
            message: "Payroll returned conflicting employment statuses for one employee.",
        })
        selected.delete(employeeCode)
        conflictedEmployeeCodes.add(employeeCode)
    }

    return {
        selected: [...selected.values()],
        conflicts,
        ignoredCount,
    }
}

async function latestStatusMovement(employeeId) {
    return EmployeeMovement.findOne({
        employeeId,
        status: { $ne: "ARCHIVED" },
        $expr: {
            $ne: ["$from.employmentStatus", "$to.employmentStatus"],
        },
    })
        .sort({ effectiveDate: -1, createdAt: -1 })
        .select("effectiveDate to.employmentStatus")
        .lean()
}

function buildEmployeeUpdate({ employee, rule, reportDate }) {
    const update = {
        employmentStatus: rule.employmentStatus,
    }

    if (rule.employmentStatus === "MATERNITY_LEAVE") {
        update.resignDate = null
        update.exitReasonId = null
        update.resignReason = ""
        return update
    }

    update.resignDate = employee.resignDate
        && new Date(employee.resignDate) <= reportDate
        ? employee.resignDate
        : reportDate
    const statusAlreadyMatches = employee.employmentStatus === rule.employmentStatus
    update.exitReasonId = statusAlreadyMatches
        ? employee.exitReasonId || null
        : null
    update.resignReason = statusAlreadyMatches && employee.resignReason
        ? employee.resignReason
        : `Payroll line ${rule.lineNo}`.slice(0, 240)
    return update
}

function employeeNeedsUpdate(employee, update) {
    if (employee.employmentStatus !== update.employmentStatus) return true
    if (!sameBusinessDate(employee.resignDate, update.resignDate)) {
        return Boolean(employee.resignDate || update.resignDate)
    }
    if (String(employee.resignReason || "") !== String(update.resignReason || "")) {
        return true
    }
    return false
}

function clearEmployeeStatusCaches() {
    clearCacheByPrefix("employee:list:")
    clearCacheByPrefix("employeeMovement:list:")
    clearCacheByPrefix("employeeType:")
    clearCacheByPrefix("hr-dashboard:")
    clearCacheByPrefix("manpower-plan:")
    clearCacheByPrefix("attendance:")
}

export async function syncEmployeeStatusesFromPayroll({
    payload,
    user,
}) {
    assertAttendanceScope(user, payload.companyId, payload.branchId)

    const reportDate = startOfReportDate(payload.reportDate)
    const { selected, conflicts, ignoredCount } = chooseStatusRows(payload.rows)
    const employeeCodes = selected.map((row) => row.employeeCode)
    const employees = await Employee.find({
        companyId: payload.companyId,
        branchId: payload.branchId,
        employeeCode: { $in: employeeCodes },
        recordStatus: { $ne: "ARCHIVED" },
    }).lean()
    const employeeByCode = new Map(
        employees.map((employee) => [normalizeEmployeeCode(employee.employeeCode), employee]),
    )

    const summary = {
        reportDate: reportDate.toISOString().slice(0, 10),
        receivedCount: payload.rows.length,
        mappedCount: selected.length,
        updatedCount: 0,
        unchangedCount: 0,
        skippedOlderCount: 0,
        unmatchedCount: 0,
        conflictCount: conflicts.length,
        ignoredCount,
        errorCount: conflicts.length,
        updates: [],
        issues: [...conflicts],
    }

    for (const rule of selected) {
        const employee = employeeByCode.get(rule.employeeCode)
        if (!employee) {
            summary.unmatchedCount += 1
            summary.errorCount += 1
            summary.issues.push({
                employeeCode: rule.employeeCode,
                lineNo: rule.lineNo,
                message: "Employee was not found in this company and branch.",
            })
            continue
        }

        const latestMovement = await latestStatusMovement(employee._id)
        if (latestMovement?.effectiveDate
            && new Date(latestMovement.effectiveDate) > reportDate) {
            summary.skippedOlderCount += 1
            summary.issues.push({
                employeeCode: rule.employeeCode,
                lineNo: rule.lineNo,
                message: "An employment status with a newer effective date already exists.",
            })
            continue
        }

        const update = buildEmployeeUpdate({ employee, rule, reportDate })
        if (!employeeNeedsUpdate(employee, update)) {
            summary.unchangedCount += 1
            continue
        }

        let updated = null
        try {
            updated = await Employee.findByIdAndUpdate(
                employee._id,
                {
                    $set: {
                        ...update,
                        updatedByAccountId: user.accountId,
                    },
                },
                {
                    new: true,
                    runValidators: true,
                    context: "query",
                },
            ).lean()

            await createAutomaticMovementForEmployeeUpdate({
                before: employee,
                after: updated,
                user,
                source: "IMPORT",
                effectiveDate: reportDate,
                reason: `Updated automatically from Payroll attendance line ${rule.lineNo}.`,
            })

            summary.updatedCount += 1
            summary.updates.push({
                employeeCode: rule.employeeCode,
                lineNo: rule.lineNo,
                previousStatus: employee.employmentStatus,
                employmentStatus: updated.employmentStatus,
            })
        } catch (error) {
            if (updated) {
                await Employee.findByIdAndUpdate(
                    employee._id,
                    {
                        $set: {
                            employmentStatus: employee.employmentStatus,
                            resignDate: employee.resignDate || null,
                            exitReasonId: employee.exitReasonId || null,
                            resignReason: employee.resignReason || "",
                            updatedByAccountId: employee.updatedByAccountId || null,
                        },
                    },
                    { runValidators: true, context: "query" },
                )
            }
            summary.errorCount += 1
            summary.issues.push({
                employeeCode: rule.employeeCode,
                lineNo: rule.lineNo,
                message: error?.message || "Employee status could not be updated.",
            })
        }
    }

    if (summary.updatedCount > 0) {
        clearEmployeeStatusCaches()
    }

    return summary
}

export { PAYROLL_STATUS_BY_LINE_CODE }
