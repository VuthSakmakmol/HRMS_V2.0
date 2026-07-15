import { Types } from "mongoose"

import {
    clearCacheByPrefix,
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"
import { buildPagination } from "../../../shared/http/pagination.js"
import Branch from "../models/Branch.js"
import Company from "../models/Company.js"
import Department from "../models/Department.js"
import Position from "../models/Position.js"

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

function getPositionScopeFilter(user) {
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

function buildPositionSearchFilter(search) {
    const normalizedSearch = String(search || "").trim()

    if (!normalizedSearch) {
        return {}
    }

    const searchRegex = new RegExp(escapeRegExp(normalizedSearch), "i")

    return {
        $or: [
            { code: searchRegex },
            { title: searchRegex },
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
        status: branch.status,
        isHeadOffice: Boolean(branch.isHeadOffice),
    }
}

function serializeDepartment(department) {
    if (!department || typeof department !== "object") {
        return null
    }

    return {
        id: department._id?.toString?.() || department.id,
        companyId: department.companyId?.toString?.() || department.companyId,
        branchId: department.branchId?.toString?.() || department.branchId,
        code: department.code,
        name: department.name,
        status: department.status,
    }
}

function serializeReportsToPosition(position) {
    if (!position || typeof position !== "object") {
        return null
    }

    return {
        id: position._id?.toString?.() || position.id,
        code: position.code,
        title: position.title,
        level: position.level,
        isManager: Boolean(position.isManager),
        status: position.status,
    }
}

function serializePosition(position) {
    if (!position) {
        return null
    }

    const raw =
        typeof position.toJSON === "function"
            ? position.toJSON()
            : {
                  ...position,
              }

    const populatedCompany =
        raw.companyId && typeof raw.companyId === "object"
            ? serializeCompany(raw.companyId)
            : null

    const populatedBranch =
        raw.branchId && typeof raw.branchId === "object"
            ? serializeBranch(raw.branchId)
            : null

    const populatedDepartment =
        raw.departmentId && typeof raw.departmentId === "object"
            ? serializeDepartment(raw.departmentId)
            : null

    const populatedReportsTo =
        raw.reportsToPositionId &&
        typeof raw.reportsToPositionId === "object"
            ? serializeReportsToPosition(raw.reportsToPositionId)
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
        departmentId:
            populatedDepartment?.id ||
            raw.departmentId?.toString?.() ||
            raw.departmentId,
        reportsToPositionId:
            populatedReportsTo?.id ||
            raw.reportsToPositionId?.toString?.() ||
            raw.reportsToPositionId ||
            null,
        company: populatedCompany,
        branch: populatedBranch,
        department: populatedDepartment,
        reportsToPosition: populatedReportsTo,
        code: raw.code,
        title: raw.title,
        level: Number(raw.level || 0),
        isManager: Boolean(raw.isManager),
        description: raw.description || "",
        status: raw.status,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

function buildPositionUpdatePayload(payload, accountId) {
    const updatePayload = {
        updatedByAccountId: accountId,
    }

    for (const field of [
        "reportsToPositionId",
        "code",
        "title",
        "level",
        "isManager",
        "description",
        "status",
    ]) {
        if (payload[field] !== undefined) {
            updatePayload[field] = payload[field]
        }
    }

    return updatePayload
}

function handleDuplicatePositionError(error) {
    if (error?.code !== 11000) {
        throw error
    }

    if (error?.keyPattern?.code || error?.keyValue?.code) {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_POSITION_CODE_EXISTS",
            messageKey: "errors.organization.position.codeExists",
            fields: {
                code: ["errors.organization.position.codeExists"],
            },
        })
    }

    throw new AppError({
        statusCode: 409,
        code: "ORGANIZATION_POSITION_DUPLICATE",
        messageKey: "errors.organization.position.duplicate",
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

async function ensureDepartmentExists({
    companyId,
    branchId,
    departmentId,
    user,
}) {
    ensureValidObjectId(
        departmentId,
        "ORGANIZATION_DEPARTMENT_INVALID_ID",
        "errors.organization.department.invalidId",
    )

    const department = await Department.findOne({
        _id: departmentId,
        companyId,
        branchId,
        status: { $ne: "ARCHIVED" },
        ...getPositionScopeFilter(user),
    }).lean()

    if (!department) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_DEPARTMENT_NOT_FOUND",
            messageKey: "errors.organization.department.notFound",
        })
    }

    return department
}

async function ensureReportsToPositionExists({
    reportsToPositionId,
    companyId,
    branchId,
    positionId,
    user,
}) {
    if (!reportsToPositionId) {
        return null
    }

    ensureValidObjectId(
        reportsToPositionId,
        "ORGANIZATION_POSITION_INVALID_ID",
        "errors.organization.position.invalidId",
    )

    if (positionId && reportsToPositionId.toString() === positionId.toString()) {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_POSITION_REPORTS_TO_SELF",
            messageKey: "errors.organization.position.reportsToSelf",
            fields: {
                reportsToPositionId: [
                    "errors.organization.position.reportsToSelf",
                ],
            },
        })
    }

    const reportsToPosition = await Position.findOne({
        _id: reportsToPositionId,
        companyId,
        branchId,
        status: { $ne: "ARCHIVED" },
        ...getPositionScopeFilter(user),
    }).lean()

    if (!reportsToPosition) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_POSITION_REPORTS_TO_NOT_FOUND",
            messageKey: "errors.organization.position.reportsToNotFound",
            fields: {
                reportsToPositionId: [
                    "errors.organization.position.reportsToNotFound",
                ],
            },
        })
    }

    return reportsToPosition
}

export async function listPositions({ query, user }) {
    const cacheKey = `position:list:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`

    const cachedResult = getCache(cacheKey)

    if (cachedResult) {
        return cachedResult
    }

    const filter = {
        ...getPositionScopeFilter(user),
        ...buildPositionSearchFilter(query.search),
    }

    if (query.companyId) {
        await ensureCompanyExists({
            companyId: query.companyId,
            user,
        })

        filter.companyId = query.companyId
    }

    if (query.branchId) {
        if (query.companyId) {
            await ensureBranchExists({
                companyId: query.companyId,
                branchId: query.branchId,
                user,
            })
        }

        filter.branchId = query.branchId
    }

    if (query.departmentId) {
        if (!query.companyId || !query.branchId) {
            const department = await Department.findOne({
                _id: query.departmentId,
                status: { $ne: "ARCHIVED" },
                ...getPositionScopeFilter(user),
            }).lean()

            if (!department) {
                throw new AppError({
                    statusCode: 404,
                    code: "ORGANIZATION_DEPARTMENT_NOT_FOUND",
                    messageKey: "errors.organization.department.notFound",
                })
            }
        } else {
            await ensureDepartmentExists({
                companyId: query.companyId,
                branchId: query.branchId,
                departmentId: query.departmentId,
                user,
            })
        }

        filter.departmentId = query.departmentId
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit
    const sortDirection = query.sortOrder === "desc" ? -1 : 1
    const sort = {
        [query.sortBy]: sortDirection,
        _id: sortDirection,
    }

    const [items, total] = await Promise.all([
        Position.find(filter)
            .populate({
                path: "companyId",
                select: "code displayName legalName status",
            })
            .populate({
                path: "branchId",
                select: "companyId code name status isHeadOffice",
            })
            .populate({
                path: "departmentId",
                select: "companyId branchId code name status",
            })
            .populate({
                path: "reportsToPositionId",
                select: "code title level isManager status",
            })
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        Position.countDocuments(filter),
    ])

    const result = {
        items: items.map(serializePosition),
        pagination: buildPagination({
            page,
            limit,
            total,
        }),
    }

    return setCache(cacheKey, result, 30_000)
}

export async function lookupPositions({ query, user }) {
    const result = await listPositions({
        query: {
            ...query,
            page: 1,
            limit: Math.min(query.limit || 100, 100),
            status: "ACTIVE",
        },
        user,
    })

    return result.items.map((position) => ({
        id: position.id,
        companyId: position.companyId,
        branchId: position.branchId,
        departmentId: position.departmentId,
        reportsToPositionId: position.reportsToPositionId || null,
        code: position.code,
        name: position.title,
        title: position.title,
        level: position.level,
        isManager: Boolean(position.isManager),
        status: position.status,
    }))
}

export async function getPositionById({ positionId, user }) {
    ensureValidObjectId(
        positionId,
        "ORGANIZATION_POSITION_INVALID_ID",
        "errors.organization.position.invalidId",
    )

    const position = await Position.findOne({
        _id: positionId,
        ...getPositionScopeFilter(user),
    })
        .populate({
            path: "companyId",
            select: "code displayName legalName status",
        })
        .populate({
            path: "branchId",
            select: "companyId code name status isHeadOffice",
        })
        .populate({
            path: "departmentId",
            select: "companyId branchId code name status",
        })
        .populate({
            path: "reportsToPositionId",
            select: "code title level isManager status",
        })

    if (!position) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_POSITION_NOT_FOUND",
            messageKey: "errors.organization.position.notFound",
        })
    }

    return serializePosition(position)
}

export async function createPosition({ payload, user }) {
    await ensureCompanyExists({
        companyId: payload.companyId,
        user,
    })

    await ensureBranchExists({
        companyId: payload.companyId,
        branchId: payload.branchId,
        user,
    })

    await ensureDepartmentExists({
        companyId: payload.companyId,
        branchId: payload.branchId,
        departmentId: payload.departmentId,
        user,
    })

    await ensureReportsToPositionExists({
        reportsToPositionId: payload.reportsToPositionId,
        companyId: payload.companyId,
        branchId: payload.branchId,
        user,
    })

    try {
        const position = await Position.create({
            ...payload,
            reportsToPositionId: payload.reportsToPositionId || null,
            level: Number(payload.level || 0),
            isManager: Boolean(payload.isManager),
            status: payload.status || "ACTIVE",
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        clearCacheByPrefix("position:list:")

        return await getPositionById({
            positionId: position._id.toString(),
            user,
        })
    } catch (error) {
        handleDuplicatePositionError(error)
    }
}

export async function updatePosition({ positionId, payload, user }) {
    ensureValidObjectId(
        positionId,
        "ORGANIZATION_POSITION_INVALID_ID",
        "errors.organization.position.invalidId",
    )

    const currentPosition = await Position.findOne({
        _id: positionId,
        status: { $ne: "ARCHIVED" },
        ...getPositionScopeFilter(user),
    }).lean()

    if (!currentPosition) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_POSITION_NOT_FOUND",
            messageKey: "errors.organization.position.notFound",
        })
    }

    if (payload.reportsToPositionId !== undefined) {
        await ensureReportsToPositionExists({
            reportsToPositionId: payload.reportsToPositionId,
            companyId: currentPosition.companyId,
            branchId: currentPosition.branchId,
            positionId,
            user,
        })
    }

    try {
        const position = await Position.findOneAndUpdate(
            {
                _id: positionId,
                status: { $ne: "ARCHIVED" },
                ...getPositionScopeFilter(user),
            },
            {
                $set: buildPositionUpdatePayload(payload, user.accountId),
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
                select: "companyId code name status isHeadOffice",
            })
            .populate({
                path: "departmentId",
                select: "companyId branchId code name status",
            })
            .populate({
                path: "reportsToPositionId",
                select: "code title level isManager status",
            })

        if (!position) {
            throw new AppError({
                statusCode: 404,
                code: "ORGANIZATION_POSITION_NOT_FOUND",
                messageKey: "errors.organization.position.notFound",
            })
        }

        clearCacheByPrefix("position:list:")

        return serializePosition(position)
    } catch (error) {
        if (error instanceof AppError) {
            throw error
        }

        handleDuplicatePositionError(error)
    }
}

export async function archivePosition({ positionId, user }) {
    ensureValidObjectId(
        positionId,
        "ORGANIZATION_POSITION_INVALID_ID",
        "errors.organization.position.invalidId",
    )

    const childCount = await Position.countDocuments({
        reportsToPositionId: positionId,
        status: { $ne: "ARCHIVED" },
        ...getPositionScopeFilter(user),
    })

    if (childCount > 0) {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_POSITION_HAS_REPORTING_POSITIONS",
            messageKey: "errors.organization.position.hasReportingPositions",
        })
    }

    const position = await Position.findOneAndUpdate(
        {
            _id: positionId,
            ...getPositionScopeFilter(user),
        },
        {
            $set: {
                status: "ARCHIVED",
                reportsToPositionId: null,
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
            select: "companyId code name status isHeadOffice",
        })
        .populate({
            path: "departmentId",
            select: "companyId branchId code name status",
        })
        .populate({
            path: "reportsToPositionId",
            select: "code title level isManager status",
        })

    if (!position) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_POSITION_NOT_FOUND",
            messageKey: "errors.organization.position.notFound",
        })
    }

    clearCacheByPrefix("position:list:")

    return serializePosition(position)
}
