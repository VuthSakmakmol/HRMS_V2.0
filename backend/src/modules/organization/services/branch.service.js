import { Types } from "mongoose"

import { AppError } from "../../../shared/errors/AppError.js"
import { buildPagination } from "../../../shared/http/pagination.js"
import Branch from "../models/Branch.js"
import Company from "../models/Company.js"

const BRANCH_SORT_FIELDS = new Set([
    "code",
    "name",
    "shortName",
    "status",
    "isHeadOffice",
    "createdAt",
    "updatedAt",
])

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

function buildBranchSearchFilter(search) {
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
            { "contact.email": searchRegex },
            { "contact.phone": searchRegex },
            { "address.city": searchRegex },
        ],
    }
}


function buildBranchSort(query) {
    const sortBy = BRANCH_SORT_FIELDS.has(query.sortBy)
        ? query.sortBy
        : "name"
    const direction = query.sortOrder === "desc" ? -1 : 1

    return {
        [sortBy]: direction,
        _id: direction,
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
    if (!branch) {
        return null
    }

    const raw =
        typeof branch.toJSON === "function"
            ? branch.toJSON()
            : {
                  ...branch,
              }

    const populatedCompany =
        raw.companyId && typeof raw.companyId === "object"
            ? serializeCompany(raw.companyId)
            : null

    const branchCompanyId =
        populatedCompany?.id ||
        raw.companyId?.toString?.() ||
        raw.companyId ||
        null

    return {
        id: raw._id?.toString?.() || raw.id,
        companyId: branchCompanyId,
        company: populatedCompany,
        code: raw.code,
        name: raw.name,
        shortName: raw.shortName || "",
        status: raw.status,
        isHeadOffice: Boolean(raw.isHeadOffice),
        timezone: raw.timezone,
        contact: raw.contact || {},
        address: raw.address || {},
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

function buildBranchUpdatePayload(payload, accountId) {
    const updatePayload = {
        updatedByAccountId: accountId,
    }

    for (const field of [
        "code",
        "name",
        "shortName",
        "status",
        "isHeadOffice",
        "timezone",
    ]) {
        if (payload[field] !== undefined) {
            updatePayload[field] = payload[field]
        }
    }

    for (const [groupName, groupValue] of [
        ["contact", payload.contact],
        ["address", payload.address],
    ]) {
        if (!groupValue) {
            continue
        }

        for (const [key, value] of Object.entries(groupValue)) {
            if (value !== undefined) {
                updatePayload[`${groupName}.${key}`] = value
            }
        }
    }

    return updatePayload
}

function handleDuplicateBranchError(error) {
    if (error?.code !== 11000) {
        throw error
    }

    if (error?.keyPattern?.code || error?.keyValue?.code) {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_BRANCH_CODE_EXISTS",
            messageKey: "errors.organization.branch.codeExists",
            fields: {
                code: ["errors.organization.branch.codeExists"],
            },
        })
    }

    if (
        error?.keyPattern?.isHeadOffice ||
        error?.keyValue?.isHeadOffice === true
    ) {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_BRANCH_HEAD_OFFICE_EXISTS",
            messageKey: "errors.organization.branch.headOfficeExists",
            fields: {
                isHeadOffice: [
                    "errors.organization.branch.headOfficeExists",
                ],
            },
        })
    }

    throw new AppError({
        statusCode: 409,
        code: "ORGANIZATION_BRANCH_DUPLICATE",
        messageKey: "errors.organization.branch.duplicate",
    })
}

async function ensureCompanyExistsForBranch({ companyId, user }) {
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

export async function listBranches({ query, user }) {
    const filter = {
        ...getBranchScopeFilter(user),
        ...buildBranchSearchFilter(query.search),
    }

    if (query.companyId) {
        await ensureCompanyExistsForBranch({
            companyId: query.companyId,
            user,
        })

        filter.companyId = query.companyId
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
        Branch.find(filter)
            .populate({
                path: "companyId",
                select: "code displayName legalName status",
            })
            .sort(buildBranchSort(query))
            .skip(skip)
            .limit(limit)
            .lean(),
        Branch.countDocuments(filter),
    ])

    return {
        items: items.map(serializeBranch),
        pagination: buildPagination({ page, limit, total }),
    }
}

export async function lookupBranches({ query, user }) {
    const result = await listBranches({
        query: {
            ...query,
            page: 1,
            limit: Math.min(query.limit || 100, 100),
            status: "ACTIVE",
            sortBy: query.sortBy || "name",
            sortOrder: query.sortOrder || "asc",
        },
        user,
    })

    return result.items.map((branch) => ({
        id: branch.id,
        companyId: branch.companyId,
        code: branch.code,
        name: branch.name,
        shortName: branch.shortName || "",
        status: branch.status,
    }))
}

export async function getBranchById({ branchId, user }) {
    ensureValidObjectId(
        branchId,
        "ORGANIZATION_BRANCH_INVALID_ID",
        "errors.organization.branch.invalidId",
    )

    const branch = await Branch.findOne({
        _id: branchId,
        ...getBranchScopeFilter(user),
    }).populate({
        path: "companyId",
        select: "code displayName legalName status",
    })

    if (!branch) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_BRANCH_NOT_FOUND",
            messageKey: "errors.organization.branch.notFound",
        })
    }

    return serializeBranch(branch)
}

export async function createBranch({ payload, user }) {
    await ensureCompanyExistsForBranch({
        companyId: payload.companyId,
        user,
    })

    try {
        const branch = await Branch.create({
            ...payload,
            status: payload.status || "ACTIVE",
            isHeadOffice: Boolean(payload.isHeadOffice),
            timezone: payload.timezone || "Asia/Phnom_Penh",
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        return await getBranchById({
            branchId: branch._id.toString(),
            user,
        })
    } catch (error) {
        handleDuplicateBranchError(error)
    }
}

export async function updateBranch({ branchId, payload, user }) {
    ensureValidObjectId(
        branchId,
        "ORGANIZATION_BRANCH_INVALID_ID",
        "errors.organization.branch.invalidId",
    )

    try {
        const branch = await Branch.findOneAndUpdate(
            {
                _id: branchId,
                status: { $ne: "ARCHIVED" },
                ...getBranchScopeFilter(user),
            },
            {
                $set: buildBranchUpdatePayload(payload, user.accountId),
            },
            {
                returnDocument: "after",
                runValidators: true,
                context: "query",
            },
        ).populate({
            path: "companyId",
            select: "code displayName legalName status",
        })

        if (!branch) {
            throw new AppError({
                statusCode: 404,
                code: "ORGANIZATION_BRANCH_NOT_FOUND",
                messageKey: "errors.organization.branch.notFound",
            })
        }

        return serializeBranch(branch)
    } catch (error) {
        if (error instanceof AppError) {
            throw error
        }

        handleDuplicateBranchError(error)
    }
}

export async function archiveBranch({ branchId, user }) {
    ensureValidObjectId(
        branchId,
        "ORGANIZATION_BRANCH_INVALID_ID",
        "errors.organization.branch.invalidId",
    )

    const branch = await Branch.findOneAndUpdate(
        {
            _id: branchId,
            ...getBranchScopeFilter(user),
        },
        {
            $set: {
                status: "ARCHIVED",
                isHeadOffice: false,
                updatedByAccountId: user.accountId,
            },
        },
        {
            returnDocument: "after",
            runValidators: true,
            context: "query",
        },
    ).populate({
        path: "companyId",
        select: "code displayName legalName status",
    })

    if (!branch) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_BRANCH_NOT_FOUND",
            messageKey: "errors.organization.branch.notFound",
        })
    }

    return serializeBranch(branch)
}