import { defineStore } from "pinia"

import {
    clearAccessToken,
    getStoredAccessToken,
    saveAccessToken,
} from "@/shared/auth/auth.storage.js"

import {
    apiClient,
    setApiAccessToken,
} from "@/shared/services/apiClient.js"
import { clearActiveWorkspaceContext } from "@/shared/workspace/workspace.storage.js"

function getLoginPayload(response) {
    const payload = response?.data?.data

    if (!payload?.accessToken || !payload?.user) {
        throw new Error("Invalid login response from backend.")
    }

    return payload
}

export const useAuthStore = defineStore("auth", {
    state: () => ({
        accessToken: getStoredAccessToken(),
        user: null,
        initialized: false,
    }),

    getters: {
        isAuthenticated(state) {
            return Boolean(state.accessToken && state.user)
        },

        isRootAdmin(state) {
            return Boolean(state.user?.isRootAdmin)
        },

        permissionCodes(state) {
            return state.user?.effectivePermissionCodes || []
        },
    },

    actions: {
        async login({ loginId, password }) {
            const response = await apiClient.post("/auth/login", {
                loginId: String(loginId || "").trim(),
                password,
            })

            const payload = getLoginPayload(response)

            saveAccessToken(payload.accessToken)
            setApiAccessToken(payload.accessToken)

            this.accessToken = payload.accessToken
            this.user = payload.user
            this.initialized = true

            return payload.user
        },

        async bootstrap() {
            if (this.initialized) {
                return
            }

            const accessToken = getStoredAccessToken()

            if (!accessToken) {
                this.accessToken = null
                this.user = null
                this.initialized = true
                return
            }

            this.accessToken = accessToken
            setApiAccessToken(accessToken)

            try {
                const response = await apiClient.get("/auth/me", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                })

                const user = response.data?.data?.user

                if (!user) {
                    throw new Error("Backend did not return authenticated user.")
                }

                this.user = user
            } catch {
                this.clearSession()
            } finally {
                this.initialized = true
            }
        },

        clearSession() {
            clearAccessToken()
            setApiAccessToken(null)

            this.accessToken = null
            this.user = null
            clearActiveWorkspaceContext()
        },

        logout() {
            this.clearSession()
            this.initialized = true
        },

        hasPermission(permissionCode) {
            if (this.isRootAdmin) {
                return true
            }

            return this.permissionCodes.includes(permissionCode)
        },
    },
})
