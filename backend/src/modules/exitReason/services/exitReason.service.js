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

function normalizeText(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
}

function toId(value) {
    return value?._id?.toString?.() || value?.id || value?.toString?.() || null
}

function getExitReasonScopeFilter(user) {
    if (user?.isRootAdmin) return {}

    const scopes = []

    for (const assignment of user?.roleAssignments || []) {
        if (!assignment.companyId) continue

        if (assignment.allBranches) {
            scopes.push({ companyId: assignment.companyId })
            continue
        }

        if (assignment.branchIds?.length) {
            scopes.push({
                companyId: assignment.companyId,
                branchId: { $in: assignment.branchIds },
            })
        }
    }

    return scopes.length ? { $or: scopes } : { _id: { $in: [] } }
}

function assertScopeAllowed(user, companyId, branchId) {
    if (user?.isRootAdmin) return

    const allowed = (user?.roleAssignments || []).some((assignment) => {
        if (String(assignment.companyId || "") !== String(companyId || "")) {
            return false
        }

        if (assignment.allBranches) return true

        return (assignment.branchIds || []).some(
            (id) => String(id) === String(branchId || ""),
        )
    })

    if (!allowed) {
        throw new AppError({
            statusCode: 403,
            code: "EXIT_REASON_SCOPE_FORBIDDEN",
            messageKey: "errors.authorization.insufficientScope",
        })
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

    if (query.companyId) filter.companyId = query.companyId
    if (query.branchId) filter.branchId = query.branchId

    return filter
}

function buildLookupFilter(query = {}, user) {
    return {
        ...getExitReasonScopeFilter(user),
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.status && query.status !== "ALL" ? { status: query.status } : {}),
    }
}

function serializeScope(document) {
    if (!document) return null

    return {
        id: toId(document),
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
        description: document.description || "",
        status: document.status || "ACTIVE",
        createdAt: document.createdAt || null,
        updatedAt: document.updatedAt || null,
    }
}

function duplicateCodeError() {
    return new AppError({
        statusCode: 409,
        code: "EXIT_REASON_CODE_EXISTS",
        messageKey: "errors.organization.exitReason.codeExists",
        fields: {
            code: ["errors.organization.exitReason.codeExists"],
        },
    })
}

function rethrowMongoDuplicate(error) {
    if (error?.code === 11000) {
        throw duplicateCodeError()
    }

    throw error
}

function clearExitReasonCaches() {
    clearCacheByPrefix("exit-reason:")
    clearCacheByPrefix("excom:")
}

async function validateScope(payload, user) {
    const companyId = payload.companyId || null
    const branchId = payload.branchId || null

    if (!companyId || !branchId) {
        throw new AppError({
            statusCode: 422,
            code: "EXIT_REASON_SCOPE_REQUIRED",
            messageKey: "errors.organization.exitReason.scopeRequired",
            fields: {
                ...(!companyId
                    ? { companyId: ["errors.organization.exitReason.scopeRequired"] }
                    : {}),
                ...(!branchId
                    ? { branchId: ["errors.organization.exitReason.scopeRequired"] }
                    : {}),
            },
        })
    }

    assertScopeAllowed(user, companyId, branchId)

    ensureObjectId(
        companyId,
        "EXIT_REASON_COMPANY_INVALID_ID",
        "errors.organization.company.invalidId",
    )

    ensureObjectId(
        branchId,
        "EXIT_REASON_BRANCH_INVALID_ID",
        "errors.organization.branch.invalidId",
    )

    const [company, branch] = await Promise.all([
        Company.findOne({
            _id: companyId,
            status: { $ne: "ARCHIVED" },
        })
            .select("_id")
            .lean(),
        Branch.findOne({
            _id: branchId,
            companyId,
            status: { $ne: "ARCHIVED" },
        })
            .select("_id")
            .lean(),
    ])

    if (!company) {
        throw new AppError({
            statusCode: 404,
            code: "EXIT_REASON_COMPANY_NOT_FOUND",
            messageKey: "errors.organization.exitReason.companyNotFound",
            fields: {
                companyId: ["errors.organization.exitReason.companyNotFound"],
            },
        })
    }

    if (!branch) {
        throw new AppError({
            statusCode: 404,
            code: "EXIT_REASON_BRANCH_NOT_FOUND",
            messageKey: "errors.organization.exitReason.branchNotFound",
            fields: {
                branchId: ["errors.organization.exitReason.branchNotFound"],
            },
        })
    }
}

async function ensureUniqueCode(payload, ignoreId = null) {
    const existing = await ExitReason.findOne({
        companyId: payload.companyId,
        branchId: payload.branchId,
        code: normalizeCode(payload.code),
        ...(ignoreId ? { _id: { $ne: ignoreId } } : {}),
    })
        .select("_id")
        .lean()

    if (existing) throw duplicateCodeError()
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
            .sort({ name: 1, code: 1 })
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
        .sort({ name: 1, code: 1 })
        .lean()

    return setCache(
        cacheKey,
        { items: items.map(serializeExitReason) },
        60_000,
    )
}

export async function getExitReasonById({ exitReasonId, user }) {
    ensureObjectId(
        exitReasonId,
        "EXIT_REASON_INVALID_ID",
        "errors.organization.exitReason.invalidId",
    )

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
    const cleanPayload = {
        ...payload,
        companyId: payload.companyId,
        branchId: payload.branchId,
        code: normalizeCode(payload.code),
        name: normalizeText(payload.name),
        description: normalizeText(payload.description),
        status: payload.status || "ACTIVE",
    }

    await validateScope(cleanPayload, user)
    await ensureUniqueCode(cleanPayload)

    let exitReason

    try {
        exitReason = await ExitReason.create({
            ...cleanPayload,
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })
    } catch (error) {
        rethrowMongoDuplicate(error)
    }

    clearExitReasonCaches()

    return getExitReasonById({
        exitReasonId: exitReason._id,
        user,
    })
}

export async function updateExitReason({ exitReasonId, payload, user }) {
    ensureObjectId(
        exitReasonId,
        "EXIT_REASON_INVALID_ID",
        "errors.organization.exitReason.invalidId",
    )

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
        companyId: Object.prototype.hasOwnProperty.call(payload, "companyId")
            ? payload.companyId
            : existing.companyId,
        branchId: Object.prototype.hasOwnProperty.call(payload, "branchId")
            ? payload.branchId
            : existing.branchId,
        code: Object.prototype.hasOwnProperty.call(payload, "code")
            ? normalizeCode(payload.code)
            : existing.code,
        name: Object.prototype.hasOwnProperty.call(payload, "name")
            ? normalizeText(payload.name)
            : existing.name,
        description: Object.prototype.hasOwnProperty.call(payload, "description")
            ? normalizeText(payload.description)
            : existing.description,
        status: Object.prototype.hasOwnProperty.call(payload, "status")
            ? payload.status
            : existing.status,
    }

    await validateScope(nextPayload, user)
    await ensureUniqueCode(nextPayload, existing._id)

    let updated

    try {
        updated = await ExitReason.findByIdAndUpdate(
            existing._id,
            {
                $set: {
                    companyId: nextPayload.companyId,
                    branchId: nextPayload.branchId,
                    code: nextPayload.code,
                    name: nextPayload.name,
                    description: nextPayload.description,
                    status: nextPayload.status,
                    updatedByAccountId: user.accountId,
                },
            },
            {
                new: true,
                runValidators: true,
                context: "query",
            },
        ).lean()
    } catch (error) {
        rethrowMongoDuplicate(error)
    }

    clearExitReasonCaches()

    return getExitReasonById({
        exitReasonId: updated._id,
        user,
    })
}

export async function archiveExitReason({ exitReasonId, user }) {
    ensureObjectId(
        exitReasonId,
        "EXIT_REASON_INVALID_ID",
        "errors.organization.exitReason.invalidId",
    )

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
        return getExitReasonById({ exitReasonId: existing._id, user })
    }

    const updated = await ExitReason.findByIdAndUpdate(
        existing._id,
        {
            $set: {
                status: "ARCHIVED",
                updatedByAccountId: user.accountId,
            },
        },
        {
            new: true,
            runValidators: true,
            context: "query",
        },
    ).lean()

    clearExitReasonCaches()

    return getExitReasonById({
        exitReasonId: updated._id,
        user,
    })
}
