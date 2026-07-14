import { defineStore } from "pinia"

import {
    archiveDepartment,
    createDepartment,
    downloadDepartmentImportTemplate,
    exportDepartments,
    fetchDepartments,
    importDepartments,
    updateDepartment,
} from "../services/department.api.js"

export const useDepartmentStore = defineStore("department", {
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
            branchId: undefined,
        },

        loading: false,
        saving: false,
        archiving: false,
        importing: false,
        exporting: false,
        downloadingTemplate: false,

        error: null,
    }),

    actions: {
        async loadDepartments(params = {}) {
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

            if (!cleanFilters.branchId) {
                delete cleanFilters.branchId
            }

            try {
                const result = await fetchDepartments(cleanFilters)

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

        async createDepartment(payload) {
            this.saving = true
            this.error = null

            try {
                return await createDepartment(payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async updateDepartment(departmentId, payload) {
            this.saving = true
            this.error = null

            try {
                return await updateDepartment(departmentId, payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async archiveDepartment(departmentId) {
            this.archiving = true
            this.error = null

            try {
                return await archiveDepartment(departmentId)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.archiving = false
            }
        },

        async downloadImportTemplate() {
            this.downloadingTemplate = true
            this.error = null

            try {
                await downloadDepartmentImportTemplate()
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.downloadingTemplate = false
            }
        },

        async exportDepartments(params = {}) {
            this.exporting = true
            this.error = null

            try {
                await exportDepartments(params)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.exporting = false
            }
        },

        async importDepartments(file, options = {}) {
            this.importing = true
            this.error = null

            try {
                return await importDepartments(file, options)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.importing = false
            }
        },
    },
})
