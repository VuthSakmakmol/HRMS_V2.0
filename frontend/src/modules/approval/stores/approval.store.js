import { defineStore } from "pinia"

import {
    archiveApprovalModule,
    archiveApprovalPolicy,
    createApprovalModule,
    createApprovalPolicy,
    fetchApprovalModules,
    fetchApprovalPolicies,
    fetchApprovalRequests,
    fetchResolverOptions,
    resolveApprovalPreview,
    updateApprovalModule,
    updateApprovalPolicy,
} from "../services/approval.api.js"

function cleanParams(params) {
    const result = { ...params }

    for (const [key, value] of Object.entries(result)) {
        if (value === "" || value === null || value === undefined) {
            delete result[key]
        }
    }

    return result
}

export const useApprovalStore = defineStore("approval", {
    state: () => ({
        modules: [],
        modulePagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 1,
        },
        policies: [],
        policyPagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 1,
        },
        requests: [],
        requestPagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 1,
        },
        resolverOptions: [],
        preview: null,
        loading: false,
        saving: false,
        archiving: false,
        previewing: false,
        error: null,
    }),

    actions: {
        async loadModules(params = {}) {
            this.loading = true
            this.error = null
            try {
                const result = await fetchApprovalModules(cleanParams(params))
                this.modules = result.items || []
                this.modulePagination = result.pagination || this.modulePagination
                return result
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.loading = false
            }
        },

        async saveModule(moduleId, payload) {
            this.saving = true
            this.error = null
            try {
                return moduleId
                    ? await updateApprovalModule(moduleId, payload)
                    : await createApprovalModule(payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async archiveModule(moduleId) {
            this.archiving = true
            this.error = null
            try {
                return await archiveApprovalModule(moduleId)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.archiving = false
            }
        },

        async loadResolverOptions() {
            this.resolverOptions = await fetchResolverOptions()
            return this.resolverOptions
        },

        async loadPolicies(params = {}) {
            this.loading = true
            this.error = null
            try {
                const result = await fetchApprovalPolicies(cleanParams(params))
                this.policies = result.items || []
                this.policyPagination = result.pagination || this.policyPagination
                return result
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.loading = false
            }
        },

        async savePolicy(policyId, payload) {
            this.saving = true
            this.error = null
            try {
                return policyId
                    ? await updateApprovalPolicy(policyId, payload)
                    : await createApprovalPolicy(payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async archivePolicy(policyId) {
            this.archiving = true
            this.error = null
            try {
                return await archiveApprovalPolicy(policyId)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.archiving = false
            }
        },

        async previewPolicy(payload) {
            this.previewing = true
            this.error = null
            try {
                this.preview = await resolveApprovalPreview(payload)
                return this.preview
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.previewing = false
            }
        },

        async loadRequests(params = {}) {
            this.loading = true
            this.error = null
            try {
                const result = await fetchApprovalRequests(cleanParams(params))
                this.requests = result.items || []
                this.requestPagination = result.pagination || this.requestPagination
                return result
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.loading = false
            }
        },
    },
})
