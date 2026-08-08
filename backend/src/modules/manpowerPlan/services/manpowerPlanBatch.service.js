import { Types } from "mongoose"

import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Employee from "../../employee/models/Employee.js"
import Branch from "../../organization/models/Branch.js"
import Company from "../../organization/models/Company.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"
import ManpowerPlan from "../models/ManpowerPlan.js"
import { buildManpowerPlanScopeFilter } from "./manpowerPlan.service.js"

function toId(value) {
    return value?._id?.toString?.() || value?.id || value?.toString?.() || null
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

async function validateScope({ companyId, branchId, user }) {
    const company = await Company.findOne({
        _id: companyId,
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
        _id: branchId,
        companyId,
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
}

function makeRowKey(row) {
    return [toId(row.departmentId) || "", toId(row.positionId) || ""].join("|")
}

function simple(item, nameField = "name") {
    if (!item) return null
    return {
        id: toId(item),
        code: item.code || "",
        name: item[nameField] || item.name || item.title || "",
        title: item.title || item.name || "",
    }
}

function selectPlanBucket(bucket = []) {
    if (!bucket.length) return null

    const sorted = [...bucket].sort(
        (left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0),
    )
    const preferred = sorted.find((item) => item.status !== "ARCHIVED") || sorted[0]

    return {
        id: toId(preferred),
        targetBudget: Number(preferred.targetBudget || 0),
        targetRoadmap: Number(preferred.targetRoadmap || 0),
        remark: preferred.remark || "",
        status: preferred.status || "ACTIVE",
    }
}

export async function getManpowerPlanningGrid({ query, user }) {
    await validateScope({
        companyId: query.companyId,
        branchId: query.branchId,
        user,
    })

    const baseFilter = {
        companyId: new Types.ObjectId(query.companyId),
        branchId: new Types.ObjectId(query.branchId),
    }

    const [departments, positions, employeeGroups, plans] = await Promise.all([
        Department.find({
            ...baseFilter,
            status: "ACTIVE",
        })
            .sort({ name: 1 })
            .lean(),
        Position.find({
            ...baseFilter,
            status: "ACTIVE",
        })
            .sort({ title: 1 })
            .lean(),
        Employee.aggregate([
            {
                $match: {
                    ...baseFilter,
                    recordStatus: "ACTIVE",
                    employmentStatus: { $in: ["WORKING", "MATERNITY_LEAVE"] },
                },
            },
            {
                $group: {
                    _id: {
                        departmentId: "$departmentId",
                        positionId: "$positionId",
                    },
                    currentEmployees: { $sum: 1 },
                },
            },
        ]),
        ManpowerPlan.find({
            ...baseFilter,
            year: query.year,
            month: query.month,
            status: { $ne: "ARCHIVED" },
        }).lean(),
    ])

    const departmentMap = new Map(
        departments.map((item) => [toId(item), item]),
    )
    const positionMap = new Map(
        positions.map((item) => [toId(item), item]),
    )
    const employeeCountMap = new Map(
        employeeGroups.map((item) => [
            makeRowKey(item._id),
            Number(item.currentEmployees || 0),
        ]),
    )
    const planBuckets = new Map()

    for (const plan of plans) {
        const key = makeRowKey(plan)
        if (!planBuckets.has(key)) planBuckets.set(key, [])
        planBuckets.get(key).push(plan)
    }

    const rows = []

    for (const position of positions) {
        const departmentId = toId(position.departmentId)
        const positionId = toId(position)
        const department = departmentMap.get(departmentId)
        if (!department) continue

        const rowKey = makeRowKey({ departmentId, positionId })
        const plan = selectPlanBucket(planBuckets.get(rowKey))

        rows.push({
            id: plan?.id || null,
            rowKey,
            departmentId,
            positionId,
            department: simple(department),
            position: simple(position, "title"),
            currentEmployees: Number(employeeCountMap.get(rowKey) || 0),
            targetBudget: Number(plan?.targetBudget || 0),
            targetRoadmap: Number(plan?.targetRoadmap || 0),
            remark: plan?.remark || "",
            status: plan?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
            archive: false,
        })
    }

    rows.sort((left, right) => {
        const departmentCompare = (left.department?.name || "").localeCompare(
            right.department?.name || "",
        )
        if (departmentCompare !== 0) return departmentCompare

        return (left.position?.name || "").localeCompare(
            right.position?.name || "",
        )
    })

    return {
        rows,
        summary: {
            currentEmployees: rows.reduce(
                (sum, row) => sum + Number(row.currentEmployees || 0),
                0,
            ),
            targetBudget: rows.reduce(
                (sum, row) => sum + Number(row.targetBudget || 0),
                0,
            ),
            targetRoadmap: rows.reduce(
                (sum, row) => sum + Number(row.targetRoadmap || 0),
                0,
            ),
        },
    }
}

export async function saveManpowerPlanBatch({ payload, user }) {
    await validateScope({
        companyId: payload.companyId,
        branchId: payload.branchId,
        user,
    })

    const accountId = user.accountId
    const seen = new Set()
    const basePeriodFilter = {
        companyId: payload.companyId,
        branchId: payload.branchId,
        year: payload.year,
        month: payload.month,
    }

    const existingPlans = await ManpowerPlan.find(basePeriodFilter).lean()

    const existingByKey = new Map()
    for (const plan of existingPlans) {
        const key = makeRowKey(plan)
        if (!existingByKey.has(key)) existingByKey.set(key, [])
        existingByKey.get(key).push(plan)
    }

    let matched = 0
    let modified = 0
    let upserted = 0

    for (const row of payload.rows) {
        const scope = {
            ...basePeriodFilter,
            departmentId: row.departmentId,
            positionId: row.positionId,
        }
        const duplicateKey = makeRowKey(scope)

        if (seen.has(duplicateKey)) {
            throw new AppError({
                statusCode: 422,
                code: "MANPOWER_PLAN_BATCH_DUPLICATE_ROW",
                messageKey: "errors.report.manpowerPlan.duplicateScope",
            })
        }
        seen.add(duplicateKey)

        const candidates = existingByKey.get(duplicateKey) || []
        const canonical =
            candidates.find((item) => toId(item) === row.id) ||
            candidates.find((item) => item.status !== "ARCHIVED") ||
            candidates[0] ||
            null

        if (row.archive) {
            if (!canonical) continue

            const result = await ManpowerPlan.updateOne(
                { _id: canonical._id },
                {
                    $set: {
                        status: "ARCHIVED",
                        updatedByAccountId: accountId,
                    },
                },
            )
            matched += Number(result.matchedCount || 0)
            modified += Number(result.modifiedCount || 0)
            continue
        }

        const shouldPersist =
            Boolean(canonical) ||
            Number(row.targetBudget || 0) > 0 ||
            Number(row.targetRoadmap || 0) > 0 ||
            Boolean(String(row.remark || "").trim())

        if (!shouldPersist) continue

        if (canonical) {
            const result = await ManpowerPlan.updateOne(
                { _id: canonical._id },
                {
                    $set: {
                        ...scope,
                        targetBudget: Number(row.targetBudget || 0),
                        targetRoadmap: Number(row.targetRoadmap || 0),
                        remark: String(row.remark || "").trim(),
                        status: row.status || "ACTIVE",
                        updatedByAccountId: accountId,
                    },
                },
            )
            matched += Number(result.matchedCount || 0)
            modified += Number(result.modifiedCount || 0)
            continue
        }

        try {
            await ManpowerPlan.create({
                ...scope,
                targetBudget: Number(row.targetBudget || 0),
                targetRoadmap: Number(row.targetRoadmap || 0),
                remark: String(row.remark || "").trim(),
                status: row.status || "ACTIVE",
                createdByAccountId: accountId,
                updatedByAccountId: accountId,
            })
            upserted += 1
        } catch (error) {
            if (error?.code === 11000) {
                throw new AppError({
                    statusCode: 409,
                    code: "MANPOWER_PLAN_DUPLICATE_SCOPE",
                    messageKey: "errors.report.manpowerPlan.duplicateScope",
                })
            }
            throw error
        }
    }

    clearCacheByPrefix("manpowerPlan:list:")

    return { matched, modified, upserted }
}
