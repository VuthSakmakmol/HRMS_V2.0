
import { defineStore } from "pinia"

import {
    archiveEmployeeMovement,
    createEmployeeMovement,
    downloadEmployeeMovementImportTemplate,
    exportEmployeeMovements,
    fetchEmployeeMovements,
    importEmployeeMovements,
    updateEmployeeMovement,
} from "../services/employeeMovement.api.js"

function buildCleanFilters(filters) {
    const cleanFilters = { ...filters }
    for (const key of Object.keys(cleanFilters)) {
        if (cleanFilters[key] === "" || cleanFilters[key] === null || cleanFilters[key] === undefined) {
            delete cleanFilters[key]
        }
    }
    return cleanFilters
}

export const useEmployeeMovementStore = defineStore("employeeMovement", {
    state: () => ({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        filters: { page: 1, limit: 20, search: "", status: "ACTIVE", movementType: "ALL", source: "ALL", employeeId: undefined, companyId: undefined, branchId: undefined, departmentId: undefined, positionId: undefined, lineId: undefined, shiftId: undefined, employeeTypeId: undefined, employeeTypeChildId: undefined, fromDate: undefined, toDate: undefined },
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
        async loadEmployeeMovements(params = {}) {
            this.loading = true
            this.error = null
            this.filters = { ...this.filters, ...params }
            try {
                const result = await fetchEmployeeMovements(buildCleanFilters(this.filters))
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

        async createEmployeeMovement(payload) {
            this.saving = true
            this.error = null
            try {
                return await createEmployeeMovement(payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async updateEmployeeMovement(id, payload) {
            this.saving = true
            this.error = null
            try {
                return await updateEmployeeMovement(id, payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async archiveEmployeeMovement(id) {
            this.archiving = true
            this.error = null
            try {
                return await archiveEmployeeMovement(id)
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
                await downloadEmployeeMovementImportTemplate()
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.downloadingTemplate = false
            }
        },

        async exportEmployeeMovements() {
            this.exporting = true
            this.error = null
            try {
                await exportEmployeeMovements(buildCleanFilters(this.filters))
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.exporting = false
            }
        },

        async importEmployeeMovements(file) {
            this.importing = true
            this.importProgress = 0
            this.importSummary = null
            this.error = null
            try {
                const summary = await importEmployeeMovements(file, (event) => {
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
