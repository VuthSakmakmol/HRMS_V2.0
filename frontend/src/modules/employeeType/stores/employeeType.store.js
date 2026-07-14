import { defineStore } from "pinia"

import {
    archiveEmployeeType,
    createEmployeeType,
    downloadEmployeeTypeImportTemplate,
    exportEmployeeTypes,
    fetchEmployeeTypes,
    importEmployeeTypes,
    updateEmployeeType,
} from "../services/employeeType.api.js"

function buildCleanFilters(filters) {
    return Object.fromEntries(
        Object.entries(filters).filter(([, value]) =>
            value !== "" && value !== null && value !== undefined,
        ),
    )
}

export const useEmployeeTypeStore = defineStore("employeeType", {
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
            dashboardCategory: "ALL",
            companyId: undefined,
            branchId: undefined,
            departmentId: undefined,
            positionId: undefined,
        },

        loading: false,
        saving: false,
        archiving: false,
        downloadingTemplate: false,
        exporting: false,
        importing: false,
        importProgress: 0,
        importSummary: null,
        error: null,
    }),

    actions: {
        async loadEmployeeTypes(params = {}) {
            this.loading = true
            this.error = null
            this.filters = { ...this.filters, ...params }

            try {
                const result = await fetchEmployeeTypes(buildCleanFilters(this.filters))
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

        async createEmployeeType(payload) {
            this.saving = true
            this.error = null
            try {
                return await createEmployeeType(payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async updateEmployeeType(employeeTypeId, payload) {
            this.saving = true
            this.error = null
            try {
                return await updateEmployeeType(employeeTypeId, payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async archiveEmployeeType(employeeTypeId) {
            this.archiving = true
            this.error = null
            try {
                return await archiveEmployeeType(employeeTypeId)
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
                await downloadEmployeeTypeImportTemplate()
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.downloadingTemplate = false
            }
        },

        async exportEmployeeTypes() {
            this.exporting = true
            this.error = null
            try {
                await exportEmployeeTypes(buildCleanFilters(this.filters))
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.exporting = false
            }
        },

        async importEmployeeTypes(file) {
            this.importing = true
            this.importProgress = 1
            this.importSummary = null
            this.error = null
            let processingTimer = null

            const startProcessingProgress = () => {
                if (processingTimer) return
                processingTimer = window.setInterval(() => {
                    if (this.importProgress < 95) this.importProgress += 1
                }, 800)
            }

            try {
                const summary = await importEmployeeTypes(file, (event) => {
                    if (!event.total) {
                        startProcessingProgress()
                        return
                    }
                    const uploadPercent = Math.round((event.loaded * 70) / event.total)
                    this.importProgress = Math.max(3, uploadPercent)
                    if (event.loaded >= event.total) {
                        this.importProgress = Math.max(this.importProgress, 72)
                        startProcessingProgress()
                    }
                })
                this.importProgress = 100
                this.importSummary = summary
                return summary
            } catch (error) {
                this.error = error
                throw error
            } finally {
                if (processingTimer) window.clearInterval(processingTimer)
                window.setTimeout(() => { this.importing = false }, 500)
            }
        },
    },
})
