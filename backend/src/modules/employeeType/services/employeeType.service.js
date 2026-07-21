import mongoose, { Types } from "mongoose"

import {
    clearCacheByPrefix,
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Company from "../../organization/models/Company.js"
import Branch from "../../organization/models/Branch.js"
import Position from "../../organization/models/Position.js"
import Employee from "../../employee/models/Employee.js"
import EmployeeMovement from "../../employeeMovement/models/EmployeeMovement.js"
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
        dashboardCategory: child.dashboardCategory || "UNSPECIFIED",
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

    const populatedBranch =
        raw.branchId && typeof raw.branchId === "object"
            ? serializeBranch(raw.branchId)
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
        branchId:
            populatedBranch?.id || raw.branchId?.toString?.() || raw.branchId,
        branch: populatedBranch,
        code: raw.code,
        name: raw.name,
        dashboardCategory: raw.dashboardCategory || "UNSPECIFIED",
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
        "companyId",
        "branchId",
        "code",
        "name",
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
        dashboardCategory: child.dashboardCategory || "UNSPECIFIED",
        positionAssignmentMode:
            child.positionAssignmentMode || "SPECIFIC_POSITIONS",
        positionIds: [...new Set(child.positionIds || [])],
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

function assignmentByPosition(employeeType) {
    const assignments = new Map()

    for (const positionId of employeeType.positionIds || []) {
        assignments.set(toId(positionId), {
            employeeTypeChildId: null,
            employeeTypeChildCode: "",
            employeeTypeChildName: "",
        })
    }

    for (const child of employeeType.children || []) {
        for (const positionId of child.positionIds || []) {
            assignments.set(toId(positionId), {
                employeeTypeChildId: child._id || child.id || null,
                employeeTypeChildCode: child.code || "",
                employeeTypeChildName: child.name || "",
            })
        }
    }

    return assignments
}

function employeeAssignmentSnapshot(employee, overrides = {}) {
    return {
        companyId: employee.companyId || null,
        branchId: employee.branchId || null,
        departmentId: employee.departmentId || null,
        positionId: employee.positionId || null,
        lineId: employee.lineId || null,
        shiftId: employee.shiftId || null,
        employeeTypeId: employee.employeeTypeId || null,
        employeeTypeChildId: employee.employeeTypeChildId || null,
        employeeTypeChildCode: employee.employeeTypeChildCode || "",
        employeeTypeChildName: employee.employeeTypeChildName || "",
        employmentStatus: employee.employmentStatus || "",
        ...overrides,
    }
}

async function buildEmployeeReconciliationPreview({ existingEmployeeType, normalizedPayload }) {
    const oldAssignments = assignmentByPosition(existingEmployeeType)
    const newAssignments = assignmentByPosition(normalizedPayload)
    const affectedPositionIds = [...new Set([...oldAssignments.keys(), ...newAssignments.keys()])]

    if (!affectedPositionIds.length) {
        return { totalAffected: 0, reassigned: 0, reviewRequired: 0, employees: [] }
    }

    const employees = await Employee.find({
        companyId: normalizedPayload.companyId,
        branchId: normalizedPayload.branchId,
        positionId: { $in: affectedPositionIds },
        recordStatus: { $ne: "ARCHIVED" },
    })
        .select("employeeCode companyId branchId departmentId positionId lineId shiftId employeeTypeId employeeTypeChildId employeeTypeChildCode employeeTypeChildName employeeTypeReviewRequired employmentStatus")
        .lean()

    const changes = []
    for (const employee of employees) {
        const target = newAssignments.get(toId(employee.positionId))
        const desiredTypeId = target ? toId(existingEmployeeType._id) : null
        const alreadyCorrect =
            toId(employee.employeeTypeId) === desiredTypeId &&
            toId(employee.employeeTypeChildId) === toId(target?.employeeTypeChildId)

        if (alreadyCorrect && !employee.employeeTypeReviewRequired) continue

        changes.push({ employee, target: target || null })
    }

    return {
        totalAffected: changes.length,
        reassigned: changes.filter((item) => item.target).length,
        reviewRequired: changes.filter((item) => !item.target).length,
        employees: changes,
    }
}

async function applyEmployeeReconciliation({ preview, employeeTypeId, accountId, session }) {
    if (!preview.totalAffected) return

    const employeeOperations = []
    const movementRows = []

    for (const { employee, target } of preview.employees) {
        const next = target
            ? {
                  employeeTypeId,
                  employeeTypeChildId: target.employeeTypeChildId || null,
                  employeeTypeChildCode: target.employeeTypeChildCode,
                  employeeTypeChildName: target.employeeTypeChildName,
                  employeeTypeReviewRequired: false,
                  employeeTypeReviewReason: "",
              }
            : {
                  employeeTypeId: null,
                  employeeTypeChildId: null,
                  employeeTypeChildCode: "",
                  employeeTypeChildName: "",
                  employeeTypeReviewRequired: true,
                  employeeTypeReviewReason: "POSITION_UNASSIGNED",
              }

        employeeOperations.push({
            updateOne: {
                filter: { _id: employee._id },
                update: { $set: { ...next, updatedByAccountId: accountId } },
            },
        })
        movementRows.push({
            employeeId: employee._id,
            movementType: "EMPLOYEE_TYPE_CHANGE",
            effectiveDate: new Date(),
            from: employeeAssignmentSnapshot(employee),
            to: employeeAssignmentSnapshot(employee, next),
            reason: target
                ? "Automatically reconciled after Employee Type position assignment changed."
                : "Position removed from Employee Type assignment; HR review required.",
            source: "SYSTEM",
            createdByAccountId: accountId,
            updatedByAccountId: accountId,
        })
    }

    await Employee.bulkWrite(employeeOperations, { session })
    await EmployeeMovement.insertMany(movementRows, { session })
}

function normalizeAssignmentPayload(payload) {
    const normalized = { ...payload }

    if (!normalized.positionAssignmentMode) {
        normalized.positionAssignmentMode = "SPECIFIC_POSITIONS"
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


async function ensureBranchExists({ companyId, branchId, user }) {
    ensureValidObjectId(
        branchId,
        "ORGANIZATION_BRANCH_INVALID_ID",
        "errors.organization.branch.invalidId",
    )

    const branch = await Branch.findOne({
        _id: branchId,
        companyId,
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!branch) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_BRANCH_NOT_FOUND",
            messageKey: "errors.organization.branch.notFound",
            fields: {
                branchId: ["errors.organization.branch.notFound"],
            },
        })
    }

    const allowedCompany = await Company.exists({
        _id: companyId,
        ...getCompanyScopeFilter(user),
    })

    if (!allowedCompany) {
        throw new AppError({
            statusCode: 403,
            code: "ORGANIZATION_BRANCH_FORBIDDEN",
            messageKey: "errors.forbidden",
        })
    }

    return branch
}

async function ensurePositionsExist({ companyId, branchId, positionIds, user }) {
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
        branchId,
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

async function getAllActivePositionIds({ companyId, branchId, user }) {
    const positions = await Position.find({
        companyId,
        branchId,
        status: "ACTIVE",
        ...getPositionScopeFilter(user),
    })
        .select("_id")
        .lean()

    return positions.map((position) => position._id.toString())
}

async function resolveAssignmentPositionIds({ payload, user }) {
    const allActivePositionIds = await getAllActivePositionIds({
        companyId: payload.companyId,
        branchId: payload.branchId,
        user,
    })

    const normalized = { ...payload }

    if ((normalized.children || []).length > 0) {
        normalized.children = normalized.children.map((child) => ({
            ...child,
            positionIds:
                child.positionAssignmentMode === "ALL_POSITIONS"
                    ? [...allActivePositionIds]
                    : [...new Set(child.positionIds || [])],
        }))
        normalized.positionIds = []
    } else if (normalized.positionAssignmentMode === "ALL_POSITIONS") {
        normalized.positionIds = [...allActivePositionIds]
    }

    return normalized
}

async function ensurePositionsNotAlreadyMapped({
    companyId,
    branchId,
    positionIds,
    employeeTypeId = null,
}) {
    const uniquePositionIds = [...new Set(positionIds || [])]

    if (uniquePositionIds.length === 0) {
        return
    }

    const filter = {
        companyId,
        branchId,
        status: { $ne: "ARCHIVED" },
        $or: [
            { positionIds: { $in: uniquePositionIds } },
            { "children.positionIds": { $in: uniquePositionIds } },
            { positionAssignmentMode: "ALL_POSITIONS" },
            { "children.positionAssignmentMode": "ALL_POSITIONS" },
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
            path: "branchId",
            select: "companyId code name shortName status",
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

    if (query.branchId) {
        await ensureBranchExists({
            companyId: query.companyId,
            branchId: query.branchId,
            user,
        })
        filter.branchId = query.branchId
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

export async function listEmployeeTypePositionAssignments({ query, user }) {
    await ensureCompanyExists({ companyId: query.companyId, user })
    await ensureBranchExists({
        companyId: query.companyId,
        branchId: query.branchId,
        user,
    })

    const employeeTypes = await EmployeeType.find({
        companyId: query.companyId,
        branchId: query.branchId,
        status: { $ne: "ARCHIVED" },
        ...getEmployeeTypeScopeFilter(user),
    })
        .select("code name positionAssignmentMode positionIds children")
        .lean()

    const allActivePositionIds = await getAllActivePositionIds({
        companyId: query.companyId,
        branchId: query.branchId,
        user,
    })

    const assignments = []

    for (const employeeType of employeeTypes) {
        const directIds =
            employeeType.positionAssignmentMode === "ALL_POSITIONS"
                ? allActivePositionIds
                : employeeType.positionIds || []

        for (const positionId of directIds) {
            assignments.push({
                positionId: toId(positionId),
                employeeTypeId: toId(employeeType._id),
                employeeTypeCode: employeeType.code,
                employeeTypeName: employeeType.name,
                childCode: null,
                childName: null,
            })
        }

        for (const child of employeeType.children || []) {
            const childIds =
                child.positionAssignmentMode === "ALL_POSITIONS"
                    ? allActivePositionIds
                    : child.positionIds || []

            for (const positionId of childIds) {
                assignments.push({
                    positionId: toId(positionId),
                    employeeTypeId: toId(employeeType._id),
                    employeeTypeCode: employeeType.code,
                    employeeTypeName: employeeType.name,
                    childCode: child.code,
                    childName: child.name,
                })
            }
        }
    }

    return assignments
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
    await ensureBranchExists({
        companyId: payload.companyId,
        branchId: payload.branchId,
        user,
    })

    const normalizedPayload = await resolveAssignmentPositionIds({
        payload: normalizeAssignmentPayload(payload),
        user,
    })
    const allPositionIds = flattenAssignmentPositionIds(normalizedPayload)

    await ensurePositionsExist({
        companyId: normalizedPayload.companyId,
        branchId: normalizedPayload.branchId,
        positionIds: allPositionIds,
        user,
    })

    await ensurePositionsNotAlreadyMapped({
        companyId: normalizedPayload.companyId,
        branchId: normalizedPayload.branchId,
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

    const confirmEmployeeReconciliation = payload.confirmEmployeeReconciliation === true
    const cleanPayload = { ...payload }
    delete cleanPayload.confirmEmployeeReconciliation

    let normalizedPayload = normalizeAssignmentPayload({
        ...existingEmployeeType,
        ...cleanPayload,
    })

    await ensureCompanyExists({
        companyId: normalizedPayload.companyId,
        user,
    })

    await ensureBranchExists({
        companyId: normalizedPayload.companyId,
        branchId: normalizedPayload.branchId,
        user,
    })

    normalizedPayload = await resolveAssignmentPositionIds({
        payload: normalizedPayload,
        user,
    })

    let patchPayload = normalizeAssignmentPayload(cleanPayload)

    if (
        patchPayload.positionIds !== undefined ||
        patchPayload.children !== undefined ||
        patchPayload.positionAssignmentMode !== undefined ||
        patchPayload.companyId !== undefined ||
        patchPayload.branchId !== undefined
    ) {
        const allPositionIds = flattenAssignmentPositionIds(normalizedPayload)

        await ensurePositionsExist({
            companyId: normalizedPayload.companyId,
            branchId: normalizedPayload.branchId,
            positionIds: allPositionIds,
            user,
        })

        await ensurePositionsNotAlreadyMapped({
            companyId: normalizedPayload.companyId,
            branchId: normalizedPayload.branchId,
            positionIds: allPositionIds,
            employeeTypeId,
        })

        patchPayload = {
            ...patchPayload,
            positionAssignmentMode: normalizedPayload.positionAssignmentMode,
            positionIds: normalizedPayload.positionIds,
            children: normalizedPayload.children,
        }
    }

    const reconciliationPreview = await buildEmployeeReconciliationPreview({
        existingEmployeeType,
        normalizedPayload,
    })

    if (reconciliationPreview.totalAffected > 0 && !confirmEmployeeReconciliation) {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_EMPLOYEE_TYPE_RECONCILIATION_CONFIRMATION_REQUIRED",
            messageKey: "errors.organization.employeeType.reconciliationConfirmationRequired",
            details: {
                reconciliation: {
                    totalAffected: reconciliationPreview.totalAffected,
                    reassigned: reconciliationPreview.reassigned,
                    reviewRequired: reconciliationPreview.reviewRequired,
                },
            },
        })
    }

    const session = await mongoose.startSession()
    try {
        let updatedEmployeeType
        await session.withTransaction(async () => {
            updatedEmployeeType = await EmployeeType.findOneAndUpdate(
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
                session,
            },
            )

            await applyEmployeeReconciliation({
                preview: reconciliationPreview,
                employeeTypeId: updatedEmployeeType._id,
                accountId: user?.accountId || null,
                session,
            })
        })

        clearEmployeeTypeRelatedCaches()

        const employeeType = await getEmployeeTypeById({
            employeeTypeId: updatedEmployeeType._id,
            user,
        })
        return {
            employeeType,
            reconciliation: {
                totalAffected: reconciliationPreview.totalAffected,
                reassigned: reconciliationPreview.reassigned,
                reviewRequired: reconciliationPreview.reviewRequired,
            },
        }
    } catch (error) {
        handleDuplicateEmployeeTypeError(error)
    } finally {
        await session.endSession()
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

export async function listEmployeeTypeDashboardCategories({ user }) {
    const scope = getEmployeeTypeScopeFilter(user)
    const rows = await EmployeeType.aggregate([
        { $match: { ...scope, status: { $ne: "ARCHIVED" } } },
        { $project: { categories: { $setUnion: [[{ $ifNull: ["$dashboardCategory", ""] }], { $map: { input: { $ifNull: ["$children", []] }, as: "child", in: { $ifNull: ["$$child.dashboardCategory", ""] } } }] } } },
        { $unwind: "$categories" },
        { $match: { categories: { $nin: ["", null] } } },
        { $group: { _id: "$categories" } },
        { $sort: { _id: 1 } },
    ])
    return rows.map((row) => ({ value: row._id, label: String(row._id).toLowerCase().split("_").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") }))
}
