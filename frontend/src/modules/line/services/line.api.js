import { apiClient } from "@/shared/services/apiClient.js"

const LINE_ENDPOINT = "/organization/lines"

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

export async function fetchLines(params = {}) {
    const response = await apiClient.get(LINE_ENDPOINT, {
        params,
    })

    return response.data.data
}

export async function createLine(payload) {
    const response = await apiClient.post(LINE_ENDPOINT, payload)

    return response.data.data.line
}

export async function updateLine(lineId, payload) {
    const response = await apiClient.patch(`${LINE_ENDPOINT}/${lineId}`, payload)

    return response.data.data.line
}

export async function archiveLine(lineId) {
    const response = await apiClient.patch(`${LINE_ENDPOINT}/${lineId}/archive`)

    return response.data.data.line
}

export async function downloadLineImportTemplate() {
    const response = await apiClient.get(`${LINE_ENDPOINT}/import-template`, {
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(
        response.data,
        getFilenameFromResponse(response, "line-import-template.xlsx"),
    )
}

export async function exportLines(params = {}) {
    const response = await apiClient.get(`${LINE_ENDPOINT}/export`, {
        params,
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(
        response.data,
        getFilenameFromResponse(response, "lines-export.xlsx"),
    )
}

export async function importLines(file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(`${LINE_ENDPOINT}/import`, formData, {
        timeout: 0,
        onUploadProgress,
    })

    return response.data.data.summary
}