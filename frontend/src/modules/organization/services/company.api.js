import { apiClient } from "@/shared/services/apiClient.js"

const COMPANY_ENDPOINT = "/organization/companies"

export async function fetchCompanies(params = {}) {
    const response = await apiClient.get(COMPANY_ENDPOINT, {
        params,
    })

    return response.data.data
}

export async function fetchCompaniesLookup(params = {}) {
    const response = await apiClient.get(`${COMPANY_ENDPOINT}/lookup`, {
        params,
    })

    return response.data.data.items || []
}

export async function createCompany(payload) {
    const response = await apiClient.post(COMPANY_ENDPOINT, payload)

    return response.data.data.company
}

export async function updateCompany(companyId, payload) {
    const response = await apiClient.patch(
        `${COMPANY_ENDPOINT}/${companyId}`,
        payload,
    )

    return response.data.data.company
}

export async function archiveCompany(companyId) {
    const response = await apiClient.patch(
        `${COMPANY_ENDPOINT}/${companyId}/archive`,
    )

    return response.data.data.company
}