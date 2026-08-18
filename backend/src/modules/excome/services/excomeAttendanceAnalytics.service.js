import mongoose from "mongoose"

import AttendanceRecord from "../../attendance/models/AttendanceRecord.js"

const MONTH_LABELS = Object.freeze([
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
])

const PRESENT_STATUSES = [
    "PRESENT",
    "LATE",
    "EARLY_LEAVE",
    "LATE_AND_EARLY_LEAVE",
    "MISSING_IN",
    "MISSING_OUT",
]
const LATE_STATUSES = ["LATE", "LATE_AND_EARLY_LEAVE"]
const EARLY_STATUSES = ["EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"]
const MISSING_STATUSES = ["MISSING_IN", "MISSING_OUT"]
const DETAIL_CODES = ["AL", "SP", "UL", "AB", "SL", "ML"]
const RATE_EXCLUDING_ANNUAL_MATERNITY = ["UL", "SL", "SP", "AB"]
const TOP_ABSENT_DEPARTMENT_LIMIT = 15
const DEFAULT_ABSENCE_TARGET_RATE = 4.88

const ABSENCE_DETAIL_OPTIONS = Object.freeze([
    { code: "AL", label: "AL", name: "Annual Leave" },
    { code: "SP", label: "SP", name: "Special Permission" },
    { code: "UL", label: "UL", name: "Unpaid Leave" },
    { code: "AB", label: "AB", name: "Absent" },
    { code: "SL", label: "SL", name: "Sick Leave" },
    { code: "ML", label: "ML", name: "Maternity Leave" },
])

const ABSENCE_OVERALL_TYPES = Object.freeze([
    { code: "UL", label: "Unpaid Leave", showDay: false, group: "absence" },
    { code: "SL", label: "Sick Leave", showDay: true, group: "absence" },
    { code: "AB", label: "Absent", showDay: true, group: "absence" },
    { code: "AL", label: "Annual Leave", showDay: true, group: "leave" },
    { code: "ML", label: "Maternity Leave", showDay: true, group: "leave" },
])

function toObjectId(value) {
    return value ? new mongoose.Types.ObjectId(value) : undefined
}

function round(value, digits = 2) {
    const factor = 10 ** digits
    return Math.round((Number(value) || 0) * factor) / factor
}

function monthStart(year, month) {
    return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
}

function monthEnd(year, month) {
    return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
}

function buildAttendanceMatch(query, selectedYear, employees = []) {
    const match = {
        attendanceDate: {
            $gte: monthStart(selectedYear - 1, 1),
            $lte: monthEnd(selectedYear, 12),
        },
    }

    for (const field of [
        "companyId",
        "branchId",
        "departmentId",
        "positionId",
        "lineId",
        "shiftId",
    ]) {
        if (query[field]) match[field] = toObjectId(query[field])
    }

    if (query.employeeTypeId || query.employeeTypeChildCode) {
        const employeeIds = employees.map((employee) => employee._id).filter(Boolean)
        if (!employeeIds.length) return null
        match.employeeId = { $in: employeeIds }
    }

    return match
}

function numericField(field) {
    return {
        $convert: {
            input: `$${field}`,
            to: "double",
            onError: 0,
            onNull: 0,
        },
    }
}

function dayValueExpression() {
    const fields = [
        "dayValue",
        "days",
        "leaveDays",
        "absenceDays",
        "absentDays",
        "durationDays",
    ]

    return {
        $switch: {
            branches: fields.map((field) => ({
                case: { $gt: [numericField(field), 0] },
                then: numericField(field),
            })),
            default: 1,
        },
    }
}

function explicitDayValueExpression(field, fallback) {
    const explicit = {
        $convert: {
            input: `$${field}`,
            to: "double",
            onError: null,
            onNull: null,
        },
    }

    return {
        $let: {
            vars: { explicit },
            in: {
                $cond: [
                    { $ne: ["$$explicit", null] },
                    { $max: [0, { $min: [1, "$$explicit"] }] },
                    fallback,
                ],
            },
        },
    }
}

function rawDetailCodeExpression() {
    return {
        $ifNull: [
            "$absenceCode",
            {
                $ifNull: [
                    "$leaveCode",
                    {
                        $ifNull: [
                            "$leaveTypeCode",
                            {
                                $ifNull: [
                                    "$attendanceCode",
                                    { $ifNull: ["$correctionCode", ""] },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    }
}

function normalizedDetailCodeExpression() {
    const normalized = {
        $replaceAll: {
            input: {
                $replaceAll: {
                    input: {
                        $toUpper: {
                            $trim: { input: rawDetailCodeExpression() },
                        },
                    },
                    find: "-",
                    replacement: "_",
                },
            },
            find: " ",
            replacement: "_",
        },
    }

    return {
        $switch: {
            branches: [
                { case: { $in: [normalized, ["ANNUAL_LEAVE", "ANNUAL", "AL"]] }, then: "AL" },
                { case: { $in: [normalized, ["SPECIAL_PERMISSION", "SPECIAL_LEAVE", "SPECIAL", "SP"]] }, then: "SP" },
                { case: { $in: [normalized, ["UNPAID_LEAVE", "UNPAID", "UL"]] }, then: "UL" },
                { case: { $in: [normalized, ["ABSENT", "ABSENCE", "AB"]] }, then: "AB" },
                { case: { $in: [normalized, ["SICK_LEAVE", "SICK", "SL"]] }, then: "SL" },
                { case: { $in: [normalized, ["MATERNITY_LEAVE", "MATERNITY", "ML"]] }, then: "ML" },
            ],
            default: normalized,
        },
    }
}

function conditionalSum(condition, value = 1) {
    return { $sum: { $cond: [condition, value, 0] } }
}

function monthlyGroupStage() {
    const group = {
        _id: { year: "$year", month: "$month" },
        processed: { $sum: 1 },
        present: conditionalSum({ $in: ["$status", PRESENT_STATUSES] }),
        absent: conditionalSum({ $eq: ["$status", "ABSENT"] }),
        late: conditionalSum({
            $or: [
                { $in: ["$status", LATE_STATUSES] },
                { $gt: ["$lateMinutes", 0] },
            ],
        }),
        earlyLeave: conditionalSum({
            $or: [
                { $in: ["$status", EARLY_STATUSES] },
                { $gt: ["$earlyLeaveMinutes", 0] },
            ],
        }),
        missingPunch: conditionalSum({ $in: ["$status", MISSING_STATUSES] }),
        needsReview: conditionalSum({ $eq: ["$verificationStatus", "NEEDS_REVIEW"] }),
        holiday: conditionalSum({ $eq: ["$status", "HOLIDAY"] }),
        restDay: conditionalSum({ $eq: ["$status", "REST_DAY"] }),
        expectedCount: conditionalSum("$expected", "$expectedDayValue"),
        totalAbsenceCount: conditionalSum("$isAbsence", "$absenceDayValue"),
        expectedDays: conditionalSum("$expected", "$expectedDayValue"),
        absenceDays: conditionalSum("$isAbsence", "$absenceDayValue"),
        absenceDaysExcludingAnnualMaternity: conditionalSum(
            { $and: ["$isAbsence", { $in: ["$absenceBucketCode", RATE_EXCLUDING_ANNUAL_MATERNITY] }] },
            "$absenceDayValue",
        ),
    }

    for (const code of DETAIL_CODES) {
        group[`${code}Count`] = conditionalSum({ $and: ["$isAbsence", { $eq: ["$comparisonDetailCode", code] }] }, "$absenceDayValue")
        group[`${code}Days`] = conditionalSum(
            { $and: ["$isAbsence", { $eq: ["$absenceBucketCode", code] }] },
            "$absenceDayValue",
        )
    }

    return { $group: group }
}

function departmentGroupStage() {
    return {
        $group: {
            _id: {
                departmentId: "$departmentId",
                year: "$year",
                month: "$month",
            },
            expected: conditionalSum("$expected", "$expectedDayValue"),
            absenceDay: conditionalSum("$isAbsence", "$absenceDayValue"),
            absenceDayExcludingAnnualMaternity: conditionalSum(
                { $and: ["$isAbsence", { $in: ["$absenceBucketCode", RATE_EXCLUDING_ANNUAL_MATERNITY] }] },
                "$absenceDayValue",
            ),
        },
    }
}

function lineGroupStage() {
    return {
        $group: {
            _id: "$lineId",
            processed: { $sum: 1 },
            present: conditionalSum({ $in: ["$status", PRESENT_STATUSES] }),
            absent: conditionalSum({ $eq: ["$status", "ABSENT"] }),
            late: conditionalSum({
                $or: [
                    { $in: ["$status", LATE_STATUSES] },
                    { $gt: ["$lateMinutes", 0] },
                ],
            }),
            missingPunch: conditionalSum({ $in: ["$status", MISSING_STATUSES] }),
            needsReview: conditionalSum({ $eq: ["$verificationStatus", "NEEDS_REVIEW"] }),
        },
    }
}

async function aggregateAttendance(query, selectedYear, employees) {
    const match = buildAttendanceMatch(query, selectedYear, employees)

    if (!match) {
        return { monthly: [], departments: [], lines: [] }
    }

    const [result = {}] = await AttendanceRecord.aggregate([
        { $match: match },
        {
            $project: {
                attendanceDate: 1,
                departmentId: 1,
                lineId: 1,
                status: { $ifNull: ["$status", ""] },
                verificationStatus: { $ifNull: ["$verificationStatus", ""] },
                lateMinutes: numericField("lateMinutes"),
                earlyLeaveMinutes: numericField("earlyLeaveMinutes"),
                expectedDayValue: explicitDayValueExpression("expectedDayValue", dayValueExpression()),
                absenceDayValue: explicitDayValueExpression("absenceDayValue", dayValueExpression()),
                detailCode: normalizedDetailCodeExpression(),
            },
        },
        {
            $set: {
                year: { $year: "$attendanceDate" },
                month: { $month: "$attendanceDate" },
                expected: { $not: [{ $in: ["$status", ["REST_DAY", "HOLIDAY"]] }] },
            },
        },
        {
            $set: {
                comparisonDetailCode: {
                    $cond: [
                        { $ne: ["$detailCode", ""] },
                        "$detailCode",
                        { $cond: [{ $eq: ["$status", "ABSENT"] }, "AB", ""] },
                    ],
                },
            },
        },
        {
            $set: {
                isAbsence: {
                    $or: [
                        { $in: ["$comparisonDetailCode", DETAIL_CODES] },
                        { $eq: ["$status", "ABSENT"] },
                    ],
                },
                absenceBucketCode: {
                    $cond: [
                        { $in: ["$comparisonDetailCode", DETAIL_CODES] },
                        "$comparisonDetailCode",
                        { $cond: [{ $eq: ["$status", "ABSENT"] }, "AB", "$comparisonDetailCode"] },
                    ],
                },
            },
        },
        {
            $facet: {
                monthly: [
                    monthlyGroupStage(),
                    { $sort: { "_id.year": 1, "_id.month": 1 } },
                ],
                departments: [
                    { $match: { year: selectedYear } },
                    departmentGroupStage(),
                    { $sort: { "_id.month": 1 } },
                ],
                lines: [
                    { $match: { year: selectedYear, lineId: { $ne: null } } },
                    lineGroupStage(),
                    { $sort: { absent: -1, late: -1 } },
                    { $limit: 20 },
                ],
            },
        },
    ]).allowDiskUse(true)

    return {
        monthly: result.monthly || [],
        departments: result.departments || [],
        lines: result.lines || [],
    }
}

function createMonthlyAttendanceRow(year, month) {
    return {
        key: `${year}-${String(month).padStart(2, "0")}`,
        year,
        month,
        label: MONTH_LABELS[month - 1],
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
}

function monthlyGroupKey(year, month) {
    return `${year}-${String(month).padStart(2, "0")}`
}

function buildMonthlyRows(groups, selectedYear) {
    const byKey = new Map(groups.map((group) => [monthlyGroupKey(group._id.year, group._id.month), group]))

    return Array.from({ length: 12 }, (_, index) => {
        const month = index + 1
        const row = createMonthlyAttendanceRow(selectedYear, month)
        const group = byKey.get(row.key)

        if (group) {
            for (const field of [
                "processed", "present", "absent", "late", "earlyLeave",
                "missingPunch", "needsReview", "holiday", "restDay",
            ]) {
                row[field] = Number(group[field]) || 0
            }
        }

        const denominator = row.present + row.absent
        row.attendanceRate = denominator > 0 ? round((row.present / denominator) * 100, 1) : 0
        return row
    })
}

function buildSummary(rows) {
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
    summary.attendanceRate = denominator > 0 ? round((summary.present / denominator) * 100, 1) : 0
    return summary
}

function buildByLine(groups, lines = []) {
    const lineById = new Map(
        lines.map((line) => [String(line.id || line._id || ""), line]),
    )

    return groups.map((group) => {
        const lineId = group._id?.toString?.() || String(group._id || "")
        const line = lineById.get(lineId)
        const present = Number(group.present) || 0
        const absent = Number(group.absent) || 0
        const denominator = present + absent

        return {
            lineId,
            code: line?.code || "-",
            name: line?.name || "Unknown Line",
            processed: Number(group.processed) || 0,
            present,
            absent,
            late: Number(group.late) || 0,
            missingPunch: Number(group.missingPunch) || 0,
            needsReview: Number(group.needsReview) || 0,
            attendanceRate: denominator > 0 ? round((present / denominator) * 100, 1) : 0,
        }
    })
}

function createComparisonMonth(year, month) {
    return {
        key: monthlyGroupKey(year, month),
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

function comparisonMonths(groups, year) {
    const byKey = new Map(groups.map((group) => [monthlyGroupKey(group._id.year, group._id.month), group]))

    return Array.from({ length: 12 }, (_, index) => {
        const month = index + 1
        const row = createComparisonMonth(year, month)
        const group = byKey.get(row.key)

        if (group) {
            row.expected = Number(group.expectedCount) || 0
            row.totalAbsence = Number(group.totalAbsenceCount) || 0
            for (const option of ABSENCE_DETAIL_OPTIONS) {
                row.details[option.code] = Number(group[`${option.code}Count`]) || 0
            }
        }

        row.rate = row.expected > 0 ? round((row.totalAbsence / row.expected) * 100, 2) : 0
        return row
    })
}

function summarizeComparisonMonths(months) {
    const expected = months.reduce((sum, month) => sum + month.expected, 0)
    const totalAbsence = months.reduce((sum, month) => sum + month.totalAbsence, 0)
    const details = ABSENCE_DETAIL_OPTIONS.reduce((result, option) => {
        result[option.code] = months.reduce((sum, month) => sum + (Number(month.details[option.code]) || 0), 0)
        return result
    }, {})

    return {
        expected,
        totalAbsence,
        rate: expected > 0 ? round((totalAbsence / expected) * 100, 2) : 0,
        details,
    }
}

function buildDetailRows(previousMonths, currentMonths) {
    return ABSENCE_DETAIL_OPTIONS.map((option) => {
        const previousTotal = previousMonths.reduce((sum, month) => sum + (Number(month.details[option.code]) || 0), 0)
        const currentTotal = currentMonths.reduce((sum, month) => sum + (Number(month.details[option.code]) || 0), 0)
        const previousExpected = previousMonths.reduce((sum, month) => sum + month.expected, 0)
        const currentExpected = currentMonths.reduce((sum, month) => sum + month.expected, 0)

        return {
            ...option,
            previousTotal,
            currentTotal,
            previousExpected,
            currentExpected,
            previousRate: previousExpected > 0 ? round((previousTotal / previousExpected) * 100, 2) : 0,
            currentRate: currentExpected > 0 ? round((currentTotal / currentExpected) * 100, 2) : 0,
            months: currentMonths.map((currentMonth, index) => {
                const previousMonth = previousMonths[index]
                const currentCount = Number(currentMonth.details[option.code]) || 0
                const previousCount = Number(previousMonth.details[option.code]) || 0

                return {
                    key: currentMonth.key,
                    month: currentMonth.month,
                    label: currentMonth.label,
                    previousCount,
                    currentCount,
                    previousExpected: previousMonth.expected,
                    currentExpected: currentMonth.expected,
                    previousRate: previousMonth.expected > 0 ? round((previousCount / previousMonth.expected) * 100, 2) : 0,
                    currentRate: currentMonth.expected > 0 ? round((currentCount / currentMonth.expected) * 100, 2) : 0,
                }
            }),
        }
    })
}

function buildAbsenceComparison(groups, selectedYear, selectedLabel, targetRates) {
    const previousYear = selectedYear - 1
    const previousMonths = comparisonMonths(groups, previousYear)
    const currentMonths = comparisonMonths(groups, selectedYear)
    const previousAverage = summarizeComparisonMonths(previousMonths)
    const currentAverage = summarizeComparisonMonths(currentMonths)

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
        options: [{ code: "TOTAL", label: "Total absent", name: "Total absent" }, ...ABSENCE_DETAIL_OPTIONS],
        rows,
        detailRows: buildDetailRows(previousMonths, currentMonths),
    }
}

function createOverallRow({ key, label, rowType, year, month = null }) {
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
        types: ABSENCE_OVERALL_TYPES.reduce((result, type) => {
            result[type.code] = { day: 0, rate: 0 }
            return result
        }, {}),
    }
}

function addMonthlyGroupToOverall(row, group) {
    row.expected += Number(group.expectedDays) || 0
    row.absenceDay += Number(group.absenceDays) || 0
    row.absenceDayExcludingAnnualMaternity += Number(group.absenceDaysExcludingAnnualMaternity) || 0
    for (const type of ABSENCE_OVERALL_TYPES) {
        row.types[type.code].day += Number(group[`${type.code}Days`]) || 0
    }
}

function finalizeOverall(row) {
    for (const type of ABSENCE_OVERALL_TYPES) {
        const value = row.types[type.code]
        value.day = round(value.day, 1)
        value.rate = row.expected > 0 ? round((value.day / row.expected) * 100, 2) : 0
    }
    row.expected = round(row.expected, 1)
    row.absenceDay = round(row.absenceDay, 1)
    row.absenceDayExcludingAnnualMaternity = round(row.absenceDayExcludingAnnualMaternity, 1)
    row.absentRate = row.expected > 0 ? round((row.absenceDay / row.expected) * 100, 2) : 0
    row.absentRateExcludingAnnualMaternity = row.expected > 0
        ? round((row.absenceDayExcludingAnnualMaternity / row.expected) * 100, 2)
        : 0
    return row
}

function buildAbsenceOverall(groups, selectedYear) {
    const previousYear = selectedYear - 1
    const previousRow = createOverallRow({
        key: String(previousYear), label: String(previousYear), rowType: "PREVIOUS_YEAR", year: previousYear,
    })
    const ytdRow = createOverallRow({
        key: `YTD-${selectedYear}`, label: `YTD-${selectedYear}`, rowType: "CURRENT_YTD", year: selectedYear,
    })
    const monthRows = Array.from({ length: 12 }, (_, index) => createOverallRow({
        key: monthlyGroupKey(selectedYear, index + 1),
        label: MONTH_LABELS[index],
        rowType: "MONTH",
        year: selectedYear,
        month: index + 1,
    }))
    const monthByNumber = new Map(monthRows.map((row) => [row.month, row]))

    for (const group of groups) {
        const year = Number(group._id.year)
        const month = Number(group._id.month)
        if (year === previousYear) addMonthlyGroupToOverall(previousRow, group)
        if (year === selectedYear) {
            addMonthlyGroupToOverall(ytdRow, group)
            const monthRow = monthByNumber.get(month)
            if (monthRow) addMonthlyGroupToOverall(monthRow, group)
        }
    }

    return {
        columns: ABSENCE_OVERALL_TYPES,
        rows: [previousRow, ytdRow, ...monthRows].map(finalizeOverall),
    }
}

function createDepartmentRow(departmentId, department) {
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
        months: Array.from({ length: 12 }, (_, index) => ({
            key: monthlyGroupKey(new Date().getUTCFullYear(), index + 1),
            year: null,
            month: index + 1,
            label: MONTH_LABELS[index],
            expected: 0,
            absenceDay: 0,
            absenceDayExcludingAnnualMaternity: 0,
            absentRate: 0,
            absentRateExcludingAnnualMaternity: 0,
        })),
    }
}

function buildTopAbsentDepartments(groups, selectedYear, departments = []) {
    const departmentById = new Map(
        departments.map((department) => [String(department.id || department._id || ""), department]),
    )
    const rowByDepartment = new Map()

    for (const group of groups) {
        const departmentId = group._id.departmentId?.toString?.() || "UNASSIGNED"
        if (!rowByDepartment.has(departmentId)) {
            const row = createDepartmentRow(departmentId, departmentById.get(departmentId))
            for (const month of row.months) {
                month.year = selectedYear
                month.key = monthlyGroupKey(selectedYear, month.month)
            }
            rowByDepartment.set(departmentId, row)
        }

        const row = rowByDepartment.get(departmentId)
        const month = row.months[Number(group._id.month) - 1]
        const expected = Number(group.expected) || 0
        const absenceDay = Number(group.absenceDay) || 0
        const excluded = Number(group.absenceDayExcludingAnnualMaternity) || 0

        row.expected += expected
        row.absenceDay += absenceDay
        row.absenceDayExcludingAnnualMaternity += excluded
        if (month) {
            month.expected += expected
            month.absenceDay += absenceDay
            month.absenceDayExcludingAnnualMaternity += excluded
        }
    }

    const rows = [...rowByDepartment.values()].map((row) => {
        for (const month of row.months) {
            month.expected = round(month.expected, 1)
            month.absenceDay = round(month.absenceDay, 1)
            month.absenceDayExcludingAnnualMaternity = round(month.absenceDayExcludingAnnualMaternity, 1)
            month.absentRate = month.expected > 0 ? round((month.absenceDay / month.expected) * 100, 2) : 0
            month.absentRateExcludingAnnualMaternity = month.expected > 0
                ? round((month.absenceDayExcludingAnnualMaternity / month.expected) * 100, 2)
                : 0
        }
        row.expected = round(row.expected, 1)
        row.absenceDay = round(row.absenceDay, 1)
        row.absenceDayExcludingAnnualMaternity = round(row.absenceDayExcludingAnnualMaternity, 1)
        row.absentRate = row.expected > 0 ? round((row.absenceDay / row.expected) * 100, 2) : 0
        row.absentRateExcludingAnnualMaternity = row.expected > 0
            ? round((row.absenceDayExcludingAnnualMaternity / row.expected) * 100, 2)
            : 0
        return row
    })
        .filter((row) => row.expected > 0)
        .sort((a, b) =>
            b.absentRateExcludingAnnualMaternity - a.absentRateExcludingAnnualMaternity ||
            b.absentRate - a.absentRate ||
            String(a.label).localeCompare(String(b.label)),
        )
        .slice(0, TOP_ABSENT_DEPARTMENT_LIMIT)

    return {
        periods: Array.from({ length: 12 }, (_, index) => ({
            key: monthlyGroupKey(selectedYear, index + 1),
            year: selectedYear,
            month: index + 1,
            label: MONTH_LABELS[index],
        })),
        rows,
    }
}

export async function buildExcomeAttendanceAnalytics({
    query,
    employees,
    selectedYear,
    selectedLabel,
    targetRates,
    departments,
    lines,
}) {
    const groups = await aggregateAttendance(query, selectedYear, employees)
    const monthly = buildMonthlyRows(groups.monthly, selectedYear)

    return {
        recordCount: monthly.reduce((sum, row) => sum + row.processed, 0),
        attendance: {
            summary: buildSummary(monthly),
            monthly,
            byLine: buildByLine(groups.lines, lines),
            absenceComparison: buildAbsenceComparison(groups.monthly, selectedYear, selectedLabel, targetRates),
            absenceOverall: buildAbsenceOverall(groups.monthly, selectedYear),
            topAbsentDepartments: buildTopAbsentDepartments(groups.departments, selectedYear, departments),
        },
    }
}
