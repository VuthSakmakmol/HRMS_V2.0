import { Types } from "mongoose"

import {
    clearCacheByPrefix,
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Branch from "../../organization/models/Branch.js"
import Company from "../../organization/models/Company.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"
import ManpowerPlan from "../models/ManpowerPlan.js"

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function ensureObjectId(id, code, messageKey) {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError({ statusCode: 400, code, messageKey })
    }
}

function toId(value) {
    return value?._id?.toString?.() || value?.id || value?.toString?.() || value || null
}

export function makeManpowerPlanDuplicateKey(payload) {
    return [
        toId(payload.companyId) || "",
        toId(payload.branchId) || "",
        String(payload.year || ""),
        String(payload.month || ""),
        toId(payload.departmentId) || "",
        toId(payload.positionId) || "",
    ].join("::")
}

export function buildManpowerPlanScopeFilter(payload) {
    return {
        companyId: payload.companyId,
        branchId: payload.branchId,
        year: payload.year,
        month: payload.month,
        departmentId: payload.departmentId,
        positionId: payload.positionId,
    }
}

function getUserCompanyIds(user) {
    return [...new Set((user?.roleAssignments || []).map((item) => item.companyId).filter(Boolean))]
}

function hasGlobalScope(user) {
    return (user?.roleAssignments || []).some(
        (assignment) => assignment.roleScope === "GLOBAL",
    )
}

function getCompanyScopeFilter(user) {
    if (user?.isRootAdmin || hasGlobalScope(user)) return {}
    const companyIds = getUserCompanyIds(user)
    return companyIds.length ? { _id: { $in: companyIds } } : { _id: { $in: [] } }
}

function getBranchScopeFilter(user) {
    if (user?.isRootAdmin || hasGlobalScope(user)) return {}

    const allBranchCompanyIds = []
    const branchIds = []

    for (const assignment of user?.roleAssignments || []) {
        if (assignment.allBranches && assignment.companyId) {
            allBranchCompanyIds.push(assignment.companyId)
        }
        for (const branchId of assignment.branchIds || []) {
            branchIds.push(branchId)
        }
    }

    const filters = []
    if (allBranchCompanyIds.length) {
        filters.push({ companyId: { $in: [...new Set(allBranchCompanyIds)] } })
    }
    if (branchIds.length) {
        filters.push({ _id: { $in: [...new Set(branchIds)] } })
    }

    return filters.length ? { $or: filters } : { _id: { $in: [] } }
}

function getPlanScopeFilter(user) {
    if (user?.isRootAdmin || hasGlobalScope(user)) return {}

    const allBranchCompanyIds = []
    const branchIds = []

    for (const assignment of user?.roleAssignments || []) {
        if (assignment.allBranches && assignment.companyId) {
            allBranchCompanyIds.push(assignment.companyId)
        }
        for (const branchId of assignment.branchIds || []) {
            branchIds.push(branchId)
        }
    }

    const filters = []
    if (allBranchCompanyIds.length) {
        filters.push({ companyId: { $in: [...new Set(allBranchCompanyIds)] } })
    }
    if (branchIds.length) {
        filters.push({ branchId: { $in: [...new Set(branchIds)] } })
    }

    return filters.length ? { $or: filters } : { _id: { $in: [] } }
}

function simpleOrg(item) {
    if (!item || typeof item !== "object") return null
    return {
        id: toId(item._id || item.id),
        code: item.code,
        name: item.name || item.title || item.displayName || item.legalName,
        displayName: item.displayName,
        title: item.title,
        status: item.status,
    }
}

export function serializeManpowerPlan(plan) {
    if (!plan) return null
    const raw = typeof plan.toJSON === "function" ? plan.toJSON() : { ...plan }

    return {
        id: toId(raw._id || raw.id),
        companyId: toId(raw.companyId),
        branchId: toId(raw.branchId),
        year: raw.year,
        month: raw.month,
        departmentId: toId(raw.departmentId),
        positionId: toId(raw.positionId),
        targetBudget: Number(raw.targetBudget || 0),
        targetRoadmap: Number(raw.targetRoadmap || 0),
        remark: raw.remark || "",
        status: raw.status,
        company: simpleOrg(raw.companyId),
        branch: simpleOrg(raw.branchId),
        department: simpleOrg(raw.departmentId),
        position: simpleOrg(raw.positionId),
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

function planPopulate(query) {
    return query
        .populate({ path: "companyId", select: "code displayName legalName status" })
        .populate({ path: "branchId", select: "companyId code name status" })
        .populate({ path: "departmentId", select: "companyId branchId code name status" })
        .populate({ path: "positionId", select: "companyId branchId departmentId code title level isManager status" })
}

async function buildSearchFilter(search, query, user) {
    const keyword = String(search || "").trim()
    if (!keyword) return {}

    const regex = new RegExp(escapeRegExp(keyword), "i")
    const scope = getPlanScopeFilter(user)
    const baseOrganizationFilter = {
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.branchId ? { branchId: query.branchId } : {}),
        status: { $ne: "ARCHIVED" },
    }

    const [departments, positions] = await Promise.all([
        Department.find({
            ...baseOrganizationFilter,
            $or: [{ code: regex }, { name: regex }],
        })
            .select("_id")
            .lean(),
        Position.find({
            ...baseOrganizationFilter,
            $or: [{ code: regex }, { title: regex }],
        })
            .select("_id")
            .lean(),
    ])

    const or = [{ remark: regex }]
    if (departments.length) {
        or.push({ departmentId: { $in: departments.map((item) => item._id) } })
    }
    if (positions.length) {
        or.push({ positionId: { $in: positions.map((item) => item._id) } })
    }

    return Object.keys(scope).length
        ? { $and: [scope, { $or: or }] }
        : { $or: or }
}

async function validateReferences(payload, user) {
    ensureObjectId(payload.companyId, "MANPOWER_PLAN_COMPANY_INVALID_ID", "errors.organization.company.invalidId")
    ensureObjectId(payload.branchId, "MANPOWER_PLAN_BRANCH_INVALID_ID", "errors.organization.branch.invalidId")
    ensureObjectId(payload.departmentId, "MANPOWER_PLAN_DEPARTMENT_INVALID_ID", "errors.report.manpowerPlan.invalidReference")
    ensureObjectId(payload.positionId, "MANPOWER_PLAN_POSITION_INVALID_ID", "errors.report.manpowerPlan.invalidReference")

    const company = await Company.findOne({
        _id: payload.companyId,
        ...getCompanyScopeFilter(user),
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!company) {
        throw new AppError({
            statusCode: 404,
            code: "MANPOWER_PLAN_COMPANY_NOT_FOUND",
            messageKey: "errors.organization.company.notFound",
        })
    }

    const branch = await Branch.findOne({
        _id: payload.branchId,
        companyId: payload.companyId,
        ...getBranchScopeFilter(user),
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!branch) {
        throw new AppError({
            statusCode: 404,
            code: "MANPOWER_PLAN_BRANCH_NOT_FOUND",
            messageKey: "errors.organization.branch.notFound",
        })
    }

    const department = await Department.findOne({
        _id: payload.departmentId,
        companyId: payload.companyId,
        branchId: payload.branchId,
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!department) {
        throw new AppError({
            statusCode: 404,
            code: "MANPOWER_PLAN_DEPARTMENT_NOT_FOUND",
            messageKey: "errors.report.manpowerPlan.departmentNotFound",
            fields: {
                departmentId: ["errors.report.manpowerPlan.departmentNotFound"],
            },
        })
    }

    const position = await Position.findOne({
        _id: payload.positionId,
        companyId: payload.companyId,
        branchId: payload.branchId,
        departmentId: payload.departmentId,
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!position) {
        throw new AppError({
            statusCode: 404,
            code: "MANPOWER_PLAN_POSITION_NOT_FOUND",
            messageKey: "errors.report.manpowerPlan.positionNotFound",
            fields: {
                positionId: ["errors.report.manpowerPlan.positionNotFound"],
            },
        })
    }
}

export async function validateManpowerPlanWorkspace({ companyId, branchId, user }) {
    ensureObjectId(companyId, "MANPOWER_PLAN_COMPANY_INVALID_ID", "errors.organization.company.invalidId")
    ensureObjectId(branchId, "MANPOWER_PLAN_BRANCH_INVALID_ID", "errors.organization.branch.invalidId")

    const [company, branch] = await Promise.all([
        Company.exists({ _id: companyId, ...getCompanyScopeFilter(user) }),
        Branch.exists({
            _id: branchId,
            companyId,
            ...getBranchScopeFilter(user),
        }),
    ])

    if (!company || !branch) {
        throw new AppError({
            statusCode: 403,
            code: "MANPOWER_PLAN_WORKSPACE_FORBIDDEN",
            messageKey: "errors.forbidden",
        })
    }
}

async function buildListFilter(query, user) {
    const scopeFilter = getPlanScopeFilter(user)
    const searchFilter = await buildSearchFilter(query.search, query, user)
    const filters = []

    if (Object.keys(scopeFilter).length) filters.push(scopeFilter)
    if (Object.keys(searchFilter).length) filters.push(searchFilter)

    const direct = {}
    for (const key of [
        "companyId",
        "branchId",
        "year",
        "month",
        "departmentId",
        "positionId",
    ]) {
        if (query[key]) direct[key] = query[key]
    }
    if (query.status !== "ALL") direct.status = query.status
    if (Object.keys(direct).length) filters.push(direct)

    if (!filters.length) return {}
    if (filters.length === 1) return filters[0]
    return { $and: filters }
}

function buildMutationPayload(payload, accountId, merged) {
    const result = {
        updatedByAccountId: accountId,
    }

    for (const field of [
        "year",
        "month",
        "departmentId",
        "positionId",
        "targetBudget",
        "targetRoadmap",
        "remark",
        "status",
    ]) {
        if (payload[field] !== undefined) result[field] = payload[field]
    }

    return result
}

function handleDuplicate(error) {
    if (error?.code !== 11000) throw error
    throw new AppError({
        statusCode: 409,
        code: "MANPOWER_PLAN_DUPLICATE_SCOPE",
        messageKey: "errors.report.manpowerPlan.duplicateScope",
    })
}

async function ensureNoDuplicateScope(payload, excludeId = null) {
    const filter = buildManpowerPlanScopeFilter(payload)
    if (excludeId) filter._id = { $ne: excludeId }

    const duplicate = await ManpowerPlan.exists(filter)
    if (duplicate) {
        throw new AppError({
            statusCode: 409,
            code: "MANPOWER_PLAN_DUPLICATE_SCOPE",
            messageKey: "errors.report.manpowerPlan.duplicateScope",
        })
    }
}

export async function listManpowerPlans({ query, user }) {
    const cacheKey = `manpowerPlan:list:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cached = getCache(cacheKey)
    if (cached) return cached

    const filter = await buildListFilter(query, user)
    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
        planPopulate(ManpowerPlan.find(filter))
            .sort({ year: -1, month: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        ManpowerPlan.countDocuments(filter),
    ])

    const result = {
        items: items.map(serializeManpowerPlan),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            hasNext: page * limit < total,
            hasPrevious: page > 1,
        },
    }

    return setCache(cacheKey, result, 30_000)
}

export async function getManpowerPlanById({ manpowerPlanId, user }) {
    ensureObjectId(manpowerPlanId, "MANPOWER_PLAN_INVALID_ID", "errors.report.manpowerPlan.invalidId")

    const plan = await planPopulate(
        ManpowerPlan.findOne({
            _id: manpowerPlanId,
            ...getPlanScopeFilter(user),
        }),
    ).lean()

    if (!plan) {
        throw new AppError({
            statusCode: 404,
            code: "MANPOWER_PLAN_NOT_FOUND",
            messageKey: "errors.report.manpowerPlan.notFound",
        })
    }

    return serializeManpowerPlan(plan)
}

export async function createManpowerPlan({ payload, user }) {
    await validateReferences(payload, user)
    await ensureNoDuplicateScope(payload)

    try {
        const plan = await ManpowerPlan.create({
            ...payload,
            status: payload.status || "ACTIVE",
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        clearCacheByPrefix("manpowerPlan:list:")
        return getManpowerPlanById({ manpowerPlanId: plan._id, user })
    } catch (error) {
        handleDuplicate(error)
    }
}

export async function updateManpowerPlan({ manpowerPlanId, payload, user }) {
    ensureObjectId(manpowerPlanId, "MANPOWER_PLAN_INVALID_ID", "errors.report.manpowerPlan.invalidId")

    const existing = await ManpowerPlan.findOne({
        _id: manpowerPlanId,
        ...getPlanScopeFilter(user),
    }).lean()

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "MANPOWER_PLAN_NOT_FOUND",
            messageKey: "errors.report.manpowerPlan.notFound",
        })
    }
    if (existing.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "MANPOWER_PLAN_ARCHIVED",
            messageKey: "errors.report.manpowerPlan.archived",
        })
    }

    const merged = { ...existing, ...payload }
    await validateReferences(merged, user)
    await ensureNoDuplicateScope(merged, existing._id)

    try {
        const updated = await ManpowerPlan.findByIdAndUpdate(
            existing._id,
            {
                $set: buildMutationPayload(payload, user.accountId, merged),
            },
            { new: true, runValidators: true, context: "query" },
        ).lean()

        clearCacheByPrefix("manpowerPlan:list:")
        return getManpowerPlanById({ manpowerPlanId: updated._id, user })
    } catch (error) {
        handleDuplicate(error)
    }
}

export async function archiveManpowerPlan({ manpowerPlanId, user }) {
    ensureObjectId(manpowerPlanId, "MANPOWER_PLAN_INVALID_ID", "errors.report.manpowerPlan.invalidId")

    const existing = await ManpowerPlan.findOne({
        _id: manpowerPlanId,
        ...getPlanScopeFilter(user),
    }).lean()

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "MANPOWER_PLAN_NOT_FOUND",
            messageKey: "errors.report.manpowerPlan.notFound",
        })
    }

    const archived = await ManpowerPlan.findByIdAndUpdate(
        existing._id,
        {
            $set: {
                status: "ARCHIVED",
                updatedByAccountId: user.accountId,
            },
        },
        { new: true, runValidators: true, context: "query" },
    ).lean()

    clearCacheByPrefix("manpowerPlan:list:")
    return getManpowerPlanById({ manpowerPlanId: archived._id, user })
}

export async function getExportManpowerPlans({ query, user }) {
    const filter = await buildListFilter(
        { ...query, page: 1, limit: 100, status: query.status || "ACTIVE" },
        user,
    )

    const items = await planPopulate(ManpowerPlan.find(filter))
        .sort({ year: -1, month: -1, createdAt: -1 })
        .lean()

    return items.map(serializeManpowerPlan)
}
