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
import EmployeeType from "../../employeeType/models/EmployeeType.js"
import HrDashboardTarget from "../models/HrDashboardTarget.js"

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function ensureObjectId(id, code, messageKey) {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError({
            statusCode: 400,
            code,
            messageKey,
        })
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
    return [
        ...new Set(
            (user?.roleAssignments || [])
                .map((item) => item.companyId)
                .filter(Boolean),
        ),
    ]
}

function getCompanyScopeFilter(user) {
    if (user?.isRootAdmin) return {}

    const companyIds = getUserCompanyIds(user)

    return companyIds.length
        ? { _id: { $in: companyIds } }
        : { _id: { $in: [] } }
}

function getBranchScopeFilter(user) {
    if (user?.isRootAdmin) return {}

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

function getTargetScopeFilter(user) {
    if (user?.isRootAdmin) return {}

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

function buildSearchFilter(search) {
    const keyword = String(search || "").trim()

    if (!keyword) return {}

    const regex = new RegExp(escapeRegExp(keyword), "i")

    return {
        $or: [
            { employeeTypeChildCode: regex },
            { employeeTypeChildName: regex },
            { remark: regex },
            { metric: regex },
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

function targetPopulate(query) {
    return query
        .populate({ path: "companyId", select: "code displayName legalName status" })
        .populate({ path: "branchId", select: "companyId code name shortName status" })
        .populate({ path: "departmentId", select: "companyId branchId code name shortName status" })
        .populate({ path: "positionId", select: "companyId branchId departmentId code title shortName level isManager status" })
        .populate({ path: "lineId", select: "companyId branchId departmentId code name shortName status" })
        .populate({ path: "employeeTypeId", select: "code name shortName status" })
}

function findEmployeeTypePositionMatch(employeeType, positionId) {
    if (!employeeType || !positionId) return null

    if ((employeeType.positionIds || []).some((id) => sameId(id, positionId))) {
        return {
            employeeTypeChildId: null,
            employeeTypeChildCode: "",
            employeeTypeChildName: "",
        }
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

    const employeeType = await EmployeeType.findOne({
        _id: payload.employeeTypeId,
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!employeeType) {
        throw new AppError({
            statusCode: 404,
            code: "HR_DASHBOARD_TARGET_EMPLOYEE_TYPE_NOT_FOUND",
            messageKey: "errors.report.hrDashboardTarget.employeeTypeNotFound",
        })
    }

    if (payload.employeeTypeChildId) {
        const child = (employeeType.children || []).find((item) =>
            sameId(item._id, payload.employeeTypeChildId),
        )

        if (!child) {
            throw new AppError({
                statusCode: 404,
                code: "HR_DASHBOARD_TARGET_EMPLOYEE_TYPE_CHILD_NOT_FOUND",
                messageKey: "errors.report.hrDashboardTarget.employeeTypeChildNotFound",
            })
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
    ensureObjectId(
        payload.companyId,
        "HR_DASHBOARD_TARGET_COMPANY_INVALID_ID",
        "errors.organization.company.invalidId",
    )
    ensureObjectId(
        payload.branchId,
        "HR_DASHBOARD_TARGET_BRANCH_INVALID_ID",
        "errors.organization.branch.invalidId",
    )

    const company = await Company.findOne({
        _id: payload.companyId,
        ...getCompanyScopeFilter(user),
    }).lean()

    if (!company) {
        throw new AppError({
            statusCode: 404,
            code: "HR_DASHBOARD_TARGET_COMPANY_NOT_FOUND",
            messageKey: "errors.organization.company.notFound",
        })
    }

    const branch = await Branch.findOne({
        _id: payload.branchId,
        companyId: payload.companyId,
        ...getBranchScopeFilter(user),
    }).lean()

    if (!branch) {
        throw new AppError({
            statusCode: 404,
            code: "HR_DASHBOARD_TARGET_BRANCH_NOT_FOUND",
            messageKey: "errors.organization.branch.notFound",
        })
    }

    const optionalModels = [
        [payload.departmentId, Department, { companyId: payload.companyId, branchId: payload.branchId }, "departmentId"],
        [payload.positionId, Position, { companyId: payload.companyId, branchId: payload.branchId }, "positionId"],
        [payload.lineId, Line, { companyId: payload.companyId, branchId: payload.branchId }, "lineId"],
        [payload.employeeTypeId, EmployeeType, { companyId: payload.companyId }, "employeeTypeId"],
    ]

    for (const [id, Model, extra, field] of optionalModels) {
        if (!id) continue

        ensureObjectId(
            id,
            "HR_DASHBOARD_TARGET_INVALID_REFERENCE",
            "errors.report.hrDashboardTarget.invalidReference",
        )

        const exists = await Model.exists({
            _id: id,
            ...extra,
            status: { $ne: "ARCHIVED" },
        })

        if (!exists) {
            throw new AppError({
                statusCode: 404,
                code: "HR_DASHBOARD_TARGET_REFERENCE_NOT_FOUND",
                messageKey: "errors.report.hrDashboardTarget.referenceNotFound",
                fields: {
                    [field]: ["errors.report.hrDashboardTarget.referenceNotFound"],
                },
            })
        }
    }
}

function buildListFilter(query, user) {
    const filter = {
        ...getTargetScopeFilter(user),
        ...buildSearchFilter(query.search),
    }

    for (const key of [
        "companyId",
        "branchId",
        "metric",
        "year",
        "month",
        "departmentId",
        "positionId",
        "lineId",
        "employeeTypeId",
        "employeeTypeChildId",
    ]) {
        if (query[key] !== undefined && query[key] !== null && query[key] !== "") {
            filter[key] = query[key]
        }
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    return filter
}

function buildMutationPayload(payload, accountId) {
    const result = {
        updatedByAccountId: accountId,
    }

    for (const field of [
        "companyId",
        "branchId",
        "metric",
        "year",
        "month",
        "departmentId",
        "positionId",
        "lineId",
        "employeeTypeId",
        "employeeTypeChildId",
        "employeeTypeChildCode",
        "employeeTypeChildName",
        "targetRate",
        "remark",
        "status",
    ]) {
        if (payload[field] !== undefined) {
            result[field] = payload[field]
        }
    }

    return result
}

function handleDuplicate(error) {
    if (error?.code !== 11000) throw error

    throw new AppError({
        statusCode: 409,
        code: "HR_DASHBOARD_TARGET_DUPLICATE_SCOPE",
        messageKey: "errors.report.hrDashboardTarget.duplicateScope",
    })
}

export function serializeHrDashboardTarget(target) {
    if (!target) return null

    const raw = typeof target.toJSON === "function" ? target.toJSON() : { ...target }

    return {
        id: toId(raw._id || raw.id),
        companyId: toId(raw.companyId),
        branchId: toId(raw.branchId),
        metric: raw.metric,
        year: raw.year,
        month: Number(raw.month || 0),
        departmentId: toId(raw.departmentId),
        positionId: toId(raw.positionId),
        lineId: toId(raw.lineId),
        employeeTypeId: toId(raw.employeeTypeId),
        employeeTypeChildId: toId(raw.employeeTypeChildId),
        employeeTypeChildCode: raw.employeeTypeChildCode || "",
        employeeTypeChildName: raw.employeeTypeChildName || "",
        targetRate: Number(raw.targetRate || 0),
        remark: raw.remark || "",
        status: raw.status,
        company: simpleOrg(raw.companyId),
        branch: simpleOrg(raw.branchId),
        department: simpleOrg(raw.departmentId),
        position: simpleOrg(raw.positionId),
        line: simpleOrg(raw.lineId),
        employeeType: simpleOrg(raw.employeeTypeId),
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

export async function listHrDashboardTargets({ query, user }) {
    const cacheKey = `hrDashboardTarget:list:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cached = getCache(cacheKey)

    if (cached) return cached

    const filter = buildListFilter(query, user)
    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
        targetPopulate(HrDashboardTarget.find(filter))
            .sort({ year: -1, month: 1, metric: 1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        HrDashboardTarget.countDocuments(filter),
    ])

    const result = {
        items: items.map(serializeHrDashboardTarget),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        },
    }

    return setCache(cacheKey, result, 30_000)
}

export async function listHrDashboardTargetsForExport({ query, user }) {
    const filter = buildListFilter(query, user)
    const items = await targetPopulate(HrDashboardTarget.find(filter))
        .sort({ year: -1, month: 1, metric: 1, createdAt: -1 })
        .limit(50_000)
        .lean()

    return items.map(serializeHrDashboardTarget)
}

export async function getHrDashboardTargetById({ targetId, user }) {
    ensureObjectId(
        targetId,
        "HR_DASHBOARD_TARGET_INVALID_ID",
        "errors.report.hrDashboardTarget.invalidId",
    )

    const target = await targetPopulate(
        HrDashboardTarget.findOne({
            _id: targetId,
            ...getTargetScopeFilter(user),
        }),
    ).lean()

    if (!target) {
        throw new AppError({
            statusCode: 404,
            code: "HR_DASHBOARD_TARGET_NOT_FOUND",
            messageKey: "errors.report.hrDashboardTarget.notFound",
        })
    }

    return serializeHrDashboardTarget(target)
}

export async function createHrDashboardTarget({ payload, user }) {
    await validateReferences(payload, user)

    const child = await resolveEmployeeTypeChild(payload)

    try {
        const target = await HrDashboardTarget.create({
            ...payload,
            ...child,
            status: payload.status || "ACTIVE",
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        clearCacheByPrefix("hrDashboardTarget:list:")
        clearCacheByPrefix("hr-dashboard:data:")

        return getHrDashboardTargetById({ targetId: target._id, user })
    } catch (error) {
        handleDuplicate(error)
    }
}

export async function updateHrDashboardTarget({ targetId, payload, user }) {
    ensureObjectId(
        targetId,
        "HR_DASHBOARD_TARGET_INVALID_ID",
        "errors.report.hrDashboardTarget.invalidId",
    )

    const existing = await HrDashboardTarget.findOne({
        _id: targetId,
        ...getTargetScopeFilter(user),
    }).lean()

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "HR_DASHBOARD_TARGET_NOT_FOUND",
            messageKey: "errors.report.hrDashboardTarget.notFound",
        })
    }

    if (existing.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "HR_DASHBOARD_TARGET_ARCHIVED",
            messageKey: "errors.report.hrDashboardTarget.archived",
        })
    }

    const merged = {
        ...existing,
        ...payload,
    }

    await validateReferences(merged, user)

    const child = await resolveEmployeeTypeChild(merged)

    try {
        const updatePayload = {
            ...buildMutationPayload(payload, user.accountId),
            ...child,
        }

        const updated = await HrDashboardTarget.findByIdAndUpdate(
            existing._id,
            { $set: updatePayload },
            {
                new: true,
                runValidators: true,
                context: "query",
            },
        ).lean()

        clearCacheByPrefix("hrDashboardTarget:list:")
        clearCacheByPrefix("hr-dashboard:data:")

        return getHrDashboardTargetById({ targetId: updated._id, user })
    } catch (error) {
        handleDuplicate(error)
    }
}

export async function archiveHrDashboardTarget({ targetId, user }) {
    ensureObjectId(
        targetId,
        "HR_DASHBOARD_TARGET_INVALID_ID",
        "errors.report.hrDashboardTarget.invalidId",
    )

    const existing = await HrDashboardTarget.findOne({
        _id: targetId,
        ...getTargetScopeFilter(user),
    }).lean()

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "HR_DASHBOARD_TARGET_NOT_FOUND",
            messageKey: "errors.report.hrDashboardTarget.notFound",
        })
    }

    const archived = await HrDashboardTarget.findByIdAndUpdate(
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

    clearCacheByPrefix("hrDashboardTarget:list:")
    clearCacheByPrefix("hr-dashboard:data:")

    return getHrDashboardTargetById({ targetId: archived._id, user })
}

function lookupItem(item) {
    return {
        id: toId(item._id),
        code: item.code || "",
        name: item.name || item.title || "",
        title: item.title || item.name || "",
        companyId: toId(item.companyId),
        branchId: toId(item.branchId),
        departmentId: toId(item.departmentId),
        children: (item.children || [])
            .filter((child) => child.status !== "ARCHIVED")
            .map((child) => ({
                id: toId(child._id),
                code: child.code || "",
                name: child.name || "",
            })),
    }
}

export async function getHrDashboardTargetLookups({ query, user }) {
    await validateReferences(
        {
            companyId: query.companyId,
            branchId: query.branchId,
            departmentId: null,
            positionId: null,
            lineId: null,
            employeeTypeId: null,
        },
        user,
    )

    const baseFilter = {
        companyId: query.companyId,
        branchId: query.branchId,
        status: "ACTIVE",
    }
    const [departments, employeeTypes, positions, lines] = await Promise.all([
        Department.find(baseFilter)
            .select("code name companyId branchId")
            .sort({ code: 1, name: 1 })
            .lean(),
        EmployeeType.find({
            companyId: query.companyId,
            status: "ACTIVE",
        })
            .select("code name companyId children")
            .sort({ code: 1, name: 1 })
            .lean(),
        query.departmentId
            ? Position.find({ ...baseFilter, departmentId: query.departmentId })
                .select("code title companyId branchId departmentId")
                .sort({ code: 1, title: 1 })
                .lean()
            : [],
        query.departmentId
            ? Line.find({ ...baseFilter, departmentId: query.departmentId })
                .select("code name companyId branchId departmentId")
                .sort({ code: 1, name: 1 })
                .lean()
            : [],
    ])

    return {
        departments: departments.map(lookupItem),
        employeeTypes: employeeTypes.map(lookupItem),
        positions: positions.map(lookupItem),
        lines: lines.map(lookupItem),
    }
}
