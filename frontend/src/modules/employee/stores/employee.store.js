import { defineStore } from "pinia"

import {
    archiveEmployee,
    createEmployee,
    downloadEmployeeImportTemplate,
    exportEmployees,
    fetchEmployeeApprovalPreview,
    fetchEmployees,
    importEmployees,
    updateEmployee,
} from "../services/employee.api.js"

function buildCleanFilters(filters) {
    const clean = { ...filters }
    for (const key of ["companyId", "branchId", "departmentId", "positionId", "lineId", "shiftId"]) {
        if (!clean[key]) delete clean[key]
    }
    return clean
}

export const useEmployeeStore = defineStore("employee", {
    state: () => ({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        filters: {
            page: 1,
            limit: 20,
            search: "",
            employmentStatus: "ALL",
            recordStatus: "ACTIVE",
            companyId: undefined,
            branchId: undefined,
            departmentId: undefined,
            positionId: undefined,
            lineId: undefined,
            shiftId: undefined,
        },
        loading: false,
        saving: false,
        archiving: false,
        exporting: false,
        downloadingTemplate: false,
        importing: false,
        importProgress: 0,
        importSummary: null,
        approvalPreview: null,
        approvalLoading: false,
        error: null,
    }),

    actions: {
        async loadEmployees(params = {}) {
            this.loading = true
            this.error = null
            this.filters = { ...this.filters, ...params }
            try {
                const result = await fetchEmployees(buildCleanFilters(this.filters))
                this.items = result.items || []
                this.pagination = result.pagination || this.pagination
                return result
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.loading = false
            }
        },

        async createEmployee(payload) {
            this.saving = true
            this.error = null
            try { return await createEmployee(payload) }
            catch (error) { this.error = error; throw error }
            finally { this.saving = false }
        },

        async updateEmployee(employeeId, payload) {
            this.saving = true
            this.error = null
            try { return await updateEmployee(employeeId, payload) }
            catch (error) { this.error = error; throw error }
            finally { this.saving = false }
        },

        async archiveEmployee(employeeId) {
            this.archiving = true
            this.error = null
            try { return await archiveEmployee(employeeId) }
            catch (error) { this.error = error; throw error }
            finally { this.archiving = false }
        },

        async loadApprovalPreview(params) {
            this.approvalLoading = true
            this.approvalPreview = null
            try {
                this.approvalPreview = await fetchEmployeeApprovalPreview(params)
                return this.approvalPreview
            } finally {
                this.approvalLoading = false
            }
        },

        async downloadImportTemplate() {
            this.downloadingTemplate = true
            try { await downloadEmployeeImportTemplate() }
            finally { this.downloadingTemplate = false }
        },

        async exportEmployees() {
            this.exporting = true
            try { await exportEmployees(buildCleanFilters(this.filters)) }
            finally { this.exporting = false }
        },

        async importEmployees(file, context = {}) {
            this.importing = true
            this.importProgress = 1
            this.importSummary = null
            let timer = null
            const startProcessing = () => {
                if (timer) return
                timer = window.setInterval(() => {
                    if (this.importProgress < 95) this.importProgress += 1
                }, 800)
            }
            try {
                const summary = await importEmployees(file, context, (event) => {
                    if (!event.total) return startProcessing()
                    const uploaded = Math.round((event.loaded * 70) / event.total)
                    this.importProgress = Math.max(3, uploaded)
                    if (event.loaded >= event.total) {
                        this.importProgress = Math.max(this.importProgress, 72)
                        startProcessing()
                    }
                })
                this.importProgress = 100
                this.importSummary = summary
                return summary
            } finally {
                if (timer) window.clearInterval(timer)
                window.setTimeout(() => { this.importing = false }, 500)
            }
        },
    },
})
