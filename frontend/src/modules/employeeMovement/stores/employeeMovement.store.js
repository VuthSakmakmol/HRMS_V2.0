import { defineStore } from "pinia"
import {
    exportEmployeeMovements,
    fetchEmployeeMovement,
    fetchEmployeeMovements,
} from "../services/employeeMovement.api.js"

function clean(value) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== "" && item !== null && item !== undefined))
}

export const useEmployeeMovementStore = defineStore("employeeMovement", {
    state: () => ({
        items: [],
        selected: null,
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
        filters: { page: 1, limit: 10, search: "", status: "ALL", movementType: "ALL", source: "ALL", departmentId: undefined, fromDate: undefined, toDate: undefined },
        loading: false,
        loadingDetail: false,
        exporting: false,
        error: null,
    }),
    actions: {
        async loadEmployeeMovements(params = {}) {
            Object.assign(this.filters, params)
            this.loading = true
            this.error = null
            try {
                const result = await fetchEmployeeMovements(clean(this.filters))
                this.items = result.items || []
                this.pagination = result.pagination || this.pagination
                return result
            } catch (error) {
                this.error = error
                throw error
            } finally { this.loading = false }
        },
        async loadEmployeeMovement(id) {
            this.loadingDetail = true
            try {
                this.selected = await fetchEmployeeMovement(id)
                return this.selected
            } finally { this.loadingDetail = false }
        },
        async exportEmployeeMovements() {
            this.exporting = true
            try { await exportEmployeeMovements(clean(this.filters)) }
            finally { this.exporting = false }
        },
    },
})
