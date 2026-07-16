import { apiClient } from "@/shared/services/apiClient.js"

const ENDPOINT = "/organization/locations"
const TERMINAL_JOB_STATUSES = new Set(["COMPLETED", "FAILED"])

function unwrap(response) {
    return response?.data?.data ?? {}
}

function filenameFrom(response, fallback) {
    const header = response.headers?.["content-disposition"] || ""
    return header.match(/filename="?([^";]+)"?/i)?.[1] || fallback
}

function download(response, fallback) {
    const url = URL.createObjectURL(response.data)
    const link = document.createElement("a")

    link.href = url
    link.download = filenameFrom(response, fallback)
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}

export async function listLocations(entity, params = {}, signal) {
    return unwrap(
        await apiClient.get(`${ENDPOINT}/${entity}`, {
            params,
            signal,
        }),
    )
}

export async function lookupLocations(entity, params = {}, signal) {
    const data = unwrap(
        await apiClient.get(`${ENDPOINT}/${entity}/lookup`, {
            params: {
                page: 1,
                limit: 100,
                status: "ACTIVE",
                ...params,
            },
            signal,
        }),
    )

    return data.items ?? []
}

export async function createLocation(entity, payload) {
    return unwrap(
        await apiClient.post(`${ENDPOINT}/${entity}`, payload),
    ).location
}

export async function updateLocation(entity, id, payload) {
    return unwrap(
        await apiClient.patch(`${ENDPOINT}/${entity}/${id}`, payload),
    ).location
}

export async function archiveLocation(entity, id) {
    return unwrap(
        await apiClient.patch(`${ENDPOINT}/${entity}/${id}/archive`),
    ).location
}

export async function downloadLocationTemplate(entity) {
    const response = await apiClient.get(
        `${ENDPOINT}/${entity}/import-template`,
        {
            responseType: "blob",
            timeout: 0,
        },
    )

    download(response, `${entity}-import-template.xlsx`)
}

export async function exportLocations(entity, params = {}) {
    const response = await apiClient.get(`${ENDPOINT}/${entity}/export`, {
        params,
        responseType: "blob",
        timeout: 0,
    })

    download(response, `${entity}-export.xlsx`)
}

export async function startLocationImportJob(entity, file, onUploadProgress) {
    const body = new FormData()
    body.append("file", file)

    return unwrap(
        await apiClient.post(`${ENDPOINT}/${entity}/import-jobs`, body, {
            timeout: 0,
            headers: {
                Accept: "application/json",
            },
            onUploadProgress,
        }),
    ).job
}

export async function getLocationImportJob(entity, jobId, signal) {
    return unwrap(
        await apiClient.get(`${ENDPOINT}/${entity}/import-jobs/${jobId}`, {
            signal,
        }),
    ).job
}

export async function waitForLocationImportJob(
    entity,
    jobId,
    {
        signal,
        onProgress,
        intervalMs = 750,
    } = {},
) {
    while (true) {
        const job = await getLocationImportJob(entity, jobId, signal)
        onProgress?.(job)

        if (TERMINAL_JOB_STATUSES.has(job.status)) {
            return job
        }

        await new Promise((resolve, reject) => {
            const timeout = window.setTimeout(resolve, intervalMs)

            signal?.addEventListener(
                "abort",
                () => {
                    window.clearTimeout(timeout)
                    reject(new DOMException("Aborted", "AbortError"))
                },
                { once: true },
            )
        })
    }
}
