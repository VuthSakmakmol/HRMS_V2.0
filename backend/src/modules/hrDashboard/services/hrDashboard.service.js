import mongoose from "mongoose"

import { getCache, setCache } from "../../../shared/cache/memoryCache.js"
import AttendanceRecord from "../../attendance/models/AttendanceRecord.js"
import Employee from "../../employee/models/Employee.js"
import EmployeeMovement from "../../employeeMovement/models/EmployeeMovement.js"
import RecruitmentChannel from "../../recruitmentChannel/models/RecruitmentChannel.js"
import EmployeeType from "../../employeeType/models/EmployeeType.js"
import ExitReason from "../../exitReason/models/ExitReason.js"
import Line from "../../line/models/Line.js"
import ManpowerPlan from "../../manpowerPlan/models/ManpowerPlan.js"
import HrDashboardTarget from "../../hrDashboardTarget/models/HrDashboardTarget.js"
import Branch from "../../organization/models/Branch.js"
import Company from "../../organization/models/Company.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"

const MONTH_LABELS = Object.freeze([
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
])

const ENTRY_TYPES = new Set(["NEW_HIRE", "REJOIN"])
const EXIT_TYPES = new Set([
    "RESIGN",
    "TERMINATE",
    "ABANDON",
    "PASSED_AWAY",
    "RETIRE",
])

const FILTER_FIELDS = Object.freeze([
    "companyId",
    "branchId",
    "departmentId",
    "positionId",
    "lineId",
    "employeeTypeId",
])

const ATTENDANCE_FILTER_FIELDS = Object.freeze([
    "companyId",
    "branchId",
    "departmentId",
    "positionId",
    "lineId",
])

const PRESENT_STATUSES = new Set([
    "PRESENT",
    "LATE",
    "EARLY_LEAVE",
    "LATE_AND_EARLY_LEAVE",
    "MISSING_IN",
    "MISSING_OUT",
])

const LATE_STATUSES = new Set(["LATE", "LATE_AND_EARLY_LEAVE"])
const EARLY_STATUSES = new Set(["EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"])
const MISSING_STATUSES = new Set(["MISSING_IN", "MISSING_OUT"])

const DEFAULT_ABSENCE_TARGET_RATE = 4.88
const DEFAULT_TURNOVER_TARGET_RATE = 2.64

const ABSENCE_DETAIL_OPTIONS = Object.freeze([
    {
        code: "AL",
        label: "AL",
        name: "Annual Leave",
    },
    {
        code: "SP",
        label: "SP",
        name: "Special Permission",
    },
    {
        code: "UL",
        label: "UL",
        name: "Unpaid Leave",
    },
    {
        code: "AB",
        label: "AB",
        name: "Absent",
    },
    {
        code: "SL",
        label: "SL",
        name: "Sick Leave",
    },
    {
        code: "ML",
        label: "ML",
        name: "Maternity Leave",
    },
])

const ATTENDANCE_DETAIL_CODE_ALIASES = Object.freeze({
    ANNUAL_LEAVE: "AL",
    ANNUAL: "AL",
    AL: "AL",
    SPECIAL_PERMISSION: "SP",
    SPECIAL_LEAVE: "SP",
    SPECIAL: "SP",
    SP: "SP",
    UNPAID_LEAVE: "UL",
    UNPAID: "UL",
    UL: "UL",
    ABSENT: "AB",
    ABSENCE: "AB",
    AB: "AB",
    SICK_LEAVE: "SL",
    SICK: "SL",
    SL: "SL",
    MATERNITY_LEAVE: "ML",
    MATERNITY: "ML",
    ML: "ML",
})

const ABSENCE_OVERALL_TYPES = Object.freeze([
    {
        code: "UL",
        label: "Unpaid Leave",
        showDay: false,
        group: "absence",
    },
    {
        code: "SL",
        label: "Sick Leave",
        showDay: true,
        group: "absence",
    },
    {
        code: "AB",
        label: "Absent",
        showDay: true,
        group: "absence",
    },
    {
        code: "AL",
        label: "Annual Leave",
        showDay: true,
        group: "leave",
    },
    {
        code: "ML",
        label: "Maternity Leave",
        showDay: true,
        group: "leave",
    },
])

const ABSENCE_EXCLUDED_FROM_WORKFORCE_RATE = new Set(["AL", "ML"])
const ABSENCE_RATE_CODES = new Set(["UL", "SL", "SP", "AB", "AL", "ML"])
const ABSENCE_RATE_EXCLUDING_ANNUAL_MATERNITY_CODES = new Set(["UL", "SL", "SP", "AB"])
const TOP_ABSENT_DEPARTMENT_LIMIT = 15

const GENERAL_WORKFORCE_CATEGORY_KEYS = Object.freeze({
    DIRECT_LABOR: "DIRECT_LABOR",
    INDIRECT_LABOR: "INDIRECT_LABOR",
    RD_MARKETING: "RD_MARKETING",
})

const GENERAL_WORKFORCE_DEPARTMENT_KEYWORDS = Object.freeze([
    "MERCHANDISING",
    "MERCHANDISE",
    "MARKETING",
    "MKT",
    "RD MKT",
    "R D MKT",
    "R D",
])

const GENERAL_WORKFORCE_DIRECT_KEYWORDS = Object.freeze([
    "SEWER",
    "SEWING",
    "JUMPER",
])

function toObjectId(value) {
    return value ? new mongoose.Types.ObjectId(value) : undefined
}

function parseStartDate(value) {
    return new Date(`${value}T00:00:00.000Z`)
}

function parseEndDate(value) {
    return new Date(`${value}T23:59:59.999Z`)
}

function monthStart(year, month) {
    return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
}

function monthEnd(year, month) {
    return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
}

function parseEmployeeTypeFilter(query = {}) {
    const result = {
        employeeTypeId: query.employeeTypeId || null,
        employeeTypeChildCode: query.employeeTypeChildCode || null,
        employeeTypeFilterKey: query.employeeTypeFilterKey || null,
    }

    if (!query.employeeTypeFilterKey) {
        return result
    }

    const parts = String(query.employeeTypeFilterKey).split(":")

    if (parts[0] === "TYPE") {
        result.employeeTypeId = parts[1]
        result.employeeTypeChildCode = null
    }

    if (parts[0] === "CHILD") {
        result.employeeTypeId = parts[1]
        result.employeeTypeChildCode = parts[2]
    }

    return result
}

function normalizedQuery(query = {}) {
    const employeeTypeFilter = parseEmployeeTypeFilter(query)

    return {
        ...query,
        employeeTypeId: employeeTypeFilter.employeeTypeId || undefined,
        employeeTypeChildCode:
            employeeTypeFilter.employeeTypeChildCode || undefined,
        employeeTypeFilterKey:
            employeeTypeFilter.employeeTypeFilterKey || undefined,
    }
}

function buildDimensionMatch(query, prefix = "") {
    const match = {}
    const filter = normalizedQuery(query)

    for (const field of FILTER_FIELDS) {
        if (!filter[field]) continue

        const key = prefix ? `${prefix}.${field}` : field
        match[key] = toObjectId(filter[field])
    }

    if (filter.employeeTypeChildCode) {
        const key = prefix ? `${prefix}.employeeTypeChildCode` : "employeeTypeChildCode"
        match[key] = filter.employeeTypeChildCode
    }

    return match
}

function buildAttendanceDimensionMatch(query) {
    const match = {}

    for (const field of ATTENDANCE_FILTER_FIELDS) {
        if (!query[field]) continue
        match[field] = toObjectId(query[field])
    }

    return match
}

function createPeriods(startDate, endDate) {
    const periods = []
    const cursor = monthStart(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth() + 1,
    )
    const finalMonth = monthStart(
        endDate.getUTCFullYear(),
        endDate.getUTCMonth() + 1,
    )
    const spansMultipleYears =
        startDate.getUTCFullYear() !== endDate.getUTCFullYear()

    while (cursor <= finalMonth) {
        const year = cursor.getUTCFullYear()
        const month = cursor.getUTCMonth() + 1
        const key = `${year}-${String(month).padStart(2, "0")}`

        periods.push({
            key,
            year,
            month,
            label: spansMultipleYears
                ? `${MONTH_LABELS[month - 1]} ${year}`
                : MONTH_LABELS[month - 1],
            startDate: new Date(Math.max(monthStart(year, month), startDate)),
            endDate: new Date(Math.min(monthEnd(year, month), endDate)),
            budget: 0,
            roadmap: 0,
            actual: 0,
            targetGap: 0,
            roadmapGap: 0,
            fillRate: 0,
            in: 0,
            out: 0,
            balance: 0,
        })

        cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }

    return periods
}

function round(value, digits = 2) {
    const factor = 10 ** digits
    return Math.round((Number(value) || 0) * factor) / factor
}

function average(values) {
    const validValues = values.filter((value) => Number.isFinite(value))

    if (!validValues.length) return 0

    return validValues.reduce((sum, value) => sum + value, 0) / validValues.length
}

function calculateYears(startDate, endDate) {
    if (!startDate) return null

    const milliseconds = endDate.getTime() - new Date(startDate).getTime()

    if (milliseconds < 0) return null

    return milliseconds / (365.2425 * 24 * 60 * 60 * 1000)
}

function employeeWasActiveOn(employee, date) {
    const joined = employee.joinDate && new Date(employee.joinDate) <= date
    const notLeft = !employee.resignDate || new Date(employee.resignDate) > date

    return Boolean(joined && notLeft)
}

async function loadEmployees(query) {
    return Employee.find({
        ...buildDimensionMatch(query),
        recordStatus: { $ne: "ARCHIVED" },
    })
        .select([
            "dateOfBirth",
            "joinDate",
            "resignDate",
            "employmentStatus",
            "companyId",
            "branchId",
            "departmentId",
            "positionId",
            "lineId",
            "employeeTypeId",
            "employeeTypeChildId",
            "employeeTypeChildCode",
            "employeeTypeChildName",
            "sourceOfHiring",
            "recruitmentChannelId",
            "exitReasonId",
            "resignReason",
        ])
        .lean()
}

async function loadPlans(query, periods) {
    const periodConditions = periods.map((period) => ({
        year: period.year,
        month: period.month,
    }))

    return ManpowerPlan.find({
        ...buildDimensionMatch(query),
        status: "ACTIVE",
        $or: periodConditions,
    })
        .select([
            "year",
            "month",
            "targetBudget",
            "targetRoadmap",
            "employeeTypeId",
            "employeeTypeChildId",
            "employeeTypeChildCode",
            "employeeTypeChildName",
        ])
        .lean()
}

async function loadMovements(query, startDate, endDate) {
    const fromMatch = buildDimensionMatch(query, "from")
    const toMatch = buildDimensionMatch(query, "to")
    const hasDimensionFilter =
        FILTER_FIELDS.some((field) => normalizedQuery(query)[field]) ||
        Boolean(normalizedQuery(query).employeeTypeChildCode)

    return EmployeeMovement.find({
        effectiveDate: { $gte: startDate, $lte: endDate },
        status: "ACTIVE",
        ...(hasDimensionFilter ? { $or: [fromMatch, toMatch] } : {}),
    })
        .select([
            "movementType",
            "effectiveDate",
            "from.employeeTypeId",
            "from.employeeTypeChildId",
            "from.employeeTypeChildCode",
            "from.employeeTypeChildName",
            "to.employeeTypeId",
            "to.employeeTypeChildId",
            "to.employeeTypeChildCode",
            "to.employeeTypeChildName",
        ])
        .lean()
}

async function loadAttendanceRecords(query, startDate, endDate, employees) {
    const match = {
        ...buildAttendanceDimensionMatch(query),
        attendanceDate: { $gte: startDate, $lte: endDate },
    }

    const employeeTypeFilter = normalizedQuery(query)

    if (employeeTypeFilter.employeeTypeId || employeeTypeFilter.employeeTypeChildCode) {
        const employeeIds = employees.map((employee) => employee._id)

        if (!employeeIds.length) return []

        match.employeeId = { $in: employeeIds }
    }

    return AttendanceRecord.find(match)
        .select([
            "employeeId",
            "attendanceDate",
            "companyId",
            "branchId",
            "departmentId",
            "positionId",
            "lineId",
            "status",
            "verificationStatus",
            "workedMinutes",
            "lateMinutes",
            "earlyLeaveMinutes",
            "attendanceCode",
            "absenceCode",
            "leaveCode",
            "leaveTypeCode",
            "correctionCode",
            "dayValue",
            "days",
            "leaveDays",
            "absenceDays",
            "absentDays",
            "durationDays",
        ])
        .lean()
}

function clonePeriods(periods) {
    return periods.map((period) => ({
        key: period.key,
        year: period.year,
        month: period.month,
        label: period.label,
        budget: 0,
        roadmap: 0,
        actual: 0,
        targetGap: 0,
        roadmapGap: 0,
        fillRate: 0,
        in: 0,
        out: 0,
        balance: 0,
    }))
}

function cloneAttendancePeriods(periods) {
    return periods.map((period) => ({
        key: period.key,
        year: period.year,
        month: period.month,
        label: period.label,
        processed: 0,
        present: 0,
        absent: 0,
        late: 0,
        earlyLeave: 0,
        missingPunch: 0,
        needsReview: 0,
        holiday: 0,
        restDay: 0,
        attendanceRate: 0,
    }))
}

function buildManpowerSeries({ employees, plans, periods }) {
    const rows = clonePeriods(periods)
    const rowByKey = new Map(rows.map((row) => [row.key, row]))

    for (const plan of plans) {
        const key = `${plan.year}-${String(plan.month).padStart(2, "0")}`
        const row = rowByKey.get(key)

        if (!row) continue

        row.budget += Number(plan.targetBudget) || 0
        row.roadmap += Number(plan.targetRoadmap) || 0
    }

    for (const row of rows) {
        const periodEnd = monthEnd(row.year, row.month)

        row.actual = employees.filter((employee) =>
            employeeWasActiveOn(employee, periodEnd),
        ).length

        row.targetGap = row.actual - row.budget
        row.roadmapGap = row.actual - row.roadmap
        row.fillRate = row.roadmap > 0
            ? round((row.actual / row.roadmap) * 100, 1)
            : 0
    }

    return rows
}

function movementMatchesEmployeeTypeFilter(snapshot = {}, filter = {}) {
    if (filter.employeeTypeId) {
        const id = snapshot.employeeTypeId?.toString?.() || snapshot.employeeTypeId
        if (id !== filter.employeeTypeId) return false
    }

    if (filter.employeeTypeChildCode) {
        if (snapshot.employeeTypeChildCode !== filter.employeeTypeChildCode) {
            return false
        }
    }

    return true
}

function buildMovementSeries({ movements, periods, query }) {
    const rows = clonePeriods(periods)
    const rowByKey = new Map(rows.map((row) => [row.key, row]))
    const filter = normalizedQuery(query)

    for (const movement of movements) {
        const date = new Date(movement.effectiveDate)
        const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
        const row = rowByKey.get(key)

        if (!row) continue

        if (ENTRY_TYPES.has(movement.movementType)) {
            if (movementMatchesEmployeeTypeFilter(movement.to, filter)) {
                row.in += 1
            }
        }

        if (EXIT_TYPES.has(movement.movementType)) {
            if (movementMatchesEmployeeTypeFilter(movement.from, filter)) {
                row.out += 1
            }
        }
    }

    for (const row of rows) {
        row.balance = row.in - row.out
    }

    return rows
}

function buildAttendanceSeries({ records, periods }) {
    const rows = cloneAttendancePeriods(periods)
    const rowByKey = new Map(rows.map((row) => [row.key, row]))

    for (const record of records) {
        const date = new Date(record.attendanceDate)
        const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
        const row = rowByKey.get(key)

        if (!row) continue

        row.processed += 1

        if (PRESENT_STATUSES.has(record.status)) row.present += 1
        if (record.status === "ABSENT") row.absent += 1
        if (LATE_STATUSES.has(record.status) || Number(record.lateMinutes) > 0) row.late += 1
        if (EARLY_STATUSES.has(record.status) || Number(record.earlyLeaveMinutes) > 0) row.earlyLeave += 1
        if (MISSING_STATUSES.has(record.status)) row.missingPunch += 1
        if (record.verificationStatus === "NEEDS_REVIEW") row.needsReview += 1
        if (record.status === "HOLIDAY") row.holiday += 1
        if (record.status === "REST_DAY") row.restDay += 1
    }

    for (const row of rows) {
        const denominator = row.present + row.absent
        row.attendanceRate = denominator > 0
            ? round((row.present / denominator) * 100, 1)
            : 0
    }

    return rows
}

function buildAttendanceSummary(rows) {
    const summary = {
        processed: 0,
        present: 0,
        absent: 0,
        late: 0,
        earlyLeave: 0,
        missingPunch: 0,
        needsReview: 0,
        holiday: 0,
        restDay: 0,
        attendanceRate: 0,
    }

    for (const row of rows) {
        for (const key of Object.keys(summary)) {
            if (key !== "attendanceRate") summary[key] += Number(row[key]) || 0
        }
    }

    const denominator = summary.present + summary.absent
    summary.attendanceRate = denominator > 0
        ? round((summary.present / denominator) * 100, 1)
        : 0

    return summary
}

function buildAttendanceLineSummary({ records, lines }) {
    const lineById = new Map(lines.map((line) => [line._id.toString(), line]))
    const rowByLineId = new Map()

    for (const record of records) {
        const lineId = record.lineId?.toString?.()
        if (!lineId) continue

        if (!rowByLineId.has(lineId)) {
            const line = lineById.get(lineId)
            rowByLineId.set(lineId, {
                lineId,
                code: line?.code || "-",
                name: line?.name || "Unknown Line",
                processed: 0,
                present: 0,
                absent: 0,
                late: 0,
                missingPunch: 0,
                needsReview: 0,
                attendanceRate: 0,
            })
        }

        const row = rowByLineId.get(lineId)
        row.processed += 1
        if (PRESENT_STATUSES.has(record.status)) row.present += 1
        if (record.status === "ABSENT") row.absent += 1
        if (LATE_STATUSES.has(record.status) || Number(record.lateMinutes) > 0) row.late += 1
        if (MISSING_STATUSES.has(record.status)) row.missingPunch += 1
        if (record.verificationStatus === "NEEDS_REVIEW") row.needsReview += 1
    }

    return [...rowByLineId.values()]
        .map((row) => {
            const denominator = row.present + row.absent
            return {
                ...row,
                attendanceRate: denominator > 0
                    ? round((row.present / denominator) * 100, 1)
                    : 0,
            }
        })
        .sort((a, b) => b.absent - a.absent || b.late - a.late)
        .slice(0, 20)
}


function normalizeRecruitmentText(value) {
    return String(value || "")
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .toUpperCase()
}

function getRecruitmentSourceKeys(channel = {}) {
    const keys = []

    if (channel._id) {
        keys.push(`ID:${channel._id.toString()}`)
    }

    for (const value of [channel.code, channel.name, channel.shortName]) {
        const normalized = normalizeRecruitmentText(value)
        if (normalized) keys.push(`TEXT:${normalized}`)
    }

    return [...new Set(keys)]
}

function getEmployeeRecruitmentSourceKeys(employee = {}) {
    const keys = []

    if (employee.recruitmentChannelId) {
        keys.push(`ID:${employee.recruitmentChannelId.toString()}`)
    }

    const normalizedSource = normalizeRecruitmentText(employee.sourceOfHiring)

    if (normalizedSource) {
        keys.push(`TEXT:${normalizedSource}`)
    }

    return keys
}

function getChannelTargetMonthly(channel = {}) {
    return Number(
        channel.targetMonthly ??
        channel.targetPerMonth ??
        channel.monthlyTarget ??
        0,
    ) || 0
}

async function loadRecruitmentChannels(query = {}) {
    const match = {
        status: "ACTIVE",
    }
    const andConditions = []

    if (query.companyId) {
        andConditions.push({
            $or: [
                { companyId: toObjectId(query.companyId) },
                { companyId: null },
                { companyId: { $exists: false } },
            ],
        })
    }

    if (query.branchId) {
        andConditions.push({
            $or: [
                { branchId: toObjectId(query.branchId) },
                { branchId: null },
                { branchId: { $exists: false } },
            ],
        })
    }

    if (andConditions.length) {
        match.$and = andConditions
    }

    return RecruitmentChannel.find(match)
        .select([
            "companyId",
            "branchId",
            "code",
            "name",
            "shortName",
            "targetMonthly",
            "targetPerMonth",
            "monthlyTarget",
            "sortOrder",
            "status",
        ])
        .sort({ sortOrder: 1, name: 1 })
        .lean()
}


function toOptionalStringId(value) {
    if (!value) return ""

    return value?.toString?.() || String(value)
}

function targetFieldMatches(target, query, field) {
    const targetValue = toOptionalStringId(target[field])

    if (!targetValue) return true

    const queryValue = toOptionalStringId(query[field])

    return Boolean(queryValue && queryValue === targetValue)
}

function dashboardTargetMatches(target = {}, query = {}) {
    const fields = [
        "companyId",
        "branchId",
        "employeeTypeId",
    ]

    for (const field of fields) {
        if (!targetFieldMatches(target, query, field)) {
            return false
        }
    }

    if (
        target.employeeTypeChildId &&
        String(target.employeeTypeChildCode || "") !== String(query.employeeTypeChildCode || "")
    ) {
        return false
    }

    return true
}

function dashboardTargetSpecificity(target = {}, month) {
    let score = 0

    for (const field of [
        "companyId",
        "branchId",
        "employeeTypeId",
        "employeeTypeChildId",
        "employeeTypeChildCode",
    ]) {
        if (toOptionalStringId(target[field])) score += 10
    }

    if (Number(target.month) === month) score += 100

    return score
}

function pickDashboardTargetRate({ targets, metric, month, query, fallbackRate }) {
    const candidates = targets
        .filter((target) => target.metric === metric)
        .filter((target) => [0, month].includes(Number(target.month || 0)))
        .filter((target) => dashboardTargetMatches(target, query))
        .sort((a, b) => {
            const specificityDifference = dashboardTargetSpecificity(b, month) -
                dashboardTargetSpecificity(a, month)

            if (specificityDifference !== 0) return specificityDifference

            return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
        })

    return candidates.length
        ? Number(candidates[0].targetRate || 0)
        : fallbackRate
}

function buildDashboardTargetRates({ targets, metric, query, fallbackRate }) {
    const monthly = {}

    for (let month = 1; month <= 12; month += 1) {
        monthly[month] = pickDashboardTargetRate({
            targets,
            metric,
            month,
            query,
            fallbackRate,
        })
    }

    return {
        monthly,
        average: round(
            Object.values(monthly).reduce((sum, value) => sum + value, 0) / 12,
            2,
        ),
    }
}

async function loadDashboardTargets(query, year) {
    const match = {
        status: "ACTIVE",
        metric: { $in: ["ABSENCE_RATE", "TURNOVER_RATE"] },
        year,
    }

    if (query.companyId) {
        match.companyId = toObjectId(query.companyId)
    }

    if (query.branchId) {
        match.branchId = toObjectId(query.branchId)
    }

    return HrDashboardTarget.find(match)
        .select([
            "companyId",
            "branchId",
            "metric",
            "year",
            "month",
            "employeeTypeId",
            "employeeTypeChildId",
            "employeeTypeChildCode",
            "targetRate",
            "updatedAt",
        ])
        .lean()
}

function createRecruitmentMonthRows(periods = []) {
    return periods.map((period) => ({
        key: period.key,
        year: period.year,
        month: period.month,
        label: period.label,
        count: 0,
    }))
}

function createRecruitmentRowFromChannel(channel, periods) {
    return {
        id: channel._id?.toString?.() || null,
        key: channel._id?.toString?.() || normalizeRecruitmentText(channel.code || channel.name),
        code: channel.code || "",
        name: channel.name || channel.code || "-",
        shortName: channel.shortName || channel.name || channel.code || "-",
        targetPerMonth: getChannelTargetMonthly(channel),
        previousTotal: 0,
        previousAveragePerMonth: 0,
        currentTotal: 0,
        averagePerMonth: 0,
        months: createRecruitmentMonthRows(periods),
    }
}

function createRecruitmentRowFromText(sourceText, periods) {
    const label = sourceText
        ? String(sourceText).trim().replace(/\s+/g, " ")
        : "Unassigned"

    return {
        id: null,
        key: `TEXT:${normalizeRecruitmentText(label) || "UNASSIGNED"}`,
        code: normalizeRecruitmentText(label) || "UNASSIGNED",
        name: label,
        shortName: label,
        targetPerMonth: 0,
        previousTotal: 0,
        previousAveragePerMonth: 0,
        currentTotal: 0,
        averagePerMonth: 0,
        months: createRecruitmentMonthRows(periods),
    }
}

function findRecruitmentRowForEmployee(employee, rowBySourceKey, rows, periods) {
    for (const key of getEmployeeRecruitmentSourceKeys(employee)) {
        const row = rowBySourceKey.get(key)
        if (row) return row
    }

    const sourceKey = normalizeRecruitmentText(employee.sourceOfHiring)
    const fallbackKey = sourceKey ? `TEXT:${sourceKey}` : "TEXT:UNASSIGNED"

    if (!rowBySourceKey.has(fallbackKey)) {
        const row = createRecruitmentRowFromText(employee.sourceOfHiring || "Unassigned", periods)
        rows.push(row)
        rowBySourceKey.set(fallbackKey, row)
    }

    return rowBySourceKey.get(fallbackKey)
}

function buildRecruitmentPie(items = [], valueKey) {
    const total = items.reduce(
        (sum, item) => sum + (Number(item[valueKey]) || 0),
        0,
    )

    if (!total) return []

    return items
        .filter((item) => Number(item[valueKey]) > 0)
        .map((item) => ({
            name: item.shortName || item.name,
            value: Number(item[valueKey]) || 0,
            percent: round(((Number(item[valueKey]) || 0) / total) * 100, 1),
        }))
        .sort((a, b) => b.value - a.value)
}

function buildRecruitmentTotalRow(rows = [], periods = []) {
    const totalRow = {
        id: null,
        key: "TOTAL",
        code: "TOTAL",
        name: "Total",
        shortName: "Total",
        targetPerMonth: 0,
        previousTotal: 0,
        previousAveragePerMonth: 0,
        currentTotal: 0,
        averagePerMonth: 0,
        months: createRecruitmentMonthRows(periods),
    }

    for (const row of rows) {
        totalRow.targetPerMonth += Number(row.targetPerMonth) || 0
        totalRow.previousTotal += Number(row.previousTotal) || 0
        totalRow.currentTotal += Number(row.currentTotal) || 0

        row.months.forEach((month, index) => {
            totalRow.months[index].count += Number(month.count) || 0
        })
    }

    totalRow.previousAveragePerMonth = round(totalRow.previousTotal / 12, 0)
    totalRow.averagePerMonth = periods.length
        ? round(totalRow.currentTotal / periods.length, 0)
        : 0

    return totalRow
}

function buildRecruitmentChannelDashboard({
    employees,
    recruitmentChannels,
    periods,
    startDate,
    endDate,
}) {
    const firstPeriod = periods[0]
    const currentYear = firstPeriod?.year || startDate.getUTCFullYear()
    const previousYear = currentYear - 1
    const rows = []
    const rowBySourceKey = new Map()
    const monthIndexByKey = new Map(periods.map((period, index) => [period.key, index]))

    for (const channel of recruitmentChannels) {
        const row = createRecruitmentRowFromChannel(channel, periods)
        rows.push(row)

        for (const key of getRecruitmentSourceKeys(channel)) {
            rowBySourceKey.set(key, row)
        }
    }

    for (const employee of employees) {
        if (!employee.joinDate) continue

        const joinDate = new Date(employee.joinDate)
        const joinYear = joinDate.getUTCFullYear()
        const row = findRecruitmentRowForEmployee(employee, rowBySourceKey, rows, periods)

        if (joinYear === previousYear) {
            row.previousTotal += 1
        }

        if (joinDate >= startDate && joinDate <= endDate) {
            const key = `${joinYear}-${String(joinDate.getUTCMonth() + 1).padStart(2, "0")}`
            const monthIndex = monthIndexByKey.get(key)

            if (monthIndex !== undefined) {
                row.months[monthIndex].count += 1
                row.currentTotal += 1
            }
        }
    }

    for (const row of rows) {
        row.previousAveragePerMonth = round(row.previousTotal / 12, 0)
        row.averagePerMonth = periods.length
            ? round(row.currentTotal / periods.length, 0)
            : 0
    }

    const sortedRows = rows.sort(
        (a, b) =>
            (Number(b.currentTotal) || 0) - (Number(a.currentTotal) || 0) ||
            String(a.name || "").localeCompare(String(b.name || "")),
    )

    return {
        previousYear,
        currentYear,
        periods: periods.map((period) => ({
            key: period.key,
            year: period.year,
            month: period.month,
            label: period.label,
        })),
        rows: sortedRows,
        total: buildRecruitmentTotalRow(sortedRows, periods),
        charts: {
            previousYear: buildRecruitmentPie(sortedRows, "previousTotal"),
            currentYear: buildRecruitmentPie(sortedRows, "currentTotal"),
        },
    }
}

function normalizeAttendanceDetailCode(value) {
    if (!value) return ""

    const normalized = String(value)
        .trim()
        .replace(/[\s-]+/g, "_")
        .toUpperCase()

    return ATTENDANCE_DETAIL_CODE_ALIASES[normalized] || normalized
}

function getAttendanceDetailCode(record = {}) {
    const explicitCode = normalizeAttendanceDetailCode(
        record.absenceCode ||
            record.leaveCode ||
            record.leaveTypeCode ||
            record.attendanceCode ||
            record.correctionCode,
    )

    if (explicitCode) return explicitCode

    if (record.status === "ABSENT") return "AB"

    return ""
}

function isAttendanceExpectedWorkRecord(record = {}) {
    return !["REST_DAY", "HOLIDAY"].includes(record.status)
}

function isAbsenceRecord(record = {}) {
    const code = getAttendanceDetailCode(record)

    return ABSENCE_RATE_CODES.has(code) || record.status === "ABSENT"
}

function getAttendanceDayValue(record = {}) {
    for (const field of [
        "dayValue",
        "days",
        "leaveDays",
        "absenceDays",
        "absentDays",
        "durationDays",
    ]) {
        const value = Number(record[field])

        if (Number.isFinite(value) && value > 0) {
            return value
        }
    }

    return 1
}

function createAbsenceTypeValue() {
    return {
        day: 0,
        rate: 0,
    }
}

function createAbsenceTypesObject() {
    return ABSENCE_OVERALL_TYPES.reduce((result, type) => {
        result[type.code] = createAbsenceTypeValue()
        return result
    }, {})
}

function createAbsenceOverallRow({ key, label, rowType = "MONTH", year = null, month = null }) {
    return {
        key,
        label,
        rowType,
        year,
        month,
        expected: 0,
        absenceDay: 0,
        absenceDayExcludingAnnualMaternity: 0,
        absentRate: 0,
        absentRateExcludingAnnualMaternity: 0,
        types: createAbsenceTypesObject(),
    }
}

function addRecordToAbsenceOverallRow(row, record = {}) {
    if (isAttendanceExpectedWorkRecord(record)) {
        row.expected += getAttendanceDayValue(record)
    }

    if (!isAbsenceRecord(record)) return

    const rawCode = getAttendanceDetailCode(record)
    const code = ABSENCE_RATE_CODES.has(rawCode) ? rawCode : "AB"
    const dayValue = getAttendanceDayValue(record)

    if (row.types[code]) {
        row.types[code].day += dayValue
    }

    row.absenceDay += dayValue

    if (!ABSENCE_EXCLUDED_FROM_WORKFORCE_RATE.has(code)) {
        row.absenceDayExcludingAnnualMaternity += dayValue
    }
}

function finalizeAbsenceOverallRow(row) {
    for (const type of ABSENCE_OVERALL_TYPES) {
        const value = row.types[type.code]
        value.day = round(value.day, 1)
        value.rate = row.expected > 0
            ? round((value.day / row.expected) * 100, 2)
            : 0
    }

    row.expected = round(row.expected, 1)
    row.absenceDay = round(row.absenceDay, 1)
    row.absenceDayExcludingAnnualMaternity = round(
        row.absenceDayExcludingAnnualMaternity,
        1,
    )
    row.absentRate = row.expected > 0
        ? round((row.absenceDay / row.expected) * 100, 2)
        : 0
    row.absentRateExcludingAnnualMaternity = row.expected > 0
        ? round((row.absenceDayExcludingAnnualMaternity / row.expected) * 100, 2)
        : 0

    return row
}

function buildAttendanceOverallRows({ records, selectedYear, periods }) {
    const previousYear = selectedYear - 1
    const previousRow = createAbsenceOverallRow({
        key: String(previousYear),
        label: String(previousYear),
        rowType: "PREVIOUS_YEAR",
        year: previousYear,
    })
    const currentYtdRow = createAbsenceOverallRow({
        key: `YTD-${selectedYear}`,
        label: `YTD-${selectedYear}`,
        rowType: "CURRENT_YTD",
        year: selectedYear,
    })
    const monthRows = periods
        .filter((period) => period.year === selectedYear)
        .map((period) =>
            createAbsenceOverallRow({
                key: period.key,
                label: period.label,
                rowType: "MONTH",
                year: period.year,
                month: period.month,
            }),
        )
    const monthRowByKey = new Map(monthRows.map((row) => [row.key, row]))
    const selectedYearKeys = new Set(monthRows.map((row) => row.key))

    for (const record of records) {
        const recordDate = new Date(record.attendanceDate)
        const year = recordDate.getUTCFullYear()
        const key = `${year}-${String(recordDate.getUTCMonth() + 1).padStart(2, "0")}`

        if (year === previousYear) {
            addRecordToAbsenceOverallRow(previousRow, record)
        }

        if (year === selectedYear && selectedYearKeys.has(key)) {
            addRecordToAbsenceOverallRow(currentYtdRow, record)

            const monthRow = monthRowByKey.get(key)

            if (monthRow) {
                addRecordToAbsenceOverallRow(monthRow, record)
            }
        }
    }

    return [previousRow, currentYtdRow, ...monthRows].map(finalizeAbsenceOverallRow)
}

function createTopAbsentMonthValue(period) {
    return {
        key: period.key,
        year: period.year,
        month: period.month,
        label: period.label,
        expected: 0,
        absenceDay: 0,
        absenceDayExcludingAnnualMaternity: 0,
        absentRate: 0,
        absentRateExcludingAnnualMaternity: 0,
    }
}

function createTopAbsentDepartmentRow({ departmentId, department, periods }) {
    return {
        departmentId: departmentId || "UNASSIGNED",
        departmentCode: department?.code || "-",
        departmentName: department?.name || "Unassigned",
        label: department?.code
            ? `${department.code}--${department.name || ""}`.trim()
            : department?.name || "Unassigned",
        expected: 0,
        absenceDay: 0,
        absenceDayExcludingAnnualMaternity: 0,
        absentRate: 0,
        absentRateExcludingAnnualMaternity: 0,
        months: periods.map(createTopAbsentMonthValue),
    }
}

function addRecordToTopAbsentRow(row, record = {}) {
    const recordDate = new Date(record.attendanceDate)
    const key = `${recordDate.getUTCFullYear()}-${String(recordDate.getUTCMonth() + 1).padStart(2, "0")}`
    const month = row.months.find((item) => item.key === key)
    const expectedValue = isAttendanceExpectedWorkRecord(record)
        ? getAttendanceDayValue(record)
        : 0

    if (expectedValue > 0) {
        row.expected += expectedValue
        if (month) month.expected += expectedValue
    }

    if (!isAbsenceRecord(record)) return

    const rawCode = getAttendanceDetailCode(record)
    const code = ABSENCE_RATE_CODES.has(rawCode) ? rawCode : "AB"
    const dayValue = getAttendanceDayValue(record)

    row.absenceDay += dayValue
    if (month) month.absenceDay += dayValue

    if (ABSENCE_RATE_EXCLUDING_ANNUAL_MATERNITY_CODES.has(code)) {
        row.absenceDayExcludingAnnualMaternity += dayValue
        if (month) month.absenceDayExcludingAnnualMaternity += dayValue
    }
}

function finalizeTopAbsentDepartmentRow(row) {
    for (const month of row.months) {
        month.expected = round(month.expected, 1)
        month.absenceDay = round(month.absenceDay, 1)
        month.absenceDayExcludingAnnualMaternity = round(
            month.absenceDayExcludingAnnualMaternity,
            1,
        )
        month.absentRate = month.expected > 0
            ? round((month.absenceDay / month.expected) * 100, 2)
            : 0
        month.absentRateExcludingAnnualMaternity = month.expected > 0
            ? round((month.absenceDayExcludingAnnualMaternity / month.expected) * 100, 2)
            : 0
    }

    row.expected = round(row.expected, 1)
    row.absenceDay = round(row.absenceDay, 1)
    row.absenceDayExcludingAnnualMaternity = round(
        row.absenceDayExcludingAnnualMaternity,
        1,
    )
    row.absentRate = row.expected > 0
        ? round((row.absenceDay / row.expected) * 100, 2)
        : 0
    row.absentRateExcludingAnnualMaternity = row.expected > 0
        ? round((row.absenceDayExcludingAnnualMaternity / row.expected) * 100, 2)
        : 0

    return row
}

function buildAttendanceTopAbsentDepartments({ records, periods, departments }) {
    const departmentById = new Map(
        departments.map((department) => [department.id || department._id?.toString?.(), department]),
    )
    const rowByDepartmentId = new Map()

    for (const record of records) {
        const departmentId = record.departmentId?.toString?.() || "UNASSIGNED"

        if (!rowByDepartmentId.has(departmentId)) {
            rowByDepartmentId.set(
                departmentId,
                createTopAbsentDepartmentRow({
                    departmentId,
                    department: departmentById.get(departmentId),
                    periods,
                }),
            )
        }

        addRecordToTopAbsentRow(rowByDepartmentId.get(departmentId), record)
    }

    return [...rowByDepartmentId.values()]
        .map(finalizeTopAbsentDepartmentRow)
        .filter((row) => row.expected > 0)
        .sort(
            (a, b) =>
                b.absentRateExcludingAnnualMaternity - a.absentRateExcludingAnnualMaternity ||
                b.absentRate - a.absentRate ||
                String(a.label).localeCompare(String(b.label)),
        )
        .slice(0, TOP_ABSENT_DEPARTMENT_LIMIT)
}

function buildAttendanceAbsenceTables({
    records,
    periods,
    selectedYear,
    departments,
}) {
    const currentYearPeriods = periods.filter(
        (period) => period.year === selectedYear,
    )
    const currentYearKeys = new Set(currentYearPeriods.map((period) => period.key))
    const currentYearRecords = records.filter((record) => {
        const date = new Date(record.attendanceDate)
        const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`

        return currentYearKeys.has(key)
    })

    return {
        overall: {
            columns: ABSENCE_OVERALL_TYPES,
            rows: buildAttendanceOverallRows({
                records,
                selectedYear,
                periods: currentYearPeriods,
            }),
        },
        topAbsentDepartments: {
            periods: currentYearPeriods.map((period) => ({
                key: period.key,
                year: period.year,
                month: period.month,
                label: period.label,
            })),
            rows: buildAttendanceTopAbsentDepartments({
                records: currentYearRecords,
                periods: currentYearPeriods,
                departments,
            }),
        },
    }
}

function createAttendanceComparisonMonth({ year, month }) {
    const key = `${year}-${String(month).padStart(2, "0")}`

    return {
        key,
        year,
        month,
        label: MONTH_LABELS[month - 1],
        expected: 0,
        totalAbsence: 0,
        rate: 0,
        details: ABSENCE_DETAIL_OPTIONS.reduce((result, option) => {
            result[option.code] = 0
            return result
        }, {}),
    }
}

function createAttendanceComparisonYear(year) {
    return Array.from({ length: 12 }, (_, index) =>
        createAttendanceComparisonMonth({
            year,
            month: index + 1,
        }),
    )
}

function calculateAttendanceMonthRates(months = []) {
    for (const month of months) {
        month.rate = month.expected > 0
            ? round((month.totalAbsence / month.expected) * 100, 2)
            : 0
    }

    return months
}

function summarizeAttendanceMonths(months = []) {
    const expected = months.reduce((sum, month) => sum + month.expected, 0)
    const totalAbsence = months.reduce((sum, month) => sum + month.totalAbsence, 0)
    const details = ABSENCE_DETAIL_OPTIONS.reduce((result, option) => {
        result[option.code] = months.reduce(
            (sum, month) => sum + (Number(month.details?.[option.code]) || 0),
            0,
        )
        return result
    }, {})

    return {
        key: "AVG",
        year: months[0]?.year || null,
        month: "AVG",
        label: "AVG",
        expected,
        totalAbsence,
        rate: expected > 0 ? round((totalAbsence / expected) * 100, 2) : 0,
        details,
    }
}

function buildAttendanceDetailRows({ previousMonths, currentMonths }) {
    return ABSENCE_DETAIL_OPTIONS.map((option) => {
        const months = currentMonths.map((currentMonth, index) => {
            const previousMonth = previousMonths[index]
            const currentCount = Number(currentMonth.details?.[option.code]) || 0
            const previousCount = Number(previousMonth.details?.[option.code]) || 0

            return {
                key: currentMonth.key,
                month: currentMonth.month,
                label: currentMonth.label,
                previousCount,
                currentCount,
                previousExpected: previousMonth.expected,
                currentExpected: currentMonth.expected,
                previousRate: previousMonth.expected > 0
                    ? round((previousCount / previousMonth.expected) * 100, 2)
                    : 0,
                currentRate: currentMonth.expected > 0
                    ? round((currentCount / currentMonth.expected) * 100, 2)
                    : 0,
            }
        })

        const previousTotal = previousMonths.reduce(
            (sum, month) => sum + (Number(month.details?.[option.code]) || 0),
            0,
        )
        const currentTotal = currentMonths.reduce(
            (sum, month) => sum + (Number(month.details?.[option.code]) || 0),
            0,
        )
        const previousExpected = previousMonths.reduce(
            (sum, month) => sum + month.expected,
            0,
        )
        const currentExpected = currentMonths.reduce(
            (sum, month) => sum + month.expected,
            0,
        )

        return {
            ...option,
            previousTotal,
            currentTotal,
            previousExpected,
            currentExpected,
            previousRate: previousExpected > 0
                ? round((previousTotal / previousExpected) * 100, 2)
                : 0,
            currentRate: currentExpected > 0
                ? round((currentTotal / currentExpected) * 100, 2)
                : 0,
            months,
        }
    })
}

function buildAttendanceAbsenceComparison({
    records,
    selectedYear,
    selectedLabel,
    targetRates,
}) {
    const previousYear = selectedYear - 1
    const previousMonths = createAttendanceComparisonYear(previousYear)
    const currentMonths = createAttendanceComparisonYear(selectedYear)
    const monthsByYear = new Map([
        [previousYear, previousMonths],
        [selectedYear, currentMonths],
    ])

    for (const record of records) {
        const recordDate = new Date(record.attendanceDate)
        const year = recordDate.getUTCFullYear()
        const month = recordDate.getUTCMonth()
        const months = monthsByYear.get(year)

        if (!months) continue

        const bucket = months[month]

        if (!bucket) continue

        if (isAttendanceExpectedWorkRecord(record)) {
            bucket.expected += 1
        }

        if (isAbsenceRecord(record)) {
            const code = getAttendanceDetailCode(record) || "AB"
            bucket.totalAbsence += 1

            if (bucket.details[code] !== undefined) {
                bucket.details[code] += 1
            }
        }
    }

    calculateAttendanceMonthRates(previousMonths)
    calculateAttendanceMonthRates(currentMonths)

    const previousAverage = summarizeAttendanceMonths(previousMonths)
    const currentAverage = summarizeAttendanceMonths(currentMonths)

    const rows = currentMonths.map((currentMonth, index) => {
        const previousMonth = previousMonths[index]

        return {
            key: currentMonth.key,
            month: currentMonth.month,
            label: currentMonth.label,
            previousYear,
            currentYear: selectedYear,
            previousCount: previousMonth.totalAbsence,
            currentCount: currentMonth.totalAbsence,
            previousExpected: previousMonth.expected,
            currentExpected: currentMonth.expected,
            previousRate: previousMonth.rate,
            currentRate: currentMonth.rate,
            targetRate: round(targetRates?.monthly?.[currentMonth.month] || DEFAULT_ABSENCE_TARGET_RATE, 2),
        }
    })

    rows.push({
        key: "AVG",
        month: "AVG",
        label: "AVG",
        previousYear,
        currentYear: selectedYear,
        previousCount: previousAverage.totalAbsence,
        currentCount: currentAverage.totalAbsence,
        previousExpected: previousAverage.expected,
        currentExpected: currentAverage.expected,
        previousRate: previousAverage.rate,
        currentRate: currentAverage.rate,
        targetRate: round(targetRates?.average || DEFAULT_ABSENCE_TARGET_RATE, 2),
    })

    return {
        selectedLabel,
        previousYear,
        currentYear: selectedYear,
        targetRate: round(targetRates?.average || DEFAULT_ABSENCE_TARGET_RATE, 2),
        monthlyTargetRates: targetRates?.monthly || {},
        options: [
            {
                code: "TOTAL",
                label: "Total absent",
                name: "Total absent",
            },
            ...ABSENCE_DETAIL_OPTIONS,
        ],
        rows,
        detailRows: buildAttendanceDetailRows({
            previousMonths,
            currentMonths,
        }),
    }
}

function createTurnoverComparisonMonth({ year, month }) {
    const key = `${year}-${String(month).padStart(2, "0")}`

    return {
        key,
        year,
        month,
        label: MONTH_LABELS[month - 1],
        exits: 0,
        headcountStart: 0,
        headcountEnd: 0,
        averageHeadcount: 0,
        rate: 0,
    }
}

function createTurnoverComparisonYear(year) {
    return Array.from({ length: 12 }, (_, index) =>
        createTurnoverComparisonMonth({
            year,
            month: index + 1,
        }),
    )
}

function calculateTurnoverMonthRates(months = []) {
    for (const month of months) {
        month.averageHeadcount = round(
            ((Number(month.headcountStart) || 0) + (Number(month.headcountEnd) || 0)) / 2,
            2,
        )
        month.rate = month.averageHeadcount > 0
            ? round((month.exits / month.averageHeadcount) * 100, 2)
            : 0
    }

    return months
}

function summarizeTurnoverMonths(months = []) {
    const exits = months.reduce((sum, month) => sum + (Number(month.exits) || 0), 0)
    const averageHeadcount = months.reduce(
        (sum, month) => sum + (Number(month.averageHeadcount) || 0),
        0,
    )

    return {
        key: "AVG",
        year: months[0]?.year || null,
        month: "AVG",
        label: "AVG",
        exits,
        headcountStart: months[0]?.headcountStart || 0,
        headcountEnd: months.at(-1)?.headcountEnd || 0,
        averageHeadcount,
        rate: averageHeadcount > 0
            ? round((exits / averageHeadcount) * 100, 2)
            : 0,
    }
}

function buildTurnoverComparison({
    employees,
    movements,
    selectedYear,
    selectedLabel,
    targetRates,
}) {
    const previousYear = selectedYear - 1
    const previousMonths = createTurnoverComparisonYear(previousYear)
    const currentMonths = createTurnoverComparisonYear(selectedYear)
    const monthsByYear = new Map([
        [previousYear, previousMonths],
        [selectedYear, currentMonths],
    ])

    for (const month of [...previousMonths, ...currentMonths]) {
        const start = monthStart(month.year, month.month)
        const end = monthEnd(month.year, month.month)

        month.headcountStart = employees.filter((employee) =>
            employeeWasActiveOn(employee, start),
        ).length
        month.headcountEnd = employees.filter((employee) =>
            employeeWasActiveOn(employee, end),
        ).length
    }

    for (const movement of movements) {
        if (!EXIT_TYPES.has(movement.movementType)) continue

        const date = new Date(movement.effectiveDate)
        const year = date.getUTCFullYear()
        const month = date.getUTCMonth()
        const months = monthsByYear.get(year)

        if (!months) continue

        const bucket = months[month]

        if (!bucket) continue

        bucket.exits += 1
    }

    calculateTurnoverMonthRates(previousMonths)
    calculateTurnoverMonthRates(currentMonths)

    const previousAverage = summarizeTurnoverMonths(previousMonths)
    const currentAverage = summarizeTurnoverMonths(currentMonths)

    const rows = currentMonths.map((currentMonth, index) => {
        const previousMonth = previousMonths[index]

        return {
            key: currentMonth.key,
            month: currentMonth.month,
            label: currentMonth.label,
            previousYear,
            currentYear: selectedYear,
            previousCount: previousMonth.exits,
            currentCount: currentMonth.exits,
            previousAverageHeadcount: previousMonth.averageHeadcount,
            currentAverageHeadcount: currentMonth.averageHeadcount,
            previousRate: previousMonth.rate,
            currentRate: currentMonth.rate,
            targetRate: round(targetRates?.monthly?.[currentMonth.month] || DEFAULT_TURNOVER_TARGET_RATE, 2),
        }
    })

    rows.push({
        key: "AVG",
        month: "AVG",
        label: "AVG",
        previousYear,
        currentYear: selectedYear,
        previousCount: previousAverage.exits,
        currentCount: currentAverage.exits,
        previousAverageHeadcount: previousAverage.averageHeadcount,
        currentAverageHeadcount: currentAverage.averageHeadcount,
        previousRate: previousAverage.rate,
        currentRate: currentAverage.rate,
        targetRate: round(targetRates?.average || DEFAULT_TURNOVER_TARGET_RATE, 2),
    })

    return {
        selectedLabel,
        previousYear,
        currentYear: selectedYear,
        targetRate: round(targetRates?.average || DEFAULT_TURNOVER_TARGET_RATE, 2),
        monthlyTargetRates: targetRates?.monthly || {},
        rows,
    }
}

function summarizeEmployeesForGeneralData({ employees, selectedDate }) {
    const activeEmployees = employees.filter((employee) =>
        employeeWasActiveOn(employee, selectedDate),
    )
    const workingEmployees = activeEmployees.filter(
        (employee) => employee.employmentStatus === "WORKING",
    )
    const inactiveEmployees = activeEmployees.filter(
        (employee) => employee.employmentStatus !== "WORKING",
    )

    return {
        totalEmployees: activeEmployees.length,
        workingEmployees: workingEmployees.length,
        inactiveEmployees: inactiveEmployees.length,
        averageAge: round(
            average(
                activeEmployees.map((employee) =>
                    calculateYears(employee.dateOfBirth, selectedDate),
                ),
            ),
            1,
        ),
        averageServiceYears: round(
            average(
                activeEmployees.map((employee) =>
                    calculateYears(employee.joinDate, selectedDate),
                ),
            ),
            1,
        ),
    }
}

function normalizeDashboardText(value) {
    return String(value || "")
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .toUpperCase()
}

function findLookupById(items = [], id) {
    const stringId = toOptionalStringId(id)

    if (!stringId) return null

    return items.find((item) => item.id === stringId) || null
}

function getEmployeeTypeOptionForEmployee(employee = {}, lookups = {}) {
    const employeeTypeId = toOptionalStringId(employee.employeeTypeId)

    if (!employeeTypeId) return null

    if (employee.employeeTypeChildCode) {
        const childKey = `CHILD:${employeeTypeId}:${employee.employeeTypeChildCode}`
        const childOption = lookups.employeeTypes?.find((item) => item.key === childKey)

        if (childOption) return childOption
    }

    const parentKey = `TYPE:${employeeTypeId}`

    return lookups.employeeTypes?.find((item) => item.key === parentKey) || null
}

function lookupTextMatchesKeywords(item = {}, keywords = []) {
    const text = normalizeDashboardText([
        item.code,
        item.name,
        item.label,
        item.title,
    ].filter(Boolean).join(" "))

    return keywords.some((keyword) => text.includes(keyword))
}

function isEmployeeInMerchandisingDepartment(employee = {}, lookups = {}) {
    const department = findLookupById(lookups.departments, employee.departmentId)

    return lookupTextMatchesKeywords(
        department,
        GENERAL_WORKFORCE_DEPARTMENT_KEYWORDS,
    )
}

function isDirectLaborEmployee(employee = {}, lookups = {}) {
    const employeeTypeOption = getEmployeeTypeOptionForEmployee(employee, lookups)

    if (employeeTypeOption?.dashboardCategory === "BLUE_COLLAR_SEWER") {
        return true
    }

    const position = findLookupById(lookups.positions, employee.positionId)

    return lookupTextMatchesKeywords(
        position,
        GENERAL_WORKFORCE_DIRECT_KEYWORDS,
    )
}

function buildGeneralWorkforceCategoryBreakdown({
    employees,
    selectedDate,
    selectedPeriod,
    lookups,
}) {
    const activeEmployees = employees.filter((employee) =>
        employeeWasActiveOn(employee, selectedDate),
    )
    const counts = {
        [GENERAL_WORKFORCE_CATEGORY_KEYS.DIRECT_LABOR]: 0,
        [GENERAL_WORKFORCE_CATEGORY_KEYS.INDIRECT_LABOR]: 0,
        [GENERAL_WORKFORCE_CATEGORY_KEYS.RD_MARKETING]: 0,
    }

    for (const employee of activeEmployees) {
        if (isEmployeeInMerchandisingDepartment(employee, lookups)) {
            counts[GENERAL_WORKFORCE_CATEGORY_KEYS.RD_MARKETING] += 1
            continue
        }

        if (isDirectLaborEmployee(employee, lookups)) {
            counts[GENERAL_WORKFORCE_CATEGORY_KEYS.DIRECT_LABOR] += 1
            continue
        }

        counts[GENERAL_WORKFORCE_CATEGORY_KEYS.INDIRECT_LABOR] += 1
    }

    const rows = [
        {
            key: GENERAL_WORKFORCE_CATEGORY_KEYS.DIRECT_LABOR,
            category: "Direct Labor (DL)",
            department: "Sewer + Jumper",
            count: counts[GENERAL_WORKFORCE_CATEGORY_KEYS.DIRECT_LABOR],
            highlight: false,
        },
        {
            key: GENERAL_WORKFORCE_CATEGORY_KEYS.INDIRECT_LABOR,
            category: "Indirect Labor (IDL)",
            department: "All except DL & Merchandising",
            count: counts[GENERAL_WORKFORCE_CATEGORY_KEYS.INDIRECT_LABOR],
            highlight: false,
        },
        {
            key: GENERAL_WORKFORCE_CATEGORY_KEYS.RD_MARKETING,
            category: "RD& MKT",
            department: "Merchandising",
            count: counts[GENERAL_WORKFORCE_CATEGORY_KEYS.RD_MARKETING],
            highlight: true,
        },
    ]

    const total = rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0)

    return {
        monthLabel: selectedPeriod?.label || "Selected",
        rows,
        total,
    }
}

function findPeriodRow(rows = [], periodKey) {
    return rows.find((row) => row.key === periodKey) || null
}

function getBudgetValue(row) {
    if (!row) return 0

    const budget = Number(row.budget) || 0
    const roadmap = Number(row.roadmap) || 0

    return budget > 0 ? budget : roadmap
}


function getExitReasonLabel(employee, exitReasonById) {
    const exitReasonId = employee.exitReasonId?.toString?.() || employee.exitReasonId || null

    if (exitReasonId && exitReasonById.has(exitReasonId)) {
        const reason = exitReasonById.get(exitReasonId)
        return reason.name || reason.code || "Unknown"
    }

    const legacyReason = String(employee.resignReason || "").trim()

    return legacyReason || "Unknown"
}

function isExitEmployee(employee, startDate, endDate) {
    if (!employee?.resignDate) return false
    if (!EXIT_TYPES.has(employee.employmentStatus)) return false

    const resignDate = new Date(employee.resignDate)

    return resignDate >= startDate && resignDate <= endDate
}

function serviceBucketFromYears(years) {
    if (years < 0.25) return "LT_3M"
    if (years < 0.5) return "M3_6M"
    if (years < 0.75) return "M6_9M"
    if (years < 1) return "M9_12M"
    if (years < 3) return "Y1_3Y"
    if (years < 5) return "Y3_5Y"
    if (years < 10) return "Y5_10Y"
    return "Y10_20Y"
}

function buildExitReasonRows({ exitEmployees, exitReasons }) {
    const exitReasonById = new Map(
        exitReasons.map((reason) => [reason._id.toString(), reason]),
    )
    const countByLabel = new Map()

    for (const reason of exitReasons) {
        countByLabel.set(reason.name || reason.code || "Unknown", 0)
    }

    for (const employee of exitEmployees) {
        const label = getExitReasonLabel(employee, exitReasonById)
        countByLabel.set(label, (countByLabel.get(label) || 0) + 1)
    }

    const total = exitEmployees.length

    return [...countByLabel.entries()]
        .map(([label, count]) => ({
            label,
            count,
            rate: total > 0 ? round((count / total) * 100, 2) : 0,
        }))
        .sort((a, b) => b.rate - a.rate || b.count - a.count || a.label.localeCompare(b.label))
}

function buildServicePeriodRows(exitEmployees = []) {
    const buckets = [
        { key: "LT_3M", label: "<3 M", count: 0 },
        { key: "M3_6M", label: "3<6 M", count: 0 },
        { key: "M6_9M", label: "6<9 M", count: 0 },
        { key: "M9_12M", label: "9<12 M", count: 0 },
        { key: "Y1_3Y", label: "1<3 Y", count: 0 },
        { key: "Y3_5Y", label: "3<5 Y", count: 0 },
        { key: "Y5_10Y", label: "5<10 Y", count: 0 },
        { key: "Y10_20Y", label: "10<20 Y", count: 0 },
    ]
    const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))

    for (const employee of exitEmployees) {
        const serviceYears = calculateYears(
            employee.joinDate,
            employee.resignDate ? new Date(employee.resignDate) : new Date(),
        )

        if (!Number.isFinite(serviceYears)) continue

        const bucket = bucketByKey.get(serviceBucketFromYears(serviceYears))

        if (bucket) bucket.count += 1
    }

    const total = exitEmployees.length

    return buckets.map((bucket) => ({
        ...bucket,
        rate: total > 0 ? round((bucket.count / total) * 100, 2) : 0,
    }))
}

function buildExitAnalysisDashboard({ employees, exitReasons, startDate, endDate, selectedYear, selectedLabel }) {
    const exitEmployees = employees.filter((employee) =>
        isExitEmployee(employee, startDate, endDate),
    )

    return {
        selectedLabel,
        selectedYear,
        totalExits: exitEmployees.length,
        exitReasons: {
            title: `Exit Reasons-${selectedLabel} ${selectedYear}`,
            rows: buildExitReasonRows({ exitEmployees, exitReasons }),
        },
        servicePeriods: {
            title: `Period of Service-${selectedLabel}- ${selectedYear}`,
            rows: buildServicePeriodRows(exitEmployees),
        },
    }
}

function buildIndirectDirectRatio({
    totalSummary,
    selectedSummary,
    totalManpower,
    selectedManpower,
    selectedPeriodKey,
}) {
    const directActual = Number(selectedSummary.totalEmployees) || 0
    const totalActual = Number(totalSummary.totalEmployees) || 0
    const indirectActual = Math.max(totalActual - directActual, 0)
    const actualRatio = directActual > 0
        ? round(indirectActual / directActual, 2)
        : 0

    const totalPeriod = findPeriodRow(totalManpower, selectedPeriodKey)
    const selectedPeriod = findPeriodRow(selectedManpower, selectedPeriodKey)
    const directBudget = getBudgetValue(selectedPeriod)
    const totalBudget = getBudgetValue(totalPeriod)
    const indirectBudget = Math.max(totalBudget - directBudget, 0)
    const budgetRatio = directBudget > 0
        ? round(indirectBudget / directBudget, 2)
        : 0

    return {
        actualRatio,
        budgetRatio,
        directActual,
        indirectActual,
        directBudget,
        indirectBudget,
    }
}

function buildGeneralData({
    totalEmployees,
    selectedEmployees,
    selectedDate,
    selectedLabel,
    selectedPeriod,
    totalManpower,
    selectedManpower,
    lookups,
}) {
    const totalSummary = summarizeEmployeesForGeneralData({
        employees: totalEmployees,
        selectedDate,
    })
    const selectedSummary = summarizeEmployeesForGeneralData({
        employees: selectedEmployees,
        selectedDate,
    })
    const selectedPeriodKey = selectedPeriod?.key || null

    return {
        // Keep old fields for backward compatibility while the UI is being changed.
        totalEmployees: selectedSummary.totalEmployees,
        workingEmployees: selectedSummary.workingEmployees,
        inactiveEmployees: selectedSummary.inactiveEmployees,
        averageAge: selectedSummary.averageAge,
        averageServiceYears: selectedSummary.averageServiceYears,

        selectedLabel,
        budgetLabel: selectedPeriod?.year
            ? `Budget ${selectedPeriod.year}`
            : "Budget",
        total: totalSummary,
        selected: selectedSummary,
        indirectDirect: buildIndirectDirectRatio({
            totalSummary,
            selectedSummary,
            totalManpower,
            selectedManpower,
            selectedPeriodKey,
        }),
        workforceCategory: buildGeneralWorkforceCategoryBreakdown({
            employees: selectedEmployees,
            selectedDate,
            selectedPeriod,
            lookups,
        }),
    }
}

function toStringId(value) {
    return value?.toString?.() || value || null
}

function normalizeIdList(values = []) {
    return [...new Set(
        values
            .map((value) => toStringId(value))
            .filter(Boolean),
    )]
}

function normalizeLookupItem(document, nameField = "name") {
    return {
        id: document._id.toString(),
        code: document.code || "",
        name: document[nameField] || document.name || document.code || "",
        companyId: document.companyId?.toString?.() || null,
        branchId: document.branchId?.toString?.() || null,
        departmentId: document.departmentId?.toString?.() || null,
        positionIds: normalizeIdList(
            document.positionIds ||
            document.allowedPositionIds ||
            [],
        ),
    }
}

function aggregateChildPositionIds(children = []) {
    const positionIds = []

    for (const child of children) {
        positionIds.push(...(child.positionIds || []))
    }

    return normalizeIdList(positionIds)
}

function employeeTypeUsesAllChildPositions(children = []) {
    return children.some(
        (child) => child.positionAssignmentMode === "ALL_POSITIONS",
    )
}

function buildEmployeeTypeLookupOptions(employeeTypes = []) {
    const options = []

    for (const employeeType of employeeTypes) {
        const parentId = employeeType._id.toString()
        const parentName = employeeType.name || employeeType.code
        const children = employeeType.children || []
        const hasChildren = children.length > 0
        const parentPositionMode = hasChildren && employeeTypeUsesAllChildPositions(children)
            ? "ALL_POSITIONS"
            : employeeType.positionAssignmentMode || "SPECIFIC_POSITIONS"
        const parentPositionIds = hasChildren
            ? aggregateChildPositionIds(children)
            : normalizeIdList(employeeType.positionIds || [])

        options.push({
            id: parentId,
            key: `TYPE:${parentId}`,
            type: "TYPE",
            code: employeeType.code,
            name: parentName,
            label: employeeType.code
                ? `${employeeType.code} - ${parentName}`
                : parentName,
            companyId: employeeType.companyId?.toString?.() || null,
            employeeTypeId: parentId,
            employeeTypeChildCode: null,
            dashboardCategory: employeeType.dashboardCategory || "CUSTOM",
            positionAssignmentMode: parentPositionMode,
            positionIds: parentPositionIds,
            hasChildren,
        })

        for (const child of children) {
            const childPositionMode = child.positionAssignmentMode || "SPECIFIC_POSITIONS"
            const childPositionIds = normalizeIdList(child.positionIds || [])
            const childHasAssignment = childPositionMode === "ALL_POSITIONS" ||
                childPositionIds.length > 0

            if (!childHasAssignment) continue

            options.push({
                id: `${parentId}:${child.code}`,
                key: `CHILD:${parentId}:${child.code}`,
                type: "CHILD",
                code: child.code,
                name: child.name,
                label: `${parentName} / ${child.name}`,
                companyId: employeeType.companyId?.toString?.() || null,
                employeeTypeId: parentId,
                employeeTypeChildCode: child.code,
                dashboardCategory: child.dashboardCategory || "CUSTOM",
                positionAssignmentMode: childPositionMode,
                positionIds: childPositionIds,
                hasChildren: false,
            })
        }
    }

    return options.sort((a, b) =>
        String(a.label || "").localeCompare(String(b.label || "")),
    )
}

function getSelectedEmployeeTypeLabel({ query, lookups }) {
    const filter = normalizedQuery(query)

    if (!filter.employeeTypeFilterKey) return "All Employee Types"

    const selected = lookups.employeeTypes.find(
        (item) => item.key === filter.employeeTypeFilterKey,
    )

    return selected?.label || "Selected Employee Type"
}

function findLookupName(items = [], id) {
    if (!id) return ""

    const item = items.find((entry) => entry.id === id)

    return item?.name || item?.label || item?.code || ""
}

function getSelectedMetricLabel({ query, lookups }) {
    const filter = normalizedQuery(query)

    if (filter.employeeTypeFilterKey) {
        const selected = lookups.employeeTypes.find(
            (item) => item.key === filter.employeeTypeFilterKey,
        )

        return selected?.name || selected?.label || "Selected"
    }

    if (filter.positionId) {
        return findLookupName(lookups.positions, filter.positionId) || "Selected"
    }

    if (filter.lineId) {
        return findLookupName(lookups.lines, filter.lineId) || "Selected"
    }

    if (filter.departmentId) {
        return findLookupName(lookups.departments, filter.departmentId) || "Selected"
    }

    return "Selected"
}

function buildGeneralTotalQuery(query = {}) {
    return {
        companyId: query.companyId || undefined,
        branchId: query.branchId || undefined,
    }
}


async function loadExitReasons(query = {}) {
    return ExitReason.find({
        status: "ACTIVE",
        $or: [
            { companyId: null, branchId: null },
            ...(query.companyId ? [{ companyId: toObjectId(query.companyId), branchId: null }] : []),
            ...(query.companyId && query.branchId
                ? [{ companyId: toObjectId(query.companyId), branchId: toObjectId(query.branchId) }]
                : []),
        ],
    })
        .select(["code", "name", "shortName", "companyId", "branchId", "sortOrder"])
        .sort({ sortOrder: 1, name: 1 })
        .lean()
}

export async function getHrDashboardLookups({ query }) {
    const cacheKey = `hr-dashboard:lookups:${JSON.stringify(query)}`
    const cachedResult = getCache(cacheKey)

    if (cachedResult) return cachedResult

    const companyMatch = query.companyId
        ? { _id: toObjectId(query.companyId) }
        : {}
    const branchMatch = {
        status: "ACTIVE",
        ...(query.companyId ? { companyId: toObjectId(query.companyId) } : {}),
        ...(query.branchId ? { _id: toObjectId(query.branchId) } : {}),
    }
    const dimensionMatch = {
        status: "ACTIVE",
        ...(query.companyId ? { companyId: toObjectId(query.companyId) } : {}),
        ...(query.branchId ? { branchId: toObjectId(query.branchId) } : {}),
    }
    const departmentMatch = {
        ...dimensionMatch,
        ...(query.departmentId ? { _id: toObjectId(query.departmentId) } : {}),
    }
    const childDimensionMatch = {
        ...dimensionMatch,
        ...(query.departmentId ? { departmentId: toObjectId(query.departmentId) } : {}),
    }
    const employeeTypeMatch = {
        status: "ACTIVE",
        ...(query.companyId ? { companyId: toObjectId(query.companyId) } : {}),
    }

    const [companies, branches, departments, positions, lines, employeeTypes] =
        await Promise.all([
            Company.find({ status: "ACTIVE", ...companyMatch })
                .select(["code", "displayName"])
                .sort({ displayName: 1 })
                .lean(),
            Branch.find(branchMatch)
                .select(["code", "name", "companyId"])
                .sort({ name: 1 })
                .lean(),
            Department.find(departmentMatch)
                .select(["code", "name", "companyId", "branchId"])
                .sort({ name: 1 })
                .lean(),
            Position.find(childDimensionMatch)
                .select(["code", "title", "companyId", "branchId", "departmentId"])
                .sort({ title: 1 })
                .lean(),
            Line.find(childDimensionMatch)
                .select([
                    "code",
                    "name",
                    "companyId",
                    "branchId",
                    "departmentId",
                    "positionIds",
                    "allowedPositionIds",
                ])
                .sort({ name: 1 })
                .lean(),
            EmployeeType.find(employeeTypeMatch)
                .select([
                    "code",
                    "name",
                    "companyId",
                    "dashboardCategory",
                    "positionAssignmentMode",
                    "positionIds",
                    "children.code",
                    "children.name",
                    "children.dashboardCategory",
                    "children.positionAssignmentMode",
                    "children.positionIds",
                ])
                .sort({ name: 1 })
                .lean(),
        ])

    const result = {
        companies: companies.map((item) => normalizeLookupItem(item, "displayName")),
        branches: branches.map((item) => normalizeLookupItem(item)),
        departments: departments.map((item) => normalizeLookupItem(item)),
        positions: positions.map((item) => normalizeLookupItem(item, "title")),
        lines: lines.map((item) => normalizeLookupItem(item)),
        employeeTypes: buildEmployeeTypeLookupOptions(employeeTypes),
    }

    return setCache(cacheKey, result, 60_000)
}

export async function getHrDashboard({ query }) {
    const cleanQuery = normalizedQuery(query)
    const cacheKey = `hr-dashboard:data:${JSON.stringify(cleanQuery)}`
    const cachedResult = getCache(cacheKey)

    if (cachedResult) return cachedResult

    const startDate = parseStartDate(cleanQuery.startDate)
    const endDate = parseEndDate(cleanQuery.endDate)
    const periods = createPeriods(startDate, endDate)

    const lookups = await getHrDashboardLookups({
        query: {
            companyId: cleanQuery.companyId,
            branchId: cleanQuery.branchId,
            departmentId: cleanQuery.departmentId,
        },
    })

    const totalGeneralQuery = buildGeneralTotalQuery(cleanQuery)

    const [
        employees,
        totalGeneralEmployees,
        plans,
        totalGeneralPlans,
        movements,
        turnoverMovements,
        recruitmentChannels,
        dashboardTargets,
        exitReasons,
        lines,
    ] = await Promise.all([
            loadEmployees(cleanQuery),
            loadEmployees(totalGeneralQuery),
            loadPlans(cleanQuery, periods),
            loadPlans(totalGeneralQuery, periods),
            loadMovements(cleanQuery, startDate, endDate),
            loadMovements(cleanQuery, monthStart(startDate.getUTCFullYear() - 1, 1), monthEnd(startDate.getUTCFullYear(), 12)),
            loadRecruitmentChannels(cleanQuery),
            loadDashboardTargets(cleanQuery, startDate.getUTCFullYear()),
            loadExitReasons(cleanQuery),
            Line.find({
                status: "ACTIVE",
                ...(cleanQuery.companyId ? { companyId: toObjectId(cleanQuery.companyId) } : {}),
                ...(cleanQuery.branchId ? { branchId: toObjectId(cleanQuery.branchId) } : {}),
                ...(cleanQuery.departmentId ? { departmentId: toObjectId(cleanQuery.departmentId) } : {}),
                ...(cleanQuery.lineId ? { _id: toObjectId(cleanQuery.lineId) } : {}),
            })
                .select(["code", "name"])
                .lean(),
        ])

    const selectedYear = startDate.getUTCFullYear()
    const attendanceRecords = await loadAttendanceRecords(
        cleanQuery,
        startDate,
        endDate,
        employees,
    )
    const attendanceComparisonRecords = await loadAttendanceRecords(
        cleanQuery,
        monthStart(selectedYear - 1, 1),
        monthEnd(selectedYear, 12),
        employees,
    )

    const selectedPeriod = periods.at(-1)
    const absenceTargetRates = buildDashboardTargetRates({
        targets: dashboardTargets,
        metric: "ABSENCE_RATE",
        query: cleanQuery,
        fallbackRate: DEFAULT_ABSENCE_TARGET_RATE,
    })
    const turnoverTargetRates = buildDashboardTargetRates({
        targets: dashboardTargets,
        metric: "TURNOVER_RATE",
        query: cleanQuery,
        fallbackRate: DEFAULT_TURNOVER_TARGET_RATE,
    })
    const attendanceMonthly = buildAttendanceSeries({ records: attendanceRecords, periods })
    const manpower = buildManpowerSeries({ employees, plans, periods })
    const totalManpower = buildManpowerSeries({
        employees: totalGeneralEmployees,
        plans: totalGeneralPlans,
        periods,
    })
    const selectedEmployeeTypeLabel = getSelectedEmployeeTypeLabel({
        query: cleanQuery,
        lookups,
    })
    const selectedMetricLabel = getSelectedMetricLabel({
        query: cleanQuery,
        lookups,
    })
    const attendanceAbsenceComparison = buildAttendanceAbsenceComparison({
        records: attendanceComparisonRecords,
        selectedYear,
        selectedLabel: selectedMetricLabel,
        targetRates: absenceTargetRates,
    })
    const turnoverComparison = buildTurnoverComparison({
        employees,
        movements: turnoverMovements,
        selectedYear,
        selectedLabel: selectedMetricLabel,
        targetRates: turnoverTargetRates,
    })
    const attendanceAbsenceTables = buildAttendanceAbsenceTables({
        records: attendanceComparisonRecords,
        periods,
        selectedYear,
        departments: lookups.departments,
    })

    const result = {
        filters: {
            startDate: cleanQuery.startDate,
            endDate: cleanQuery.endDate,
            selectedPeriodKey: selectedPeriod?.key || null,
            companyId: cleanQuery.companyId || null,
            branchId: cleanQuery.branchId || null,
            departmentId: cleanQuery.departmentId || null,
            positionId: cleanQuery.positionId || null,
            lineId: cleanQuery.lineId || null,
            employeeTypeId: cleanQuery.employeeTypeId || null,
            employeeTypeChildCode: cleanQuery.employeeTypeChildCode || null,
            employeeTypeFilterKey: cleanQuery.employeeTypeFilterKey || null,
            employeeTypeLabel: selectedEmployeeTypeLabel,
        },
        general: buildGeneralData({
            totalEmployees: totalGeneralEmployees,
            selectedEmployees: employees,
            selectedDate: endDate,
            selectedLabel: selectedMetricLabel,
            selectedPeriod,
            totalManpower,
            selectedManpower: manpower,
            lookups,
        }),
        manpower,
        recruitment: buildRecruitmentChannelDashboard({
            employees,
            recruitmentChannels,
            periods,
            startDate,
            endDate,
        }),
        attendance: {
            summary: buildAttendanceSummary(attendanceMonthly),
            monthly: attendanceMonthly,
            byLine: buildAttendanceLineSummary({ records: attendanceRecords, lines }),
            absenceComparison: attendanceAbsenceComparison,
            absenceOverall: attendanceAbsenceTables.overall,
            topAbsentDepartments: attendanceAbsenceTables.topAbsentDepartments,
        },
        exitAnalysis: buildExitAnalysisDashboard({
            employees,
            exitReasons,
            startDate,
            endDate,
            selectedYear,
            selectedLabel: selectedMetricLabel,
        }),
        turnover: turnoverComparison,
        movement: buildMovementSeries({ movements, periods, query: cleanQuery }),
    }

    return setCache(cacheKey, result, 30_000)
}
