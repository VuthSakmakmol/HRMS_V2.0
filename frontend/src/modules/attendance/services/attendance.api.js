import { apiClient } from "@/shared/services/apiClient.js"

const ATTENDANCE_ENDPOINT = "/attendance"

function withoutBlankParams(params = {}) {
    return Object.fromEntries(
        Object.entries(params).filter(
            ([, value]) => value !== "" && value !== null && value !== undefined,
        ),
    )
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

export async function fetchAttendanceRecords(params) {
    const response = await apiClient.get(ATTENDANCE_ENDPOINT, {
        params: withoutBlankParams(params),
    })
    return response.data.data
}

export async function createAttendanceRecord(payload) {
    const response = await apiClient.post(ATTENDANCE_ENDPOINT, payload)
    return response.data.data.record
}

export async function updateAttendanceRecord(attendanceId, payload) {
    const response = await apiClient.patch(
        `${ATTENDANCE_ENDPOINT}/${attendanceId}`,
        payload,
    )
    return response.data.data.record
}

export async function downloadAttendanceTemplate() {
    const response = await apiClient.get(
        `${ATTENDANCE_ENDPOINT}/import-template`,
        {
            params: { downloadVersion: Date.now() },
            responseType: "blob",
            timeout: 0,
        },
    )

    downloadBlob(response.data, "attendance-import-template.xlsx")
}

function delay(milliseconds, signal) {
    return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(resolve, milliseconds)
        signal?.addEventListener("abort", () => {
            window.clearTimeout(timeoutId)
            reject(new DOMException("Aborted", "AbortError"))
        }, { once: true })
    })
}

async function waitForImportJob(endpoint, jobId, { onProgress, signal } = {}) {
    while (true) {
        const response = await apiClient.get(`${endpoint}/import-jobs/${jobId}`, { signal })
        const job = response.data.data.job
        onProgress?.(job)
        if (job.status === "COMPLETED") return job.result
        if (job.status === "FAILED") {
            const error = new Error(job.error?.message || "Attendance import failed.")
            error.code = job.error?.code
            error.importSummary = job.error?.details?.importSummary || null
            throw error
        }
        await delay(500, signal)
    }
}

export async function importAttendance(file, { onUploadProgress, onProgress, signal } = {}) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(
        `${ATTENDANCE_ENDPOINT}/import-jobs`,
        formData,
        {
            timeout: 0,
            onUploadProgress,
            signal,
        },
    )

    return waitForImportJob(ATTENDANCE_ENDPOINT, response.data.data.job.jobId, { onProgress, signal })
}

export async function fetchAttendanceImportIssues(params = {}) {
    const response = await apiClient.get(
        `${ATTENDANCE_ENDPOINT}/import-issues`,
        { params: withoutBlankParams(params) },
    )

    return response.data.data
}

export async function exportAttendanceRecords(params = {}) {
    const response = await apiClient.get(`${ATTENDANCE_ENDPOINT}/export`, {
        params: withoutBlankParams(params),
        responseType: "blob",
        timeout: 0,
    })
    downloadBlob(response.data, "attendance-records.xlsx")
}

export async function fetchAttendanceDailyReport(params = {}) {
    const response = await apiClient.post(`${ATTENDANCE_ENDPOINT}/daily-report/jobs`, {}, {
        params: withoutBlankParams(params),
        timeout: 0,
    })
    return response.data.data.job
}

export async function exportAttendanceDailyReport(params = {}) {
    const response = await apiClient.post(`${ATTENDANCE_ENDPOINT}/daily-report/export-jobs`, {}, {
        params: withoutBlankParams(params),
        timeout: 0,
    })
    return response.data.data.job
}

export async function fetchAttendanceDailyReportJob(jobId, exportJob = false) {
    const segment = exportJob ? "export-jobs" : "jobs"
    const response = await apiClient.get(`${ATTENDANCE_ENDPOINT}/daily-report/${segment}/${jobId}`)
    return response.data.data.job
}

export async function downloadAttendanceDailyReportExport(jobId, fileName) {
    const response = await apiClient.get(`${ATTENDANCE_ENDPOINT}/daily-report/export-jobs/${jobId}/download`, {
        responseType: "blob",
        timeout: 0,
    })
    downloadBlob(response.data, fileName || "attendance-daily-report.xlsx")
}


const POLICY_ENDPOINT = "/attendance/policies"
const SCAN_ENDPOINT = "/attendance/scans"
const VERIFICATION_ENDPOINT = "/attendance/verification"


export async function fetchAttendancePolicies(params = {}) {
    const response = await apiClient.get(POLICY_ENDPOINT, { params })
    return response.data.data
}

export async function archiveAttendancePolicy(policyId) {
    const response = await apiClient.patch(`${POLICY_ENDPOINT}/${policyId}/archive`)
    return response.data.data.policy
}

export async function createAttendancePolicy(payload) {
    const response = await apiClient.post(POLICY_ENDPOINT, payload)
    return response.data.data.policy
}

export async function updateAttendancePolicy(policyId, payload) {
    const response = await apiClient.patch(
        `${POLICY_ENDPOINT}/${policyId}`,
        payload,
    )
    return response.data.data.policy
}

export async function fetchRawScans(params) {
    const response = await apiClient.get(
        SCAN_ENDPOINT,
        { params },
    )
    return response.data.data
}

export async function downloadRawScanTemplate() {
    const response = await apiClient.get(
        `${SCAN_ENDPOINT}/template`,
        {
            responseType: "blob",
            timeout: 0,
        },
    )
    downloadBlob(response.data, "attendance-raw-scan-template.xlsx")
}

export async function importRawScans(file, { onUploadProgress, onProgress, signal } = {}) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(
        `${SCAN_ENDPOINT}/import-jobs`,
        formData,
        {
            timeout: 0,
            onUploadProgress,
            signal,
        },
    )
    return waitForImportJob(SCAN_ENDPOINT, response.data.data.job.jobId, { onProgress, signal })
}

export async function runAttendanceVerification(payload) {
    const response = await apiClient.post(
        `${VERIFICATION_ENDPOINT}/run`,
        payload,
        { timeout: 0 },
    )
    return response.data.data.summary
}
