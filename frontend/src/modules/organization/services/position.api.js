import { apiClient } from "@/shared/services/apiClient.js"

const POSITION_ENDPOINT = "/organization/positions"

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

export async function fetchPositions(params = {}) {
    const response = await apiClient.get(POSITION_ENDPOINT, {
        params,
    })

    return response.data.data
}

export async function fetchPositionsLookup(params = {}) {
    const response = await apiClient.get(`${POSITION_ENDPOINT}/lookup`, {
        params,
    })

    return response.data.data.items || []
}

export async function createPosition(payload) {
    const response = await apiClient.post(POSITION_ENDPOINT, payload)

    return response.data.data.position
}

export async function updatePosition(positionId, payload) {
    const response = await apiClient.patch(
        `${POSITION_ENDPOINT}/${positionId}`,
        payload,
    )

    return response.data.data.position
}

export async function archivePosition(positionId) {
    const response = await apiClient.patch(
        `${POSITION_ENDPOINT}/${positionId}/archive`,
    )

    return response.data.data.position
}

export async function downloadPositionImportTemplate() {
    const response = await apiClient.get(
        `${POSITION_ENDPOINT}/import-template`,
        {
            responseType: "blob",
            timeout: 0,
        },
    )

    downloadBlob(
        response.data,
        getFilenameFromResponse(response, "position-import-template.xlsx"),
    )
}

export async function exportPositions(params = {}) {
    const response = await apiClient.get(`${POSITION_ENDPOINT}/export`, {
        params,
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(
        response.data,
        getFilenameFromResponse(response, "positions-export.xlsx"),
    )
}

export async function importPositions(file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(
        `${POSITION_ENDPOINT}/import`,
        formData,
        {
            timeout: 0,
            onUploadProgress,
        },
    )

    return response.data.data.summary
}