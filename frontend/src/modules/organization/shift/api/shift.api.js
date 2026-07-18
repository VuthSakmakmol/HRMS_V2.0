import { apiClient } from "@/shared/services/apiClient.js"

const ENDPOINT = "/organization/shifts"
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

export async function listShifts(params = {}, signal) {
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

export async function createShift(payload) {
    const response = await apiClient.post(ENDPOINT, payload)

    return unwrapData(response).shift
}

export async function updateShift(shiftId, payload) {
    const response = await apiClient.patch(
        `${ENDPOINT}/${shiftId}`,
        payload,
    )

    return unwrapData(response).shift
}

export async function archiveShift(shiftId) {
    const response = await apiClient.patch(
        `${ENDPOINT}/${shiftId}/archive`,
    )

    return unwrapData(response).shift
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

export async function lookupShifts(params = {}, signal) {
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

export async function downloadShiftTemplate() {
    const response = await apiClient.get(`${ENDPOINT}/import-template`, {
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(response.data, "shift-import-template.xlsx")
}

export async function exportShifts(params = {}) {
    const response = await apiClient.get(`${ENDPOINT}/export`, {
        params,
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(response.data, "shifts-export.xlsx")
}

export async function startShiftImportJob(file, onUploadProgress) {
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

export async function getShiftImportJob(jobId, signal) {
    const response = await apiClient.get(
        `${ENDPOINT}/import-jobs/${jobId}`,
        { signal },
    )

    return unwrapData(response).job
}

export async function waitForShiftImportJob(
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

        const job = await getShiftImportJob(jobId, signal)
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
