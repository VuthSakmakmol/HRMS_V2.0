import { Types } from "mongoose"

import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"
import Branch from "../../organization/models/Branch.js"
import Company from "../../organization/models/Company.js"
import RecruitmentChannel from "../models/recruitmentChannel.js"

function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function toId(value) {
    return value?._id?.toString?.() || value?.id?.toString?.() || value?.toString?.() || null
}

function ensureValidObjectId(id) {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError({
            statusCode: 400,
            code: "RECRUITMENT_CHANNEL_INVALID_ID",
            messageKey: "errors.organization.recruitmentChannel.invalidId",
        })
    }
}

function hasGlobalScope(user) {
    return Boolean(
        user?.isRootAdmin ||
            (user?.roleAssignments || []).some(
                (assignment) => assignment.roleScope === "GLOBAL",
            ),
    )
}

function getUserCompanyIds(user) {
    return [
        ...new Set(
            (user?.roleAssignments || [])
                .map((assignment) => toId(assignment.companyId))
                .filter(Boolean),
        ),
    ]
}

function getUserBranchIds(user) {
    return [
        ...new Set(
            (user?.roleAssignments || [])
                .flatMap((assignment) => assignment.branchIds || [])
                .map((branchId) => toId(branchId))
                .filter(Boolean),
        ),
    ]
}

function getAllBranchCompanyIds(user) {
    return [
        ...new Set(
            (user?.roleAssignments || [])
                .filter((assignment) => assignment.allBranches && assignment.companyId)
                .map((assignment) => toId(assignment.companyId))
                .filter(Boolean),
        ),
    ]
}

function getRecruitmentChannelScopeFilter(user) {
    if (hasGlobalScope(user)) {
        return {}
    }

    const companyIds = getUserCompanyIds(user)
    const branchIds = getUserBranchIds(user)
    const allBranchCompanyIds = getAllBranchCompanyIds(user)
    const filters = [{ companyId: null, branchId: null }]

    if (companyIds.length > 0) {
        filters.push({
            companyId: { $in: companyIds },
            branchId: null,
        })
    }

    if (allBranchCompanyIds.length > 0) {
        filters.push({
            companyId: { $in: allBranchCompanyIds },
        })
    }

    if (branchIds.length > 0) {
        filters.push({
            branchId: { $in: branchIds },
        })
    }

    return { $or: filters }
}

function ensureUserCanManageScope({ companyId, branchId, user }) {
    if (hasGlobalScope(user)) {
        return
    }

    if (!companyId) {
        throw new AppError({
            statusCode: 403,
            code: "ACCESS_PERMISSION_DENIED",
            messageKey: "errors.permissionDenied",
        })
    }

    const normalizedCompanyId = toId(companyId)
    const normalizedBranchId = toId(branchId)
    const assignments = user?.roleAssignments || []

    const companyAssignments = assignments.filter(
        (assignment) => toId(assignment.companyId) === normalizedCompanyId,
    )

    if (companyAssignments.length === 0) {
        throw new AppError({
            statusCode: 403,
            code: "ACCESS_PERMISSION_DENIED",
            messageKey: "errors.permissionDenied",
        })
    }

    if (!normalizedBranchId) {
        const companyLevelAllowed = companyAssignments.some(
            (assignment) => assignment.roleScope === "COMPANY",
        )

        if (!companyLevelAllowed) {
            throw new AppError({
                statusCode: 403,
                code: "ACCESS_PERMISSION_DENIED",
                messageKey: "errors.permissionDenied",
            })
        }

        return
    }

    const branchAllowed = companyAssignments.some(
        (assignment) =>
            (assignment.roleScope === "COMPANY" && assignment.allBranches) ||
            (assignment.branchIds || []).some(
                (allowedBranchId) => toId(allowedBranchId) === normalizedBranchId,
            ),
    )

    if (!branchAllowed) {
        throw new AppError({
            statusCode: 403,
            code: "ACCESS_PERMISSION_DENIED",
            messageKey: "errors.permissionDenied",
        })
    }
}

function serializeCompany(company) {
    if (!company || typeof company !== "object") return null

    return {
        id: toId(company),
        code: company.code || "",
        displayName: company.displayName || "",
        legalName: company.legalName || "",
        status: company.status || "",
    }
}

function serializeBranch(branch) {
    if (!branch || typeof branch !== "object") return null

    return {
        id: toId(branch),
        companyId: toId(branch.companyId),
        code: branch.code || "",
        name: branch.name || "",
        status: branch.status || "",
        isHeadOffice: Boolean(branch.isHeadOffice),
    }
}

export function serializeRecruitmentChannel(recruitmentChannel) {
    if (!recruitmentChannel) return null

    const raw =
        typeof recruitmentChannel.toObject === "function"
            ? recruitmentChannel.toObject()
            : { ...recruitmentChannel }

    const populatedCompany =
        raw.companyId && typeof raw.companyId === "object"
            ? serializeCompany(raw.companyId)
            : null

    const populatedBranch =
        raw.branchId && typeof raw.branchId === "object"
            ? serializeBranch(raw.branchId)
            : null

    return {
        id: toId(raw._id || raw.id),
        companyId: populatedCompany?.id || toId(raw.companyId),
        branchId: populatedBranch?.id || toId(raw.branchId),
        company: populatedCompany,
        branch: populatedBranch,
        code: raw.code || "",
        name: raw.name || "",
        shortName: raw.shortName || "",
        targetMonthly: Number(raw.targetMonthly || 0),
        sortOrder: Number(raw.sortOrder || 0),
        description: raw.description || "",
        status: raw.status || "ACTIVE",
        createdAt: raw.createdAt || null,
        updatedAt: raw.updatedAt || null,
    }
}

function buildMatch({ query = {}, user }) {
    const clauses = []
    const scopeFilter = getRecruitmentChannelScopeFilter(user)

    if (Object.keys(scopeFilter).length > 0) {
        clauses.push(scopeFilter)
    }

    if (query.companyId) clauses.push({ companyId: query.companyId })
    if (query.branchId) clauses.push({ branchId: query.branchId })
    if (query.status && query.status !== "ALL") clauses.push({ status: query.status })

    if (query.search) {
        const regex = new RegExp(escapeRegExp(query.search), "i")
        clauses.push({
            $or: [
                { code: regex },
                { name: regex },
                { shortName: regex },
                { description: regex },
            ],
        })
    }

    if (clauses.length === 0) return {}
    if (clauses.length === 1) return clauses[0]

    return { $and: clauses }
}

async function ensureScopeReferences({ companyId, branchId, user }) {
    const normalizedCompanyId = companyId || null
    const normalizedBranchId = branchId || null

    if (normalizedBranchId && !normalizedCompanyId) {
        throw new AppError({
            statusCode: 422,
            code: "RECRUITMENT_CHANNEL_COMPANY_REQUIRED_FOR_BRANCH",
            messageKey: "errors.organization.recruitmentChannel.companyRequiredForBranch",
            fields: {
                companyId: [
                    "errors.organization.recruitmentChannel.companyRequiredForBranch",
                ],
            },
        })
    }

    ensureUserCanManageScope({
        companyId: normalizedCompanyId,
        branchId: normalizedBranchId,
        user,
    })

    if (!normalizedCompanyId) {
        return {
            company: null,
            branch: null,
        }
    }

    ensureValidObjectId(normalizedCompanyId)

    const company = await Company.findOne({
        _id: normalizedCompanyId,
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!company) {
        throw new AppError({
            statusCode: 422,
            code: "RECRUITMENT_CHANNEL_COMPANY_NOT_FOUND",
            messageKey: "errors.organization.recruitmentChannel.companyNotFound",
            fields: {
                companyId: ["errors.organization.recruitmentChannel.companyNotFound"],
            },
        })
    }

    if (!normalizedBranchId) {
        return { company, branch: null }
    }

    ensureValidObjectId(normalizedBranchId)

    const branch = await Branch.findOne({
        _id: normalizedBranchId,
        companyId: normalizedCompanyId,
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!branch) {
        throw new AppError({
            statusCode: 422,
            code: "RECRUITMENT_CHANNEL_BRANCH_NOT_FOUND",
            messageKey: "errors.organization.recruitmentChannel.branchNotFound",
            fields: {
                branchId: ["errors.organization.recruitmentChannel.branchNotFound"],
            },
        })
    }

    return { company, branch }
}

function duplicateCodeError() {
    return new AppError({
        statusCode: 409,
        code: "RECRUITMENT_CHANNEL_CODE_EXISTS",
        messageKey: "errors.organization.recruitmentChannel.codeExists",
        fields: {
            code: ["errors.organization.recruitmentChannel.codeExists"],
        },
    })
}

function handleDuplicateError(error) {
    if (error?.code === 11000) {
        throw duplicateCodeError()
    }

    throw error
}

function clearRecruitmentChannelCaches() {
    clearCacheByPrefix("recruitment-channel:")
    clearCacheByPrefix("excome:")
    clearCacheByPrefix("hr-dashboard:data:")
    clearCacheByPrefix("hr-dashboard:lookups:")
}

async function loadRecruitmentChannelById({ recruitmentChannelId, user, includeArchived = false }) {
    ensureValidObjectId(recruitmentChannelId)

    const match = {
        _id: recruitmentChannelId,
        ...getRecruitmentChannelScopeFilter(user),
    }

    if (!includeArchived) {
        match.status = { $ne: "ARCHIVED" }
    }

    const recruitmentChannel = await RecruitmentChannel.findOne(match)
        .populate({
            path: "companyId",
            select: "code displayName legalName status",
        })
        .populate({
            path: "branchId",
            select: "companyId code name status isHeadOffice",
        })
        .lean()

    if (!recruitmentChannel) {
        throw new AppError({
            statusCode: 404,
            code: "RECRUITMENT_CHANNEL_NOT_FOUND",
            messageKey: "errors.organization.recruitmentChannel.notFound",
        })
    }

    return serializeRecruitmentChannel(recruitmentChannel)
}

export async function listRecruitmentChannels({ query, user }) {
    const page = Number(query.page) || 1
    const limit = Number(query.limit) || 10
    const skip = (page - 1) * limit
    const match = buildMatch({ query, user })

    const [rows, total] = await Promise.all([
        RecruitmentChannel.find(match)
            .populate({
                path: "companyId",
                select: "code displayName legalName status",
            })
            .populate({
                path: "branchId",
                select: "companyId code name status isHeadOffice",
            })
            .sort({ sortOrder: 1, name: 1, code: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        RecruitmentChannel.countDocuments(match),
    ])

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

    return {
        items: rows.map(serializeRecruitmentChannel),
        pagination: {
            page,
            limit,
            total,
            totalPages,
            pages: totalPages,
            hasNext: page * limit < total,
            hasPrevious: page > 1,
        },
    }
}

export async function getRecruitmentChannelById({ recruitmentChannelId, user }) {
    return loadRecruitmentChannelById({
        recruitmentChannelId,
        user,
    })
}

export async function createRecruitmentChannel({ payload, user }) {
    await ensureScopeReferences({
        companyId: payload.companyId,
        branchId: payload.branchId,
        user,
    })

    const duplicate = await RecruitmentChannel.exists({
        companyId: payload.companyId || null,
        branchId: payload.branchId || null,
        code: payload.code,
    })

    if (duplicate) {
        throw duplicateCodeError()
    }

    try {
        const created = await RecruitmentChannel.create({
            companyId: payload.companyId || null,
            branchId: payload.branchId || null,
            code: payload.code,
            name: payload.name,
            shortName: payload.shortName || "",
            targetMonthly: Number(payload.targetMonthly || 0),
            sortOrder: Number(payload.sortOrder || 0),
            description: payload.description || "",
            status: payload.status || "ACTIVE",
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        clearRecruitmentChannelCaches()

        return loadRecruitmentChannelById({
            recruitmentChannelId: created._id,
            user,
        })
    } catch (error) {
        handleDuplicateError(error)
    }
}

export async function updateRecruitmentChannel({ recruitmentChannelId, payload, user }) {
    ensureValidObjectId(recruitmentChannelId)

    const existing = await RecruitmentChannel.findOne({
        _id: recruitmentChannelId,
        ...getRecruitmentChannelScopeFilter(user),
    }).lean()

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "RECRUITMENT_CHANNEL_NOT_FOUND",
            messageKey: "errors.organization.recruitmentChannel.notFound",
        })
    }

    if (existing.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "RECRUITMENT_CHANNEL_ARCHIVED",
            messageKey: "errors.organization.recruitmentChannel.archived",
        })
    }

    const nextCompanyId =
        Object.prototype.hasOwnProperty.call(payload, "companyId")
            ? payload.companyId || null
            : existing.companyId || null
    const nextBranchId =
        Object.prototype.hasOwnProperty.call(payload, "branchId")
            ? payload.branchId || null
            : existing.branchId || null
    const nextCode = payload.code ?? existing.code

    await ensureScopeReferences({
        companyId: nextCompanyId,
        branchId: nextBranchId,
        user,
    })

    const duplicate = await RecruitmentChannel.exists({
        _id: { $ne: existing._id },
        companyId: nextCompanyId,
        branchId: nextBranchId,
        code: nextCode,
    })

    if (duplicate) {
        throw duplicateCodeError()
    }

    const updatePayload = {
        companyId: nextCompanyId,
        branchId: nextBranchId,
        updatedByAccountId: user.accountId,
    }

    for (const field of [
        "code",
        "name",
        "shortName",
        "targetMonthly",
        "sortOrder",
        "description",
        "status",
    ]) {
        if (Object.prototype.hasOwnProperty.call(payload, field)) {
            updatePayload[field] = payload[field]
        }
    }

    try {
        const updated = await RecruitmentChannel.findByIdAndUpdate(
            existing._id,
            { $set: updatePayload },
            {
                new: true,
                runValidators: true,
                context: "query",
            },
        ).lean()

        if (!updated) {
            throw new AppError({
                statusCode: 404,
                code: "RECRUITMENT_CHANNEL_NOT_FOUND",
                messageKey: "errors.organization.recruitmentChannel.notFound",
            })
        }

        clearRecruitmentChannelCaches()

        return loadRecruitmentChannelById({
            recruitmentChannelId: updated._id,
            user,
        })
    } catch (error) {
        handleDuplicateError(error)
    }
}

export async function archiveRecruitmentChannel({ recruitmentChannelId, user }) {
    ensureValidObjectId(recruitmentChannelId)

    const existing = await RecruitmentChannel.findOne({
        _id: recruitmentChannelId,
        ...getRecruitmentChannelScopeFilter(user),
    }).lean()

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "RECRUITMENT_CHANNEL_NOT_FOUND",
            messageKey: "errors.organization.recruitmentChannel.notFound",
        })
    }

    if (existing.status === "ARCHIVED") {
        return serializeRecruitmentChannel(existing)
    }

    const archived = await RecruitmentChannel.findByIdAndUpdate(
        existing._id,
        {
            $set: {
                status: "ARCHIVED",
                updatedByAccountId: user.accountId,
            },
        },
        {
            new: true,
            runValidators: true,
            context: "query",
        },
    ).lean()

    clearRecruitmentChannelCaches()

    return serializeRecruitmentChannel(archived)
}
