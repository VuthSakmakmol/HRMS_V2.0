import { Types } from "mongoose"

import {
    clearCacheByPrefix,
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Company from "../../organization/models/Company.js"
import Position from "../../organization/models/Position.js"
import EmployeeType from "../models/EmployeeType.js"

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

function toId(value) {
    return value?._id?.toString?.() || value?.id || value?.toString?.() || value
}

function normalizeCode(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, "")
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

function getCompanyScopeFilter(user) {
    if (user?.isRootAdmin) {
        return {}
    }

    const companyIds = getUserCompanyIds(user)

    if (companyIds.length === 0) {
        return { _id: { $in: [] } }
    }

    return { _id: { $in: companyIds } }
}

function getEmployeeTypeScopeFilter(user) {
    if (user?.isRootAdmin) {
        return {}
    }

    const companyIds = getUserCompanyIds(user)

    if (companyIds.length === 0) {
        return { _id: { $in: [] } }
    }

    return { companyId: { $in: companyIds } }
}

function getPositionScopeFilter(user) {
    if (user?.isRootAdmin) {
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
        filters.push({ companyId: { $in: [...new Set(allBranchCompanyIds)] } })
    }

    if (branchIds.length > 0) {
        filters.push({ branchId: { $in: [...new Set(branchIds)] } })
    }

    if (filters.length === 0) {
        return { _id: { $in: [] } }
    }

    return { $or: filters }
}

function buildEmployeeTypeSearchFilter(search) {
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
            { "children.code": searchRegex },
            { "children.name": searchRegex },
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
        companyId: toId(branch.companyId),
        code: branch.code,
        name: branch.name,
        shortName: branch.shortName,
        status: branch.status,
    }
}

function serializeDepartment(department) {
    if (!department || typeof department !== "object") {
        return null
    }

    return {
        id: department._id?.toString?.() || department.id,
        companyId: toId(department.companyId),
        branchId: toId(department.branchId),
        code: department.code,
        name: department.name,
        shortName: department.shortName,
        status: department.status,
    }
}

function serializePosition(position) {
    if (!position || typeof position !== "object") {
        return null
    }

    const branch =
        position.branchId && typeof position.branchId === "object"
            ? serializeBranch(position.branchId)
            : null

    const department =
        position.departmentId && typeof position.departmentId === "object"
            ? serializeDepartment(position.departmentId)
            : null

    return {
        id: position._id?.toString?.() || position.id,
        companyId: toId(position.companyId),
        branchId: branch?.id || toId(position.branchId),
        departmentId: department?.id || toId(position.departmentId),
        branch,
        department,
        code: position.code,
        title: position.title,
        shortName: position.shortName || "",
        level: Number(position.level || 0),
        isManager: Boolean(position.isManager),
        status: position.status,
    }
}

function serializeEmployeeTypeChild(child) {
    if (!child || typeof child !== "object") {
        return null
    }

    const populatedPositions = Array.isArray(child.positionIds)
        ? child.positionIds
              .filter((position) => position && typeof position === "object")
              .map(serializePosition)
              .filter(Boolean)
        : []

    const rawPositionIds = Array.isArray(child.positionIds)
        ? child.positionIds.map(toId).filter(Boolean)
        : []

    return {
        id: child._id?.toString?.() || child.id || child.code,
        code: child.code,
        name: child.name,
        dashboardCategory: child.dashboardCategory || "CUSTOM",
        positionAssignmentMode:
            child.positionAssignmentMode || "SPECIFIC_POSITIONS",
        positionIds: populatedPositions.length
            ? populatedPositions.map((position) => position.id)
            : rawPositionIds,
        positions: populatedPositions,
        positionCount:
            child.positionAssignmentMode === "ALL_POSITIONS"
                ? "ALL"
                : populatedPositions.length || rawPositionIds.length || 0,
    }
}

function serializeEmployeeType(employeeType) {
    if (!employeeType) {
        return null
    }

    const raw =
        typeof employeeType.toJSON === "function"
            ? employeeType.toJSON()
            : { ...employeeType }

    const populatedCompany =
        raw.companyId && typeof raw.companyId === "object"
            ? serializeCompany(raw.companyId)
            : null

    const populatedPositions = Array.isArray(raw.positionIds)
        ? raw.positionIds
              .filter((position) => position && typeof position === "object")
              .map(serializePosition)
              .filter(Boolean)
        : []

    const rawPositionIds = Array.isArray(raw.positionIds)
        ? raw.positionIds.map(toId).filter(Boolean)
        : []

    const children = Array.isArray(raw.children)
        ? raw.children.map(serializeEmployeeTypeChild).filter(Boolean)
        : []

    const childPositionCount = children.reduce((sum, child) => {
        if (child.positionAssignmentMode === "ALL_POSITIONS") {
            return sum
        }

        return sum + Number(child.positionCount || 0)
    }, 0)

    const allPositions = children.length
        ? children.flatMap((child) => child.positions || [])
        : populatedPositions

    return {
        id: raw._id?.toString?.() || raw.id,
        companyId:
            populatedCompany?.id || raw.companyId?.toString?.() || raw.companyId,
        company: populatedCompany,
        code: raw.code,
        name: raw.name,
        shortName: raw.shortName || "",
        dashboardCategory: raw.dashboardCategory || "CUSTOM",
        assignmentMode: children.length > 0 ? "CHILD" : "DIRECT",
        positionAssignmentMode:
            raw.positionAssignmentMode || "SPECIFIC_POSITIONS",
        positionIds: populatedPositions.length
            ? populatedPositions.map((position) => position.id)
            : rawPositionIds,
        positions: populatedPositions,
        children,
        allPositionIds: children.length
            ? children.flatMap((child) => child.positionIds || [])
            : populatedPositions.length
              ? populatedPositions.map((position) => position.id)
              : rawPositionIds,
        allPositions,
        childCount: children.length,
        positionCount: children.length
            ? children.some(
                  (child) => child.positionAssignmentMode === "ALL_POSITIONS",
              )
                ? "ALL"
                : childPositionCount
            : raw.positionAssignmentMode === "ALL_POSITIONS"
              ? "ALL"
              : populatedPositions.length || rawPositionIds.length || 0,
        description: raw.description || "",
        status: raw.status,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

function buildEmployeeTypeUpdatePayload(payload, accountId) {
    const updatePayload = { updatedByAccountId: accountId }

    for (const field of [
        "code",
        "name",
        "shortName",
        "dashboardCategory",
        "positionAssignmentMode",
        "positionIds",
        "children",
        "description",
        "status",
    ]) {
        if (payload[field] !== undefined) {
            updatePayload[field] = payload[field]
        }
    }

    return updatePayload
}

function handleDuplicateEmployeeTypeError(error) {
    if (error?.code !== 11000) {
        throw error
    }

    if (error?.keyPattern?.code || error?.keyValue?.code) {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_EMPLOYEE_TYPE_CODE_EXISTS",
            messageKey: "errors.organization.employeeType.codeExists",
            fields: { code: ["errors.organization.employeeType.codeExists"] },
        })
    }

    throw new AppError({
        statusCode: 409,
        code: "ORGANIZATION_EMPLOYEE_TYPE_DUPLICATE",
        messageKey: "errors.organization.employeeType.duplicate",
    })
}

function normalizeChildGroups(children = []) {
    return (children || []).map((child) => ({
        code: normalizeCode(child.code || child.name),
        name: child.name,
        dashboardCategory: child.dashboardCategory || "CUSTOM",
        positionAssignmentMode:
            child.positionAssignmentMode || "SPECIFIC_POSITIONS",
        positionIds:
            child.positionAssignmentMode === "ALL_POSITIONS"
                ? []
                : [...new Set(child.positionIds || [])],
    }))
}

function flattenAssignmentPositionIds({ positionIds = [], children = [] }) {
    return [
        ...new Set([
            ...(positionIds || []),
            ...(children || []).flatMap((child) => child.positionIds || []),
        ]),
    ]
}

function normalizeAssignmentPayload(payload) {
    const normalized = { ...payload }

    if (!normalized.dashboardCategory) {
        normalized.dashboardCategory = "CUSTOM"
    }

    if (!normalized.positionAssignmentMode) {
        normalized.positionAssignmentMode = "SPECIFIC_POSITIONS"
    }

    if (normalized.positionAssignmentMode === "ALL_POSITIONS") {
        normalized.positionIds = []
    }

    if (normalized.children !== undefined) {
        normalized.children = normalizeChildGroups(normalized.children)
    }

    if (normalized.positionIds !== undefined) {
        normalized.positionIds = [...new Set(normalized.positionIds || [])]
    }

    if ((normalized.children || []).length > 0) {
        normalized.positionIds = []
        normalized.positionAssignmentMode = "SPECIFIC_POSITIONS"
    }

    return normalized
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

async function ensurePositionsExist({ companyId, positionIds, user }) {
    const uniquePositionIds = [...new Set(positionIds || [])]

    if (uniquePositionIds.length === 0) {
        return []
    }

    for (const positionId of uniquePositionIds) {
        ensureValidObjectId(
            positionId,
            "ORGANIZATION_POSITION_INVALID_ID",
            "errors.organization.position.invalidId",
        )
    }

    const positions = await Position.find({
        _id: { $in: uniquePositionIds },
        companyId,
        status: { $ne: "ARCHIVED" },
        ...getPositionScopeFilter(user),
    })
        .populate({
            path: "branchId",
            select: "companyId code name shortName status",
        })
        .populate({
            path: "departmentId",
            select: "companyId branchId code name shortName status",
        })
        .lean()

    if (positions.length !== uniquePositionIds.length) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_EMPLOYEE_TYPE_POSITION_NOT_FOUND",
            messageKey: "errors.organization.employeeType.positionNotFound",
            fields: {
                positionIds: [
                    "errors.organization.employeeType.positionNotFound",
                ],
            },
        })
    }

    return positions
}

async function ensurePositionsNotAlreadyMapped({
    companyId,
    positionIds,
    employeeTypeId = null,
}) {
    const uniquePositionIds = [...new Set(positionIds || [])]

    if (uniquePositionIds.length === 0) {
        return
    }

    const filter = {
        companyId,
        status: { $ne: "ARCHIVED" },
        $or: [
            { positionIds: { $in: uniquePositionIds } },
            { "children.positionIds": { $in: uniquePositionIds } },
        ],
    }

    if (employeeTypeId) {
        filter._id = { $ne: employeeTypeId }
    }

    const existingType = await EmployeeType.findOne(filter)
        .select("code name positionIds children.positionIds")
        .lean()

    if (!existingType) {
        return
    }

    throw new AppError({
        statusCode: 409,
        code: "ORGANIZATION_EMPLOYEE_TYPE_POSITION_ALREADY_MAPPED",
        messageKey: "errors.organization.employeeType.positionAlreadyMapped",
        fields: {
            positionIds: ["errors.organization.employeeType.positionAlreadyMapped"],
            children: ["errors.organization.employeeType.positionAlreadyMapped"],
        },
    })
}

async function getPositionIdsForOrgFilter({ query, user }) {
    if (!query.branchId && !query.departmentId) {
        return null
    }

    const positionFilter = {
        status: { $ne: "ARCHIVED" },
        ...getPositionScopeFilter(user),
    }

    if (query.companyId) {
        positionFilter.companyId = query.companyId
    }

    if (query.branchId) {
        ensureValidObjectId(
            query.branchId,
            "ORGANIZATION_BRANCH_INVALID_ID",
            "errors.organization.branch.invalidId",
        )
        positionFilter.branchId = query.branchId
    }

    if (query.departmentId) {
        ensureValidObjectId(
            query.departmentId,
            "ORGANIZATION_DEPARTMENT_INVALID_ID",
            "errors.organization.department.invalidId",
        )
        positionFilter.departmentId = query.departmentId
    }

    const positions = await Position.find(positionFilter).select("_id").lean()

    return positions.map((position) => position._id)
}

function addPositionMatchFilter(filter, positionIds) {
    const ids = [...new Set((positionIds || []).filter(Boolean))]

    if (ids.length === 0) {
        return
    }

    const positionClause = {
        $or: [
            { positionIds: { $in: ids } },
            { "children.positionIds": { $in: ids } },
            { positionAssignmentMode: "ALL_POSITIONS" },
            { "children.positionAssignmentMode": "ALL_POSITIONS" },
        ],
    }

    if (!filter.$and) {
        filter.$and = []
    }

    filter.$and.push(positionClause)
}

function populateEmployeeTypeQuery(query) {
    return query
        .populate({
            path: "companyId",
            select: "code displayName legalName status",
        })
        .populate({
            path: "positionIds",
            select: "companyId branchId departmentId code title shortName level isManager status",
            populate: [
                {
                    path: "branchId",
                    select: "companyId code name shortName status",
                },
                {
                    path: "departmentId",
                    select: "companyId branchId code name shortName status",
                },
            ],
        })
        .populate({
            path: "children.positionIds",
            select: "companyId branchId departmentId code title shortName level isManager status",
            populate: [
                {
                    path: "branchId",
                    select: "companyId code name shortName status",
                },
                {
                    path: "departmentId",
                    select: "companyId branchId code name shortName status",
                },
            ],
        })
}

function applyDashboardCategoryFilter(filter, dashboardCategory) {
    if (!dashboardCategory || dashboardCategory === "ALL") {
        return
    }

    if (!filter.$and) {
        filter.$and = []
    }

    filter.$and.push({
        $or: [
            { dashboardCategory },
            { "children.dashboardCategory": dashboardCategory },
        ],
    })
}

function clearEmployeeTypeRelatedCaches() {
    clearCacheByPrefix("employeeType:")
    clearCacheByPrefix("employee:list:")
    clearCacheByPrefix("hr-dashboard:")
}

export async function listEmployeeTypes({ query, user }) {
    const cacheKey = `employeeType:list:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cachedResult = getCache(cacheKey)

    if (cachedResult) {
        return cachedResult
    }

    const filter = {
        ...getEmployeeTypeScopeFilter(user),
        ...buildEmployeeTypeSearchFilter(query.search),
    }

    if (query.companyId) {
        await ensureCompanyExists({ companyId: query.companyId, user })
        filter.companyId = query.companyId
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    applyDashboardCategoryFilter(filter, query.dashboardCategory)

    if (query.positionId) {
        ensureValidObjectId(
            query.positionId,
            "ORGANIZATION_POSITION_INVALID_ID",
            "errors.organization.position.invalidId",
        )

        addPositionMatchFilter(filter, [query.positionId])
    }

    const orgPositionIds = await getPositionIdsForOrgFilter({ query, user })

    if (orgPositionIds) {
        addPositionMatchFilter(filter, orgPositionIds)
    }

    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
        populateEmployeeTypeQuery(EmployeeType.find(filter))
            .sort({ name: 1, code: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        EmployeeType.countDocuments(filter),
    ])

    const result = {
        items: items.map(serializeEmployeeType),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        },
    }

    return setCache(cacheKey, result, 30_000)
}

export async function getEmployeeTypeById({ employeeTypeId, user }) {
    ensureValidObjectId(
        employeeTypeId,
        "ORGANIZATION_EMPLOYEE_TYPE_INVALID_ID",
        "errors.organization.employeeType.invalidId",
    )

    const employeeType = await populateEmployeeTypeQuery(
        EmployeeType.findOne({
            _id: employeeTypeId,
            ...getEmployeeTypeScopeFilter(user),
        }),
    ).lean()

    if (!employeeType) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_EMPLOYEE_TYPE_NOT_FOUND",
            messageKey: "errors.organization.employeeType.notFound",
        })
    }

    return serializeEmployeeType(employeeType)
}

export async function createEmployeeType({ payload, user }) {
    await ensureCompanyExists({ companyId: payload.companyId, user })

    const normalizedPayload = normalizeAssignmentPayload(payload)
    const allPositionIds = flattenAssignmentPositionIds(normalizedPayload)

    await ensurePositionsExist({
        companyId: normalizedPayload.companyId,
        positionIds: allPositionIds,
        user,
    })

    await ensurePositionsNotAlreadyMapped({
        companyId: normalizedPayload.companyId,
        positionIds: allPositionIds,
    })

    try {
        const employeeType = await EmployeeType.create({
            ...normalizedPayload,
            createdByAccountId: user?.accountId || null,
            updatedByAccountId: user?.accountId || null,
        })

        clearEmployeeTypeRelatedCaches()

        return getEmployeeTypeById({ employeeTypeId: employeeType._id, user })
    } catch (error) {
        handleDuplicateEmployeeTypeError(error)
    }
}

export async function updateEmployeeType({ employeeTypeId, payload, user }) {
    ensureValidObjectId(
        employeeTypeId,
        "ORGANIZATION_EMPLOYEE_TYPE_INVALID_ID",
        "errors.organization.employeeType.invalidId",
    )

    const existingEmployeeType = await EmployeeType.findOne({
        _id: employeeTypeId,
        ...getEmployeeTypeScopeFilter(user),
    }).lean()

    if (!existingEmployeeType) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_EMPLOYEE_TYPE_NOT_FOUND",
            messageKey: "errors.organization.employeeType.notFound",
        })
    }

    if (existingEmployeeType.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_EMPLOYEE_TYPE_ARCHIVED",
            messageKey: "errors.organization.employeeType.archived",
        })
    }

    const normalizedPayload = normalizeAssignmentPayload({
        ...existingEmployeeType,
        ...payload,
    })

    const patchPayload = normalizeAssignmentPayload(payload)

    if (
        patchPayload.positionIds !== undefined ||
        patchPayload.children !== undefined ||
        patchPayload.positionAssignmentMode !== undefined
    ) {
        const allPositionIds = flattenAssignmentPositionIds(normalizedPayload)

        await ensurePositionsExist({
            companyId: existingEmployeeType.companyId,
            positionIds: allPositionIds,
            user,
        })

        await ensurePositionsNotAlreadyMapped({
            companyId: existingEmployeeType.companyId,
            positionIds: allPositionIds,
            employeeTypeId,
        })
    }

    try {
        const updatedEmployeeType = await EmployeeType.findOneAndUpdate(
            {
                _id: employeeTypeId,
                ...getEmployeeTypeScopeFilter(user),
            },
            {
                $set: buildEmployeeTypeUpdatePayload(
                    patchPayload,
                    user?.accountId || null,
                ),
            },
            {
                new: true,
                runValidators: true,
            },
        )

        clearEmployeeTypeRelatedCaches()

        return getEmployeeTypeById({
            employeeTypeId: updatedEmployeeType._id,
            user,
        })
    } catch (error) {
        handleDuplicateEmployeeTypeError(error)
    }
}

export async function archiveEmployeeType({ employeeTypeId, user }) {
    ensureValidObjectId(
        employeeTypeId,
        "ORGANIZATION_EMPLOYEE_TYPE_INVALID_ID",
        "errors.organization.employeeType.invalidId",
    )

    const employeeType = await EmployeeType.findOne({
        _id: employeeTypeId,
        ...getEmployeeTypeScopeFilter(user),
    }).lean()

    if (!employeeType) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_EMPLOYEE_TYPE_NOT_FOUND",
            messageKey: "errors.organization.employeeType.notFound",
        })
    }

    if (employeeType.status === "ARCHIVED") {
        return getEmployeeTypeById({ employeeTypeId, user })
    }

    await EmployeeType.updateOne(
        {
            _id: employeeTypeId,
            ...getEmployeeTypeScopeFilter(user),
        },
        {
            $set: {
                status: "ARCHIVED",
                updatedByAccountId: user?.accountId || null,
            },
        },
    )

    clearEmployeeTypeRelatedCaches()

    return getEmployeeTypeById({ employeeTypeId, user })
}
