import { apiClient } from "@/shared/services/apiClient.js"

const BRANCH_ENDPOINT = "/organization/branches"

export async function fetchBranches(params = {}) {
    const response = await apiClient.get(BRANCH_ENDPOINT, {
        params,
    })

    return response.data.data
}

export async function fetchBranchesLookup(params = {}) {
    const response = await apiClient.get(`${BRANCH_ENDPOINT}/lookup`, {
        params,
    })

    return response.data.data.items || []
}

export async function createBranch(payload) {
    const response = await apiClient.post(BRANCH_ENDPOINT, payload)

    return response.data.data.branch
}

export async function updateBranch(branchId, payload) {
    const response = await apiClient.patch(
        `${BRANCH_ENDPOINT}/${branchId}`,
        payload,
    )

    return response.data.data.branch
}

export async function archiveBranch(branchId) {
    const response = await apiClient.patch(
        `${BRANCH_ENDPOINT}/${branchId}/archive`,
    )

    return response.data.data.branch
}