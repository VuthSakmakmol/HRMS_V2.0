import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"
import CalendarDay from "../../calendar/models/CalendarDay.js"
import AttendanceRecord from "../../attendance/models/AttendanceRecord.js"
import ExitReason from "../../exitReason/models/ExitReason.js"
import { createAutomaticMovementForEmployeeUpdate } from "../../employeeMovement/services/employeeMovement.service.js"
import Employee from "../models/Employee.js"
import EmployeeMaternityLeave from "../models/EmployeeMaternityLeave.js"
import {
    addBusinessDays,
    businessWeekday,
    endOfBusinessDay,
    startOfBusinessDay,
    toBusinessDateKey,
} from "../../attendance/utils/attendanceDate.util.js"

export const MATERNITY_LEAVE_DAYS = 90
export const ABANDONMENT_CONSECUTIVE_WORKING_DAYS = 6
const ABANDONMENT_LOOKBACK_DAYS = 45
const EXIT_STATUSES = new Set(["RESIGNED", "TERMINATED", "ABANDONED", "PASSED_AWAY", "RETIRED"])

function toDateKey(value) {
    if (!value) return ""
    return toBusinessDateKey(value)
}

function dateForKey(value) {
    return startOfBusinessDay(value)
}

export function calculateMaternityLeaveDates(startValue) {
    const startKey = toDateKey(startValue)
    if (!startKey) return null
    const endKey = addBusinessDays(startKey, MATERNITY_LEAVE_DAYS - 1)
    const returnKey = addBusinessDays(startKey, MATERNITY_LEAVE_DAYS)
    return {
        maternityLeaveStartDate: dateForKey(startKey),
        maternityLeaveEndDate: dateForKey(endKey),
        maternityExpectedReturnDate: dateForKey(returnKey),
    }
}

export function buildMaternityEmployeeFields({ employmentStatus, maternityLeaveStartDate, existing = {} }) {
    if (employmentStatus !== "MATERNITY_LEAVE") {
        return {
            maternityLeaveStartDate: existing.maternityLeaveStartDate || null,
            maternityLeaveEndDate: existing.maternityLeaveEndDate || null,
            maternityExpectedReturnDate: existing.maternityExpectedReturnDate || null,
        }
    }

    const dates = calculateMaternityLeaveDates(maternityLeaveStartDate)
    if (!dates) {
        throw new AppError({
            statusCode: 422,
            code: "EMPLOYEE_MATERNITY_START_DATE_REQUIRED",
            messageKey: "errors.validationFailed",
            fields: {
                maternityLeaveStartDate: ["Maternity Leave Start Date is required."],
            },
        })
    }
    return dates
}

function sameDate(left, right) {
    if (!left && !right) return true
    if (!left || !right) return false
    return toDateKey(left) === toDateKey(right)
}

function clearLifecycleCaches() {
    clearCacheByPrefix("employee:list:")
    clearCacheByPrefix("employeeMovement:list:")
    clearCacheByPrefix("attendance:")
    clearCacheByPrefix("attendance:daily-report:")
    clearCacheByPrefix("hr-dashboard:")
    clearCacheByPrefix("excome:")
}

export async function syncMaternityPeriodAfterEmployeeChange({ before = null, after, user = null, source = "EMPLOYEE_PROFILE" }) {
    if (!after?._id) return null

    const beforeStatus = before?.employmentStatus || null
    const afterStatus = after.employmentStatus
    const accountId = user?.accountId || null

    if (afterStatus === "MATERNITY_LEAVE") {
        const dates = calculateMaternityLeaveDates(after.maternityLeaveStartDate)
        if (!dates) return null

        await EmployeeMaternityLeave.updateMany(
            {
                employeeId: after._id,
                status: "ACTIVE",
                startDate: { $ne: dates.maternityLeaveStartDate },
            },
            {
                $set: {
                    status: "CANCELLED",
                    updatedByAccountId: accountId,
                },
            },
        )

        const period = await EmployeeMaternityLeave.findOneAndUpdate(
            {
                employeeId: after._id,
                startDate: dates.maternityLeaveStartDate,
            },
            {
                $set: {
                    companyId: after.companyId,
                    branchId: after.branchId,
                    endDate: dates.maternityLeaveEndDate,
                    expectedReturnDate: dates.maternityExpectedReturnDate,
                    actualReturnDate: null,
                    status: "ACTIVE",
                    source,
                    updatedByAccountId: accountId,
                },
                $setOnInsert: {
                    createdByAccountId: accountId,
                },
            },
            { upsert: true, new: true, runValidators: true },
        ).lean()

        clearLifecycleCaches()
        return period
    }

    if (beforeStatus === "MATERNITY_LEAVE" && afterStatus !== "MATERNITY_LEAVE") {
        const activePeriod = await EmployeeMaternityLeave.findOne({
            employeeId: after._id,
            status: "ACTIVE",
        }).sort({ startDate: -1 })

        if (activePeriod) {
            if (afterStatus === "WORKING") {
                const actualReturnKey = toDateKey(new Date())
                const actualReturnDate = dateForKey(actualReturnKey)
                const actualEndDate = dateForKey(addBusinessDays(actualReturnKey, -1))

                if (actualReturnDate <= activePeriod.startDate) {
                    activePeriod.status = "CANCELLED"
                    activePeriod.actualReturnDate = null
                } else {
                    activePeriod.status = "COMPLETED"
                    activePeriod.actualReturnDate = actualReturnDate
                    if (actualEndDate < activePeriod.endDate) {
                        activePeriod.endDate = actualEndDate
                    }
                }
            } else if (EXIT_STATUSES.has(afterStatus)) {
                // An employee who exits during maternity must keep the already
                // elapsed maternity history. Truncate the leave at the exit
                // date instead of cancelling the period and losing history.
                activePeriod.status = "COMPLETED"
                activePeriod.actualReturnDate = null
                if (after.resignDate) {
                    const exitDate = dateForKey(toDateKey(after.resignDate))
                    if (exitDate < activePeriod.startDate) {
                        activePeriod.status = "CANCELLED"
                    } else if (exitDate < activePeriod.endDate) {
                        activePeriod.endDate = exitDate
                    }
                }
            } else {
                activePeriod.status = "CANCELLED"
                activePeriod.actualReturnDate = null
            }

            activePeriod.updatedByAccountId = accountId
            await activePeriod.save()
            clearLifecycleCaches()
            return activePeriod.toObject()
        }
    }

    return null
}

export async function getMaternityPeriodsForEmployees({ employeeIds, dateFrom, dateTo }) {
    if (!employeeIds?.length) return []
    return EmployeeMaternityLeave.find({
        employeeId: { $in: employeeIds },
        status: { $ne: "CANCELLED" },
        startDate: { $lte: endOfBusinessDay(dateTo) },
        endDate: { $gte: startOfBusinessDay(dateFrom) },
    })
        .select("employeeId companyId branchId startDate endDate expectedReturnDate actualReturnDate status")
        .lean()
}

export function buildMaternityPeriodMap(periods = []) {
    const byEmployee = new Map()
    for (const period of periods) {
        const key = String(period.employeeId)
        if (!byEmployee.has(key)) byEmployee.set(key, [])
        byEmployee.get(key).push({
            startKey: toDateKey(period.startDate),
            endKey: toDateKey(period.endDate),
        })
    }
    return byEmployee
}

export function employeeIsOnMaternityDate(employeeId, dateKey, maternityPeriodMap) {
    return (maternityPeriodMap.get(String(employeeId)) || []).some(
        (period) => period.startKey <= dateKey && dateKey <= period.endKey,
    )
}

async function ensureAbandonedExitReason({ companyId, branchId }) {
    let reason = await ExitReason.findOne({
        companyId,
        branchId,
        status: "ACTIVE",
        $or: [
            { code: { $in: ["ABANDONED", "ABANDON"] } },
            { name: /^abandoned$/i },
        ],
    }).lean()

    if (reason) return reason

    try {
        reason = await ExitReason.create({
            companyId,
            branchId,
            code: "ABANDONED",
            name: "Abandoned",
            description: "System exit reason for 6 consecutive working-day absences.",
            status: "ACTIVE",
        })
        return reason.toObject()
    } catch (error) {
        if (error?.code !== 11000) throw error
        return ExitReason.findOne({ companyId, branchId, code: "ABANDONED" }).lean()
    }
}

function calendarIsWorking(dateKey, calendarByDate) {
    const override = calendarByDate.get(dateKey)
    if (override) {
        return ["WORKING_DAY", "SPECIAL_WORKING_DAY", "COMPANY_EVENT"].includes(override.dayType)
    }
    return businessWeekday(dateKey) !== 0
}

function buildCalendarByDate(days = []) {
    const scopeRank = { GLOBAL: 1, COMPANY: 2, BRANCH: 3 }
    const result = new Map()
    for (const day of days) {
        const current = result.get(day.dateKey)
        if (!current || (scopeRank[day.scopeLevel] || 0) > (scopeRank[current.scopeLevel] || 0)) {
            result.set(day.dateKey, day)
        }
    }
    return result
}

function attendanceRowKey(employeeId, dateValue) {
    return `${String(employeeId)}|${toDateKey(dateValue)}`
}

function isPresent(record) {
    return Boolean(record?.firstInAt || record?.lastOutAt)
}

function isApprovedAttendanceLeave(record) {
    return ["AL", "ML", "SL", "UL"].includes(String(record?.leaveCode || "").toUpperCase())
}

export async function evaluateAbandonmentForWorkspace({ companyId, branchId, throughDate }) {
    if (!companyId || !branchId || !throughDate) {
        return { checked: 0, abandoned: 0, skipped: true }
    }

    const throughKey = toDateKey(throughDate)
    const fromKey = addBusinessDays(throughKey, -ABANDONMENT_LOOKBACK_DAYS)
    const employees = await Employee.find({
        companyId,
        branchId,
        recordStatus: "ACTIVE",
        employmentStatus: "WORKING",
        joinDate: { $lte: endOfBusinessDay(throughKey) },
        $or: [{ resignDate: null }, { resignDate: { $gt: endOfBusinessDay(throughKey) } }],
    })
        .select("_id employeeCode companyId branchId joinDate employmentStatus resignDate exitReasonId resignReason recordStatus departmentId positionId lineId shiftId employeeTypeId employeeTypeChildId employeeTypeChildCode employeeTypeChildName")
        .lean()

    if (!employees.length) return { checked: 0, abandoned: 0, throughDate: throughKey }

    const employeeIds = employees.map((employee) => employee._id)
    const [attendanceRows, calendarRows, maternityPeriods] = await Promise.all([
        AttendanceRecord.find({
            employeeId: { $in: employeeIds },
            attendanceDate: {
                $gte: startOfBusinessDay(fromKey),
                $lte: endOfBusinessDay(throughKey),
            },
        })
            .select("employeeId attendanceDate firstInAt lastOutAt leaveCode")
            .lean(),
        CalendarDay.find({
            status: "ACTIVE",
            dateKey: { $gte: fromKey, $lte: throughKey },
            $or: [{ scopeLevel: "GLOBAL" }, { companyId }, { branchId }],
        })
            .select("dateKey dayType scopeLevel")
            .lean(),
        getMaternityPeriodsForEmployees({ employeeIds, dateFrom: fromKey, dateTo: throughKey }),
    ])

    const attendanceByEmployeeDate = new Map(
        attendanceRows.map((row) => [attendanceRowKey(row.employeeId, row.attendanceDate), row]),
    )
    const maternityMap = buildMaternityPeriodMap(maternityPeriods)
    const calendarByDate = buildCalendarByDate(calendarRows)
    const exitReason = await ensureAbandonedExitReason({ companyId, branchId })

    let abandoned = 0
    const updates = []

    for (const employee of employees) {
        const joinKey = toDateKey(employee.joinDate)
        let cursor = throughKey
        const consecutiveAbsentWorkingDates = []

        while (cursor >= fromKey && cursor >= joinKey) {
            if (!calendarIsWorking(cursor, calendarByDate)) {
                cursor = addBusinessDays(cursor, -1)
                continue
            }

            if (employeeIsOnMaternityDate(employee._id, cursor, maternityMap)) break

            const record = attendanceByEmployeeDate.get(`${String(employee._id)}|${cursor}`)
            if (isPresent(record) || isApprovedAttendanceLeave(record)) break

            consecutiveAbsentWorkingDates.push(cursor)
            cursor = addBusinessDays(cursor, -1)
        }

        if (consecutiveAbsentWorkingDates.length < ABANDONMENT_CONSECUTIVE_WORKING_DAYS) continue

        // Dates were collected newest -> oldest. If the system discovers an
        // 8-day streak late, the exit date must still be the 6th absence from
        // the START of the streak, not simply today's/latest absent date.
        const thresholdIndex = consecutiveAbsentWorkingDates.length - ABANDONMENT_CONSECUTIVE_WORKING_DAYS
        const abandonedKey = consecutiveAbsentWorkingDates[thresholdIndex]
        const before = employee
        const abandonedDate = startOfBusinessDay(abandonedKey)
        const updated = await Employee.findOneAndUpdate(
            { _id: employee._id, employmentStatus: "WORKING", recordStatus: "ACTIVE" },
            {
                $set: {
                    employmentStatus: "ABANDONED",
                    resignDate: abandonedDate,
                    exitReasonId: exitReason?._id || exitReason?.id || null,
                    resignReason: `${ABANDONMENT_CONSECUTIVE_WORKING_DAYS} consecutive working days absent. Updated automatically by HRMS.`,
                    updatedByAccountId: null,
                },
            },
            { new: true, runValidators: true, context: "query" },
        ).lean()

        if (!updated) continue

        await createAutomaticMovementForEmployeeUpdate({
            before,
            after: updated,
            user: { accountId: null, isRootAdmin: true, roleAssignments: [] },
            source: "SYSTEM",
            effectiveDate: abandonedDate,
            reason: `Automatically changed to ABANDONED after ${ABANDONMENT_CONSECUTIVE_WORKING_DAYS} consecutive working-day absences.`,
        })

        abandoned += 1
        updates.push({ employeeCode: employee.employeeCode, exitDate: abandonedKey })
    }

    if (abandoned) clearLifecycleCaches()
    return { checked: employees.length, abandoned, throughDate: throughKey, updates }
}

export async function autoReturnMaternityEmployees({ asOf = new Date() } = {}) {
    const todayKey = toDateKey(asOf)
    const dueEmployees = await Employee.find({
        recordStatus: "ACTIVE",
        employmentStatus: "MATERNITY_LEAVE",
        maternityExpectedReturnDate: { $lte: endOfBusinessDay(todayKey) },
    }).lean()

    let returned = 0
    const updates = []

    for (const employee of dueEmployees) {
        const returnKey = toDateKey(employee.maternityExpectedReturnDate || todayKey)
        const before = employee
        const updated = await Employee.findOneAndUpdate(
            { _id: employee._id, employmentStatus: "MATERNITY_LEAVE", recordStatus: "ACTIVE" },
            {
                $set: {
                    employmentStatus: "WORKING",
                    resignDate: null,
                    exitReasonId: null,
                    resignReason: "",
                    updatedByAccountId: null,
                },
            },
            { new: true, runValidators: true, context: "query" },
        ).lean()

        if (!updated) continue

        await EmployeeMaternityLeave.findOneAndUpdate(
            { employeeId: employee._id, status: "ACTIVE" },
            {
                $set: {
                    status: "COMPLETED",
                    actualReturnDate: startOfBusinessDay(returnKey),
                    source: "SYSTEM",
                    updatedByAccountId: null,
                },
            },
            { sort: { startDate: -1 }, new: true },
        )

        await createAutomaticMovementForEmployeeUpdate({
            before,
            after: updated,
            user: { accountId: null, isRootAdmin: true, roleAssignments: [] },
            source: "SYSTEM",
            effectiveDate: startOfBusinessDay(returnKey),
            reason: `Automatically returned to WORKING after ${MATERNITY_LEAVE_DAYS} days of maternity leave.`,
        })

        returned += 1
        updates.push({ employeeCode: employee.employeeCode, returnDate: returnKey })
    }

    if (returned) clearLifecycleCaches()
    return { checked: dueEmployees.length, returned, asOf: todayKey, updates }
}

export function exitStatus(value) {
    return EXIT_STATUSES.has(value)
}
