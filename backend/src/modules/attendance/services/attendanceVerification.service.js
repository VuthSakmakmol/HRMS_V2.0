import mongoose from "mongoose"

import { AppError } from "../../../shared/errors/AppError.js"
import AttendanceImportIssue from "../models/AttendanceImportIssue.js"
import AttendanceRecord from "../models/AttendanceRecord.js"
import AttendanceRawScan from "../models/AttendanceRawScan.js"
import Employee from "../../employee/models/Employee.js"
import Shift from "../../shift/models/Shift.js"
import { resolveCalendarDay } from "../../calendar/services/calendar.service.js"
import { resolveAttendancePolicy } from "./attendancePolicy.service.js"
import { invalidateAttendanceCaches } from "./attendance.service.js"
import { buildShiftSchedule, calculateAttendanceResult } from "./attendanceCalculation.service.js"
import {
    businessWeekday,
    endOfBusinessDay,
    enumerateBusinessDates,
    startOfBusinessDay,
} from "../utils/attendanceDate.util.js"
import { attendanceScopeFilter, assertAttendanceScope } from "../utils/attendanceScope.util.js"

function employeeName(employee) {
    return employee?.displayName ||
        [employee?.englishFirstName, employee?.englishLastName]
            .filter(Boolean)
            .join(" ") ||
        ""
}

function verificationRecordFilter(query, user) {
    const filter = {
        ...attendanceScopeFilter(user),
        companyId: query.companyId,
        branchId: query.branchId,
        attendanceDate: {
            $gte: startOfBusinessDay(query.dateFrom),
            $lte: endOfBusinessDay(query.dateTo),
        },
    }

    for (const field of ["departmentId", "positionId", "lineId"]) {
        if (query[field]) filter[field] = query[field]
    }
    if (query.verificationStatus !== "ALL") {
        filter.verificationStatus = query.verificationStatus
    }

    return filter
}

async function employeeSearchIds(query, user) {
    if (!query.search) return null

    const employees = await Employee.find({
        ...attendanceScopeFilter(user),
        companyId: query.companyId,
        branchId: query.branchId,
        $or: [
            { employeeCode: { $regex: query.search, $options: "i" } },
            { displayName: { $regex: query.search, $options: "i" } },
            { englishFirstName: { $regex: query.search, $options: "i" } },
            { englishLastName: { $regex: query.search, $options: "i" } },
        ],
    })
        .select("_id")
        .lean()

    return employees.map((employee) => employee._id)
}

function mapVerificationRecord(record) {
    return {
        ...record,
        id: record._id.toString(),
        _id: undefined,
        employeeName: employeeName(record.employeeId),
        departmentName: record.departmentId?.name || "",
        positionName: record.positionId?.title || record.positionId?.name || "",
        lineName: record.lineId?.name || "",
        shiftName: record.shiftId?.name || record.shiftId?.code || "",
    }
}

function buildEmployeeFilter(payload, user) {
    const filter = {
        ...attendanceScopeFilter(user),
        recordStatus: "ACTIVE",
        employmentStatus: "WORKING",
        joinDate: { $lte: endOfBusinessDay(payload.dateTo) },
        $or: [
            { resignDate: null },
            { resignDate: { $gte: startOfBusinessDay(payload.dateFrom) } },
        ],
    }
    for (const field of [
        "companyId",
        "branchId",
        "departmentId",
        "positionId",
        "lineId",
        "employeeTypeId",
    ]) {
        if (payload[field]) filter[field] = payload[field]
    }
    return filter
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

async function resolveDayType({ workDate, employee, policy, user, cache }) {
    const key = `${workDate}:${employee.companyId}:${employee.branchId || ""}`
    if (cache.has(key)) return cache.get(key)

    const calendarDay = await resolveCalendarDay({
        query: {
            date: workDate,
            companyId: String(employee.companyId),
            branchId: employee.branchId ? String(employee.branchId) : undefined,
        },
        user,
    })

    let dayType = "WORKING_DAY"
    if (calendarDay.dayType === "CLOSED_DAY") dayType = "CLOSED_DAY"
    else if (calendarDay.dayType === "HOLIDAY") dayType = "HOLIDAY"
    else if (calendarDay.dayType === "WEEKEND" || calendarDay.isWorkingDay === false) dayType = "REST_DAY"
    else if (policy?.treatSundayAsRestDay && businessWeekday(workDate) === 0) dayType = "REST_DAY"

    cache.set(key, dayType)
    return dayType
}

function belongsToEmploymentPeriod(employee, workDate) {
    const start = startOfBusinessDay(workDate)
    const end = endOfBusinessDay(workDate)
    if (employee.joinDate && new Date(employee.joinDate) > end) return false
    if (employee.resignDate && new Date(employee.resignDate) < start) return false
    return true
}

function updateSummary(summary, calculated) {
    if (!calculated) {
        summary.skippedCount += 1
        return
    }
    if (calculated.dayType === "HOLIDAY" || calculated.dayType === "CLOSED_DAY") summary.holidayCount += 1
    if (calculated.dayType === "REST_DAY") summary.restDayCount += 1
    if (calculated.status === "ABSENT") summary.absentCount += 1
    else if (["REST_DAY", "HOLIDAY"].includes(calculated.status)) {
        // already counted by day type
    } else if (calculated.verificationStatus === "NEEDS_REVIEW") summary.reviewCount += 1
    else summary.presentCount += 1
}

export async function verifyAttendanceRange({ payload, user }) {
    assertAttendanceScope(user, payload.companyId, payload.branchId)
    const employees = await Employee.find(buildEmployeeFilter(payload, user)).lean()
    const shiftIds = [...new Set(employees.map((employee) => String(employee.shiftId)).filter(Boolean))]
    const shifts = await Shift.find({ _id: { $in: shiftIds }, status: "ACTIVE" }).lean()
    const shiftMap = new Map(shifts.map((shift) => [String(shift._id), shift]))
    const dates = enumerateBusinessDates(payload.dateFrom, payload.dateTo)
    const employeeCodes = employees.map((employee) => employee.employeeCode)

    let earliestScanAt = startOfBusinessDay(payload.dateFrom)
    let latestScanAt = endOfBusinessDay(payload.dateTo)
    for (const shift of shifts) {
        const firstWindow = buildShiftSchedule({ workDate: payload.dateFrom, shift })
        const lastWindow = buildShiftSchedule({ workDate: payload.dateTo, shift })
        if (firstWindow.scanWindowStartAt < earliestScanAt) earliestScanAt = firstWindow.scanWindowStartAt
        if (lastWindow.scanWindowEndAt > latestScanAt) latestScanAt = lastWindow.scanWindowEndAt
    }

    const scans = await AttendanceRawScan.find({
        companyId: payload.companyId,
        branchId: payload.branchId,
        employeeCode: { $in: employeeCodes },
        scannedAt: { $gte: earliestScanAt, $lte: latestScanAt },
    })
        .sort({ employeeCode: 1, scannedAt: 1 })
        .lean()

    const scansByEmployee = new Map()
    for (const scan of scans) {
        const list = scansByEmployee.get(scan.employeeCode) || []
        list.push(scan)
        scansByEmployee.set(scan.employeeCode, list)
    }

    const protectedConditions = [{ source: "EXCEL_IMPORT" }]
    if (!payload.overwriteCorrected) {
        protectedConditions.push({ verificationStatus: "CORRECTED" })
    }
    const protectedRecords = await AttendanceRecord.find({
        employeeId: { $in: employees.map((employee) => employee._id) },
        attendanceDate: {
            $gte: startOfBusinessDay(payload.dateFrom),
            $lte: endOfBusinessDay(payload.dateTo),
        },
        $or: protectedConditions,
    })
        .select("employeeId attendanceDate source verificationStatus")
        .lean()
    const protectedRecordMap = new Map(
        protectedRecords.map((record) => [
            `${record.employeeId}:${record.attendanceDate.toISOString()}`,
            record,
        ]),
    )

    const policyCache = new Map()
    const calendarCache = new Map()
    const operations = []
    const summary = {
        employeeCount: employees.length,
        processedCount: 0,
        createdOrUpdatedCount: 0,
        protectedCorrectedCount: 0,
        protectedImportedCount: 0,
        presentCount: 0,
        absentCount: 0,
        restDayCount: 0,
        holidayCount: 0,
        reviewCount: 0,
        missingShiftCount: 0,
        skippedCount: 0,
    }

    for (const workDate of dates) {
        const attendanceDate = startOfBusinessDay(workDate)

        for (const employee of employees) {
            if (!belongsToEmploymentPeriod(employee, workDate)) {
                summary.skippedCount += 1
                continue
            }

            const shift = shiftMap.get(String(employee.shiftId))
            if (!shift) {
                summary.missingShiftCount += 1
                continue
            }

            const protectedKey = `${employee._id}:${attendanceDate.toISOString()}`
            const protectedRecord = protectedRecordMap.get(protectedKey)
            if (protectedRecord) {
                if (protectedRecord.source === "EXCEL_IMPORT") {
                    summary.protectedImportedCount += 1
                } else {
                    summary.protectedCorrectedCount += 1
                }
                continue
            }

            const policyKey = `${employee.companyId}:${employee.branchId || ""}:${workDate}`
            let policy = policyCache.get(policyKey)
            if (policy === undefined) {
                policy = await resolveAttendancePolicy({
                    companyId: employee.companyId,
                    branchId: employee.branchId,
                    workDate: attendanceDate,
                })
                policyCache.set(policyKey, policy || null)
            }

            const dayType = await resolveDayType({
                workDate,
                employee,
                policy,
                user,
                cache: calendarCache,
            })
            const schedule = buildShiftSchedule({ workDate, shift })
            const employeeScans = (scansByEmployee.get(employee.employeeCode) || []).filter(
                (scan) =>
                    new Date(scan.scannedAt) >= schedule.scanWindowStartAt &&
                    new Date(scan.scannedAt) <= schedule.scanWindowEndAt,
            )
            const calculated = calculateAttendanceResult({
                workDate,
                shift,
                policy,
                dayType,
                scans: employeeScans,
            })

            summary.processedCount += 1
            updateSummary(summary, calculated)
            if (!calculated) continue

            operations.push({
                updateOne: {
                    filter: { employeeId: employee._id, attendanceDate },
                    update: {
                        $set: {
                            employeeCode: employee.employeeCode,
                            companyId: employee.companyId,
                            branchId: employee.branchId,
                            departmentId: employee.departmentId,
                            positionId: employee.positionId,
                            lineId: employee.lineId,
                            shiftId: employee.shiftId,
                            attendanceDate,
                            source: "MACHINE_SYNC",
                            policySnapshot: policySnapshot(policy),
                            calculationVersion: "ATTENDANCE_ENGINE_V2",
                            updatedByAccountId: user.accountId,
                            ...calculated,
                        },
                        $setOnInsert: {
                            employeeId: employee._id,
                            createdByAccountId: user.accountId,
                        },
                    },
                    upsert: true,
                },
            })
            summary.createdOrUpdatedCount += 1
        }
    }

    for (let index = 0; index < operations.length; index += 1000) {
        await AttendanceRecord.bulkWrite(operations.slice(index, index + 1000), {
            ordered: false,
        })
    }

    invalidateAttendanceCaches()
    return summary
}

export async function getAttendanceVerificationWorkspace({ query, user }) {
    assertAttendanceScope(user, query.companyId, query.branchId)

    const tableFilter = verificationRecordFilter(query, user)
    const searchIds = await employeeSearchIds(query, user)
    if (searchIds) {
        tableFilter.employeeId = { $in: searchIds }
    }

    const baseRecordFilter = verificationRecordFilter(
        { ...query, verificationStatus: "ALL" },
        user,
    )
    const employeeFilter = buildEmployeeFilter(query, user)
    const scopedEmployees = await Employee.find(employeeFilter)
        .select("_id shiftId")
        .lean()
    const assignedShiftIds = [
        ...new Set(
            scopedEmployees
                .map((employee) => String(employee.shiftId || ""))
                .filter(Boolean),
        ),
    ]
    const activeShifts = assignedShiftIds.length
        ? await Shift.find({
              _id: { $in: assignedShiftIds },
              status: "ACTIVE",
          })
              .select("_id")
              .lean()
        : []
    const activeShiftIds = new Set(
        activeShifts.map((shift) => String(shift._id)),
    )
    const missingShiftCount = scopedEmployees.filter(
        (employee) =>
            !employee.shiftId || !activeShiftIds.has(String(employee.shiftId)),
    ).length

    const importIssueFilter = {
        ...attendanceScopeFilter(user),
        companyId: query.companyId,
        branchId: query.branchId,
        status: "NO_EMPLOYEE_MATCH",
        attendanceDate: {
            $gte: startOfBusinessDay(query.dateFrom),
            $lte: endOfBusinessDay(query.dateTo),
        },
    }
    const rawScanFilter = {
        ...attendanceScopeFilter(user),
        companyId: query.companyId,
        branchId: query.branchId,
        scannedAt: {
            $gte: startOfBusinessDay(query.dateFrom),
            $lte: endOfBusinessDay(query.dateTo),
        },
    }
    const skip = (query.page - 1) * query.limit

    const [
        items,
        filteredTotal,
        totalRecords,
        verifiedCount,
        correctedCount,
        needsReviewCount,
        unmatchedCount,
        rawScanCount,
        latestRecord,
    ] = await Promise.all([
        AttendanceRecord.find(tableFilter)
            .populate(
                "employeeId",
                "employeeCode displayName englishFirstName englishLastName",
            )
            .populate("departmentId", "code name")
            .populate("positionId", "code name title")
            .populate("lineId", "code name")
            .populate("shiftId", "code name startTime endTime")
            .sort({ attendanceDate: -1, employeeCode: 1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        AttendanceRecord.countDocuments(tableFilter),
        AttendanceRecord.countDocuments(baseRecordFilter),
        AttendanceRecord.countDocuments({
            ...baseRecordFilter,
            verificationStatus: "VERIFIED",
        }),
        AttendanceRecord.countDocuments({
            ...baseRecordFilter,
            verificationStatus: "CORRECTED",
        }),
        AttendanceRecord.countDocuments({
            ...baseRecordFilter,
            verificationStatus: "NEEDS_REVIEW",
        }),
        AttendanceImportIssue.countDocuments(importIssueFilter),
        AttendanceRawScan.countDocuments(rawScanFilter),
        AttendanceRecord.findOne(baseRecordFilter)
            .sort({ updatedAt: -1 })
            .select("updatedAt")
            .lean(),
    ])

    let readiness = "READY"
    if (totalRecords === 0) {
        readiness = rawScanCount > 0 ? "NOT_VERIFIED" : "NO_DATA"
    } else if (
        needsReviewCount > 0 ||
        unmatchedCount > 0 ||
        missingShiftCount > 0
    ) {
        readiness = "ACTION_REQUIRED"
    }

    return {
        summary: {
            readiness,
            employeeCount: scopedEmployees.length,
            rawScanCount,
            totalRecords,
            verifiedCount,
            correctedCount,
            needsReviewCount,
            unmatchedCount,
            missingShiftCount,
            latestUpdatedAt: latestRecord?.updatedAt || null,
        },
        items: items.map(mapVerificationRecord),
        pagination: {
            page: query.page,
            limit: query.limit,
            total: filteredTotal,
            totalPages: Math.max(1, Math.ceil(filteredTotal / query.limit)),
        },
    }
}

export async function acceptAttendanceVerificationRecord({
    attendanceId,
    reason,
    user,
}) {
    if (!mongoose.isValidObjectId(attendanceId)) {
        throw new AppError({
            statusCode: 422,
            code: "VALIDATION_FAILED",
            messageKey: "errors.validationFailed",
        })
    }

    const record = await AttendanceRecord.findOne({
        _id: attendanceId,
        ...attendanceScopeFilter(user),
    })
    if (!record) {
        throw new AppError({
            statusCode: 404,
            code: "ATTENDANCE_RECORD_NOT_FOUND",
            messageKey: "errors.attendance.recordNotFound",
        })
    }
    if (["PAYROLL_LOCKED", "FINALIZED"].includes(record.lockStatus)) {
        throw new AppError({
            statusCode: 409,
            code: "ATTENDANCE_RECORD_LOCKED",
            messageKey: "errors.attendance.recordLocked",
        })
    }
    if (record.verificationStatus !== "NEEDS_REVIEW") {
        throw new AppError({
            statusCode: 409,
            code: "ATTENDANCE_REVIEW_ALREADY_RESOLVED",
            messageKey: "errors.attendance.reviewAlreadyResolved",
        })
    }

    const previousVerificationStatus = record.verificationStatus
    record.verificationStatus = "CORRECTED"
    record.lockStatus = "HR_VERIFIED"
    record.note = reason
    record.correction = {
        correctedByAccountId: user.accountId,
        correctedAt: new Date(),
        reason,
        previousValues: {
            firstInAt: record.firstInAt,
            lastOutAt: record.lastOutAt,
            status: record.status,
            workedMinutes: record.workedMinutes,
            lateMinutes: record.lateMinutes,
            earlyLeaveMinutes: record.earlyLeaveMinutes,
            issueCodes: record.issueCodes,
            verificationStatus: previousVerificationStatus,
        },
    }
    record.updatedByAccountId = user.accountId
    await record.save()

    invalidateAttendanceCaches()

    const populated = await AttendanceRecord.findById(record._id)
        .populate(
            "employeeId",
            "employeeCode displayName englishFirstName englishLastName",
        )
        .populate("departmentId", "code name")
        .populate("positionId", "code name title")
        .populate("lineId", "code name")
        .populate("shiftId", "code name startTime endTime")
        .lean()

    return mapVerificationRecord(populated)
}
