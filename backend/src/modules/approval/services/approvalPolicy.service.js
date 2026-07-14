import {
    clearCacheByPrefix,
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import ApprovalPolicy from "../models/ApprovalPolicy.js"
import {
    serializePolicy,
    validatePolicyScope,
} from "./approvalResolver.service.js"

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
            { code: regex },
            { name: regex },
            { moduleKey: regex },
            { actionKey: regex },
            { description: regex },
        ],
    }
}

function buildPolicyFilter(query) {
    const filter = {
        ...buildSearchFilter(query.search),
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    if (query.moduleKey) {
        filter.moduleKey = normalizeCode(query.moduleKey)
    }

    if (query.actionKey) {
        filter.actionKey = normalizeCode(query.actionKey)
    }

    if (query.companyId) {
        filter["scope.companyId"] = query.companyId
    }

    if (query.branchId) {
        filter["scope.branchId"] = query.branchId
    }

    return filter
}

function normalizePolicyPayload(payload) {
    const normalized = {
        ...payload,
    }

    if (payload.moduleKey) {
        normalized.moduleKey = normalizeCode(payload.moduleKey)
    }

    if (payload.actionKey) {
        normalized.actionKey = normalizeCode(payload.actionKey)
    }

    if (payload.code) {
        normalized.code = normalizeCode(payload.code)
    }

    if (Array.isArray(payload.steps)) {
        normalized.steps = payload.steps.map((step) => ({
            ...step,
            stepCode: normalizeCode(step.stepCode),
            approvalMode: normalizeCode(step.approvalMode || "ALL"),
            assignmentMode: normalizeCode(step.assignmentMode || "FIRST"),
            resolverKey: normalizeCode(step.resolverKey),
            fallbackResolvers: (step.fallbackResolvers || []).map((fallback) => ({
                ...fallback,
                resolverKey: normalizeCode(fallback.resolverKey),
            })),
        }))
    }

    return normalized
}

function handleDuplicate(error) {
    if (error?.code !== 11000) {
        throw error
    }

    throw new AppError({
        statusCode: 409,
        code: "APPROVAL_POLICY_CODE_EXISTS",
        messageKey: "errors.approval.policy.codeExists",
        fields: {
            code: ["errors.approval.policy.codeExists"],
        },
    })
}

function validateSteps(steps = []) {
    const sequences = new Set()
    const stepCodes = new Set()

    for (const step of steps) {
        if (sequences.has(Number(step.sequence))) {
            throw new AppError({
                statusCode: 422,
                code: "APPROVAL_POLICY_DUPLICATE_STEP_SEQUENCE",
                messageKey: "errors.approval.policy.duplicateStepSequence",
            })
        }

        if (stepCodes.has(normalizeCode(step.stepCode))) {
            throw new AppError({
                statusCode: 422,
                code: "APPROVAL_POLICY_DUPLICATE_STEP_CODE",
                messageKey: "errors.approval.policy.duplicateStepCode",
            })
        }

        sequences.add(Number(step.sequence))
        stepCodes.add(normalizeCode(step.stepCode))
    }
}

export async function listApprovalPolicies({ query }) {
    const cacheKey = `approval:policy:list:${JSON.stringify(query)}`
    const cached = getCache(cacheKey)

    if (cached) {
        return cached
    }

    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit
    const filter = buildPolicyFilter(query)

    const [items, total] = await Promise.all([
        ApprovalPolicy.find(filter)
            .sort({ moduleKey: 1, actionKey: 1, priority: 1, code: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        ApprovalPolicy.countDocuments(filter),
    ])

    const result = {
        items: items.map(serializePolicy),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        },
    }

    return setCache(cacheKey, result, 30_000)
}

export async function getApprovalPolicyById({ policyId }) {
    const policy = await ApprovalPolicy.findById(policyId).lean()

    if (!policy) {
        throw new AppError({
            statusCode: 404,
            code: "APPROVAL_POLICY_NOT_FOUND",
            messageKey: "errors.approval.policy.notFound",
        })
    }

    return serializePolicy(policy)
}

export async function createApprovalPolicy({ payload, user }) {
    const normalized = normalizePolicyPayload(payload)

    await validatePolicyScope(normalized.scope)
    validateSteps(normalized.steps)

    try {
        const policy = await ApprovalPolicy.create({
            ...normalized,
            version: 1,
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        clearCacheByPrefix("approval:policy:list:")

        return getApprovalPolicyById({ policyId: policy._id })
    } catch (error) {
        handleDuplicate(error)
    }
}

export async function updateApprovalPolicy({ policyId, payload, user }) {
    const existing = await ApprovalPolicy.findById(policyId).lean()

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "APPROVAL_POLICY_NOT_FOUND",
            messageKey: "errors.approval.policy.notFound",
        })
    }

    if (existing.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "APPROVAL_POLICY_ARCHIVED",
            messageKey: "errors.approval.policy.archived",
        })
    }

    const normalized = normalizePolicyPayload(payload)
    const merged = {
        ...existing,
        ...normalized,
        scope: {
            ...(existing.scope || {}),
            ...(normalized.scope || {}),
        },
    }

    await validatePolicyScope(merged.scope)
    validateSteps(merged.steps || [])

    try {
        const updated = await ApprovalPolicy.findByIdAndUpdate(
            existing._id,
            {
                $set: {
                    ...normalized,
                    updatedByAccountId: user.accountId,
                },
                $inc: {
                    version: 1,
                },
            },
            { new: true, runValidators: true, context: "query" },
        ).lean()

        clearCacheByPrefix("approval:policy:list:")

        return getApprovalPolicyById({ policyId: updated._id })
    } catch (error) {
        handleDuplicate(error)
    }
}

export async function archiveApprovalPolicy({ policyId, user }) {
    const existing = await ApprovalPolicy.findById(policyId).lean()

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "APPROVAL_POLICY_NOT_FOUND",
            messageKey: "errors.approval.policy.notFound",
        })
    }

    const archived = await ApprovalPolicy.findByIdAndUpdate(
        existing._id,
        {
            $set: {
                status: "ARCHIVED",
                updatedByAccountId: user.accountId,
            },
            $inc: {
                version: 1,
            },
        },
        { new: true, runValidators: true, context: "query" },
    ).lean()

    clearCacheByPrefix("approval:policy:list:")

    return getApprovalPolicyById({ policyId: archived._id })
}
