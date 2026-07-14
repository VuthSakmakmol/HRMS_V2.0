import { apiClient } from "@/shared/services/apiClient.js"

const DEPARTMENT_ENDPOINT = "/organization/departments"

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement("a")

    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(url)
}

export async function fetchDepartments(params = {}) {
    const response = await apiClient.get(DEPARTMENT_ENDPOINT, {
        params,
    })

    return response.data.data
}

export async function fetchDepartmentsLookup(params = {}) {
    const response = await apiClient.get(`${DEPARTMENT_ENDPOINT}/lookup`, {
        params,
    })

    return response.data.data.items || []
}

export async function createDepartment(payload) {
    const response = await apiClient.post(DEPARTMENT_ENDPOINT, payload)

    return response.data.data.department
}

export async function updateDepartment(departmentId, payload) {
    const response = await apiClient.patch(
        `${DEPARTMENT_ENDPOINT}/${departmentId}`,
        payload,
    )

    return response.data.data.department
}

export async function archiveDepartment(departmentId) {
    const response = await apiClient.patch(
        `${DEPARTMENT_ENDPOINT}/${departmentId}/archive`,
    )

    return response.data.data.department
}

export async function downloadDepartmentImportTemplate() {
    const response = await apiClient.get(
        `${DEPARTMENT_ENDPOINT}/import-template`,
        {
            responseType: "blob",
            timeout: 0,
        },
    )

    downloadBlob(response.data, "department-import-template.xlsx")
}

export async function exportDepartments(params = {}) {
    const response = await apiClient.get(`${DEPARTMENT_ENDPOINT}/export`, {
        params,
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(response.data, "departments-export.xlsx")
}

export async function importDepartments(file, options = {}) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(
        `${DEPARTMENT_ENDPOINT}/import`,
        formData,
        {
            timeout: 0,
            onUploadProgress(progressEvent) {
                if (!progressEvent.total) {
                    return
                }

                const uploadPercent = Math.round(
                    (progressEvent.loaded * 100) / progressEvent.total,
                )

                options.onUploadProgress?.(uploadPercent)
            },
        },
    )

    return response.data.data.summary
}
