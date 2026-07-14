import { Types } from "mongoose"

import { AppError } from "../../../shared/errors/AppError.js"
import { buildPagination } from "../../../shared/http/pagination.js"
import Company from "../models/Company.js"

const COMPANY_SORT_FIELDS = new Set([
    "code",
    "legalName",
    "displayName",
    "status",
    "createdAt",
    "updatedAt",
])

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function serializeCompany(company) {
    if (!company) {
        return null
    }

    if (typeof company.toJSON === "function") {
        return company.toJSON()
    }

    return {
        ...company,
        id: company._id?.toString?.() || company.id,
        _id: undefined,
    }
}

function ensureValidObjectId(companyId) {
    if (!Types.ObjectId.isValid(companyId)) {
        throw new AppError({
            statusCode: 400,
            code: "ORGANIZATION_COMPANY_INVALID_ID",
            messageKey: "errors.organization.company.invalidId",
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
    if (user?.isRootAdmin) {
        return {}
    }

    const hasGlobalScope = (user?.roleAssignments || []).some(
        (assignment) => assignment.roleScope === "GLOBAL",
    )

    if (hasGlobalScope) {
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

function buildCompanySearchFilter(search) {
    const normalizedSearch = String(search || "").trim()

    if (!normalizedSearch) {
        return {}
    }

    const searchRegex = new RegExp(escapeRegExp(normalizedSearch), "i")

    return {
        $or: [
            { code: searchRegex },
            { legalName: searchRegex },
            { displayName: searchRegex },
            { registrationNumber: searchRegex },
            { taxNumber: searchRegex },
        ],
    }
}

function buildCompanySort(query) {
    const sortBy = COMPANY_SORT_FIELDS.has(query.sortBy)
        ? query.sortBy
        : "displayName"
    const direction = query.sortOrder === "desc" ? -1 : 1

    return {
        [sortBy]: direction,
        _id: direction,
    }
}

function buildCompanyUpdatePayload(payload, accountId) {
    const updatePayload = {
        updatedByAccountId: accountId,
    }

    for (const field of [
        "code",
        "legalName",
        "displayName",
        "registrationNumber",
        "taxNumber",
        "status",
    ]) {
        if (payload[field] !== undefined) {
            updatePayload[field] = payload[field]
        }
    }

    for (const [groupName, groupValue] of [
        ["settings", payload.settings],
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

function handleDuplicateCompanyError(error) {
    if (error?.code !== 11000) {
        throw error
    }

    if (error?.keyPattern?.code || error?.keyValue?.code) {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_COMPANY_CODE_EXISTS",
            messageKey: "errors.organization.company.codeExists",
            fields: {
                code: ["errors.organization.company.codeExists"],
            },
        })
    }

    throw new AppError({
        statusCode: 409,
        code: "ORGANIZATION_COMPANY_DUPLICATE",
        messageKey: "errors.organization.company.duplicate",
    })
}

export async function listCompanies({ query, user }) {
    const filter = {
        ...getCompanyScopeFilter(user),
        ...buildCompanySearchFilter(query.search),
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
        Company.find(filter)
            .sort(buildCompanySort(query))
            .skip(skip)
            .limit(limit)
            .lean(),
        Company.countDocuments(filter),
    ])

    return {
        items: items.map(serializeCompany),
        pagination: buildPagination({ page, limit, total }),
    }
}

export async function lookupCompanies({ query, user }) {
    const result = await listCompanies({
        query: {
            ...query,
            page: 1,
            limit: Math.min(query.limit || 100, 100),
            status: "ACTIVE",
            sortBy: query.sortBy || "displayName",
            sortOrder: query.sortOrder || "asc",
        },
        user,
    })

    return result.items.map((company) => ({
        id: company.id,
        code: company.code,
        name: company.displayName,
        displayName: company.displayName,
        status: company.status,
    }))
}

export async function getCompanyById({ companyId, user }) {
    ensureValidObjectId(companyId)

    const company = await Company.findOne({
        _id: companyId,
        ...getCompanyScopeFilter(user),
    })

    if (!company) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_COMPANY_NOT_FOUND",
            messageKey: "errors.organization.company.notFound",
        })
    }

    return serializeCompany(company)
}

export async function createCompany({ payload, user }) {
    try {
        const company = await Company.create({
            ...payload,
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        return serializeCompany(company)
    } catch (error) {
        handleDuplicateCompanyError(error)
    }
}

export async function updateCompany({ companyId, payload, user }) {
    ensureValidObjectId(companyId)

    try {
        const company = await Company.findOneAndUpdate(
            {
                _id: companyId,
                ...getCompanyScopeFilter(user),
            },
            {
                $set: buildCompanyUpdatePayload(payload, user.accountId),
            },
            {
                returnDocument: "after",
                runValidators: true,
                context: "query",
            },
        )

        if (!company) {
            throw new AppError({
                statusCode: 404,
                code: "ORGANIZATION_COMPANY_NOT_FOUND",
                messageKey: "errors.organization.company.notFound",
            })
        }

        return serializeCompany(company)
    } catch (error) {
        if (error instanceof AppError) {
            throw error
        }

        handleDuplicateCompanyError(error)
    }
}

export async function archiveCompany({ companyId, user }) {
    ensureValidObjectId(companyId)

    const company = await Company.findOneAndUpdate(
        {
            _id: companyId,
            ...getCompanyScopeFilter(user),
        },
        {
            $set: {
                status: "ARCHIVED",
                updatedByAccountId: user.accountId,
            },
        },
        {
            returnDocument: "after",
            runValidators: true,
            context: "query",
        },
    )

    if (!company) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_COMPANY_NOT_FOUND",
            messageKey: "errors.organization.company.notFound",
        })
    }

    return serializeCompany(company)
}
