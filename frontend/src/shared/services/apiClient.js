import axios from "axios"

import { getStoredAccessToken } from "@/shared/auth/auth.storage.js"
import { toApiError } from "@/shared/errors/ApiError.js"
import { getActiveWorkspaceContext } from "@/shared/workspace/workspace.storage.js"

export const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
    timeout: 30_000,
    headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
    },
})

export function setApiAccessToken(accessToken) {
    if (accessToken) {
        apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`
        return
    }

    delete apiClient.defaults.headers.common.Authorization
}

setApiAccessToken(getStoredAccessToken())

apiClient.interceptors.request.use((config) => {
    const accessToken = getStoredAccessToken()

    if (accessToken) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${accessToken}`
    }

    config.headers = config.headers || {}
    config.headers["x-client-request-id"] = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`

    const skipWorkspace =
        String(config.headers["x-skip-workspace-context"] || "") === "1"

    if (skipWorkspace) {
        delete config.headers["x-skip-workspace-context"]
    } else {
        const workspace = getActiveWorkspaceContext()

        config.params = {
            ...(config.params || {}),
            ...(workspace.companyId
                ? { companyId: workspace.companyId }
                : {}),
            ...(workspace.branchId
                ? { branchId: workspace.branchId }
                : {}),
        }

        if (workspace.companyId) {
            config.headers["x-workspace-company-id"] = workspace.companyId
        }

        if (workspace.branchId) {
            config.headers["x-workspace-branch-id"] = workspace.branchId
        }

        const method = String(config.method || "get").toLowerCase()
        const isJsonMutation =
            ["post", "put", "patch"].includes(method) &&
            config.data &&
            typeof config.data === "object" &&
            !(typeof FormData !== "undefined" && config.data instanceof FormData)

        if (isJsonMutation) {
            config.data = {
                ...config.data,
                ...(workspace.companyId
                    ? { companyId: workspace.companyId }
                    : {}),
                ...(workspace.branchId
                    ? { branchId: workspace.branchId }
                    : {}),
            }
        }
    }

    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
        if (typeof config.headers.delete === "function") {
            config.headers.delete("Content-Type")
            config.headers.delete("content-type")
        } else {
            delete config.headers["Content-Type"]
            delete config.headers["content-type"]
        }
    }

    return config
})

apiClient.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(toApiError(error)),
)
