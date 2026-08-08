import { apiClient } from "@/shared/services/apiClient.js"

const RECRUITMENT_CHANNEL_ENDPOINT = "/organization/recruitment-channels"

function cleanParams(params = {}) {
    const clean = {}

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") continue
        clean[key] = value
    }

    return clean
}

function normalizeRecruitmentChannel(item) {
    if (!item || typeof item !== "object") return item

    return {
        ...item,
        id: item.id || item._id || null,
        companyId:
            item.companyId?.id || item.companyId?._id || item.companyId || null,
        branchId:
            item.branchId?.id || item.branchId?._id || item.branchId || null,
    }
}

function normalizeListResult(result = {}) {
    const pagination = result.pagination || {}

    return {
        ...result,
        items: (result.items || []).map(normalizeRecruitmentChannel),
        pagination: {
            page: Number(pagination.page || 1),
            limit: Number(pagination.limit || 10),
            total: Number(pagination.total || 0),
            totalPages: Number(
                pagination.totalPages ?? pagination.pages ?? 0,
            ),
            hasNext: Boolean(pagination.hasNext),
            hasPrevious: Boolean(pagination.hasPrevious),
        },
    }
}

export async function fetchRecruitmentChannels(params = {}) {
    const response = await apiClient.get(RECRUITMENT_CHANNEL_ENDPOINT, {
        params: cleanParams(params),
    })

    return normalizeListResult(response.data.data || {})
}

export async function fetchRecruitmentChannelById(recruitmentChannelId) {
    const response = await apiClient.get(
        `${RECRUITMENT_CHANNEL_ENDPOINT}/${recruitmentChannelId}`,
    )

    return normalizeRecruitmentChannel(
        response.data.data?.recruitmentChannel,
    )
}

export async function createRecruitmentChannel(payload) {
    const response = await apiClient.post(RECRUITMENT_CHANNEL_ENDPOINT, payload)

    return normalizeRecruitmentChannel(
        response.data.data?.recruitmentChannel,
    )
}

export async function updateRecruitmentChannel(recruitmentChannelId, payload) {
    const response = await apiClient.patch(
        `${RECRUITMENT_CHANNEL_ENDPOINT}/${recruitmentChannelId}`,
        payload,
    )

    return normalizeRecruitmentChannel(
        response.data.data?.recruitmentChannel,
    )
}

export async function archiveRecruitmentChannel(recruitmentChannelId) {
    const response = await apiClient.patch(
        `${RECRUITMENT_CHANNEL_ENDPOINT}/${recruitmentChannelId}/archive`,
    )

    return normalizeRecruitmentChannel(
        response.data.data?.recruitmentChannel,
    )
}
