import { apiClient } from "@/shared/services/apiClient.js"

const LOCATION_ENDPOINT = "/organization/locations"

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

export async function fetchLocationLookup(entity, params = {}) {
    const response = await apiClient.get(
        `${LOCATION_ENDPOINT}/${entity}/lookup`,
        {
            params: {
                page: 1,
                limit: 100,
                status: "ACTIVE",
                ...params,
            },
        },
    )

    return response.data.data.items || []
}

export async function fetchLocations(entity, params = {}) {
    const response = await apiClient.get(`${LOCATION_ENDPOINT}/${entity}`, {
        params,
    })

    return response.data.data
}

export async function createLocation(entity, payload) {
    const response = await apiClient.post(`${LOCATION_ENDPOINT}/${entity}`, payload)

    return response.data.data.location
}

export async function updateLocation(entity, locationId, payload) {
    const response = await apiClient.patch(
        `${LOCATION_ENDPOINT}/${entity}/${locationId}`,
        payload,
    )

    return response.data.data.location
}

export async function archiveLocation(entity, locationId) {
    const response = await apiClient.patch(
        `${LOCATION_ENDPOINT}/${entity}/${locationId}/archive`,
    )

    return response.data.data.location
}

export async function downloadLocationImportTemplate(entity) {
    const response = await apiClient.get(
        `${LOCATION_ENDPOINT}/${entity}/import-template`,
        {
            responseType: "blob",
            timeout: 0,
        },
    )

    downloadBlob(
        response.data,
        getFilenameFromResponse(response, `${entity}-import-template.xlsx`),
    )
}

export async function exportLocations(entity, params = {}) {
    const response = await apiClient.get(`${LOCATION_ENDPOINT}/${entity}/export`, {
        params,
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(
        response.data,
        getFilenameFromResponse(response, `${entity}-export.xlsx`),
    )
}

export async function importLocations(entity, file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(
        `${LOCATION_ENDPOINT}/${entity}/import`,
        formData,
        {
            timeout: 0,
            headers: {
                Accept: "application/json",
            },
            onUploadProgress,
        },
    )

    return response.data.data.summary
}
