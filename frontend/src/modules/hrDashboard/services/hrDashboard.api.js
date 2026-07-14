import { apiClient } from "@/shared/services/apiClient.js"

const HR_DASHBOARD_ENDPOINT = "/hr-dashboard"

export async function fetchHrDashboard(params = {}) {
    const response = await apiClient.get(HR_DASHBOARD_ENDPOINT, {
        params,
    })

    return response.data.data.dashboard
}

export async function fetchHrDashboardLookups(params = {}) {
    const response = await apiClient.get(
        `${HR_DASHBOARD_ENDPOINT}/lookups`,
        {
            params,
        },
    )

    return response.data.data.lookups
}
