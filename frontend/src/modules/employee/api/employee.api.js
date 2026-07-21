import { apiClient } from "@/shared/services/apiClient.js"

const EMPLOYEE_ENDPOINT = "/employees"

function getFilenameFromResponse(response, fallbackFilename) {
    const contentDisposition =
        response.headers?.["content-disposition"] ||
        response.headers?.["Content-Disposition"]

    if (!contentDisposition) return fallbackFilename
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
    return filenameMatch?.[1] || fallbackFilename
}

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
}

export async function fetchEmployees(params = {}) {
    const response = await apiClient.get(EMPLOYEE_ENDPOINT, { params })
    return response.data.data
}

export async function fetchEmployee(employeeId) {
    const response = await apiClient.get(`${EMPLOYEE_ENDPOINT}/${employeeId}`)
    return response.data.data.employee
}

export async function createEmployee(payload) {
    const response = await apiClient.post(EMPLOYEE_ENDPOINT, payload)
    return response.data.data.employee
}

export async function updateEmployee(employeeId, payload) {
    const response = await apiClient.patch(`${EMPLOYEE_ENDPOINT}/${employeeId}`, payload)
    return response.data.data.employee
}

export async function archiveEmployee(employeeId) {
    const response = await apiClient.patch(`${EMPLOYEE_ENDPOINT}/${employeeId}/archive`)
    return response.data.data.employee
}

export async function fetchEmployeeApprovalPreview(params = {}) {
    const response = await apiClient.get(`${EMPLOYEE_ENDPOINT}/approval-preview`, { params })
    return response.data.data.preview
}

export async function downloadEmployeeImportTemplate() {
    const response = await apiClient.get(`${EMPLOYEE_ENDPOINT}/import-template`, {
        responseType: "blob",
        timeout: 0,
    })
    downloadBlob(response.data, getFilenameFromResponse(response, "employee-import-template.xlsx"))
}

export async function exportEmployees(params = {}) {
    const response = await apiClient.get(`${EMPLOYEE_ENDPOINT}/export`, {
        params,
        responseType: "blob",
        timeout: 0,
    })
    downloadBlob(response.data, getFilenameFromResponse(response, "employees-export.xlsx"))
}

export async function startEmployeeImportJob(file, params = {}, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)

    try {
        const response = await apiClient.post(
            `${EMPLOYEE_ENDPOINT}/import-jobs`,
            formData,
            {
                params,
                timeout: 0,
                onUploadProgress,
            },
        )

        return response.data.data.job
    } catch (error) {
        error.importSummary =
            error?.details?.importSummary ??
            error?.cause?.response?.data?.error?.details?.importSummary ??
            null

        throw error
    }
}

export async function getEmployeeImportJob(jobId, signal) {
    const response = await apiClient.get(`${EMPLOYEE_ENDPOINT}/import-jobs/${jobId}`, { signal })
    return response.data.data.job
}

export async function waitForEmployeeImportJob(jobId, { onProgress, signal, intervalMs = 500 } = {}) {
    while (true) {
        if (signal?.aborted) throw new DOMException("Import polling aborted.", "AbortError")
        const job = await getEmployeeImportJob(jobId, signal)
        onProgress?.(job)
        if (["COMPLETED", "FAILED"].includes(job.status)) return job
        await new Promise((resolve, reject) => {
            const timer = window.setTimeout(resolve, intervalMs)
            signal?.addEventListener("abort", () => {
                window.clearTimeout(timer)
                reject(new DOMException("Import polling aborted.", "AbortError"))
            }, { once: true })
        })
    }
}

async function fetchPage(endpoint, params = {}) {
    const response = await apiClient.get(endpoint, {
        params: {
            page: 1,
            limit: 100,
            status: "ACTIVE",
            ...params,
        },
    })

    const payload = response?.data?.data

    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.items)) return payload.items

    // Some organization endpoints use an entity-specific collection key.
    // Normalize every lookup to an array before it reaches the form.
    const collection = Object.values(payload || {}).find(Array.isArray)
    return collection || []
}

async function fetchOptional(endpoints, params = {}) {
    for (const endpoint of endpoints) {
        try { return await fetchPage(endpoint, params) }
        catch (error) {
            const status = error?.status || error?.response?.status
            if (![404, 422].includes(status)) throw error
        }
    }
    return []
}

export async function fetchEmployeeLookups() {
    const companies = await fetchPage("/organization/companies/lookup")
    return { companies }
}

export function fetchEmployeeBranches(companyId) {
    if (!companyId) return Promise.resolve([])
    return fetchPage("/organization/branches/lookup", { companyId })
}

export function fetchEmployeeDepartments({ companyId, branchId }) {
    if (!companyId || !branchId) return Promise.resolve([])
    return fetchPage("/organization/departments/lookup", { companyId, branchId })
}

export function fetchEmployeePositions({ companyId, branchId, departmentId }) {
    if (!companyId || !branchId || !departmentId) return Promise.resolve([])
    return fetchPage("/organization/positions/lookup", {
        companyId,
        branchId,
        departmentId,
    })
}

export function fetchEmployeeLines({ companyId, branchId }) {
    if (!companyId || !branchId) return Promise.resolve([])
    return fetchPage("/organization/lines", {
        companyId,
        branchId,
    })
}

export function fetchEmployeeShifts({ companyId, branchId }) {
    if (!companyId || !branchId) return Promise.resolve([])
    return fetchPage("/organization/shifts/lookup", { companyId, branchId })
}

export function fetchEmployeeTypes(companyId) {
    if (!companyId) return Promise.resolve([])
    return fetchOptional(
        ["/organization/employee-types", "/employee-types", "/setup/employee-types"],
        { companyId },
    )
}

export function fetchEmployeeRecruitmentChannels({ companyId, branchId }) {
    if (!companyId || !branchId) return Promise.resolve([])
    return fetchOptional(
        ["/organization/recruitment-channels", "/recruitment-channels"],
        { companyId, branchId },
    )
}

export function fetchEmployeeExitReasons({ companyId, branchId }) {
    if (!companyId || !branchId) return Promise.resolve([])
    return fetchOptional(
        ["/organization/exit-reasons", "/exit-reasons"],
        { companyId, branchId },
    )
}
