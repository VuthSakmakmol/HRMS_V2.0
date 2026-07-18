import { apiClient } from "@/shared/services/apiClient.js"

const ENDPOINT = "/reports/manpower-plans"

function unwrap(response) {
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

export async function listManpowerPlans(params = {}, signal) {
    const response = await apiClient.get(ENDPOINT, {
        params,
        signal,
    })
    const data = unwrap(response)

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

export async function getPlanningGrid(params, signal) {
    const response = await apiClient.get(`${ENDPOINT}/planning-grid`, {
        params,
        signal,
    })

    return unwrap(response)
}

export async function savePlanningGrid(payload) {
    const response = await apiClient.put(`${ENDPOINT}/batch`, payload, {
        timeout: 0,
    })

    return unwrap(response).result
}

export async function updateManpowerPlan(manpowerPlanId, payload) {
    const response = await apiClient.patch(
        `${ENDPOINT}/${manpowerPlanId}`,
        payload,
    )

    return unwrap(response).manpowerPlan
}

export async function archiveManpowerPlan(manpowerPlanId) {
    const response = await apiClient.patch(
        `${ENDPOINT}/${manpowerPlanId}/archive`,
    )

    return unwrap(response).manpowerPlan
}

export async function lookupDepartments(params = {}, signal) {
    const response = await apiClient.get(
        "/organization/departments/lookup",
        {
            params: {
                limit: 100,
                status: "ACTIVE",
                ...params,
            },
            signal,
        },
    )

    return unwrap(response).items ?? []
}

export async function lookupPositions(params = {}, signal) {
    const items = []
    let page = 1
    let totalPages = 1

    do {
        const response = await apiClient.get("/organization/positions", {
            params: {
                page,
                limit: 100,
                status: "ACTIVE",
                ...params,
            },
            signal,
        })
        const data = unwrap(response)

        items.push(...(data.items ?? []))
        totalPages = Number(data.pagination?.totalPages ?? 1)
        page += 1
    } while (page <= totalPages)

    return items
}

export async function lookupLines(params = {}, signal) {
    const items = []
    let page = 1
    let totalPages = 1

    do {
        const response = await apiClient.get("/organization/lines", {
            params: {
                page,
                limit: 100,
                status: "ACTIVE",
                ...params,
            },
            signal,
        })
        const data = unwrap(response)

        items.push(...(data.items ?? []))
        totalPages = Number(data.pagination?.totalPages ?? 1)
        page += 1
    } while (page <= totalPages)

    return items
}

export async function lookupShifts(params = {}, signal) {
    const response = await apiClient.get("/organization/shifts", {
        params: {
            page: 1,
            limit: 100,
            status: "ACTIVE",
            ...params,
        },
        signal,
    })

    return unwrap(response).items ?? []
}

export async function lookupEmployeeTypes(params = {}, signal) {
    const items = []
    let page = 1
    let totalPages = 1

    do {
        const response = await apiClient.get(
            "/organization/employee-types",
            {
                params: {
                    page,
                    limit: 100,
                    status: "ACTIVE",
                    ...params,
                },
                signal,
            },
        )
        const data = unwrap(response)

        items.push(...(data.items ?? []))
        totalPages = Number(data.pagination?.totalPages ?? 1)
        page += 1
    } while (page <= totalPages)

    return items.map((item) => ({
        ...item,
        id: String(item.id || item._id || ""),
        positionIds: (item.positionIds || []).map((position) =>
            String(position?.id || position?._id || position),
        ),
        children: (item.children || []).map((child) => ({
            ...child,
            id: String(child.id || child._id || child.code || ""),
            positionIds: (child.positionIds || []).map((position) =>
                String(position?.id || position?._id || position),
            ),
        })),
    }))
}

export async function downloadManpowerPlanTemplate() {
    const response = await apiClient.get(`${ENDPOINT}/import-template`, {
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(response.data, "manpower-plan-import-template.xlsx")
}

export async function exportManpowerPlans(params = {}) {
    const response = await apiClient.get(`${ENDPOINT}/export`, {
        params,
        responseType: "blob",
        timeout: 0,
    })

    downloadBlob(response.data, "manpower-plans-export.xlsx")
}

export async function importManpowerPlans(file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(`${ENDPOINT}/import`, formData, {
        timeout: 0,
        onUploadProgress,
    })

    return unwrap(response).summary
}
