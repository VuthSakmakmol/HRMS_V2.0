import { apiClient } from "@/shared/services/apiClient.js"

const MANPOWER_PLAN_ENDPOINT = "/reports/manpower-plans"

function getFilenameFromResponse(response, fallbackFilename) {
    const contentDisposition =
        response.headers?.["content-disposition"] ||
        response.headers?.["Content-Disposition"]

    if (!contentDisposition) return fallbackFilename

    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
    return filenameMatch?.[1] || fallbackFilename
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

export async function fetchManpowerPlans(params = {}) {
    const response = await apiClient.get(MANPOWER_PLAN_ENDPOINT, {
        params,
    })

    return response.data.data
}

export async function fetchManpowerPlanningGrid(params) {
    const response = await apiClient.get(
        `${MANPOWER_PLAN_ENDPOINT}/planning-grid`,
        {
            params,
        },
    )

    return response.data.data
}

export async function saveManpowerPlanBatch(payload) {
    const response = await apiClient.put(
        `${MANPOWER_PLAN_ENDPOINT}/batch`,
        payload,
        {
            timeout: 0,
        },
    )

    return response.data.data.result
}

export async function createManpowerPlan(payload) {
    const response = await apiClient.post(
        MANPOWER_PLAN_ENDPOINT,
        payload,
    )

    return response.data.data.manpowerPlan
}

export async function updateManpowerPlan(manpowerPlanId, payload) {
    const response = await apiClient.patch(
        `${MANPOWER_PLAN_ENDPOINT}/${manpowerPlanId}`,
        payload,
    )

    return response.data.data.manpowerPlan
}

export async function archiveManpowerPlan(manpowerPlanId) {
    const response = await apiClient.patch(
        `${MANPOWER_PLAN_ENDPOINT}/${manpowerPlanId}/archive`,
    )

    return response.data.data.manpowerPlan
}

export async function downloadManpowerPlanImportTemplate() {
    const response = await apiClient.get(
        `${MANPOWER_PLAN_ENDPOINT}/import-template`,
        {
            responseType: "blob",
            timeout: 0,
        },
    )

    downloadBlob(
        response.data,
        getFilenameFromResponse(
            response,
            "manpower-plan-import-template.xlsx",
        ),
    )
}

export async function exportManpowerPlans(params = {}) {
    const response = await apiClient.get(
        `${MANPOWER_PLAN_ENDPOINT}/export`,
        {
            params,
            responseType: "blob",
            timeout: 0,
        },
    )

    downloadBlob(
        response.data,
        getFilenameFromResponse(
            response,
            "manpower-plans-export.xlsx",
        ),
    )
}

export async function importManpowerPlans(file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(
        `${MANPOWER_PLAN_ENDPOINT}/import`,
        formData,
        {
            timeout: 0,
            onUploadProgress,
        },
    )

    return response.data.data.summary
}
