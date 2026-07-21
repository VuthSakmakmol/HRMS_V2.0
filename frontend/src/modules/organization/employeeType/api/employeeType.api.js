import { apiClient } from "@/shared/services/apiClient.js"
const ENDPOINT = "/organization/employee-types"
function unwrapData(response) {
    return response?.data?.data ?? {}
}

function normalizeId(value) {
    if (!value) {
        return ""
    }

    if (typeof value === "string") {
        return value
    }

    return String(value.id || value._id || value)
}

function normalizePosition(item = {}) {
    return {
        ...item,
        id: normalizeId(item.id || item._id),
        companyId: normalizeId(
            item.companyId ||
            item.company?.id ||
            item.company?._id,
        ),
        branchId: normalizeId(
            item.branchId ||
            item.branch?.id ||
            item.branch?._id,
        ),
        title:
            item.title ||
            item.name ||
            item.code ||
            "",
        name:
            item.name ||
            item.title ||
            item.code ||
            "",
    }
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
export async function listEmployeeTypes(params = {}, signal) {
    const response = await apiClient.get(ENDPOINT, { params, signal })
    const data = unwrapData(response)
    return {
        items: Array.isArray(data.items) ? data.items : [],
        pagination: {
            page: Number(data.pagination?.page ?? params.page ?? 1),
            limit: Number(data.pagination?.limit ?? params.limit ?? 10),
            total: Number(data.pagination?.total ?? 0),
            totalPages: Number(data.pagination?.totalPages ?? 0),
        },
    }
}
export async function createEmployeeType(payload) { return unwrapData(await apiClient.post(ENDPOINT, payload)).employeeType }
export async function updateEmployeeType(id, payload) {
    return unwrapData(await apiClient.patch(`${ENDPOINT}/${id}`, payload))
}
export async function archiveEmployeeType(id) { return unwrapData(await apiClient.patch(`${ENDPOINT}/${id}/archive`)).employeeType }
export async function lookupPositionPage(params = {}, signal) {
    const data = unwrapData(
        await apiClient.get("/organization/positions/lookup", {
            params: {
                page: 1,
                limit: 100,
                ...params,
            },
            signal,
        }),
    )

    return {
        items: Array.isArray(data.items)
            ? data.items.map(normalizePosition)
            : [],
        pagination: {
            page: Number(data.pagination?.page ?? params.page ?? 1),
            limit: Number(data.pagination?.limit ?? params.limit ?? 100),
            total: Number(data.pagination?.total ?? 0),
            totalPages: Number(data.pagination?.totalPages ?? 0),
        },
    }
}

export async function lookupPositions(params = {}, signal) {
    const pageSize = 100
    const allItems = []
    const seenIds = new Set()

    let page = 1
    let totalPages = 1

    do {
        const result = await lookupPositionPage(
            {
                ...params,
                page,
                limit: pageSize,
            },
            signal,
        )

        let addedOnPage = 0

        for (const item of result.items) {
            const id = String(item.id || item._id || "")

            if (!id || seenIds.has(id)) {
                continue
            }

            seenIds.add(id)
            allItems.push(item)
            addedOnPage += 1
        }

        totalPages = Math.max(
            1,
            Number(result.pagination.totalPages || 1),
        )

        /*
         * Prevent an endless loop if an old backend repeats page 1.
         * With the corrected backend, totalPages is authoritative.
         */
        if (addedOnPage === 0) {
            break
        }

        page += 1
    } while (page <= totalPages)

    return allItems
}

export async function lookupEmployeeTypeDashboardCategories(signal) { return unwrapData(await apiClient.get(`${ENDPOINT}/dashboard-categories`, { signal })).items ?? [] }
export async function lookupEmployeeTypePositionAssignments(params = {}, signal) {
    const data = unwrapData(
        await apiClient.get(`${ENDPOINT}/position-assignments`, {
            params,
            signal,
        }),
    )

    return Array.isArray(data.items) ? data.items : []
}
export async function downloadEmployeeTypeTemplate() { const r = await apiClient.get(`${ENDPOINT}/import-template`, { responseType: "blob", timeout: 0 }); downloadBlob(r.data, "employee-type-import-template.xlsx") }
export async function exportEmployeeTypes(params = {}) { const r = await apiClient.get(`${ENDPOINT}/export`, { params, responseType: "blob", timeout: 0 }); downloadBlob(r.data, "employee-types-export.xlsx") }
export async function startEmployeeTypeImportJob(file, onUploadProgress) { const fd = new FormData(); fd.append("file", file); return unwrapData(await apiClient.post(`${ENDPOINT}/import-jobs`, fd, { timeout: 0, onUploadProgress })).job }
export async function getEmployeeTypeImportJob(jobId, signal) { return unwrapData(await apiClient.get(`${ENDPOINT}/import-jobs/${jobId}`, { signal })).job }
export async function waitForEmployeeTypeImportJob(jobId, { onProgress, signal, intervalMs = 500 } = {}) {
    while (true) {
        if (signal?.aborted) throw new DOMException("Import polling aborted.", "AbortError")
        const job = await getEmployeeTypeImportJob(jobId, signal)
        onProgress?.(job)
        if (["COMPLETED", "FAILED"].includes(job.status)) return job
        await new Promise((resolve, reject) => {
            const timer = window.setTimeout(resolve, intervalMs)
            signal?.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("Import polling aborted.", "AbortError")) }, { once: true })
        })
    }
}
