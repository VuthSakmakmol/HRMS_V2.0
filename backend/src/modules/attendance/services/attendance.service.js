import mongoose from "mongoose"
import Employee from "../../employee/models/Employee.js"
import Shift from "../../shift/models/Shift.js"
import AttendanceRecord from "../models/AttendanceRecord.js"
import { AppError } from "../../../shared/errors/AppError.js"
import { clearCacheByPrefix, getCache, setCache } from "../../../shared/cache/memoryCache.js"
import { calculateAttendanceResult } from "./attendanceCalculation.service.js"
import { resolveAttendancePolicy } from "./attendancePolicy.service.js"
import { endOfBusinessDay, startOfBusinessDay, toBusinessDateKey } from "../utils/attendanceDate.util.js"
import { attendanceScopeFilter, assertAttendanceScope } from "../utils/attendanceScope.util.js"

export const ATTENDANCE_LIST_CACHE_PREFIX = "attendance:records:list:"
export const HR_DASHBOARD_DATA_CACHE_PREFIX = "hr-dashboard:data:"
const CACHE_TTL_MS = 15_000

export function invalidateAttendanceCaches() {
    clearCacheByPrefix(ATTENDANCE_LIST_CACHE_PREFIX)
    clearCacheByPrefix(HR_DASHBOARD_DATA_CACHE_PREFIX)
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

async function resolveEmployeeAndShift(employeeCode, user, workspace = {}) {
    const employee = await Employee.findOne({
        employeeCode: employeeCode.trim().toUpperCase(),
        recordStatus: "ACTIVE",
        ...(workspace.companyId ? { companyId: workspace.companyId } : {}),
        ...(workspace.branchId ? { branchId: workspace.branchId } : {}),
        ...attendanceScopeFilter(user),
    }).lean()
    if (!employee) {
        throw new AppError({ statusCode: 404, code: "ATTENDANCE_EMPLOYEE_NOT_FOUND", messageKey: "errors.attendance.employeeNotFound" })
    }
    const shift = await Shift.findOne({ _id: employee.shiftId, status: "ACTIVE" }).lean()
    if (!shift) {
        throw new AppError({ statusCode: 422, code: "ATTENDANCE_SHIFT_NOT_FOUND", messageKey: "errors.attendance.shiftNotFound" })
    }
    return { employee, shift }
}

function assertUnlocked(record) {
    if (["PAYROLL_LOCKED", "FINALIZED"].includes(record?.lockStatus)) {
        throw new AppError({
            statusCode: 409,
            code: "ATTENDANCE_RECORD_LOCKED",
            messageKey: "errors.attendance.recordLocked",
        })
    }
}

export async function upsertAttendanceRecord({ payload, user, source = "MANUAL", session = null, invalidateCache = true }) {
    const { employee, shift } = await resolveEmployeeAndShift(payload.employeeCode, user, payload)
    assertAttendanceScope(user, employee.companyId, employee.branchId)
    const workDate = toBusinessDateKey(payload.attendanceDate)
    const attendanceDate = startOfBusinessDay(workDate)
    const existing = await AttendanceRecord.findOne({ employeeId: employee._id, attendanceDate }).session(session).lean()
    assertUnlocked(existing)
    const policy = await resolveAttendancePolicy({
        companyId: employee.companyId,
        branchId: employee.branchId,
        workDate: attendanceDate,
    })
    const calculated = calculateAttendanceResult({
        workDate,
        shift,
        policy,
        dayType: existing?.dayType || "WORKING_DAY",
        correctedTimes: {
            firstInAt: payload.firstInAt ? new Date(payload.firstInAt) : null,
            lastOutAt: payload.lastOutAt ? new Date(payload.lastOutAt) : null,
        },
    })
    const record = await AttendanceRecord.findOneAndUpdate(
        { employeeId: employee._id, attendanceDate },
        {
            $set: {
                employeeCode: employee.employeeCode,
                companyId: employee.companyId,
                branchId: employee.branchId,
                departmentId: employee.departmentId,
                positionId: employee.positionId,
                lineId: employee.lineId,
                shiftId: employee.shiftId,
                source,
                leaveCode: payload.leaveCode || null,
                note: payload.note || "",
                verificationStatus: "CORRECTED",
                policySnapshot: policySnapshot(policy),
                calculationVersion: "ATTENDANCE_ENGINE_V2",
                correction: {
                    correctedByAccountId: user.accountId,
                    correctedAt: new Date(),
                    reason: payload.note || "Manual correction",
                    previousValues: existing
                        ? {
                              firstInAt: existing.firstInAt,
                              lastOutAt: existing.lastOutAt,
                              status: existing.status,
                              workedMinutes: existing.workedMinutes,
                              lateMinutes: existing.lateMinutes,
                              earlyLeaveMinutes: existing.earlyLeaveMinutes,
                              leaveCode: existing.leaveCode || null,
                          }
                        : null,
                },
                updatedByAccountId: user.accountId,
                ...calculated,
                verificationStatus: "CORRECTED",
            },
            $setOnInsert: {
                employeeId: employee._id,
                attendanceDate,
                createdByAccountId: user.accountId,
            },
        },
        { upsert: true, returnDocument: "after", runValidators: true, session },
    )
    if (invalidateCache) invalidateAttendanceCaches()
    return record.toJSON()
}

export async function updateAttendanceRecord({ attendanceId, payload, user }) {
    if (!mongoose.isValidObjectId(attendanceId)) {
        throw new AppError({ statusCode: 422, code: "VALIDATION_FAILED", messageKey: "errors.validationFailed" })
    }
    const existing = await AttendanceRecord.findOne({
        _id: attendanceId,
        ...attendanceScopeFilter(user),
    })
    if (!existing) {
        throw new AppError({ statusCode: 404, code: "ATTENDANCE_RECORD_NOT_FOUND", messageKey: "errors.attendance.recordNotFound" })
    }
    assertUnlocked(existing)
    if (!payload.note?.trim()) {
        throw new AppError({ statusCode: 422, code: "ATTENDANCE_CORRECTION_REASON_REQUIRED", messageKey: "errors.attendance.correctionReasonRequired" })
    }
    if (payload.employeeCode.trim().toUpperCase() !== existing.employeeCode) {
        throw new AppError({ statusCode: 409, code: "ATTENDANCE_EMPLOYEE_CHANGE_NOT_ALLOWED", messageKey: "errors.attendance.employeeChangeNotAllowed" })
    }
    const originalDate = toBusinessDateKey(existing.attendanceDate)
    if (toBusinessDateKey(payload.attendanceDate) !== originalDate) {
        throw new AppError({ statusCode: 409, code: "ATTENDANCE_DATE_CHANGE_NOT_ALLOWED", messageKey: "errors.attendance.dateChangeNotAllowed" })
    }
    return upsertAttendanceRecord({ payload, user, source: existing.source })
}

export async function listAttendanceRecords({ query, user }) {
    const cacheKey = `${ATTENDANCE_LIST_CACHE_PREFIX}${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cached = getCache(cacheKey)
    if (cached) return cached
    const filter = {
        ...attendanceScopeFilter(user),
        attendanceDate: {
            $gte: startOfBusinessDay(query.dateFrom),
            $lte: endOfBusinessDay(query.dateTo),
        },
    }
    for (const field of ["companyId", "branchId", "departmentId", "positionId", "lineId"]) {
        if (query[field]) filter[field] = query[field]
    }
    if (query.status !== "ALL") filter.status = query.status
    if (query.verificationStatus && query.verificationStatus !== "ALL") {
        filter.verificationStatus = query.verificationStatus
    }
    if (query.issueCode) filter.issueCodes = query.issueCode
    if (query.search) {
        const employees = await Employee.find({
            ...attendanceScopeFilter(user),
            $or: [
                { employeeCode: { $regex: query.search, $options: "i" } },
                { displayName: { $regex: query.search, $options: "i" } },
                { englishFirstName: { $regex: query.search, $options: "i" } },
                { englishLastName: { $regex: query.search, $options: "i" } },
            ],
        }).select("_id").lean()
        filter.employeeId = { $in: employees.map((employee) => employee._id) }
    }
    const skip = (query.page - 1) * query.limit
    const [items, total] = await Promise.all([
        AttendanceRecord.find(filter)
            .populate("employeeId", "employeeCode displayName englishFirstName englishLastName")
            .populate("departmentId", "code name")
            .populate("positionId", "code name")
            .populate("lineId", "code name")
            .populate("shiftId", "code name startTime endTime")
            .sort({ attendanceDate: -1, employeeCode: 1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        AttendanceRecord.countDocuments(filter),
    ])
    const result = {
        items: items.map((item) => ({ ...item, id: item._id.toString(), _id: undefined })),
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    }
    return setCache(cacheKey, result, CACHE_TTL_MS)
}

export async function getAttendanceExportRecords({ query, user }) {
    const filter = {
        ...attendanceScopeFilter(user),
        attendanceDate: { $gte: startOfBusinessDay(query.dateFrom), $lte: endOfBusinessDay(query.dateTo) },
    }
    for (const field of ["companyId", "branchId", "departmentId", "positionId", "lineId"]) {
        if (query[field]) filter[field] = query[field]
    }
    if (query.status !== "ALL") filter.status = query.status
    if (query.verificationStatus && query.verificationStatus !== "ALL") filter.verificationStatus = query.verificationStatus
    if (query.issueCode) filter.issueCodes = query.issueCode
    if (query.search) {
        const employees = await Employee.find({
            ...attendanceScopeFilter(user),
            $or: [
                { employeeCode: { $regex: query.search, $options: "i" } },
                { displayName: { $regex: query.search, $options: "i" } },
            ],
        }).select("_id").lean()
        filter.employeeId = { $in: employees.map((employee) => employee._id) }
    }
    return AttendanceRecord.find(filter)
        .populate("employeeId", "employeeCode displayName")
        .populate("departmentId", "code name")
        .populate("positionId", "code title")
        .populate("lineId", "code name")
        .populate("shiftId", "code name")
        .sort({ attendanceDate: -1, employeeCode: 1 })
        .limit(50_000)
        .lean()
}
