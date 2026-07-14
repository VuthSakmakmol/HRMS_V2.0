import { defineStore } from "pinia"

import {
    archiveCompany,
    createCompany,
    fetchCompanies,
    updateCompany,
} from "../services/company.api.js"

export const useCompanyStore = defineStore("company", {
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
        },

        loading: false,
        saving: false,
        archiving: false,

        error: null,
    }),

    actions: {
        async loadCompanies(params = {}) {
            this.loading = true
            this.error = null

            this.filters = {
                ...this.filters,
                ...params,
            }

            try {
                const result = await fetchCompanies(this.filters)

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

        async createCompany(payload) {
            this.saving = true
            this.error = null

            try {
                return await createCompany(payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async updateCompany(companyId, payload) {
            this.saving = true
            this.error = null

            try {
                return await updateCompany(companyId, payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async archiveCompany(companyId) {
            this.archiving = true
            this.error = null

            try {
                return await archiveCompany(companyId)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.archiving = false
            }
        },
    },
})