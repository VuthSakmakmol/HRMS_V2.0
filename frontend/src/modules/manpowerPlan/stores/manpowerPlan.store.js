
import { defineStore } from "pinia"

import {
    archiveManpowerPlan,
    createManpowerPlan,
    downloadManpowerPlanImportTemplate,
    exportManpowerPlans,
    fetchManpowerPlans,
    importManpowerPlans,
    updateManpowerPlan,
} from "../services/manpowerPlan.api.js"

function buildCleanFilters(filters) {
    const cleanFilters = { ...filters }
    for (const key of Object.keys(cleanFilters)) {
        if (cleanFilters[key] === "" || cleanFilters[key] === null || cleanFilters[key] === undefined) {
            delete cleanFilters[key]
        }
    }
    return cleanFilters
}

export const useManpowerPlanStore = defineStore("manpowerPlan", {
    state: () => ({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        filters: { page: 1, limit: 20, search: "", status: "ACTIVE", companyId: undefined, branchId: undefined, year: new Date().getFullYear(), month: undefined, departmentId: undefined, positionId: undefined, lineId: undefined, shiftId: undefined, employeeTypeId: undefined, employeeTypeChildId: undefined },
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
        async loadManpowerPlans(params = {}) {
            this.loading = true
            this.error = null
            this.filters = { ...this.filters, ...params }
            try {
                const result = await fetchManpowerPlans(buildCleanFilters(this.filters))
                this.items = result.items || []
                this.pagination = result.pagination || { page: this.filters.page, limit: this.filters.limit, total: 0, totalPages: 1 }
                return result
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.loading = false
            }
        },

        async createManpowerPlan(payload) {
            this.saving = true
            this.error = null
            try {
                return await createManpowerPlan(payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async updateManpowerPlan(id, payload) {
            this.saving = true
            this.error = null
            try {
                return await updateManpowerPlan(id, payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async archiveManpowerPlan(id) {
            this.archiving = true
            this.error = null
            try {
                return await archiveManpowerPlan(id)
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
                await downloadManpowerPlanImportTemplate()
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.downloadingTemplate = false
            }
        },

        async exportManpowerPlans() {
            this.exporting = true
            this.error = null
            try {
                await exportManpowerPlans(buildCleanFilters(this.filters))
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.exporting = false
            }
        },

        async importManpowerPlans(file) {
            this.importing = true
            this.importProgress = 0
            this.importSummary = null
            this.error = null
            try {
                const summary = await importManpowerPlans(file, (event) => {
                    if (!event.total) return
                    this.importProgress = Math.round((event.loaded * 100) / event.total)
                })
                this.importSummary = summary
                return summary
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.importing = false
            }
        },
    },
})
