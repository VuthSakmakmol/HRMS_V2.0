import { apiClient } from "@/shared/services/apiClient.js"

const EMPLOYEE_TYPE_ENDPOINT = "/organization/employee-types"

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

export async function fetchEmployeeTypes(params = {}) {
    const response = await apiClient.get(EMPLOYEE_TYPE_ENDPOINT, {
        params,
    })

    return response.data.data
}

export async function createEmployeeType(payload) {
    const response = await apiClient.post(EMPLOYEE_TYPE_ENDPOINT, payload)

    return response.data.data.employeeType
}

export async function updateEmployeeType(employeeTypeId, payload) {
    const response = await apiClient.patch(
        `${EMPLOYEE_TYPE_ENDPOINT}/${employeeTypeId}`,
        payload,
    )

    return response.data.data.employeeType
}

export async function archiveEmployeeType(employeeTypeId) {
    const response = await apiClient.patch(
        `${EMPLOYEE_TYPE_ENDPOINT}/${employeeTypeId}/archive`,
    )

    return response.data.data.employeeType
}

export async function downloadEmployeeTypeImportTemplate() {
    const response = await apiClient.get(
        `${EMPLOYEE_TYPE_ENDPOINT}/import-template`,
        {
            responseType: "blob",
            timeout: 0,
        },
    )

    downloadBlob(
        response.data,
        getFilenameFromResponse(response, "employee-type-import-template.xlsx"),
    )
}

export async function exportEmployeeTypes(params = {}) {
    const response = await apiClient.get(`${EMPLOYEE_TYPE_ENDPOINT}/export`, {
        params,
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(
        response.data,
        getFilenameFromResponse(response, "employee-types-export.xlsx"),
    )
}

export async function importEmployeeTypes(file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(
        `${EMPLOYEE_TYPE_ENDPOINT}/import`,
        formData,
        {
            timeout: 0,
            onUploadProgress,
        },
    )

    return response.data.data.summary
}
