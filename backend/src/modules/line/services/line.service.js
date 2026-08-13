import { Types } from "mongoose"

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

import Line from "../models/Line.js"

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

function normalizeId(value) {
    return value?._id?.toString?.() || value?.id || value?.toString?.() || ""
}

function uniqueIds(values = []) {
    return [...new Set((values || []).map(normalizeId).filter(Boolean))]
}

function effectivePositionIds(line) {
    const current = Array.isArray(line?.positionIds)
        ? uniqueIds(line.positionIds)
        : []

    if (current.length) return current

    const legacy = normalizeId(line?.positionId)
    return legacy ? [legacy] : []
}

function sameIdSet(left = [], right = []) {
    const a = uniqueIds(left).sort()
    const b = uniqueIds(right).sort()
    return a.length === b.length && a.every((value, index) => value === b[index])
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
        for (const branchId of assignment.branchIds || []) branchIds.push(branchId)
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

function getLineScopeFilter(user) {
    if (user?.isRootAdmin) return {}

    const allBranchCompanyIds = []
    const branchIds = []

    for (const assignment of user?.roleAssignments || []) {
        if (assignment.allBranches && assignment.companyId) {
            allBranchCompanyIds.push(assignment.companyId)
        }
        for (const branchId of assignment.branchIds || []) branchIds.push(branchId)
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

function buildLineSearchFilter(search) {
    const normalizedSearch = String(search || "").trim()
    if (!normalizedSearch) return {}

    const searchRegex = new RegExp(escapeRegExp(normalizedSearch), "i")
    return {
        $or: [
            { code: searchRegex },
            { name: searchRegex },
            { description: searchRegex },
        ],
    }
}

function nonEmptyFilter(filter) {
    return filter && typeof filter === "object" && Object.keys(filter).length > 0
}

function serializeCompany(company) {
    if (!company || typeof company !== "object") return null
    return {
        id: company._id?.toString?.() || company.id,
        code: company.code,
        displayName: company.displayName,
        legalName: company.legalName,
        status: company.status,
    }
}

function serializeBranch(branch) {
    if (!branch || typeof branch !== "object") return null
    return {
        id: branch._id?.toString?.() || branch.id,
        companyId: normalizeId(branch.companyId),
        code: branch.code,
        name: branch.name,
        status: branch.status,
        isHeadOffice: Boolean(branch.isHeadOffice),
    }
}

function serializeDepartment(department) {
    if (!department || typeof department !== "object") return null
    return {
        id: department._id?.toString?.() || department.id,
        companyId: normalizeId(department.companyId),
        branchId: normalizeId(department.branchId),
        code: department.code,
        name: department.name,
        status: department.status,
    }
}

function serializePosition(position) {
    if (!position || typeof position !== "object") return null

    const department = position.departmentId && typeof position.departmentId === "object"
        ? serializeDepartment(position.departmentId)
        : null

    return {
        id: position._id?.toString?.() || position.id,
        companyId: normalizeId(position.companyId),
        branchId: normalizeId(position.branchId),
        departmentId: department?.id || normalizeId(position.departmentId),
        department,
        code: position.code,
        title: position.title,
        status: position.status,
    }
}

export function serializeLine(line) {
    if (!line) return null

    const raw = typeof line.toJSON === "function" ? line.toJSON() : { ...line }
    const company = raw.companyId && typeof raw.companyId === "object"
        ? serializeCompany(raw.companyId)
        : null
    const branch = raw.branchId && typeof raw.branchId === "object"
        ? serializeBranch(raw.branchId)
        : null
    const legacyDepartment = raw.departmentId && typeof raw.departmentId === "object"
        ? serializeDepartment(raw.departmentId)
        : null

    const populatedPositions = Array.isArray(raw.positionIds)
        ? raw.positionIds
            .filter((item) => item && typeof item === "object")
            .map(serializePosition)
            .filter(Boolean)
        : []

    const legacyPosition = raw.positionId && typeof raw.positionId === "object"
        ? serializePosition(raw.positionId)
        : null

    const positions = populatedPositions.length
        ? populatedPositions
        : legacyPosition
            ? [legacyPosition]
            : []

    const positionIds = positions.length
        ? positions.map((position) => position.id)
        : effectivePositionIds(raw)

    const departmentsById = new Map()
    for (const position of positions) {
        if (position?.department?.id) {
            departmentsById.set(position.department.id, position.department)
        }
    }
    if (!departmentsById.size && legacyDepartment?.id) {
        departmentsById.set(legacyDepartment.id, legacyDepartment)
    }
    const departments = [...departmentsById.values()]
    const departmentIds = departments.map((department) => department.id)

    return {
        id: raw._id?.toString?.() || raw.id,
        companyId: company?.id || normalizeId(raw.companyId),
        branchId: branch?.id || normalizeId(raw.branchId),
        departmentIds,
        positionIds,
        code: raw.code,
        name: raw.name,
        description: raw.description || "",
        status: raw.status,
        company,
        branch,
        departments,
        positions,
        // Compatibility for development data created before Line became
        // independent from Department. New code should use departments / positionIds.
        departmentId: departmentIds[0] || "",
        department: departments[0] || null,
        positionId: positionIds[0] || "",
        position: positions[0] || null,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

function throwLineCodeExists() {
    throw new AppError({
        statusCode: 409,
        code: "ORGANIZATION_LINE_CODE_EXISTS",
        messageKey: "errors.organization.line.codeExists",
        fields: { code: ["errors.organization.line.codeExists"] },
    })
}

function handleDuplicateError(error) {
    if (error?.code === 11000) throwLineCodeExists()
    throw error
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

async function ensurePositionsExist({ companyId, branchId, positionIds }) {
    const normalizedIds = uniqueIds(positionIds)
    if (!normalizedIds.length) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_LINE_POSITION_REQUIRED",
            messageKey: "errors.organization.line.positionRequired",
            fields: { positionIds: ["errors.organization.line.positionRequired"] },
        })
    }

    for (const positionId of normalizedIds) {
        ensureValidObjectId(
            positionId,
            "ORGANIZATION_POSITION_INVALID_ID",
            "errors.organization.position.invalidId",
        )
    }

    const positions = await Position.find({
        _id: { $in: normalizedIds },
        companyId,
        branchId,
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (positions.length !== normalizedIds.length) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_LINE_POSITION_NOT_FOUND",
            messageKey: "errors.organization.line.positionNotFound",
            fields: { positionIds: ["errors.organization.line.positionNotFound"] },
        })
    }

    const byId = new Map(positions.map((position) => [position._id.toString(), position]))
    return normalizedIds.map((positionId) => byId.get(positionId)).filter(Boolean)
}

async function ensureLineAssociation({ companyId, branchId, positionIds }) {
    const positions = await ensurePositionsExist({
        companyId,
        branchId,
        positionIds,
    })
    return { positions }
}

async function ensurePositionRemovalIsSafe({ lineId, newPositionIds }) {
    const employees = await Employee.find({
        lineId,
        recordStatus: "ACTIVE",
    })
        .select("positionId")
        .lean()

    if (!employees.length) return

    const allowed = new Set(uniqueIds(newPositionIds))
    const usedPositionIds = uniqueIds(employees.map((employee) => employee.positionId))
    const removedUsedPosition = usedPositionIds.some((positionId) => !allowed.has(positionId))

    if (removedUsedPosition) {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_LINE_IN_USE_CANNOT_REMOVE_POSITION",
            messageKey: "errors.organization.line.inUseCannotRemovePosition",
            fields: {
                positionIds: ["errors.organization.line.inUseCannotRemovePosition"],
            },
        })
    }
}

async function ensureLineNotUsed(lineId) {
    const used = await Employee.exists({
        lineId,
        recordStatus: "ACTIVE",
    })

    if (!used) return

    throw new AppError({
        statusCode: 409,
        code: "ORGANIZATION_LINE_IN_USE_CANNOT_ARCHIVE",
        messageKey: "errors.organization.line.inUseCannotArchive",
    })
}

export async function listLines({ query, user }) {
    const cacheKey = `line:list:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cachedResult = getCache(cacheKey)
    if (cachedResult) return cachedResult

    const andFilters = [
        getLineScopeFilter(user),
        buildLineSearchFilter(query.search),
    ].filter(nonEmptyFilter)

    const filter = andFilters.length ? { $and: andFilters } : {}

    if (query.companyId) {
        await ensureCompanyExists({ companyId: query.companyId, user })
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
        const departmentPositionFilter = {
            departmentId: query.departmentId,
            status: { $ne: "ARCHIVED" },
        }
        if (query.companyId) departmentPositionFilter.companyId = query.companyId
        if (query.branchId) departmentPositionFilter.branchId = query.branchId

        const departmentPositionIds = await Position.find(
            departmentPositionFilter,
        ).distinct("_id")

        if (!filter.$and) filter.$and = []
        filter.$and.push({
            $or: [
                { positionIds: { $in: departmentPositionIds } },
                { positionId: { $in: departmentPositionIds } },
            ],
        })
    }

    if (query.positionId) {
        if (!filter.$and) filter.$and = []
        filter.$and.push({
            $or: [
                { positionIds: query.positionId },
                { positionId: query.positionId },
            ],
        })
    }

    if (query.status !== "ALL") filter.status = query.status

    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const populate = [
        { path: "companyId", select: "code displayName legalName status" },
        { path: "branchId", select: "companyId code name status isHeadOffice" },
        { path: "departmentId", select: "companyId branchId code name status" },
        {
            path: "positionIds",
            select: "companyId branchId departmentId code title status",
            populate: { path: "departmentId", select: "companyId branchId code name status" },
        },
        {
            path: "positionId",
            select: "companyId branchId departmentId code title status",
            populate: { path: "departmentId", select: "companyId branchId code name status" },
        },
    ]

    const [items, total] = await Promise.all([
        Line.find(filter)
            .populate(populate)
            .sort({
                [query.sortBy]: query.sortOrder === "desc" ? -1 : 1,
                _id: 1,
            })
            .skip(skip)
            .limit(limit)
            .lean(),
        Line.countDocuments(filter),
    ])

    const result = {
        items: items.map(serializeLine),
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

export async function getLineById({ lineId, user }) {
    ensureValidObjectId(
        lineId,
        "ORGANIZATION_LINE_INVALID_ID",
        "errors.organization.line.invalidId",
    )

    const line = await Line.findOne({
        _id: lineId,
        ...getLineScopeFilter(user),
    })
        .populate({ path: "companyId", select: "code displayName legalName status" })
        .populate({ path: "branchId", select: "companyId code name status isHeadOffice" })
        .populate({ path: "departmentId", select: "companyId branchId code name status" })
        .populate({
            path: "positionIds",
            select: "companyId branchId departmentId code title status",
            populate: { path: "departmentId", select: "companyId branchId code name status" },
        })
        .populate({
            path: "positionId",
            select: "companyId branchId departmentId code title status",
            populate: { path: "departmentId", select: "companyId branchId code name status" },
        })
        .lean()

    if (!line) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_LINE_NOT_FOUND",
            messageKey: "errors.organization.line.notFound",
        })
    }

    return serializeLine(line)
}

export async function createLine({ payload, user }) {
    await ensureCompanyExists({ companyId: payload.companyId, user })
    await ensureBranchExists({
        companyId: payload.companyId,
        branchId: payload.branchId,
        user,
    })

    const positionIds = uniqueIds(payload.positionIds)
    await ensureLineAssociation({
        companyId: payload.companyId,
        branchId: payload.branchId,
        positionIds,
    })

    const duplicate = await Line.exists({
        companyId: payload.companyId,
        branchId: payload.branchId,
        code: payload.code,
        status: { $ne: "ARCHIVED" },
    })
    if (duplicate) throwLineCodeExists()

    try {
        const line = await Line.create({
            companyId: payload.companyId,
            branchId: payload.branchId,
            positionIds,
            code: payload.code,
            name: payload.name,
            description: payload.description || "",
            status: payload.status || "ACTIVE",
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        clearCacheByPrefix("line:list:")
        clearCacheByPrefix("excome:")

        return getLineById({ lineId: line._id, user })
    } catch (error) {
        handleDuplicateError(error)
    }
}

export async function updateLine({ lineId, payload, user }) {
    ensureValidObjectId(
        lineId,
        "ORGANIZATION_LINE_INVALID_ID",
        "errors.organization.line.invalidId",
    )

    const existingLine = await Line.findOne({
        _id: lineId,
        ...getLineScopeFilter(user),
    }).lean()

    if (!existingLine) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_LINE_NOT_FOUND",
            messageKey: "errors.organization.line.notFound",
        })
    }
    if (existingLine.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_LINE_ARCHIVED",
            messageKey: "errors.organization.line.archived",
        })
    }

    const previousPositionIds = effectivePositionIds(existingLine)
    const positionIds = payload.positionIds
        ? uniqueIds(payload.positionIds)
        : previousPositionIds

    if (!positionIds.length) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_LINE_POSITION_REQUIRED",
            messageKey: "errors.organization.line.positionRequired",
            fields: {
                positionIds: ["errors.organization.line.positionRequired"],
            },
        })
    }

    await ensureLineAssociation({
        companyId: existingLine.companyId,
        branchId: existingLine.branchId,
        positionIds,
    })

    const positionsChanged = !sameIdSet(positionIds, previousPositionIds)

    if (positionsChanged) {
        await ensurePositionRemovalIsSafe({
            lineId: existingLine._id,
            newPositionIds: positionIds,
        })
    }

    const effectiveCode = payload.code || existingLine.code
    const duplicate = await Line.exists({
        _id: { $ne: existingLine._id },
        companyId: existingLine.companyId,
        branchId: existingLine.branchId,
        code: effectiveCode,
        status: { $ne: "ARCHIVED" },
    })
    if (duplicate) throwLineCodeExists()

    const $set = {
        updatedByAccountId: user.accountId,
        positionIds,
    }

    for (const field of ["code", "name", "description", "status"]) {
        if (payload[field] !== undefined) $set[field] = payload[field]
    }

    try {
        const updatedLine = await Line.findByIdAndUpdate(
            existingLine._id,
            {
                $set,
                $unset: { positionId: "", departmentId: "" },
            },
            { new: true, runValidators: true, context: "query" },
        ).lean()

        clearCacheByPrefix("line:list:")
        clearCacheByPrefix("excome:")

        return getLineById({ lineId: updatedLine._id, user })
    } catch (error) {
        handleDuplicateError(error)
    }
}

export async function archiveLine({ lineId, user }) {
    ensureValidObjectId(
        lineId,
        "ORGANIZATION_LINE_INVALID_ID",
        "errors.organization.line.invalidId",
    )

    const existingLine = await Line.findOne({
        _id: lineId,
        ...getLineScopeFilter(user),
    }).lean()

    if (!existingLine) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_LINE_NOT_FOUND",
            messageKey: "errors.organization.line.notFound",
        })
    }

    await ensureLineNotUsed(existingLine._id)

    const archivedLine = await Line.findByIdAndUpdate(
        existingLine._id,
        {
            $set: {
                status: "ARCHIVED",
                updatedByAccountId: user.accountId,
            },
        },
        { new: true, runValidators: true, context: "query" },
    ).lean()

    clearCacheByPrefix("line:list:")
    clearCacheByPrefix("excome:")

    return getLineById({ lineId: archivedLine._id, user })
}
