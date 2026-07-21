import AttendancePolicy from "../models/AttendancePolicy.js"
import { AppError } from "../../../shared/errors/AppError.js"
import { clearCacheByPrefix, getCache, setCache } from "../../../shared/cache/memoryCache.js"
import { endOfBusinessDay, startOfBusinessDay } from "../utils/attendanceDate.util.js"
import Branch from "../../organization/models/Branch.js"
import { attendanceScopeFilter, assertAttendanceScope } from "../utils/attendanceScope.util.js"

const CACHE_PREFIX = "attendance:policies:"
const CACHE_TTL_MS = 60_000

function invalidateCache() {
    clearCacheByPrefix(CACHE_PREFIX)
}

function normalizePayload(payload) {
    return {
        ...payload,
        code: payload.code.trim().toUpperCase(),
        branchId: payload.branchId || null,
        effectiveFrom: payload.effectiveFrom ? startOfBusinessDay(payload.effectiveFrom) : null,
        effectiveTo: payload.effectiveTo ? endOfBusinessDay(payload.effectiveTo) : null,
    }
}

async function ensureNoActiveOverlap(payload, excludeId = null) {
    if (payload.status !== "ACTIVE") return

    const start = payload.effectiveFrom || new Date("1900-01-01T00:00:00.000Z")
    const end = payload.effectiveTo || new Date("2999-12-31T23:59:59.999Z")
    const overlap = await AttendancePolicy.exists({
        companyId: payload.companyId,
        branchId: payload.branchId,
        status: "ACTIVE",
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
        $and: [
            { $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: end } }] },
            { $or: [{ effectiveTo: null }, { effectiveTo: { $gte: start } }] },
        ],
    })
    if (overlap) {
        throw new AppError({
            statusCode: 409,
            code: "ATTENDANCE_POLICY_DATE_OVERLAP",
            messageKey: "errors.attendance.policyDateOverlap",
        })
    }
}

async function validatePolicyScope(payload, user) {
    assertAttendanceScope(user, payload.companyId, payload.branchId)
    const branch = await Branch.exists({ _id: payload.branchId, companyId: payload.companyId, status: { $ne: "ARCHIVED" } })
    if (!branch) throw new AppError({ statusCode: 422, code: "ATTENDANCE_POLICY_BRANCH_INVALID", messageKey: "errors.attendance.policyBranchInvalid" })
}

export async function listAttendancePolicies({ query, user }) {
    const cacheKey = `${CACHE_PREFIX}list:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cached = getCache(cacheKey)
    if (cached) return cached

    const filter = { ...attendanceScopeFilter(user) }
    if (query.companyId) filter.companyId = query.companyId
    if (query.branchId) filter.branchId = query.branchId
    if (query.status !== "ALL") filter.status = query.status

    if (query.search) filter.$and = [{ $or: [
        { code: { $regex: query.search, $options: "i" } },
        { name: { $regex: query.search, $options: "i" } },
    ] }]
    const skip = (query.page - 1) * query.limit
    const [items, total] = await Promise.all([
        AttendancePolicy.find(filter)
        .populate("companyId", "code displayName")
        .populate("branchId", "code name")
        .sort({ status: 1, effectiveFrom: -1, name: 1 })
        .skip(skip).limit(query.limit).lean(),
        AttendancePolicy.countDocuments(filter),
    ])

    const result = {
        items: items.map((item) => ({ ...item, id: item._id.toString(), _id: undefined })),
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    }
    return setCache(cacheKey, result, CACHE_TTL_MS)
}

export async function createAttendancePolicy({ payload, user }) {
    await validatePolicyScope(payload, user)
    const normalized = normalizePayload(payload)
    await ensureNoActiveOverlap(normalized)
    const policy = await AttendancePolicy.create({
        ...normalized,
        createdByAccountId: user.accountId,
        updatedByAccountId: user.accountId,
    })
    invalidateCache()
    return policy.toJSON()
}

export async function updateAttendancePolicy({ policyId, payload, user }) {
    await validatePolicyScope(payload, user)
    const normalized = normalizePayload(payload)
    await ensureNoActiveOverlap(normalized, policyId)
    const policy = await AttendancePolicy.findOneAndUpdate(
        { _id: policyId, ...attendanceScopeFilter(user) },
        { $set: { ...normalized, updatedByAccountId: user.accountId } },
        { returnDocument: "after", runValidators: true },
    )
    if (!policy) {
        throw new AppError({
            statusCode: 404,
            code: "ATTENDANCE_POLICY_NOT_FOUND",
            messageKey: "errors.attendance.policyNotFound",
        })
    }
    invalidateCache()
    return policy.toJSON()
}

export async function archiveAttendancePolicy({ policyId, user }) {
    const policy = await AttendancePolicy.findOneAndUpdate(
        { _id: policyId, ...attendanceScopeFilter(user) },
        { $set: { status: "ARCHIVED", updatedByAccountId: user.accountId } },
        { returnDocument: "after", runValidators: true },
    )
    if (!policy) throw new AppError({ statusCode: 404, code: "ATTENDANCE_POLICY_NOT_FOUND", messageKey: "errors.attendance.policyNotFound" })
    invalidateCache()
    return policy.toJSON()
}

export async function resolveAttendancePolicy({ companyId, branchId, workDate = new Date() }) {
    const effectiveFilter = {
        status: "ACTIVE",
        $and: [
            { $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: workDate } }] },
            { $or: [{ effectiveTo: null }, { effectiveTo: { $gte: workDate } }] },
        ],
    }
    if (branchId) {
        const branchPolicy = await AttendancePolicy.findOne({
            ...effectiveFilter,
            companyId,
            branchId,
        })
            .sort({ effectiveFrom: -1, updatedAt: -1 })
            .lean()
        if (branchPolicy) return branchPolicy
    }
    return null
}
