import { apiClient } from "@/shared/services/apiClient.js"

const ATTENDANCE_ENDPOINT = "/attendance"

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
    const response = await apiClient.get(ATTENDANCE_ENDPOINT, { params })
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
            responseType: "blob",
            timeout: 0,
        },
    )

    downloadBlob(response.data, "attendance-import-template.xlsx")
}

export async function importAttendance(file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(
        `${ATTENDANCE_ENDPOINT}/import`,
        formData,
        {
            timeout: 0,
            onUploadProgress,
        },
    )

    return response.data.data.summary
}


const POLICY_ENDPOINT = "/attendance/policies"
const SCAN_ENDPOINT = "/attendance/scans"
const VERIFICATION_ENDPOINT = "/attendance/verification"


export async function fetchAttendancePolicies(params = {}) {
    const response = await apiClient.get(POLICY_ENDPOINT, { params })
    return response.data.data.items || []
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

export async function importRawScans(file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(
        `${SCAN_ENDPOINT}/import`,
        formData,
        {
            timeout: 0,
            onUploadProgress,
        },
    )
    return response.data.data.summary
}

export async function runAttendanceVerification(payload) {
    const response = await apiClient.post(
        `${VERIFICATION_ENDPOINT}/run`,
        payload,
        { timeout: 0 },
    )
    return response.data.data.summary
}
