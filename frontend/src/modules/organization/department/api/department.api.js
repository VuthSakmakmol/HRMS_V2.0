import { apiClient } from "@/shared/services/apiClient.js"

const ENDPOINT = "/organization/departments"

function unwrapData(response) {
    return response?.data?.data ?? {}
}

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

export async function listDepartments(params = {}, signal) {
    const response = await apiClient.get(ENDPOINT, {
        params,
        signal,
    })
    const data = unwrapData(response)

    return {
        items: Array.isArray(data.items) ? data.items : [],
        pagination: {
            page: Number(data.pagination?.page ?? params.page ?? 1),
            limit: Number(data.pagination?.limit ?? params.limit ?? 20),
            total: Number(data.pagination?.total ?? 0),
            totalPages: Number(data.pagination?.totalPages ?? 0),
            hasNext: Boolean(data.pagination?.hasNext),
            hasPrevious: Boolean(data.pagination?.hasPrevious),
        },
    }
}

export async function createDepartment(payload) {
    const response = await apiClient.post(ENDPOINT, payload)

    return unwrapData(response).department
}

export async function updateDepartment(departmentId, payload) {
    const response = await apiClient.patch(
        `${ENDPOINT}/${departmentId}`,
        payload,
    )

    return unwrapData(response).department
}

export async function archiveDepartment(departmentId) {
    const response = await apiClient.patch(
        `${ENDPOINT}/${departmentId}/archive`,
    )

    return unwrapData(response).department
}

export async function lookupDepartments(params = {}, signal) {
    const response = await apiClient.get(`${ENDPOINT}/lookup`, {
        params: {
            limit: 100,
            status: "ACTIVE",
            ...params,
        },
        signal,
    })

    return unwrapData(response).items ?? []
}

export async function downloadDepartmentTemplate() {
    const response = await apiClient.get(`${ENDPOINT}/import-template`, {
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(response.data, "department-import-template.xlsx")
}

export async function exportDepartments(params = {}) {
    const response = await apiClient.get(`${ENDPOINT}/export`, {
        params,
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(response.data, "departments-export.xlsx")
}

export async function importDepartments(file, onUploadProgress) {
    const formData = new FormData()

    formData.append("file", file)

    const response = await apiClient.post(`${ENDPOINT}/import`, formData, {
        timeout: 0,
        onUploadProgress,
    })

    return unwrapData(response).summary
}
