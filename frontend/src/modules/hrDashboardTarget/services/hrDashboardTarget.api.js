import { apiClient } from "@/shared/services/apiClient.js"

const HR_DASHBOARD_TARGET_ENDPOINT = "/reports/hr-dashboard-targets"

function cleanParams(params = {}) {
    return Object.fromEntries(
        Object.entries(params).filter(
            ([, value]) => value !== "" && value !== null && value !== undefined,
        ),
    )
}

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
}

export async function fetchHrDashboardTargets(params = {}) {
    const response = await apiClient.get(HR_DASHBOARD_TARGET_ENDPOINT, {
        params: cleanParams(params),
    })
    return response.data.data
}

export async function fetchHrDashboardTargetLookups(params = {}) {
    const response = await apiClient.get(
        `${HR_DASHBOARD_TARGET_ENDPOINT}/lookups`,
        { params: cleanParams(params) },
    )

    return response.data.data.items
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

export async function downloadHrDashboardTargetTemplate() {
    const response = await apiClient.get(
        `${HR_DASHBOARD_TARGET_ENDPOINT}/import-template`,
        {
            params: { downloadVersion: Date.now() },
            responseType: "blob",
            timeout: 0,
        },
    )
    downloadBlob(response.data, "dashboard-target-import-template.xlsx")
}

export async function exportHrDashboardTargets(params = {}) {
    const response = await apiClient.get(
        `${HR_DASHBOARD_TARGET_ENDPOINT}/export`,
        {
            params: cleanParams(params),
            responseType: "blob",
            timeout: 0,
        },
    )
    downloadBlob(response.data, "dashboard-targets.xlsx")
}

export async function importHrDashboardTargets(file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)
    const response = await apiClient.post(
        `${HR_DASHBOARD_TARGET_ENDPOINT}/import`,
        formData,
        { timeout: 0, onUploadProgress },
    )
    return response.data.data.summary
}
