import { Types } from "mongoose"

import { clearCacheByPrefix, getCache, setCache } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import EmployeeType from "../../employeeType/models/EmployeeType.js"
import Branch from "../../organization/models/Branch.js"
import Company from "../../organization/models/Company.js"
import WorkforceRatioSetup from "../models/WorkforceRatioSetup.js"

function toId(value) {
    return value?._id?.toString?.() || value?.id || value?.toString?.() || null
}

function normalizeIdList(values = []) {
    return [...new Set((values || []).map(toId).filter(Boolean))]
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

function getScopeFilter(user) {
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
            code: "WORKFORCE_RATIO_SCOPE_FORBIDDEN",
            messageKey: "errors.authorization.insufficientScope",
        })
    }
}

function serializeScope(document) {
    if (!document) return null

    return {
        id: toId(document),
        code: document.code || "",
        name:
            document.name ||
            document.displayName ||
            document.legalName ||
            document.code ||
            "",
    }
}

function serializeEmployeeType(document) {
    if (!document) return null

    return {
        id: toId(document),
        code: document.code || "",
        name: document.name || document.code || "",
        label: document.code
            ? `${document.code} - ${document.name || document.code}`
            : document.name || "Employee Type",
        status: document.status || "ACTIVE",
    }
}

function serializeSetup(document) {
    if (!document) return null

    const directEmployeeTypes = (document.directEmployeeTypeIds || [])
        .map(serializeEmployeeType)
        .filter(Boolean)
    const indirectEmployeeTypes = (document.indirectEmployeeTypeIds || [])
        .map(serializeEmployeeType)
        .filter(Boolean)

    return {
        id: toId(document),
        companyId: toId(document.companyId),
        branchId: toId(document.branchId),
        company: serializeScope(document.companyId),
        branch: serializeScope(document.branchId),
        directEmployeeTypeIds: directEmployeeTypes.map((item) => item.id),
        indirectEmployeeTypeIds: indirectEmployeeTypes.map((item) => item.id),
        directEmployeeTypes,
        indirectEmployeeTypes,
        budgetYear: Number(document.budgetYear) || null,
        budgetRatio:
            document.budgetRatio !== null &&
            document.budgetRatio !== undefined &&
            Number.isFinite(Number(document.budgetRatio))
                ? Number(document.budgetRatio)
                : null,
        status: document.status || "ACTIVE",
        createdAt: document.createdAt || null,
        updatedAt: document.updatedAt || null,
    }
}

function clearWorkforceRatioCaches() {
    clearCacheByPrefix("workforce-ratio:")
    clearCacheByPrefix("excom:")
}

async function validateScope({ companyId, branchId, user }) {
    ensureObjectId(
        companyId,
        "WORKFORCE_RATIO_COMPANY_INVALID_ID",
        "errors.organization.company.invalidId",
    )
    ensureObjectId(
        branchId,
        "WORKFORCE_RATIO_BRANCH_INVALID_ID",
        "errors.organization.branch.invalidId",
    )

    assertScopeAllowed(user, companyId, branchId)

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
            code: "WORKFORCE_RATIO_COMPANY_NOT_FOUND",
            messageKey: "errors.report.workforceRatio.companyNotFound",
            fields: {
                companyId: ["errors.report.workforceRatio.companyNotFound"],
            },
        })
    }

    if (!branch) {
        throw new AppError({
            statusCode: 404,
            code: "WORKFORCE_RATIO_BRANCH_NOT_FOUND",
            messageKey: "errors.report.workforceRatio.branchNotFound",
            fields: {
                branchId: ["errors.report.workforceRatio.branchNotFound"],
            },
        })
    }
}

function assertNoOverlap(directIds = [], indirectIds = []) {
    const directSet = new Set(normalizeIdList(directIds))
    const overlap = normalizeIdList(indirectIds).filter((id) => directSet.has(id))

    if (overlap.length > 0) {
        throw new AppError({
            statusCode: 422,
            code: "WORKFORCE_RATIO_EMPLOYEE_TYPE_OVERLAP",
            messageKey: "errors.report.workforceRatio.employeeTypeOverlap",
            fields: {
                indirectEmployeeTypeIds: [
                    "errors.report.workforceRatio.employeeTypeOverlap",
                ],
            },
            details: { employeeTypeIds: overlap },
        })
    }
}

async function validateEmployeeTypeGroups({
    companyId,
    branchId,
    directEmployeeTypeIds,
    indirectEmployeeTypeIds,
}) {
    const directIds = normalizeIdList(directEmployeeTypeIds)
    const indirectIds = normalizeIdList(indirectEmployeeTypeIds)

    if (directIds.length === 0 || indirectIds.length === 0) {
        throw new AppError({
            statusCode: 422,
            code: "WORKFORCE_RATIO_EMPLOYEE_TYPE_REQUIRED",
            messageKey: "errors.report.workforceRatio.employeeTypeRequired",
            fields: {
                ...(directIds.length === 0
                    ? {
                          directEmployeeTypeIds: [
                              "errors.report.workforceRatio.employeeTypeRequired",
                          ],
                      }
                    : {}),
                ...(indirectIds.length === 0
                    ? {
                          indirectEmployeeTypeIds: [
                              "errors.report.workforceRatio.employeeTypeRequired",
                          ],
                      }
                    : {}),
            },
        })
    }

    assertNoOverlap(directIds, indirectIds)

    const allIds = [...new Set([...directIds, ...indirectIds])]
    const employeeTypes = await EmployeeType.find({
        _id: { $in: allIds },
        companyId,
        branchId,
        status: "ACTIVE",
    })
        .select("_id code name")
        .lean()

    const foundIds = new Set(employeeTypes.map((item) => toId(item)))
    const invalidIds = allIds.filter((id) => !foundIds.has(id))

    if (invalidIds.length > 0) {
        throw new AppError({
            statusCode: 422,
            code: "WORKFORCE_RATIO_EMPLOYEE_TYPE_INVALID_SCOPE",
            messageKey: "errors.report.workforceRatio.employeeTypeInvalidScope",
            fields: {
                directEmployeeTypeIds: [
                    "errors.report.workforceRatio.employeeTypeInvalidScope",
                ],
                indirectEmployeeTypeIds: [
                    "errors.report.workforceRatio.employeeTypeInvalidScope",
                ],
            },
            details: { employeeTypeIds: invalidIds },
        })
    }

    return {
        directEmployeeTypeIds: directIds,
        indirectEmployeeTypeIds: indirectIds,
    }
}

async function findSetupById({ workforceRatioId, user }) {
    ensureObjectId(
        workforceRatioId,
        "WORKFORCE_RATIO_INVALID_ID",
        "errors.report.workforceRatio.invalidId",
    )

    return WorkforceRatioSetup.findOne({
        _id: workforceRatioId,
        ...getScopeFilter(user),
    })
}

async function loadPopulatedSetup(setupId, user) {
    const setup = await WorkforceRatioSetup.findOne({
        _id: setupId,
        ...getScopeFilter(user),
    })
        .populate({
            path: "companyId",
            select: "code displayName legalName",
        })
        .populate({
            path: "branchId",
            select: "code name",
        })
        .populate({
            path: "directEmployeeTypeIds",
            select: "code name status",
        })
        .populate({
            path: "indirectEmployeeTypeIds",
            select: "code name status",
        })
        .lean()

    return serializeSetup(setup)
}

export async function getCurrentWorkforceRatioSetup({ query, user }) {
    await validateScope({
        companyId: query.companyId,
        branchId: query.branchId,
        user,
    })

    const cacheKey = `workforce-ratio:current:${user?.accountId || "anonymous"}:${query.companyId}:${query.branchId}`
    const cached = getCache(cacheKey)
    if (cached) return cached

    const setup = await WorkforceRatioSetup.findOne({
        companyId: query.companyId,
        branchId: query.branchId,
        status: { $ne: "ARCHIVED" },
        ...getScopeFilter(user),
    })
        .populate({
            path: "companyId",
            select: "code displayName legalName",
        })
        .populate({
            path: "branchId",
            select: "code name",
        })
        .populate({
            path: "directEmployeeTypeIds",
            select: "code name status",
        })
        .populate({
            path: "indirectEmployeeTypeIds",
            select: "code name status",
        })
        .lean()

    return setCache(
        cacheKey,
        { setup: serializeSetup(setup) },
        30_000,
    )
}

export async function lookupWorkforceRatioEmployeeTypes({ query, user }) {
    await validateScope({
        companyId: query.companyId,
        branchId: query.branchId,
        user,
    })

    const cacheKey = `workforce-ratio:employee-types:${query.companyId}:${query.branchId}`
    const cached = getCache(cacheKey)
    if (cached) return cached

    const employeeTypes = await EmployeeType.find({
        companyId: query.companyId,
        branchId: query.branchId,
        status: "ACTIVE",
    })
        .select("_id code name status")
        .sort({ code: 1, name: 1 })
        .lean()

    return setCache(
        cacheKey,
        {
            items: employeeTypes.map(serializeEmployeeType),
        },
        60_000,
    )
}

export async function createWorkforceRatioSetup({ payload, user }) {
    await validateScope({
        companyId: payload.companyId,
        branchId: payload.branchId,
        user,
    })

    const groups = await validateEmployeeTypeGroups({
        companyId: payload.companyId,
        branchId: payload.branchId,
        directEmployeeTypeIds: payload.directEmployeeTypeIds,
        indirectEmployeeTypeIds: payload.indirectEmployeeTypeIds,
    })

    const existing = await WorkforceRatioSetup.findOne({
        companyId: payload.companyId,
        branchId: payload.branchId,
    })

    let setup

    if (existing && existing.status !== "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "WORKFORCE_RATIO_ALREADY_EXISTS",
            messageKey: "errors.report.workforceRatio.alreadyExists",
        })
    }

    if (existing) {
        existing.directEmployeeTypeIds = groups.directEmployeeTypeIds
        existing.indirectEmployeeTypeIds = groups.indirectEmployeeTypeIds
        existing.budgetYear = payload.budgetYear
        existing.budgetRatio = payload.budgetRatio
        existing.status = payload.status || "ACTIVE"
        existing.updatedByAccountId = user.accountId
        setup = await existing.save()
    } else {
        setup = await WorkforceRatioSetup.create({
            companyId: payload.companyId,
            branchId: payload.branchId,
            ...groups,
            budgetYear: payload.budgetYear,
            budgetRatio: payload.budgetRatio,
            status: payload.status || "ACTIVE",
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })
    }

    clearWorkforceRatioCaches()

    return loadPopulatedSetup(setup._id, user)
}

export async function updateWorkforceRatioSetup({
    workforceRatioId,
    payload,
    user,
}) {
    const setup = await findSetupById({ workforceRatioId, user })

    if (!setup) {
        throw new AppError({
            statusCode: 404,
            code: "WORKFORCE_RATIO_NOT_FOUND",
            messageKey: "errors.report.workforceRatio.notFound",
        })
    }

    if (setup.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "WORKFORCE_RATIO_ARCHIVED",
            messageKey: "errors.report.workforceRatio.archived",
        })
    }

    assertScopeAllowed(user, setup.companyId, setup.branchId)

    const nextDirectIds = Object.prototype.hasOwnProperty.call(
        payload,
        "directEmployeeTypeIds",
    )
        ? payload.directEmployeeTypeIds
        : setup.directEmployeeTypeIds

    const nextIndirectIds = Object.prototype.hasOwnProperty.call(
        payload,
        "indirectEmployeeTypeIds",
    )
        ? payload.indirectEmployeeTypeIds
        : setup.indirectEmployeeTypeIds

    const groups = await validateEmployeeTypeGroups({
        companyId: setup.companyId,
        branchId: setup.branchId,
        directEmployeeTypeIds: nextDirectIds,
        indirectEmployeeTypeIds: nextIndirectIds,
    })

    setup.directEmployeeTypeIds = groups.directEmployeeTypeIds
    setup.indirectEmployeeTypeIds = groups.indirectEmployeeTypeIds

    if (Object.prototype.hasOwnProperty.call(payload, "budgetYear")) {
        setup.budgetYear = payload.budgetYear
    }

    if (Object.prototype.hasOwnProperty.call(payload, "budgetRatio")) {
        setup.budgetRatio = payload.budgetRatio
    }

    if (payload.status) {
        setup.status = payload.status
    }

    setup.updatedByAccountId = user.accountId
    await setup.save()

    clearWorkforceRatioCaches()

    return loadPopulatedSetup(setup._id, user)
}

export async function archiveWorkforceRatioSetup({ workforceRatioId, user }) {
    const setup = await findSetupById({ workforceRatioId, user })

    if (!setup) {
        throw new AppError({
            statusCode: 404,
            code: "WORKFORCE_RATIO_NOT_FOUND",
            messageKey: "errors.report.workforceRatio.notFound",
        })
    }

    if (setup.status === "ARCHIVED") {
        return loadPopulatedSetup(setup._id, user)
    }

    setup.status = "ARCHIVED"
    setup.updatedByAccountId = user.accountId
    await setup.save()

    clearWorkforceRatioCaches()

    return loadPopulatedSetup(setup._id, user)
}
