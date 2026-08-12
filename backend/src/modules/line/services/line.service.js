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
        companyId: branch.companyId?.toString?.() || branch.companyId,
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
        companyId: department.companyId?.toString?.() || department.companyId,
        branchId: department.branchId?.toString?.() || department.branchId,
        code: department.code,
        name: department.name,
        status: department.status,
    }
}

function serializePosition(position) {
    if (!position || typeof position !== "object") return null
    return {
        id: position._id?.toString?.() || position.id,
        companyId: position.companyId?.toString?.() || position.companyId,
        branchId: position.branchId?.toString?.() || position.branchId,
        departmentId: position.departmentId?.toString?.() || position.departmentId,
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
    const department = raw.departmentId && typeof raw.departmentId === "object"
        ? serializeDepartment(raw.departmentId)
        : null
    const position = raw.positionId && typeof raw.positionId === "object"
        ? serializePosition(raw.positionId)
        : null

    return {
        id: raw._id?.toString?.() || raw.id,
        companyId: company?.id || raw.companyId?.toString?.() || raw.companyId,
        branchId: branch?.id || raw.branchId?.toString?.() || raw.branchId,
        departmentId: department?.id || raw.departmentId?.toString?.() || raw.departmentId,
        positionId: position?.id || raw.positionId?.toString?.() || raw.positionId,
        code: raw.code,
        name: raw.name,
        description: raw.description || "",
        status: raw.status,
        company,
        branch,
        department,
        position,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

function buildUpdatePayload(payload, accountId) {
    const updatePayload = { updatedByAccountId: accountId }
    for (const field of [
        "departmentId",
        "positionId",
        "code",
        "name",
        "description",
        "status",
    ]) {
        if (payload[field] !== undefined) updatePayload[field] = payload[field]
    }
    return updatePayload
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

async function ensureDepartmentExists({ companyId, branchId, departmentId }) {
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
    }).lean()

    if (!department) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_LINE_DEPARTMENT_NOT_FOUND",
            messageKey: "errors.organization.line.departmentNotFound",
            fields: { departmentId: ["errors.organization.line.departmentNotFound"] },
        })
    }
    return department
}

async function ensurePositionExists({ companyId, branchId, departmentId, positionId }) {
    ensureValidObjectId(
        positionId,
        "ORGANIZATION_POSITION_INVALID_ID",
        "errors.organization.position.invalidId",
    )

    const position = await Position.findOne({
        _id: positionId,
        companyId,
        branchId,
        departmentId,
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!position) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_LINE_POSITION_NOT_FOUND",
            messageKey: "errors.organization.line.positionNotFound",
            fields: { positionId: ["errors.organization.line.positionNotFound"] },
        })
    }
    return position
}

async function ensureLineAssociation({ companyId, branchId, departmentId, positionId }) {
    const [department, position] = await Promise.all([
        ensureDepartmentExists({ companyId, branchId, departmentId }),
        ensurePositionExists({ companyId, branchId, departmentId, positionId }),
    ])
    return { department, position }
}

async function ensureLineNotUsed(lineId, { forArchive = false } = {}) {
    const used = await Employee.exists({
        lineId,
        recordStatus: "ACTIVE",
    })

    if (!used) return

    throw new AppError({
        statusCode: 409,
        code: forArchive
            ? "ORGANIZATION_LINE_IN_USE_CANNOT_ARCHIVE"
            : "ORGANIZATION_LINE_IN_USE_CANNOT_REASSIGN",
        messageKey: forArchive
            ? "errors.organization.line.inUseCannotArchive"
            : "errors.organization.line.inUseCannotReassign",
    })
}

export async function listLines({ query, user }) {
    const cacheKey = `line:list:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cachedResult = getCache(cacheKey)
    if (cachedResult) return cachedResult

    const filter = {
        ...getLineScopeFilter(user),
        ...buildLineSearchFilter(query.search),
    }

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

    if (query.departmentId) filter.departmentId = query.departmentId
    if (query.positionId) filter.positionId = query.positionId
    if (query.status !== "ALL") filter.status = query.status

    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const populate = [
        { path: "companyId", select: "code displayName legalName status" },
        { path: "branchId", select: "companyId code name status isHeadOffice" },
        { path: "departmentId", select: "companyId branchId code name status" },
        { path: "positionId", select: "companyId branchId departmentId code title status" },
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
        .populate({ path: "positionId", select: "companyId branchId departmentId code title status" })
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
    await ensureLineAssociation({
        companyId: payload.companyId,
        branchId: payload.branchId,
        departmentId: payload.departmentId,
        positionId: payload.positionId,
    })

    const duplicate = await Line.exists({
        companyId: payload.companyId,
        branchId: payload.branchId,
        departmentId: payload.departmentId,
        positionId: payload.positionId,
        code: payload.code,
        status: { $ne: "ARCHIVED" },
    })
    if (duplicate) throwLineCodeExists()

    try {
        const line = await Line.create({
            companyId: payload.companyId,
            branchId: payload.branchId,
            departmentId: payload.departmentId,
            positionId: payload.positionId,
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

    const departmentId = payload.departmentId || existingLine.departmentId
    const positionId = payload.positionId || existingLine.positionId

    // Existing development data may pre-date the Position-owned Line rule.
    // Editing such a row requires HR to assign both values once.
    if (!departmentId || !positionId) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_LINE_POSITION_REQUIRED",
            messageKey: "errors.organization.line.positionRequired",
            fields: {
                departmentId: ["errors.organization.line.departmentRequired"],
                positionId: ["errors.organization.line.positionRequired"],
            },
        })
    }

    await ensureLineAssociation({
        companyId: existingLine.companyId,
        branchId: existingLine.branchId,
        departmentId,
        positionId,
    })

    const associationChanged =
        String(departmentId) !== String(existingLine.departmentId || "") ||
        String(positionId) !== String(existingLine.positionId || "")

    if (associationChanged) {
        await ensureLineNotUsed(existingLine._id)
    }

    const effectiveCode = payload.code || existingLine.code
    const duplicate = await Line.exists({
        _id: { $ne: existingLine._id },
        companyId: existingLine.companyId,
        branchId: existingLine.branchId,
        departmentId,
        positionId,
        code: effectiveCode,
        status: { $ne: "ARCHIVED" },
    })
    if (duplicate) throwLineCodeExists()

    try {
        const updatedLine = await Line.findByIdAndUpdate(
            existingLine._id,
            { $set: buildUpdatePayload(payload, user.accountId) },
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

    await ensureLineNotUsed(existingLine._id, { forArchive: true })

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
