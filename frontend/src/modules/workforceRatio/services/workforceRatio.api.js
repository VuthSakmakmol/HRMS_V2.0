import { apiClient } from "@/shared/services/apiClient.js"

const BASE_URL = "/reports/workforce-ratio-setups"

function cleanParams(params = {}) {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) =>
            value !== undefined && value !== null && value !== "",
        ),
    )
}

export async function fetchCurrentWorkforceRatio(params = {}) {
    const response = await apiClient.get(`${BASE_URL}/current`, {
        params: cleanParams(params),
    })

    return response.data.data
}

export async function fetchWorkforceRatioEmployeeTypes(params = {}) {
    const response = await apiClient.get(`${BASE_URL}/employee-types`, {
        params: cleanParams(params),
    })

    return response.data.data
}

export async function createWorkforceRatio(payload) {
    const response = await apiClient.post(BASE_URL, payload)
    return response.data.data.setup
}

export async function updateWorkforceRatio(workforceRatioId, payload) {
    const response = await apiClient.patch(
        `${BASE_URL}/${workforceRatioId}`,
        payload,
    )
    return response.data.data.setup
}

export async function archiveWorkforceRatio(workforceRatioId) {
    const response = await apiClient.patch(
        `${BASE_URL}/${workforceRatioId}/archive`,
    )
    return response.data.data.setup
}
