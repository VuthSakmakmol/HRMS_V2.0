
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

export async function fetchEmployeeMovement(movementId) {
    const response = await apiClient.get(`${EMPLOYEE_MOVEMENT_ENDPOINT}/${movementId}`)
    return response.data.data.movement
}

export async function exportEmployeeMovements(params = {}) {
    const response = await apiClient.get(`${EMPLOYEE_MOVEMENT_ENDPOINT}/export`, { params, responseType: "blob", timeout: 0 })
    downloadBlob(response.data, getFilenameFromResponse(response, "employee-movements-export.xlsx"))
}
