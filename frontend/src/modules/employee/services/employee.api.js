import { apiClient } from "@/shared/services/apiClient.js"

const EMPLOYEE_ENDPOINT = "/employees"

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

export async function fetchEmployees(params = {}) {
    const response = await apiClient.get(EMPLOYEE_ENDPOINT, { params })
    return response.data.data
}

export async function createEmployee(payload) {
    const response = await apiClient.post(EMPLOYEE_ENDPOINT, payload)
    return response.data.data.employee
}

export async function updateEmployee(employeeId, payload) {
    const response = await apiClient.patch(`${EMPLOYEE_ENDPOINT}/${employeeId}`, payload)
    return response.data.data.employee
}

export async function archiveEmployee(employeeId) {
    const response = await apiClient.patch(`${EMPLOYEE_ENDPOINT}/${employeeId}/archive`)
    return response.data.data.employee
}

export async function fetchEmployeeApprovalPreview(params = {}) {
    const response = await apiClient.get(`${EMPLOYEE_ENDPOINT}/approval-preview`, { params })
    return response.data.data.preview
}

export async function downloadEmployeeImportTemplate() {
    const response = await apiClient.get(`${EMPLOYEE_ENDPOINT}/import-template`, {
        responseType: "blob",
        timeout: 0,
    })
    downloadBlob(response.data, getFilenameFromResponse(response, "employee-import-template.xlsx"))
}

export async function exportEmployees(params = {}) {
    const response = await apiClient.get(`${EMPLOYEE_ENDPOINT}/export`, {
        params,
        responseType: "blob",
        timeout: 0,
    })
    downloadBlob(response.data, getFilenameFromResponse(response, "employees-export.xlsx"))
}

export async function importEmployees(file, params = {}, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)
    const response = await apiClient.post(`${EMPLOYEE_ENDPOINT}/import`, formData, {
        params,
        timeout: 0,
        onUploadProgress,
    })
    return response.data.data.summary
}
