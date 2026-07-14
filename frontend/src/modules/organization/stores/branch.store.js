import { defineStore } from "pinia"

import {
    archiveBranch,
    createBranch,
    fetchBranches,
    updateBranch,
} from "../services/branch.api.js"

export const useBranchStore = defineStore("branch", {
    state: () => ({
        items: [],

        pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 1,
        },

        filters: {
            page: 1,
            limit: 20,
            search: "",
            status: "ALL",
            companyId: undefined,
        },

        loading: false,
        saving: false,
        archiving: false,

        error: null,
    }),

    actions: {
        async loadBranches(params = {}) {
            this.loading = true
            this.error = null

            this.filters = {
                ...this.filters,
                ...params,
            }

            const cleanFilters = {
                ...this.filters,
            }

            if (!cleanFilters.companyId) {
                delete cleanFilters.companyId
            }

            try {
                const result = await fetchBranches(cleanFilters)

                this.items = result.items || []
                this.pagination = result.pagination || {
                    page: this.filters.page,
                    limit: this.filters.limit,
                    total: 0,
                    totalPages: 1,
                }

                return result
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.loading = false
            }
        },

        async createBranch(payload) {
            this.saving = true
            this.error = null

            try {
                return await createBranch(payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async updateBranch(branchId, payload) {
            this.saving = true
            this.error = null

            try {
                return await updateBranch(branchId, payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async archiveBranch(branchId) {
            this.archiving = true
            this.error = null

            try {
                return await archiveBranch(branchId)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.archiving = false
            }
        },
    },
})