
import { Types } from "mongoose"

import {
    clearCacheByPrefix,
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Company from "../../organization/models/Company.js"
import Branch from "../../organization/models/Branch.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"
import Line from "../../line/models/Line.js"
import Shift from "../../shift/models/Shift.js"
import EmployeeType from "../../employeeType/models/EmployeeType.js"
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

function sameId(a, b) {
    const left = toId(a)
    const right = toId(b)
    return Boolean(left && right && left === right)
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
        if (assignment.allBranches && assignment.companyId) allBranchCompanyIds.push(assignment.companyId)
        for (const branchId of assignment.branchIds || []) branchIds.push(branchId)
    }

    const filters = []
    if (allBranchCompanyIds.length) filters.push({ companyId: { $in: [...new Set(allBranchCompanyIds)] } })
    if (branchIds.length) filters.push({ _id: { $in: [...new Set(branchIds)] } })
    return filters.length ? { $or: filters } : { _id: { $in: [] } }
}

function getPlanScopeFilter(user) {
    if (user?.isRootAdmin || hasGlobalScope(user)) return {}

    const allBranchCompanyIds = []
    const branchIds = []

    for (const assignment of user?.roleAssignments || []) {
        if (assignment.allBranches && assignment.companyId) allBranchCompanyIds.push(assignment.companyId)
        for (const branchId of assignment.branchIds || []) branchIds.push(branchId)
    }

    const filters = []
    if (allBranchCompanyIds.length) filters.push({ companyId: { $in: [...new Set(allBranchCompanyIds)] } })
    if (branchIds.length) filters.push({ branchId: { $in: [...new Set(branchIds)] } })
    return filters.length ? { $or: filters } : { _id: { $in: [] } }
}

function buildSearchFilter(search) {
    const keyword = String(search || "").trim()
    if (!keyword) return {}
    const regex = new RegExp(escapeRegExp(keyword), "i")
    return {
        $or: [
            { employeeTypeChildCode: regex },
            { employeeTypeChildName: regex },
            { remark: regex },
        ],
    }
}

function simpleOrg(item) {
    if (!item || typeof item !== "object") return null
    return {
        id: toId(item._id || item.id),
        code: item.code,
        name: item.name || item.title || item.displayName || item.legalName,
        displayName: item.displayName,
        title: item.title,
        shortName: item.shortName,
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
        lineId: toId(raw.lineId),
        shiftId: toId(raw.shiftId),
        employeeTypeId: toId(raw.employeeTypeId),
        employeeTypeChildId: toId(raw.employeeTypeChildId),
        employeeTypeChildCode: raw.employeeTypeChildCode || "",
        employeeTypeChildName: raw.employeeTypeChildName || "",
        targetBudget: Number(raw.targetBudget || 0),
        targetRoadmap: Number(raw.targetRoadmap || 0),
        remark: raw.remark || "",
        status: raw.status,
        company: simpleOrg(raw.companyId),
        branch: simpleOrg(raw.branchId),
        department: simpleOrg(raw.departmentId),
        position: simpleOrg(raw.positionId),
        line: simpleOrg(raw.lineId),
        shift: simpleOrg(raw.shiftId),
        employeeType: simpleOrg(raw.employeeTypeId),
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

function planPopulate(query) {
    return query
        .populate({ path: "companyId", select: "code displayName legalName status" })
        .populate({ path: "branchId", select: "companyId code name shortName status" })
        .populate({ path: "departmentId", select: "companyId branchId code name shortName status" })
        .populate({ path: "positionId", select: "companyId branchId departmentId code title shortName level isManager status" })
        .populate({ path: "lineId", select: "companyId branchId departmentId code name shortName status" })
        .populate({ path: "shiftId", select: "companyId branchId code name shortName startTime endTime status" })
        .populate({ path: "employeeTypeId", select: "code name shortName status" })
}

function findEmployeeTypePositionMatch(employeeType, positionId) {
    if (!employeeType || !positionId) return null

    if ((employeeType.positionIds || []).some((id) => sameId(id, positionId))) {
        return { employeeTypeChildId: null, employeeTypeChildCode: "", employeeTypeChildName: "" }
    }

    for (const child of employeeType.children || []) {
        if ((child.positionIds || []).some((id) => sameId(id, positionId))) {
            return {
                employeeTypeChildId: toId(child._id || child.id),
                employeeTypeChildCode: child.code || "",
                employeeTypeChildName: child.name || "",
            }
        }
    }

    return null
}

async function resolveEmployeeTypeChild(payload) {
    if (!payload.employeeTypeId) {
        return {
            employeeTypeChildId: null,
            employeeTypeChildCode: "",
            employeeTypeChildName: "",
        }
    }

    const employeeType = await EmployeeType.findOne({ _id: payload.employeeTypeId, status: { $ne: "ARCHIVED" } }).lean()
    if (!employeeType) {
        throw new AppError({ statusCode: 404, code: "MANPOWER_PLAN_EMPLOYEE_TYPE_NOT_FOUND", messageKey: "errors.report.manpowerPlan.employeeTypeNotFound" })
    }

    if (payload.employeeTypeChildId) {
        const child = (employeeType.children || []).find((item) => sameId(item._id, payload.employeeTypeChildId))
        if (!child) {
            throw new AppError({ statusCode: 404, code: "MANPOWER_PLAN_EMPLOYEE_TYPE_CHILD_NOT_FOUND", messageKey: "errors.report.manpowerPlan.employeeTypeChildNotFound" })
        }
        return {
            employeeTypeChildId: toId(child._id),
            employeeTypeChildCode: child.code || "",
            employeeTypeChildName: child.name || "",
        }
    }

    if (payload.positionId) {
        const match = findEmployeeTypePositionMatch(employeeType, payload.positionId)
        if (match) return match
    }

    return {
        employeeTypeChildId: null,
        employeeTypeChildCode: "",
        employeeTypeChildName: "",
    }
}

async function validateReferences(payload, user) {
    ensureObjectId(payload.companyId, "MANPOWER_PLAN_COMPANY_INVALID_ID", "errors.organization.company.invalidId")
    ensureObjectId(payload.branchId, "MANPOWER_PLAN_BRANCH_INVALID_ID", "errors.organization.branch.invalidId")

    const company = await Company.findOne({ _id: payload.companyId, ...getCompanyScopeFilter(user) }).lean()
    if (!company) throw new AppError({ statusCode: 404, code: "MANPOWER_PLAN_COMPANY_NOT_FOUND", messageKey: "errors.organization.company.notFound" })

    const branch = await Branch.findOne({ _id: payload.branchId, companyId: payload.companyId, ...getBranchScopeFilter(user) }).lean()
    if (!branch) throw new AppError({ statusCode: 404, code: "MANPOWER_PLAN_BRANCH_NOT_FOUND", messageKey: "errors.organization.branch.notFound" })

    const optionalModels = [
        [payload.departmentId, Department, { companyId: payload.companyId, branchId: payload.branchId }, "departmentId"],
        [payload.positionId, Position, { companyId: payload.companyId, branchId: payload.branchId }, "positionId"],
        [payload.lineId, Line, { companyId: payload.companyId, branchId: payload.branchId }, "lineId"],
        [payload.shiftId, Shift, { companyId: payload.companyId, branchId: payload.branchId }, "shiftId"],
        [payload.employeeTypeId, EmployeeType, { companyId: payload.companyId, branchId: payload.branchId }, "employeeTypeId"],
    ]

    for (const [id, Model, extra, field] of optionalModels) {
        if (!id) continue
        ensureObjectId(id, "MANPOWER_PLAN_INVALID_REFERENCE", "errors.report.manpowerPlan.invalidReference")
        const exists = await Model.exists({ _id: id, ...extra, status: { $ne: "ARCHIVED" } })
        if (!exists) {
            throw new AppError({
                statusCode: 404,
                code: "MANPOWER_PLAN_REFERENCE_NOT_FOUND",
                messageKey: "errors.report.manpowerPlan.referenceNotFound",
                fields: { [field]: ["errors.report.manpowerPlan.referenceNotFound"] },
            })
        }
    }
}

export async function validateManpowerPlanWorkspace({ companyId, branchId, user }) {
    ensureObjectId(companyId, "MANPOWER_PLAN_COMPANY_INVALID_ID", "errors.organization.company.invalidId")
    ensureObjectId(branchId, "MANPOWER_PLAN_BRANCH_INVALID_ID", "errors.organization.branch.invalidId")

    const company = await Company.exists({ _id: companyId, ...getCompanyScopeFilter(user) })
    const branch = await Branch.exists({
        _id: branchId,
        companyId,
        ...getBranchScopeFilter(user),
    })

    if (!company || !branch) {
        throw new AppError({
            statusCode: 403,
            code: "MANPOWER_PLAN_WORKSPACE_FORBIDDEN",
            messageKey: "errors.forbidden",
        })
    }
}

function buildListFilter(query, user) {
    const scopeFilter = getPlanScopeFilter(user)
    const searchFilter = buildSearchFilter(query.search)
    const filter = {}

    if (Object.keys(scopeFilter).length && Object.keys(searchFilter).length) {
        filter.$and = [scopeFilter, searchFilter]
    } else {
        Object.assign(filter, scopeFilter, searchFilter)
    }

    for (const key of ["companyId", "branchId", "year", "month", "departmentId", "positionId", "lineId", "shiftId", "employeeTypeId", "employeeTypeChildId"]) {
        if (query[key]) filter[key] = query[key]
    }
    if (query.status !== "ALL") filter.status = query.status

    return filter
}

function buildMutationPayload(payload, accountId) {
    const result = { updatedByAccountId: accountId }
    for (const field of [
        "year",
        "month",
        "departmentId",
        "positionId",
        "lineId",
        "shiftId",
        "employeeTypeId",
        "employeeTypeChildId",
        "employeeTypeChildCode",
        "employeeTypeChildName",
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

export async function listManpowerPlans({ query, user }) {
    const cacheKey = `manpowerPlan:list:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cached = getCache(cacheKey)
    if (cached) return cached

    const filter = buildListFilter(query, user)
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
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    }

    return setCache(cacheKey, result, 30_000)
}

export async function getManpowerPlanById({ manpowerPlanId, user }) {
    ensureObjectId(manpowerPlanId, "MANPOWER_PLAN_INVALID_ID", "errors.report.manpowerPlan.invalidId")
    const plan = await planPopulate(ManpowerPlan.findOne({ _id: manpowerPlanId, ...getPlanScopeFilter(user) })).lean()
    if (!plan) throw new AppError({ statusCode: 404, code: "MANPOWER_PLAN_NOT_FOUND", messageKey: "errors.report.manpowerPlan.notFound" })
    return serializeManpowerPlan(plan)
}

export async function createManpowerPlan({ payload, user }) {
    await validateReferences(payload, user)
    const child = await resolveEmployeeTypeChild(payload)

    try {
        const plan = await ManpowerPlan.create({
            ...payload,
            ...child,
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
    const existing = await ManpowerPlan.findOne({ _id: manpowerPlanId, ...getPlanScopeFilter(user) }).lean()
    if (!existing) throw new AppError({ statusCode: 404, code: "MANPOWER_PLAN_NOT_FOUND", messageKey: "errors.report.manpowerPlan.notFound" })
    if (existing.status === "ARCHIVED") throw new AppError({ statusCode: 409, code: "MANPOWER_PLAN_ARCHIVED", messageKey: "errors.report.manpowerPlan.archived" })

    const merged = { ...existing, ...payload }
    await validateReferences(merged, user)
    const child = await resolveEmployeeTypeChild(merged)

    try {
        const updatePayload = { ...buildMutationPayload(payload, user.accountId), ...child }
        const updated = await ManpowerPlan.findByIdAndUpdate(existing._id, { $set: updatePayload }, { new: true, runValidators: true, context: "query" }).lean()
        clearCacheByPrefix("manpowerPlan:list:")
        return getManpowerPlanById({ manpowerPlanId: updated._id, user })
    } catch (error) {
        handleDuplicate(error)
    }
}

export async function archiveManpowerPlan({ manpowerPlanId, user }) {
    ensureObjectId(manpowerPlanId, "MANPOWER_PLAN_INVALID_ID", "errors.report.manpowerPlan.invalidId")
    const existing = await ManpowerPlan.findOne({ _id: manpowerPlanId, ...getPlanScopeFilter(user) }).lean()
    if (!existing) throw new AppError({ statusCode: 404, code: "MANPOWER_PLAN_NOT_FOUND", messageKey: "errors.report.manpowerPlan.notFound" })
    const archived = await ManpowerPlan.findByIdAndUpdate(existing._id, { $set: { status: "ARCHIVED", updatedByAccountId: user.accountId } }, { new: true, runValidators: true, context: "query" }).lean()
    clearCacheByPrefix("manpowerPlan:list:")
    return getManpowerPlanById({ manpowerPlanId: archived._id, user })
}

export async function getExportManpowerPlans({ query, user }) {
    const filter = buildListFilter({ ...query, page: 1, limit: 100, status: query.status || "ACTIVE" }, user)
    const items = await planPopulate(ManpowerPlan.find(filter))
        .sort({ year: -1, month: -1, createdAt: -1 })
        .limit(10000)
        .lean()
    return items.map(serializeManpowerPlan)
}
