import { apiClient } from "@/shared/services/apiClient.js"

const ENDPOINT = "/organization/companies"

function unwrapData(response) {
    return response?.data?.data ?? {}
}

export async function listCompanies(params = {}, signal) {
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

export async function getCompany(companyId, signal) {
    const response = await apiClient.get(`${ENDPOINT}/${companyId}`, { signal })
    return unwrapData(response).company
}

export async function createCompany(payload) {
    const response = await apiClient.post(ENDPOINT, payload)
    return unwrapData(response).company
}

export async function updateCompany(companyId, payload) {
    const response = await apiClient.patch(`${ENDPOINT}/${companyId}`, payload)
    return unwrapData(response).company
}

export async function archiveCompany(companyId) {
    const response = await apiClient.patch(`${ENDPOINT}/${companyId}/archive`)
    return unwrapData(response).company
}

export async function lookupCompanies(params = {}, signal) {
    const response = await apiClient.get(`${ENDPOINT}/lookup`, {
        params,
        signal,
    })

    return unwrapData(response).items ?? []
}
