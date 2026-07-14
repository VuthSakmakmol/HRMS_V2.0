import {
    clearCacheByPrefix,
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import ApprovalModule from "../models/ApprovalModule.js"

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeCode(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase()
}

function buildSearchFilter(search) {
    const keyword = String(search || "").trim()

    if (!keyword) {
        return {}
    }

    const regex = new RegExp(escapeRegExp(keyword), "i")

    return {
        $or: [
            { moduleKey: regex },
            { name: regex },
            { description: regex },
            { defaultActionKey: regex },
        ],
    }
}

function serializeApprovalModule(item) {
    if (!item) {
        return null
    }

    const raw = typeof item.toJSON === "function" ? item.toJSON() : { ...item }

    return {
        id: raw._id?.toString?.() || raw.id,
        moduleKey: raw.moduleKey,
        name: raw.name,
        defaultActionKey: raw.defaultActionKey || "REQUEST",
        description: raw.description || "",
        status: raw.status,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

function handleDuplicate(error) {
    if (error?.code !== 11000) {
        throw error
    }

    throw new AppError({
        statusCode: 409,
        code: "APPROVAL_MODULE_KEY_EXISTS",
        messageKey: "errors.approval.module.keyExists",
        fields: {
            moduleKey: ["errors.approval.module.keyExists"],
        },
    })
}

export async function listApprovalModules({ query }) {
    const cacheKey = `approval:module:list:${JSON.stringify(query)}`
    const cached = getCache(cacheKey)

    if (cached) {
        return cached
    }

    const filter = {
        ...buildSearchFilter(query.search),
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
        ApprovalModule.find(filter)
            .sort({ moduleKey: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        ApprovalModule.countDocuments(filter),
    ])

    const result = {
        items: items.map(serializeApprovalModule),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        },
    }

    return setCache(cacheKey, result, 30_000)
}

export async function createApprovalModule({ payload, user }) {
    try {
        const module = await ApprovalModule.create({
            ...payload,
            moduleKey: normalizeCode(payload.moduleKey),
            defaultActionKey: normalizeCode(payload.defaultActionKey || "REQUEST"),
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        clearCacheByPrefix("approval:module:list:")

        return serializeApprovalModule(module)
    } catch (error) {
        handleDuplicate(error)
    }
}

export async function updateApprovalModule({ moduleId, payload, user }) {
    const existing = await ApprovalModule.findById(moduleId).lean()

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "APPROVAL_MODULE_NOT_FOUND",
            messageKey: "errors.approval.module.notFound",
        })
    }

    if (existing.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "APPROVAL_MODULE_ARCHIVED",
            messageKey: "errors.approval.module.archived",
        })
    }

    const updatePayload = {
        ...payload,
        updatedByAccountId: user.accountId,
    }

    if (payload.moduleKey) {
        updatePayload.moduleKey = normalizeCode(payload.moduleKey)
    }

    if (payload.defaultActionKey) {
        updatePayload.defaultActionKey = normalizeCode(payload.defaultActionKey)
    }

    try {
        const updated = await ApprovalModule.findByIdAndUpdate(
            existing._id,
            { $set: updatePayload },
            { new: true, runValidators: true, context: "query" },
        ).lean()

        clearCacheByPrefix("approval:module:list:")

        return serializeApprovalModule(updated)
    } catch (error) {
        handleDuplicate(error)
    }
}

export async function archiveApprovalModule({ moduleId, user }) {
    const existing = await ApprovalModule.findById(moduleId).lean()

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "APPROVAL_MODULE_NOT_FOUND",
            messageKey: "errors.approval.module.notFound",
        })
    }

    const archived = await ApprovalModule.findByIdAndUpdate(
        existing._id,
        {
            $set: {
                status: "ARCHIVED",
                updatedByAccountId: user.accountId,
            },
        },
        { new: true, runValidators: true, context: "query" },
    ).lean()

    clearCacheByPrefix("approval:module:list:")

    return serializeApprovalModule(archived)
}
