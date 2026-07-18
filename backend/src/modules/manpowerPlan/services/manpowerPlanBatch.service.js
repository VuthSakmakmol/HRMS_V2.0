import { Types } from "mongoose"

import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Employee from "../../employee/models/Employee.js"
import Branch from "../../organization/models/Branch.js"
import Company from "../../organization/models/Company.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"
import Line from "../../line/models/Line.js"
import Shift from "../../shift/models/Shift.js"
import ManpowerPlan from "../models/ManpowerPlan.js"

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
        filters.push({
            companyId: {
                $in: [...new Set(allBranchCompanyIds)],
            },
        })
    }

    if (branchIds.length) {
        filters.push({
            _id: {
                $in: [...new Set(branchIds)],
            },
        })
    }

    return filters.length ? { $or: filters } : { _id: { $in: [] } }
}

async function validateScope({ companyId, branchId, user }) {
    const company = await Company.findOne({
        _id: companyId,
        ...getCompanyScopeFilter(user),
        status: {
            $ne: "ARCHIVED",
        },
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
        status: {
            $ne: "ARCHIVED",
        },
    }).lean()

    if (!branch) {
        throw new AppError({
            statusCode: 404,
            code: "MANPOWER_PLAN_BRANCH_NOT_FOUND",
            messageKey: "errors.organization.branch.notFound",
        })
    }
}

function makeScopeKey(row) {
    return [
        toId(row.departmentId) || "",
        toId(row.positionId) || "",
        toId(row.lineId) || "",
        toId(row.shiftId) || "",
        toId(row.employeeTypeId) || "",
        toId(row.employeeTypeChildId) || "",
    ].join("|")
}

function simple(item, nameField = "name") {
    if (!item) return null

    return {
        id: toId(item),
        code: item.code || "",
        name: item[nameField] || item.name || item.title || "",
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

    const employeeFilter = {
        ...baseFilter,
        recordStatus: "ACTIVE",
        employmentStatus: "WORKING",
    }

    if (query.employeeTypeId) {
        employeeFilter.employeeTypeId = new Types.ObjectId(query.employeeTypeId)
    }

    if (query.employeeTypeChildId) {
        employeeFilter.employeeTypeChildId = new Types.ObjectId(query.employeeTypeChildId)
    }

    const [
        departments,
        positions,
        lines,
        shifts,
        employeeGroups,
        plans,
    ] = await Promise.all([
        Department.find({
            ...baseFilter,
            status: "ACTIVE",
        })
            .sort({
                name: 1,
            })
            .lean(),
        Position.find({
            ...baseFilter,
            status: "ACTIVE",
        })
            .sort({
                title: 1,
            })
            .lean(),
        Line.find({
            ...baseFilter,
            status: "ACTIVE",
        })
            .sort({
                name: 1,
            })
            .lean(),
        Shift.find({
            ...baseFilter,
            status: "ACTIVE",
        })
            .sort({
                name: 1,
            })
            .lean(),
        Employee.aggregate([
            {
                $match: employeeFilter,
            },
            {
                $group: {
                    _id: {
                        departmentId: "$departmentId",
                        positionId: "$positionId",
                        lineId: "$lineId",
                        shiftId: "$shiftId",
                        employeeTypeId: "$employeeTypeId",
                        employeeTypeChildId: "$employeeTypeChildId",
                        employeeTypeChildCode: "$employeeTypeChildCode",
                        employeeTypeChildName: "$employeeTypeChildName",
                    },
                    currentEmployees: {
                        $sum: 1,
                    },
                },
            },
        ]),
        ManpowerPlan.find({
            ...baseFilter,
            year: query.year,
            month: query.month,
            status: {
                $ne: "ARCHIVED",
            },
            ...(query.employeeTypeId
                ? {
                      employeeTypeId: query.employeeTypeId,
                  }
                : {}),
            ...(query.employeeTypeChildId
                ? {
                      employeeTypeChildId: query.employeeTypeChildId,
                  }
                : {}),
        }).lean(),
    ])

    const departmentMap = new Map(
        departments.map((item) => [toId(item), item]),
    )
    const positionMap = new Map(
        positions.map((item) => [toId(item), item]),
    )
    const lineMap = new Map(
        lines.map((item) => [toId(item), item]),
    )
    const shiftMap = new Map(
        shifts.map((item) => [toId(item), item]),
    )
    const planMap = new Map(
        plans.map((item) => [makeScopeKey(item), item]),
    )

    const rows = []
    const coveredPositionIds = new Set()

    for (const group of employeeGroups) {
        const scope = group._id
        const positionId = toId(scope.positionId)
        const position = positionMap.get(positionId)

        if (!position) continue

        coveredPositionIds.add(positionId)

        const plan = planMap.get(makeScopeKey(scope))

        rows.push({
            id: toId(plan),
            rowKey: makeScopeKey(scope),
            departmentId: toId(scope.departmentId),
            positionId,
            lineId: toId(scope.lineId),
            shiftId: toId(scope.shiftId),
            employeeTypeId: toId(scope.employeeTypeId),
            employeeTypeChildId: toId(scope.employeeTypeChildId),
            employeeTypeChildCode: scope.employeeTypeChildCode || "",
            employeeTypeChildName: scope.employeeTypeChildName || "",
            department: simple(departmentMap.get(toId(scope.departmentId))),
            position: simple(position, "title"),
            line: simple(lineMap.get(toId(scope.lineId))),
            shift: simple(shiftMap.get(toId(scope.shiftId))),
            currentEmployees: Number(group.currentEmployees || 0),
            targetBudget: Number(plan?.targetBudget || 0),
            targetRoadmap: Number(plan?.targetRoadmap || 0),
            remark: plan?.remark || "",
            status: plan?.status || "ACTIVE",
            archive: false,
        })
    }

    for (const position of positions) {
        const positionId = toId(position)

        if (coveredPositionIds.has(positionId)) continue

        const scope = {
            departmentId: position.departmentId,
            positionId: position._id,
            lineId: null,
            shiftId: null,
            employeeTypeId: query.employeeTypeId || null,
            employeeTypeChildId: query.employeeTypeChildId || null,
        }
        const plan = planMap.get(makeScopeKey(scope))

        rows.push({
            id: toId(plan),
            rowKey: makeScopeKey(scope),
            departmentId: toId(position.departmentId),
            positionId,
            lineId: null,
            shiftId: null,
            employeeTypeId: query.employeeTypeId || null,
            employeeTypeChildId: query.employeeTypeChildId || null,
            employeeTypeChildCode: "",
            employeeTypeChildName: "",
            department: simple(departmentMap.get(toId(position.departmentId))),
            position: simple(position, "title"),
            line: null,
            shift: null,
            currentEmployees: 0,
            targetBudget: Number(plan?.targetBudget || 0),
            targetRoadmap: Number(plan?.targetRoadmap || 0),
            remark: plan?.remark || "",
            status: plan?.status || "ACTIVE",
            archive: false,
        })
    }

    rows.sort((left, right) => {
        const departmentCompare = (left.department?.name || "").localeCompare(
            right.department?.name || "",
        )

        if (departmentCompare !== 0) return departmentCompare

        const positionCompare = (left.position?.name || "").localeCompare(
            right.position?.name || "",
        )

        if (positionCompare !== 0) return positionCompare

        const lineCompare = (left.line?.name || "").localeCompare(
            right.line?.name || "",
        )

        if (lineCompare !== 0) return lineCompare

        return (left.shift?.name || "").localeCompare(
            right.shift?.name || "",
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
    const operations = []

    for (const row of payload.rows) {
        const scope = {
            companyId: payload.companyId,
            branchId: payload.branchId,
            year: payload.year,
            month: payload.month,
            departmentId: row.departmentId,
            positionId: row.positionId,
            lineId: row.lineId || null,
            shiftId: row.shiftId || null,
            employeeTypeId: row.employeeTypeId || null,
            employeeTypeChildId: row.employeeTypeChildId || null,
        }

        const duplicateKey = makeScopeKey(scope)

        if (seen.has(duplicateKey)) {
            throw new AppError({
                statusCode: 422,
                code: "MANPOWER_PLAN_BATCH_DUPLICATE_ROW",
                messageKey: "errors.report.manpowerPlan.duplicateScope",
            })
        }

        seen.add(duplicateKey)

        const filter = row.id
            ? {
                  _id: row.id,
                  companyId: payload.companyId,
                  branchId: payload.branchId,
              }
            : scope

        if (row.archive) {
            if (!row.id) continue

            operations.push({
                updateOne: {
                    filter,
                    update: {
                        $set: {
                            status: "ARCHIVED",
                            updatedByAccountId: accountId,
                        },
                    },
                },
            })

            continue
        }

        const shouldPersist =
            Boolean(row.id) ||
            Number(row.targetBudget || 0) > 0 ||
            Number(row.targetRoadmap || 0) > 0 ||
            Boolean(String(row.remark || "").trim())

        if (!shouldPersist) continue

        operations.push({
            updateOne: {
                filter,
                update: {
                    $set: {
                        ...scope,
                        employeeTypeChildCode:
                            row.employeeTypeChildCode || "",
                        employeeTypeChildName:
                            row.employeeTypeChildName || "",
                        targetBudget: Number(row.targetBudget || 0),
                        targetRoadmap: Number(row.targetRoadmap || 0),
                        remark: String(row.remark || "").trim(),
                        status: row.status || "ACTIVE",
                        updatedByAccountId: accountId,
                    },
                    $setOnInsert: {
                        createdByAccountId: accountId,
                    },
                },
                upsert: !row.id,
            },
        })
    }

    if (!operations.length) {
        return {
            matched: 0,
            modified: 0,
            upserted: 0,
        }
    }

    try {
        const result = await ManpowerPlan.bulkWrite(operations, {
            ordered: false,
        })

        clearCacheByPrefix("manpowerPlan:list:")

        return {
            matched: Number(result.matchedCount || 0),
            modified: Number(result.modifiedCount || 0),
            upserted: Number(result.upsertedCount || 0),
        }
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
