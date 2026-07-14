import { apiClient } from "@/shared/services/apiClient.js"

const APPROVAL_ENDPOINT = "/approvals"

export async function fetchApprovalModules(params = {}) {
    const response = await apiClient.get(`${APPROVAL_ENDPOINT}/modules`, {
        params,
    })

    return response.data.data
}

export async function createApprovalModule(payload) {
    const response = await apiClient.post(`${APPROVAL_ENDPOINT}/modules`, payload)

    return response.data.data.module
}

export async function updateApprovalModule(moduleId, payload) {
    const response = await apiClient.patch(
        `${APPROVAL_ENDPOINT}/modules/${moduleId}`,
        payload,
    )

    return response.data.data.module
}

export async function archiveApprovalModule(moduleId) {
    const response = await apiClient.patch(
        `${APPROVAL_ENDPOINT}/modules/${moduleId}/archive`,
    )

    return response.data.data.module
}

export async function fetchResolverOptions() {
    const response = await apiClient.get(`${APPROVAL_ENDPOINT}/resolver-options`)

    return response.data.data.items || []
}

export async function fetchApprovalPolicies(params = {}) {
    const response = await apiClient.get(`${APPROVAL_ENDPOINT}/policies`, {
        params,
    })

    return response.data.data
}

export async function createApprovalPolicy(payload) {
    const response = await apiClient.post(`${APPROVAL_ENDPOINT}/policies`, payload)

    return response.data.data.policy
}

export async function updateApprovalPolicy(policyId, payload) {
    const response = await apiClient.patch(
        `${APPROVAL_ENDPOINT}/policies/${policyId}`,
        payload,
    )

    return response.data.data.policy
}

export async function archiveApprovalPolicy(policyId) {
    const response = await apiClient.patch(
        `${APPROVAL_ENDPOINT}/policies/${policyId}/archive`,
    )

    return response.data.data.policy
}

export async function resolveApprovalPreview(payload) {
    const response = await apiClient.post(
        `${APPROVAL_ENDPOINT}/resolve-preview`,
        payload,
    )

    return response.data.data.preview
}

export async function fetchApprovalRequests(params = {}) {
    const response = await apiClient.get(`${APPROVAL_ENDPOINT}/requests`, {
        params,
    })

    return response.data.data
}
