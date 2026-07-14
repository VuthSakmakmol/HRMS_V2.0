import { apiClient } from "@/shared/services/apiClient.js"

const ENDPOINT = "/organization/branches"
const COMPANY_ENDPOINT = "/organization/companies"

function unwrapData(response) {
    return response?.data?.data ?? {}
}

export async function listBranches(params = {}, signal) {
    const response = await apiClient.get(ENDPOINT, { params, signal })
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

export async function createBranch(payload) {
    const response = await apiClient.post(ENDPOINT, payload)
    return unwrapData(response).branch
}

export async function updateBranch(branchId, payload) {
    const response = await apiClient.patch(`${ENDPOINT}/${branchId}`, payload)
    return unwrapData(response).branch
}

export async function archiveBranch(branchId) {
    const response = await apiClient.patch(`${ENDPOINT}/${branchId}/archive`)
    return unwrapData(response).branch
}

export async function lookupCompanies(params = {}, signal) {
    const response = await apiClient.get(`${COMPANY_ENDPOINT}/lookup`, {
        params: { limit: 100, status: "ACTIVE", ...params },
        signal,
    })

    return unwrapData(response).items ?? []
}
