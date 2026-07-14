import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import RecruitmentChannel from "../models/RecruitmentChannel.js"

function buildMatch(query = {}) {
    const match = {}

    if (query.companyId) match.companyId = query.companyId
    if (query.branchId) match.branchId = query.branchId
    if (query.status && query.status !== "ALL") match.status = query.status
    if (query.search) {
        const regex = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
        match.$or = [
            { code: regex },
            { name: regex },
            { shortName: regex },
        ]
    }

    return match
}

function clearDashboardCache() {
    clearCacheByPrefix("hr-dashboard:data:")
    clearCacheByPrefix("hr-dashboard:lookups:")
}

export async function listRecruitmentChannels({ query }) {
    const page = Number(query.page) || 1
    const limit = Number(query.limit) || 20
    const skip = (page - 1) * limit
    const match = buildMatch(query)

    const [items, total] = await Promise.all([
        RecruitmentChannel.find(match)
            .sort({ sortOrder: 1, name: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        RecruitmentChannel.countDocuments(match),
    ])

    return {
        items,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    }
}

export async function getRecruitmentChannelById({ recruitmentChannelId }) {
    const recruitmentChannel = await RecruitmentChannel.findById(recruitmentChannelId).lean()

    if (!recruitmentChannel || recruitmentChannel.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 404,
            code: "RECRUITMENT_CHANNEL_NOT_FOUND",
            messageKey: "errors.organization.recruitmentChannel.notFound",
        })
    }

    return recruitmentChannel
}

export async function createRecruitmentChannel({ payload, user }) {
    const recruitmentChannel = await RecruitmentChannel.create({
        ...payload,
        createdByAccountId: user.accountId,
        updatedByAccountId: user.accountId,
    })

    clearDashboardCache()

    return recruitmentChannel.toJSON()
}

export async function updateRecruitmentChannel({ recruitmentChannelId, payload, user }) {
    const recruitmentChannel = await RecruitmentChannel.findOneAndUpdate(
        {
            _id: recruitmentChannelId,
            status: { $ne: "ARCHIVED" },
        },
        {
            ...payload,
            updatedByAccountId: user.accountId,
        },
        {
            new: true,
            runValidators: true,
        },
    )

    if (!recruitmentChannel) {
        throw new AppError({
            statusCode: 404,
            code: "RECRUITMENT_CHANNEL_NOT_FOUND",
            messageKey: "errors.organization.recruitmentChannel.notFound",
        })
    }

    clearDashboardCache()

    return recruitmentChannel.toJSON()
}

export async function archiveRecruitmentChannel({ recruitmentChannelId, user }) {
    return updateRecruitmentChannel({
        recruitmentChannelId,
        payload: {
            status: "ARCHIVED",
            updatedByAccountId: user.accountId,
        },
        user,
    })
}
