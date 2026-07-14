import { apiClient } from "@/shared/services/apiClient.js"

const HR_DASHBOARD_TARGET_ENDPOINT = "/reports/hr-dashboard-targets"

export async function fetchHrDashboardTargets(params = {}) {
    const response = await apiClient.get(HR_DASHBOARD_TARGET_ENDPOINT, { params })
    return response.data.data
}

export async function createHrDashboardTarget(payload) {
    const response = await apiClient.post(HR_DASHBOARD_TARGET_ENDPOINT, payload)
    return response.data.data.target
}

export async function updateHrDashboardTarget(targetId, payload) {
    const response = await apiClient.patch(
        `${HR_DASHBOARD_TARGET_ENDPOINT}/${targetId}`,
        payload,
    )
    return response.data.data.target
}

export async function archiveHrDashboardTarget(targetId) {
    const response = await apiClient.patch(
        `${HR_DASHBOARD_TARGET_ENDPOINT}/${targetId}/archive`,
    )
    return response.data.data.target
}
