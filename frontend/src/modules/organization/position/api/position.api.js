import { apiClient } from "@/shared/services/apiClient.js"

const ENDPOINT = "/organization/positions"
const COMPANY_ENDPOINT = "/organization/companies"
const BRANCH_ENDPOINT = "/organization/branches"
const DEPARTMENT_ENDPOINT = "/organization/departments"

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

export async function listPositions(params = {}, signal) {
    const response = await apiClient.get(ENDPOINT, {
        params,
        signal,
    })
    const data = unwrapData(response)

    return {
        items: Array.isArray(data.items) ? data.items : [],
        pagination: {
            page: Number(data.pagination?.page ?? params.page ?? 1),
            limit: Number(data.pagination?.limit ?? params.limit ?? 10),
            total: Number(data.pagination?.total ?? 0),
            totalPages: Number(data.pagination?.totalPages ?? 0),
            hasNext: Boolean(data.pagination?.hasNext),
            hasPrevious: Boolean(data.pagination?.hasPrevious),
        },
    }
}

export async function createPosition(payload) {
    const response = await apiClient.post(ENDPOINT, payload)

    return unwrapData(response).position
}

export async function updatePosition(positionId, payload) {
    const response = await apiClient.patch(
        `${ENDPOINT}/${positionId}`,
        payload,
    )

    return unwrapData(response).position
}

export async function archivePosition(positionId) {
    const response = await apiClient.patch(
        `${ENDPOINT}/${positionId}/archive`,
    )

    return unwrapData(response).position
}

export async function lookupCompanies(params = {}, signal) {
    const response = await apiClient.get(`${COMPANY_ENDPOINT}/lookup`, {
        params: {
            limit: 100,
            status: "ACTIVE",
            ...params,
        },
        signal,
    })

    return unwrapData(response).items ?? []
}

export async function lookupBranches(params = {}, signal) {
    const response = await apiClient.get(`${BRANCH_ENDPOINT}/lookup`, {
        params: {
            limit: 100,
            status: "ACTIVE",
            ...params,
        },
        signal,
    })

    return unwrapData(response).items ?? []
}

export async function lookupDepartments(params = {}, signal) {
    const response = await apiClient.get(`${DEPARTMENT_ENDPOINT}/lookup`, {
        params: {
            limit: 100,
            status: "ACTIVE",
            ...params,
        },
        signal,
    })

    return unwrapData(response).items ?? []
}

export async function lookupPositions(params = {}, signal) {
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

export async function downloadPositionTemplate() {
    const response = await apiClient.get(`${ENDPOINT}/import-template`, {
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(response.data, "position-import-template.xlsx")
}

export async function exportPositions(params = {}) {
    const response = await apiClient.get(`${ENDPOINT}/export`, {
        params,
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(response.data, "positions-export.xlsx")
}

export async function startPositionImportJob(file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(
        `${ENDPOINT}/import-jobs`,
        formData,
        {
            timeout: 0,
            onUploadProgress,
        },
    )

    return unwrapData(response).job
}

export async function getPositionImportJob(jobId, signal) {
    const response = await apiClient.get(
        `${ENDPOINT}/import-jobs/${jobId}`,
        { signal },
    )

    return unwrapData(response).job
}

export async function waitForPositionImportJob(
    jobId,
    {
        onProgress,
        signal,
        intervalMs = 500,
    } = {},
) {
    while (true) {
        if (signal?.aborted) {
            throw new DOMException("Import polling aborted.", "AbortError")
        }

        const job = await getPositionImportJob(jobId, signal)
        onProgress?.(job)

        if (job.status === "COMPLETED" || job.status === "FAILED") {
            return job
        }

        await new Promise((resolve, reject) => {
            const timer = window.setTimeout(resolve, intervalMs)

            signal?.addEventListener(
                "abort",
                () => {
                    window.clearTimeout(timer)
                    reject(
                        new DOMException(
                            "Import polling aborted.",
                            "AbortError",
                        ),
                    )
                },
                { once: true },
            )
        })
    }
}
