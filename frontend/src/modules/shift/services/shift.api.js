import { apiClient } from "@/shared/services/apiClient.js"

const SHIFT_ENDPOINT = "/organization/shifts"

function getFilenameFromResponse(response, fallbackFilename) {
    const contentDisposition =
        response.headers?.["content-disposition"] ||
        response.headers?.["Content-Disposition"]

    if (!contentDisposition) {
        return fallbackFilename
    }

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

export async function fetchShiftLookup(params = {}) {
    const response = await apiClient.get(`${SHIFT_ENDPOINT}/lookup`, {
        params: {
            page: 1,
            limit: 100,
            status: "ACTIVE",
            ...params,
        },
    })

    return response.data.data
}

export async function fetchShifts(params = {}) {
    const response = await apiClient.get(SHIFT_ENDPOINT, {
        params,
    })

    return response.data.data
}

export async function createShift(payload) {
    const response = await apiClient.post(SHIFT_ENDPOINT, payload)

    return response.data.data.shift
}

export async function updateShift(shiftId, payload) {
    const response = await apiClient.patch(
        `${SHIFT_ENDPOINT}/${shiftId}`,
        payload,
    )

    return response.data.data.shift
}

export async function archiveShift(shiftId) {
    const response = await apiClient.patch(
        `${SHIFT_ENDPOINT}/${shiftId}/archive`,
    )

    return response.data.data.shift
}

export async function downloadShiftImportTemplate() {
    const response = await apiClient.get(`${SHIFT_ENDPOINT}/import-template`, {
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(
        response.data,
        getFilenameFromResponse(response, "shift-import-template.xlsx"),
    )
}

export async function exportShifts(params = {}) {
    const response = await apiClient.get(`${SHIFT_ENDPOINT}/export`, {
        params,
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(
        response.data,
        getFilenameFromResponse(response, "shifts-export.xlsx"),
    )
}

export async function importShifts(file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(`${SHIFT_ENDPOINT}/import`, formData, {
        timeout: 0,
        onUploadProgress,
    })

    return response.data.data.summary
}