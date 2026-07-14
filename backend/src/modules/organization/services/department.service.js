import { Types } from "mongoose"

import {
    clearCacheByPrefix,
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"
import Branch from "../models/Branch.js"
import Company from "../models/Company.js"
import Department from "../models/Department.js"

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function ensureValidObjectId(id, errorCode, messageKey) {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError({
            statusCode: 400,
            code: errorCode,
            messageKey,
        })
    }
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

function hasGlobalScope(user) {
    return (user?.roleAssignments || []).some(
        (assignment) => assignment.roleScope === "GLOBAL",
    )
}


function getCompanyScopeFilter(user) {
    if (user?.isRootAdmin || hasGlobalScope(user)) {
        return {}
    }

    const companyIds = getUserCompanyIds(user)

    if (companyIds.length === 0) {
        return {
            _id: { $in: [] },
        }
    }

    return {
        _id: { $in: companyIds },
    }
}

function getBranchScopeFilter(user) {
    if (user?.isRootAdmin || hasGlobalScope(user)) {
        return {}
    }

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

    if (allBranchCompanyIds.length > 0) {
        filters.push({
            companyId: { $in: [...new Set(allBranchCompanyIds)] },
        })
    }

    if (branchIds.length > 0) {
        filters.push({
            _id: { $in: [...new Set(branchIds)] },
        })
    }

    if (filters.length === 0) {
        return {
            _id: { $in: [] },
        }
    }

    return {
        $or: filters,
    }
}

function getDepartmentScopeFilter(user) {
    if (user?.isRootAdmin || hasGlobalScope(user)) {
        return {}
    }

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

    if (allBranchCompanyIds.length > 0) {
        filters.push({
            companyId: { $in: [...new Set(allBranchCompanyIds)] },
        })
    }

    if (branchIds.length > 0) {
        filters.push({
            branchId: { $in: [...new Set(branchIds)] },
        })
    }

    if (filters.length === 0) {
        return {
            _id: { $in: [] },
        }
    }

    return {
        $or: filters,
    }
}

function buildDepartmentSearchFilter(search) {
    const normalizedSearch = String(search || "").trim()

    if (!normalizedSearch) {
        return {}
    }

    const searchRegex = new RegExp(escapeRegExp(normalizedSearch), "i")

    return {
        $or: [
            { code: searchRegex },
            { name: searchRegex },
            { shortName: searchRegex },
            { description: searchRegex },
        ],
    }
}

function serializeCompany(company) {
    if (!company || typeof company !== "object") {
        return null
    }

    return {
        id: company._id?.toString?.() || company.id,
        code: company.code,
        displayName: company.displayName,
        legalName: company.legalName,
        status: company.status,
    }
}

function serializeBranch(branch) {
    if (!branch || typeof branch !== "object") {
        return null
    }

    return {
        id: branch._id?.toString?.() || branch.id,
        companyId: branch.companyId?.toString?.() || branch.companyId,
        code: branch.code,
        name: branch.name,
        shortName: branch.shortName,
        status: branch.status,
        isHeadOffice: Boolean(branch.isHeadOffice),
    }
}

function serializeParentDepartment(department) {
    if (!department || typeof department !== "object") {
        return null
    }

    return {
        id: department._id?.toString?.() || department.id,
        code: department.code,
        name: department.name,
        shortName: department.shortName,
        status: department.status,
    }
}

function serializeDepartment(department) {
    if (!department) {
        return null
    }

    const raw =
        typeof department.toJSON === "function"
            ? department.toJSON()
            : {
                  ...department,
              }

    const populatedCompany =
        raw.companyId && typeof raw.companyId === "object"
            ? serializeCompany(raw.companyId)
            : null

    const populatedBranch =
        raw.branchId && typeof raw.branchId === "object"
            ? serializeBranch(raw.branchId)
            : null

    const populatedParentDepartment =
        raw.parentDepartmentId && typeof raw.parentDepartmentId === "object"
            ? serializeParentDepartment(raw.parentDepartmentId)
            : null

    return {
        id: raw._id?.toString?.() || raw.id,
        companyId:
            populatedCompany?.id ||
            raw.companyId?.toString?.() ||
            raw.companyId,
        branchId:
            populatedBranch?.id ||
            raw.branchId?.toString?.() ||
            raw.branchId,
        parentDepartmentId:
            populatedParentDepartment?.id ||
            raw.parentDepartmentId?.toString?.() ||
            raw.parentDepartmentId ||
            null,
        company: populatedCompany,
        branch: populatedBranch,
        parentDepartment: populatedParentDepartment,
        code: raw.code,
        name: raw.name,
        shortName: raw.shortName || "",
        description: raw.description || "",
        status: raw.status,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

function buildDepartmentUpdatePayload(payload, accountId) {
    const updatePayload = {
        updatedByAccountId: accountId,
    }

    for (const field of [
        "parentDepartmentId",
        "code",
        "name",
        "shortName",
        "description",
        "status",
    ]) {
        if (payload[field] !== undefined) {
            updatePayload[field] = payload[field]
        }
    }

    return updatePayload
}

function handleDuplicateDepartmentError(error) {
    if (error?.code !== 11000) {
        throw error
    }

    if (error?.keyPattern?.code || error?.keyValue?.code) {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_DEPARTMENT_CODE_EXISTS",
            messageKey: "errors.organization.department.codeExists",
            fields: {
                code: ["errors.organization.department.codeExists"],
            },
        })
    }

    throw new AppError({
        statusCode: 409,
        code: "ORGANIZATION_DEPARTMENT_DUPLICATE",
        messageKey: "errors.organization.department.duplicate",
    })
}

async function ensureCompanyExists({ companyId, user }) {
    ensureValidObjectId(
        companyId,
        "ORGANIZATION_COMPANY_INVALID_ID",
        "errors.organization.company.invalidId",
    )

    const company = await Company.findOne({
        _id: companyId,
        ...getCompanyScopeFilter(user),
    }).lean()

    if (!company) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_COMPANY_NOT_FOUND",
            messageKey: "errors.organization.company.notFound",
        })
    }

    if (company.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_COMPANY_ARCHIVED",
            messageKey: "errors.organization.company.archived",
        })
    }

    return company
}

async function ensureBranchExists({ companyId, branchId, user }) {
    ensureValidObjectId(
        branchId,
        "ORGANIZATION_BRANCH_INVALID_ID",
        "errors.organization.branch.invalidId",
    )

    const branch = await Branch.findOne({
        _id: branchId,
        companyId,
        ...getBranchScopeFilter(user),
    }).lean()

    if (!branch) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_BRANCH_NOT_FOUND",
            messageKey: "errors.organization.branch.notFound",
        })
    }

    if (branch.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_BRANCH_ARCHIVED",
            messageKey: "errors.organization.branch.archived",
        })
    }

    return branch
}

async function ensureParentDepartmentExists({
    parentDepartmentId,
    companyId,
    branchId,
    departmentId,
    user,
}) {
    if (!parentDepartmentId) {
        return null
    }

    ensureValidObjectId(
        parentDepartmentId,
        "ORGANIZATION_DEPARTMENT_INVALID_ID",
        "errors.organization.department.invalidId",
    )

    if (
        departmentId &&
        parentDepartmentId.toString() === departmentId.toString()
    ) {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_DEPARTMENT_PARENT_SELF",
            messageKey: "errors.organization.department.parentSelf",
            fields: {
                parentDepartmentId: [
                    "errors.organization.department.parentSelf",
                ],
            },
        })
    }

    const parentDepartment = await Department.findOne({
        _id: parentDepartmentId,
        companyId,
        branchId,
        status: { $ne: "ARCHIVED" },
        ...getDepartmentScopeFilter(user),
    }).lean()

    if (!parentDepartment) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_DEPARTMENT_PARENT_NOT_FOUND",
            messageKey: "errors.organization.department.parentNotFound",
            fields: {
                parentDepartmentId: [
                    "errors.organization.department.parentNotFound",
                ],
            },
        })
    }

    return parentDepartment
}

export async function listDepartments({ query, user }) {
    const cacheKey = `department:list:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cachedResult = getCache(cacheKey)

    if (cachedResult) {
        return cachedResult
    }

    const filter = {
        ...getDepartmentScopeFilter(user),
        ...buildDepartmentSearchFilter(query.search),
    }

    if (query.companyId) {
        await ensureCompanyExists({
            companyId: query.companyId,
            user,
        })

        filter.companyId = query.companyId
    }

    if (query.branchId) {
        if (!query.companyId) {
            const branch = await Branch.findOne({
                _id: query.branchId,
                ...getBranchScopeFilter(user),
            }).lean()

            if (!branch) {
                throw new AppError({
                    statusCode: 404,
                    code: "ORGANIZATION_BRANCH_NOT_FOUND",
                    messageKey: "errors.organization.branch.notFound",
                })
            }

            filter.branchId = query.branchId
        } else {
            await ensureBranchExists({
                companyId: query.companyId,
                branchId: query.branchId,
                user,
            })

            filter.branchId = query.branchId
        }
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
        Department.find(filter)
            .populate({
                path: "companyId",
                select: "code displayName legalName status",
            })
            .populate({
                path: "branchId",
                select: "companyId code name shortName status isHeadOffice",
            })
            .populate({
                path: "parentDepartmentId",
                select: "code name shortName status",
            })
            .sort({ [query.sortBy]: query.sortOrder === "desc" ? -1 : 1, _id: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Department.countDocuments(filter),
    ])

    const result = {
        items: items.map(serializeDepartment),
        pagination: {
            page,
            limit,
            total,
            totalPages: total === 0 ? 0 : Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrevious: page > 1,
        },
    }

    return setCache(cacheKey, result, 30_000)
}

export async function lookupDepartments({ query, user }) {
    const result = await listDepartments({
        query: {
            ...query,
            page: 1,
            limit: Math.min(query.limit || 100, 100),
            status: "ACTIVE",
        },
        user,
    })

    return result.items.map((department) => ({
        id: department.id,
        companyId: department.companyId,
        branchId: department.branchId,
        parentDepartmentId: department.parentDepartmentId || null,
        code: department.code,
        name: department.name,
        shortName: department.shortName || "",
        status: department.status,
    }))
}

export async function getDepartmentById({ departmentId, user }) {
    ensureValidObjectId(
        departmentId,
        "ORGANIZATION_DEPARTMENT_INVALID_ID",
        "errors.organization.department.invalidId",
    )

    const department = await Department.findOne({
        _id: departmentId,
        ...getDepartmentScopeFilter(user),
    })
        .populate({
            path: "companyId",
            select: "code displayName legalName status",
        })
        .populate({
            path: "branchId",
            select: "companyId code name shortName status isHeadOffice",
        })
        .populate({
            path: "parentDepartmentId",
            select: "code name shortName status",
        })

    if (!department) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_DEPARTMENT_NOT_FOUND",
            messageKey: "errors.organization.department.notFound",
        })
    }

    return serializeDepartment(department)
}

export async function createDepartment({ payload, user }) {
    await ensureCompanyExists({
        companyId: payload.companyId,
        user,
    })

    await ensureBranchExists({
        companyId: payload.companyId,
        branchId: payload.branchId,
        user,
    })

    await ensureParentDepartmentExists({
        parentDepartmentId: payload.parentDepartmentId,
        companyId: payload.companyId,
        branchId: payload.branchId,
        user,
    })

    try {
        const department = await Department.create({
            ...payload,
            parentDepartmentId: payload.parentDepartmentId || null,
            status: payload.status || "ACTIVE",
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        clearCacheByPrefix("department:list:")

        return await getDepartmentById({
            departmentId: department._id.toString(),
            user,
        })
    } catch (error) {
        handleDuplicateDepartmentError(error)
    }
}

export async function updateDepartment({ departmentId, payload, user }) {
    ensureValidObjectId(
        departmentId,
        "ORGANIZATION_DEPARTMENT_INVALID_ID",
        "errors.organization.department.invalidId",
    )

    const currentDepartment = await Department.findOne({
        _id: departmentId,
        status: { $ne: "ARCHIVED" },
        ...getDepartmentScopeFilter(user),
    }).lean()

    if (!currentDepartment) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_DEPARTMENT_NOT_FOUND",
            messageKey: "errors.organization.department.notFound",
        })
    }

    if (payload.parentDepartmentId !== undefined) {
        await ensureParentDepartmentExists({
            parentDepartmentId: payload.parentDepartmentId,
            companyId: currentDepartment.companyId,
            branchId: currentDepartment.branchId,
            departmentId,
            user,
        })
    }

    try {
        const department = await Department.findOneAndUpdate(
            {
                _id: departmentId,
                status: { $ne: "ARCHIVED" },
                ...getDepartmentScopeFilter(user),
            },
            {
                $set: buildDepartmentUpdatePayload(
                    payload,
                    user.accountId,
                ),
            },
            {
                returnDocument: "after",
                runValidators: true,
                context: "query",
            },
        )
            .populate({
                path: "companyId",
                select: "code displayName legalName status",
            })
            .populate({
                path: "branchId",
                select: "companyId code name shortName status isHeadOffice",
            })
            .populate({
                path: "parentDepartmentId",
                select: "code name shortName status",
            })

        if (!department) {
            throw new AppError({
                statusCode: 404,
                code: "ORGANIZATION_DEPARTMENT_NOT_FOUND",
                messageKey: "errors.organization.department.notFound",
            })
        }

        clearCacheByPrefix("department:list:")

        return serializeDepartment(department)
    } catch (error) {
        if (error instanceof AppError) {
            throw error
        }

        handleDuplicateDepartmentError(error)
    }
}

export async function archiveDepartment({ departmentId, user }) {
    ensureValidObjectId(
        departmentId,
        "ORGANIZATION_DEPARTMENT_INVALID_ID",
        "errors.organization.department.invalidId",
    )

    const childCount = await Department.countDocuments({
        parentDepartmentId: departmentId,
        status: { $ne: "ARCHIVED" },
        ...getDepartmentScopeFilter(user),
    })

    if (childCount > 0) {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_DEPARTMENT_HAS_CHILDREN",
            messageKey: "errors.organization.department.hasChildren",
        })
    }

    const department = await Department.findOneAndUpdate(
        {
            _id: departmentId,
            ...getDepartmentScopeFilter(user),
        },
        {
            $set: {
                status: "ARCHIVED",
                parentDepartmentId: null,
                updatedByAccountId: user.accountId,
            },
        },
        {
            returnDocument: "after",
            runValidators: true,
            context: "query",
        },
    )
        .populate({
            path: "companyId",
            select: "code displayName legalName status",
        })
        .populate({
            path: "branchId",
            select: "companyId code name shortName status isHeadOffice",
        })
        .populate({
            path: "parentDepartmentId",
            select: "code name shortName status",
        })

    if (!department) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_DEPARTMENT_NOT_FOUND",
            messageKey: "errors.organization.department.notFound",
        })
    }

    clearCacheByPrefix("department:list:")

    return serializeDepartment(department)
}
