import { apiClient } from "@/shared/services/apiClient.js"

const CALENDAR_ENDPOINT = "/calendar"

function getFilenameFromResponse(response, fallbackFilename) {
    const contentDisposition =
        response.headers?.["content-disposition"] ||
        response.headers?.["Content-Disposition"]

    if (!contentDisposition) {
        return fallbackFilename
    }

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

export async function fetchCalendarDays(params = {}) {
    const response = await apiClient.get(`${CALENDAR_ENDPOINT}/days`, { params })
    return response.data.data
}

export async function createCalendarDay(payload) {
    const response = await apiClient.post(`${CALENDAR_ENDPOINT}/days`, payload)
    return response.data.data.day
}

export async function updateCalendarDay(calendarDayId, payload) {
    const response = await apiClient.patch(
        `${CALENDAR_ENDPOINT}/days/${calendarDayId}`,
        payload,
    )

    return response.data.data.day
}

export async function archiveCalendarDay(calendarDayId) {
    const response = await apiClient.patch(
        `${CALENDAR_ENDPOINT}/days/${calendarDayId}/archive`,
    )

    return response.data.data.day
}

export async function resolveCalendarDay(params = {}) {
    const response = await apiClient.get(`${CALENDAR_ENDPOINT}/resolve/day`, {
        params,
    })

    return response.data.data.day
}

export async function resolveCalendarRange(params = {}) {
    const response = await apiClient.get(`${CALENDAR_ENDPOINT}/resolve/range`, {
        params,
    })

    return response.data.data
}

export async function downloadCalendarImportTemplate() {
    const response = await apiClient.get(`${CALENDAR_ENDPOINT}/days/import-template`, {
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(
        response.data,
        getFilenameFromResponse(response, "calendar-import-template.xlsx"),
    )
}

export async function exportCalendarDays(params = {}) {
    const response = await apiClient.get(`${CALENDAR_ENDPOINT}/days/export`, {
        params,
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(
        response.data,
        getFilenameFromResponse(response, "calendar-days-export.xlsx"),
    )
}

export async function importCalendarDays(file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(
        `${CALENDAR_ENDPOINT}/days/import`,
        formData,
        {
            timeout: 0,
            onUploadProgress,
        },
    )

    return response.data.data.summary
}
