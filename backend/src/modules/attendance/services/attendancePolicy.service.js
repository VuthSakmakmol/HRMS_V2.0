import AttendancePolicy from "../models/AttendancePolicy.js"
import { AppError } from "../../../shared/errors/AppError.js"
import { clearCacheByPrefix, getCache, setCache } from "../../../shared/cache/memoryCache.js"
import { endOfBusinessDay, startOfBusinessDay } from "../utils/attendanceDate.util.js"

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

async function deactivateOtherActivePolicies({ companyId, branchId, excludeId, user }) {
    const filter = {
        companyId,
        branchId: branchId || null,
        status: "ACTIVE",
    }
    if (excludeId) filter._id = { $ne: excludeId }
    await AttendancePolicy.updateMany(filter, {
        $set: {
            status: "INACTIVE",
            updatedByAccountId: user.accountId,
        },
    })
}

export async function listAttendancePolicies({ query }) {
    const cacheKey = `${CACHE_PREFIX}list:${JSON.stringify(query)}`
    const cached = getCache(cacheKey)
    if (cached) return cached

    const filter = {}
    if (query.companyId) filter.companyId = query.companyId
    if (query.branchId) filter.branchId = query.branchId
    if (query.status !== "ALL") filter.status = query.status

    const items = await AttendancePolicy.find(filter)
        .populate("companyId", "code displayName")
        .populate("branchId", "code name")
        .sort({ companyId: 1, branchId: 1, status: 1, effectiveFrom: -1, name: 1 })
        .lean()

    const result = items.map((item) => ({ ...item, id: item._id.toString(), _id: undefined }))
    return setCache(cacheKey, result, CACHE_TTL_MS)
}

export async function createAttendancePolicy({ payload, user }) {
    const normalized = normalizePayload(payload)
    if (normalized.status === "ACTIVE") {
        await deactivateOtherActivePolicies({
            companyId: normalized.companyId,
            branchId: normalized.branchId,
            user,
        })
    }
    const policy = await AttendancePolicy.create({
        ...normalized,
        createdByAccountId: user.accountId,
        updatedByAccountId: user.accountId,
    })
    invalidateCache()
    return policy.toJSON()
}

export async function updateAttendancePolicy({ policyId, payload, user }) {
    const normalized = normalizePayload(payload)
    if (normalized.status === "ACTIVE") {
        await deactivateOtherActivePolicies({
            companyId: normalized.companyId,
            branchId: normalized.branchId,
            excludeId: policyId,
            user,
        })
    }
    const policy = await AttendancePolicy.findByIdAndUpdate(
        policyId,
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
    return AttendancePolicy.findOne({
        ...effectiveFilter,
        companyId,
        branchId: null,
    })
        .sort({ effectiveFrom: -1, updatedAt: -1 })
        .lean()
}
