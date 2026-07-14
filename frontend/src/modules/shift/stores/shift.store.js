import { defineStore } from "pinia"

import {
    archiveShift,
    createShift,
    downloadShiftImportTemplate,
    exportShifts,
    fetchShifts,
    importShifts,
    updateShift,
} from "../services/shift.api.js"

function buildCleanFilters(filters) {
    const cleanFilters = {
        ...filters,
    }

    if (!cleanFilters.companyId) {
        delete cleanFilters.companyId
    }

    if (!cleanFilters.branchId) {
        delete cleanFilters.branchId
    }

    return cleanFilters
}

export const useShiftStore = defineStore("shift", {
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

        downloadingTemplate: false,
        exporting: false,
        importing: false,
        importProgress: 0,
        importSummary: null,

        error: null,
    }),

    actions: {
        async loadShifts(params = {}) {
            this.loading = true
            this.error = null

            this.filters = {
                ...this.filters,
                ...params,
            }

            try {
                const result = await fetchShifts(
                    buildCleanFilters(this.filters),
                )

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

        async createShift(payload) {
            this.saving = true
            this.error = null

            try {
                return await createShift(payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async updateShift(shiftId, payload) {
            this.saving = true
            this.error = null

            try {
                return await updateShift(shiftId, payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async archiveShift(shiftId) {
            this.archiving = true
            this.error = null

            try {
                return await archiveShift(shiftId)
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
                await downloadShiftImportTemplate()
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.downloadingTemplate = false
            }
        },

        async exportShifts() {
            this.exporting = true
            this.error = null

            try {
                await exportShifts(buildCleanFilters(this.filters))
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.exporting = false
            }
        },

        async importShifts(file) {
            this.importing = true
            this.importProgress = 1
            this.importSummary = null
            this.error = null

            let processingTimer = null

            const startProcessingProgress = () => {
                if (processingTimer) {
                    return
                }

                processingTimer = window.setInterval(() => {
                    if (this.importProgress < 95) {
                        this.importProgress += 1
                    }
                }, 800)
            }

            try {
                const summary = await importShifts(file, (event) => {
                    if (!event.total) {
                        startProcessingProgress()
                        return
                    }

                    const uploadPercent = Math.round(
                        (event.loaded * 70) / event.total,
                    )

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
                if (processingTimer) {
                    window.clearInterval(processingTimer)
                }

                window.setTimeout(() => {
                    this.importing = false
                }, 500)
            }
        },
    },
})