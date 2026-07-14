import { apiClient } from "@/shared/services/apiClient.js"

const RECRUITMENT_CHANNEL_ENDPOINT = "/organization/recruitment-channels"

function cleanParams(params = {}) {
    const clean = {}

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") {
            continue
        }

        clean[key] = value
    }

    return clean
}

export async function fetchRecruitmentChannels(params = {}) {
    const response = await apiClient.get(RECRUITMENT_CHANNEL_ENDPOINT, {
        params: cleanParams(params),
    })

    return response.data.data
}

export async function createRecruitmentChannel(payload) {
    const response = await apiClient.post(RECRUITMENT_CHANNEL_ENDPOINT, payload)

    return response.data.data.recruitmentChannel
}

export async function updateRecruitmentChannel(recruitmentChannelId, payload) {
    const response = await apiClient.patch(
        `${RECRUITMENT_CHANNEL_ENDPOINT}/${recruitmentChannelId}`,
        payload,
    )

    return response.data.data.recruitmentChannel
}

export async function archiveRecruitmentChannel(recruitmentChannelId) {
    const response = await apiClient.patch(
        `${RECRUITMENT_CHANNEL_ENDPOINT}/${recruitmentChannelId}/archive`,
    )

    return response.data.data.recruitmentChannel
}
