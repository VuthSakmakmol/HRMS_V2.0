import { Types } from "mongoose"

import { clearCacheByPrefix, getCache, setCache } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Branch from "../../organization/models/Branch.js"
import Company from "../../organization/models/Company.js"
import ExitReason from "../models/ExitReason.js"

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function ensureObjectId(id, code, messageKey) {
    if (!id) return

    if (!Types.ObjectId.isValid(id)) {
        throw new AppError({ statusCode: 400, code, messageKey })
    }
}

function normalizeCode(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase()
}

function toId(value) {
    return value?._id?.toString?.() || value?.id || value?.toString?.() || null
}

function getUserCompanyIds(user) {
    return [
        ...new Set(
            (user?.roleAssignments || [])
                .map((assignment) => assignment.companyId)
                .filter(Boolean),
        ),
    ]
}

function getExitReasonScopeFilter(user) {
    if (user?.isRootAdmin) return {}

    const companyIds = getUserCompanyIds(user)

    if (!companyIds.length) {
        return { _id: { $in: [] } }
    }

    return {
        $or: [
            { companyId: null },
            { companyId: { $in: companyIds } },
        ],
    }
}

function buildSearchFilter(search) {
    const keyword = String(search || "").trim()

    if (!keyword) return {}

    const regex = new RegExp(escapeRegExp(keyword), "i")

    return {
        $or: [
            { code: regex },
            { name: regex },
            { shortName: regex },
            { description: regex },
        ],
    }
}

function buildListFilter(query = {}, user) {
    const filter = {
        ...getExitReasonScopeFilter(user),
        ...buildSearchFilter(query.search),
    }

    if (query.status && query.status !== "ALL") {
        filter.status = query.status
    }

    if (query.companyId) {
        filter.companyId = query.companyId
    }

    if (query.branchId) {
        filter.branchId = query.branchId
    }

    return filter
}

function buildLookupFilter(query = {}, user) {
    const scopeFilter = getExitReasonScopeFilter(user)
    const scopeOptions = [{ companyId: null, branchId: null }]

    if (query.companyId) {
        scopeOptions.push({ companyId: query.companyId, branchId: null })
    }

    if (query.companyId && query.branchId) {
        scopeOptions.push({ companyId: query.companyId, branchId: query.branchId })
    }

    return {
        ...scopeFilter,
        ...(query.status && query.status !== "ALL" ? { status: query.status } : {}),
        $or: scopeOptions,
    }
}

function serializeScope(document) {
    return {
        id: document?._id?.toString?.() || document?.id || null,
        code: document?.code || "",
        name: document?.name || document?.displayName || document?.legalName || "",
        displayName: document?.displayName || document?.name || document?.legalName || "",
    }
}

function serializeExitReason(document) {
    if (!document) return null

    return {
        id: toId(document._id || document.id),
        companyId: toId(document.companyId),
        branchId: toId(document.branchId),
        company: serializeScope(document.companyId),
        branch: serializeScope(document.branchId),
        code: document.code || "",
        name: document.name || "",
        shortName: document.shortName || "",
        description: document.description || "",
        sortOrder: Number(document.sortOrder || 0),
        status: document.status || "ACTIVE",
        createdAt: document.createdAt || null,
        updatedAt: document.updatedAt || null,
    }
}

async function validateScope(payload) {
    const companyId = payload.companyId || null
    const branchId = payload.branchId || null

    if (companyId) {
        ensureObjectId(companyId, "EXIT_REASON_COMPANY_INVALID_ID", "errors.organization.company.invalidId")

        const company = await Company.findOne({
            _id: companyId,
            status: { $ne: "ARCHIVED" },
        }).lean()

        if (!company) {
            throw new AppError({
                statusCode: 404,
                code: "EXIT_REASON_COMPANY_NOT_FOUND",
                messageKey: "errors.organization.company.notFound",
                fields: { companyId: ["errors.organization.company.notFound"] },
            })
        }
    }

    if (branchId) {
        ensureObjectId(branchId, "EXIT_REASON_BRANCH_INVALID_ID", "errors.organization.branch.invalidId")

        if (!companyId) {
            throw new AppError({
                statusCode: 422,
                code: "EXIT_REASON_COMPANY_REQUIRED_FOR_BRANCH",
                messageKey: "errors.organization.exitReason.companyRequiredForBranch",
                fields: { companyId: ["errors.organization.exitReason.companyRequiredForBranch"] },
            })
        }

        const branch = await Branch.findOne({
            _id: branchId,
            companyId,
            status: { $ne: "ARCHIVED" },
        }).lean()

        if (!branch) {
            throw new AppError({
                statusCode: 404,
                code: "EXIT_REASON_BRANCH_NOT_FOUND",
                messageKey: "errors.organization.branch.notFound",
                fields: { branchId: ["errors.organization.branch.notFound"] },
            })
        }
    }
}

async function ensureUniqueCode(payload, ignoreId = null) {
    const existing = await ExitReason.findOne({
        companyId: payload.companyId || null,
        branchId: payload.branchId || null,
        code: normalizeCode(payload.code),
        ...(ignoreId ? { _id: { $ne: ignoreId } } : {}),
    }).lean()

    if (existing) {
        throw new AppError({
            statusCode: 409,
            code: "EXIT_REASON_CODE_EXISTS",
            messageKey: "errors.organization.exitReason.codeExists",
            fields: { code: ["errors.organization.exitReason.codeExists"] },
        })
    }
}

export async function listExitReasons({ query, user }) {
    const cacheKey = `exit-reason:list:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cached = getCache(cacheKey)

    if (cached) return cached

    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const filter = buildListFilter(query, user)

    const [items, total] = await Promise.all([
        ExitReason.find(filter)
            .populate({ path: "companyId", select: "code displayName legalName" })
            .populate({ path: "branchId", select: "code name" })
            .sort({ sortOrder: 1, name: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        ExitReason.countDocuments(filter),
    ])

    const result = {
        items: items.map(serializeExitReason),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        },
    }

    return setCache(cacheKey, result, 30_000)
}

export async function lookupExitReasons({ query, user }) {
    const cacheKey = `exit-reason:lookup:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cached = getCache(cacheKey)

    if (cached) return cached

    const items = await ExitReason.find(buildLookupFilter(query, user))
        .populate({ path: "companyId", select: "code displayName legalName" })
        .populate({ path: "branchId", select: "code name" })
        .sort({ sortOrder: 1, name: 1 })
        .lean()

    return setCache(cacheKey, { items: items.map(serializeExitReason) }, 60_000)
}

export async function getExitReasonById({ exitReasonId, user }) {
    ensureObjectId(exitReasonId, "EXIT_REASON_INVALID_ID", "errors.organization.exitReason.invalidId")

    const exitReason = await ExitReason.findOne({
        _id: exitReasonId,
        ...getExitReasonScopeFilter(user),
    })
        .populate({ path: "companyId", select: "code displayName legalName" })
        .populate({ path: "branchId", select: "code name" })
        .lean()

    if (!exitReason) {
        throw new AppError({
            statusCode: 404,
            code: "EXIT_REASON_NOT_FOUND",
            messageKey: "errors.organization.exitReason.notFound",
        })
    }

    return serializeExitReason(exitReason)
}

export async function createExitReason({ payload, user }) {
    await validateScope(payload)
    await ensureUniqueCode(payload)

    const exitReason = await ExitReason.create({
        ...payload,
        companyId: payload.companyId || null,
        branchId: payload.branchId || null,
        code: normalizeCode(payload.code),
        status: payload.status || "ACTIVE",
        createdByAccountId: user.accountId,
        updatedByAccountId: user.accountId,
    })

    clearCacheByPrefix("exit-reason:")
    clearCacheByPrefix("hr-dashboard:")

    return getExitReasonById({ exitReasonId: exitReason._id, user })
}

export async function updateExitReason({ exitReasonId, payload, user }) {
    ensureObjectId(exitReasonId, "EXIT_REASON_INVALID_ID", "errors.organization.exitReason.invalidId")

    const existing = await ExitReason.findOne({
        _id: exitReasonId,
        ...getExitReasonScopeFilter(user),
    }).lean()

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "EXIT_REASON_NOT_FOUND",
            messageKey: "errors.organization.exitReason.notFound",
        })
    }

    if (existing.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "EXIT_REASON_ARCHIVED",
            messageKey: "errors.organization.exitReason.archived",
        })
    }

    const nextPayload = {
        ...existing,
        ...payload,
        companyId: Object.prototype.hasOwnProperty.call(payload, "companyId") ? payload.companyId || null : existing.companyId,
        branchId: Object.prototype.hasOwnProperty.call(payload, "branchId") ? payload.branchId || null : existing.branchId,
        code: payload.code ? normalizeCode(payload.code) : existing.code,
    }

    await validateScope(nextPayload)
    await ensureUniqueCode(nextPayload, existing._id)

    const updated = await ExitReason.findByIdAndUpdate(
        existing._id,
        {
            $set: {
                ...payload,
                companyId: nextPayload.companyId || null,
                branchId: nextPayload.branchId || null,
                code: nextPayload.code,
                updatedByAccountId: user.accountId,
            },
        },
        { new: true, runValidators: true, context: "query" },
    ).lean()

    clearCacheByPrefix("exit-reason:")
    clearCacheByPrefix("hr-dashboard:")

    return getExitReasonById({ exitReasonId: updated._id, user })
}

export async function archiveExitReason({ exitReasonId, user }) {
    ensureObjectId(exitReasonId, "EXIT_REASON_INVALID_ID", "errors.organization.exitReason.invalidId")

    const existing = await ExitReason.findOne({
        _id: exitReasonId,
        ...getExitReasonScopeFilter(user),
    }).lean()

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "EXIT_REASON_NOT_FOUND",
            messageKey: "errors.organization.exitReason.notFound",
        })
    }

    const updated = await ExitReason.findByIdAndUpdate(
        existing._id,
        {
            $set: {
                status: "ARCHIVED",
                updatedByAccountId: user.accountId,
            },
        },
        { new: true, runValidators: true, context: "query" },
    ).lean()

    clearCacheByPrefix("exit-reason:")
    clearCacheByPrefix("hr-dashboard:")

    return getExitReasonById({ exitReasonId: updated._id, user })
}
