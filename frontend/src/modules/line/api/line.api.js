import { apiClient } from "@/shared/services/apiClient.js"

const ENDPOINT = "/organization/lines"
const DEPARTMENT_ENDPOINT = "/organization/departments"
const POSITION_ENDPOINT = "/organization/positions"

function unwrapData(response) {
    return response?.data?.data ?? {}
}

function compactParams(params = {}) {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) =>
            value !== "" && value !== null && value !== undefined,
        ),
    )
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

export async function listLines(params = {}, signal) {
    const response = await apiClient.get(ENDPOINT, {
        params: compactParams(params),
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

export async function createLine(payload) {
    const response = await apiClient.post(ENDPOINT, payload)

    return unwrapData(response).line
}

export async function updateLine(lineId, payload) {
    const response = await apiClient.patch(`${ENDPOINT}/${lineId}`, payload)

    return unwrapData(response).line
}

export async function archiveLine(lineId) {
    const response = await apiClient.patch(`${ENDPOINT}/${lineId}/archive`)

    return unwrapData(response).line
}

async function lookup(endpoint, params = {}, signal) {
    const items = []
    const seen = new Set()
    let page = 1
    let totalPages = 1

    do {
        const response = await apiClient.get(`${endpoint}/lookup`, {
            params: {
                page,
                limit: 100,
                status: "ACTIVE",
                ...params,
            },
            signal,
        })

        const payload = unwrapData(response)
        const pageItems = Array.isArray(payload.items) ? payload.items : []

        for (const item of pageItems) {
            const id = String(item?.id || item?._id || "")
            if (id && seen.has(id)) continue
            if (id) seen.add(id)
            items.push(item)
        }

        totalPages = Math.max(1, Number(payload.pagination?.totalPages || 1))
        if (!payload.pagination || pageItems.length === 0) break
        page += 1
    } while (page <= totalPages)

    return items
}

export const lookupDepartments = (params, signal) =>
    lookup(DEPARTMENT_ENDPOINT, params, signal)

export const lookupPositions = (params, signal) =>
    lookup(POSITION_ENDPOINT, params, signal)

export async function downloadLineTemplate() {
    const response = await apiClient.get(`${ENDPOINT}/import-template`, {
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(response.data, "line-import-template.xlsx")
}

export async function exportLines(params = {}) {
    const response = await apiClient.get(`${ENDPOINT}/export`, {
        params: compactParams(params),
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(response.data, "lines-export.xlsx")
}

export async function startLineImportJob(file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(
        `${ENDPOINT}/import-jobs`,
        formData,
        { timeout: 0, onUploadProgress },
    )

    return unwrapData(response).job
}

export async function getLineImportJob(jobId, signal) {
    const response = await apiClient.get(
        `${ENDPOINT}/import-jobs/${jobId}`,
        { signal },
    )

    return unwrapData(response).job
}

export async function waitForLineImportJob(
    jobId,
    { onProgress, signal, intervalMs = 500 } = {},
) {
    while (true) {
        if (signal?.aborted) {
            throw new DOMException("Import polling aborted.", "AbortError")
        }

        const job = await getLineImportJob(jobId, signal)
        onProgress?.(job)

        if (job.status === "COMPLETED" || job.status === "FAILED") {
            return job
        }

        await new Promise((resolve, reject) => {
            const timer = window.setTimeout(resolve, intervalMs)
            signal?.addEventListener("abort", () => {
                window.clearTimeout(timer)
                reject(new DOMException("Import polling aborted.", "AbortError"))
            }, { once: true })
        })
    }
}
