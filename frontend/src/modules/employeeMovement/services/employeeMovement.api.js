
import { apiClient } from "@/shared/services/apiClient.js"

const EMPLOYEE_MOVEMENT_ENDPOINT = "/employee-movements"

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

export async function fetchEmployeeMovements(params = {}) {
    const response = await apiClient.get(EMPLOYEE_MOVEMENT_ENDPOINT, { params })
    return response.data.data
}

export async function createEmployeeMovement(payload) {
    const response = await apiClient.post(EMPLOYEE_MOVEMENT_ENDPOINT, payload)
    return response.data.data.movement
}

export async function updateEmployeeMovement(movementId, payload) {
    const response = await apiClient.patch(`${EMPLOYEE_MOVEMENT_ENDPOINT}/${movementId}`, payload)
    return response.data.data.movement
}

export async function archiveEmployeeMovement(movementId) {
    const response = await apiClient.patch(`${EMPLOYEE_MOVEMENT_ENDPOINT}/${movementId}/archive`)
    return response.data.data.movement
}

export async function downloadEmployeeMovementImportTemplate() {
    const response = await apiClient.get(`${EMPLOYEE_MOVEMENT_ENDPOINT}/import-template`, { responseType: "blob", timeout: 0 })
    downloadBlob(response.data, getFilenameFromResponse(response, "employee-movement-import-template.xlsx"))
}

export async function exportEmployeeMovements(params = {}) {
    const response = await apiClient.get(`${EMPLOYEE_MOVEMENT_ENDPOINT}/export`, { params, responseType: "blob", timeout: 0 })
    downloadBlob(response.data, getFilenameFromResponse(response, "employee-movements-export.xlsx"))
}

export async function importEmployeeMovements(file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)
    const response = await apiClient.post(`${EMPLOYEE_MOVEMENT_ENDPOINT}/import`, formData, { timeout: 0, onUploadProgress })
    return response.data.data.summary
}
