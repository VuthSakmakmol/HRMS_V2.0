import { apiClient } from "@/shared/services/apiClient.js"

const BASE_URL = "/organization/exit-reasons"

function cleanParams(params = {}) {
    const clean = {}

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") continue
        clean[key] = value
    }

    return clean
}

export async function fetchExitReasons(params = {}) {
    const response = await apiClient.get(BASE_URL, {
        params: cleanParams(params),
    })

    return response.data.data
}

export async function lookupExitReasons(params = {}) {
    const response = await apiClient.get(`${BASE_URL}/lookup`, {
        params: cleanParams(params),
    })

    return response.data.data
}

export async function createExitReason(payload) {
    const response = await apiClient.post(BASE_URL, payload)

    return response.data.data.exitReason
}

export async function updateExitReason(exitReasonId, payload) {
    const response = await apiClient.patch(`${BASE_URL}/${exitReasonId}`, payload)

    return response.data.data.exitReason
}

export async function archiveExitReason(exitReasonId) {
    const response = await apiClient.patch(`${BASE_URL}/${exitReasonId}/archive`)

    return response.data.data.exitReason
}
