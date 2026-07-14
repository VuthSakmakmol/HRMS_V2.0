import { defineStore } from "pinia"

import {
    archiveLine,
    createLine,
    downloadLineImportTemplate,
    exportLines,
    fetchLines,
    importLines,
    updateLine,
} from "../services/line.api.js"

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

    if (!cleanFilters.departmentId) {
        delete cleanFilters.departmentId
    }

    if (!cleanFilters.positionId) {
        delete cleanFilters.positionId
    }

    return cleanFilters
}

export const useLineStore = defineStore("line", {
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
        async loadLines(params = {}) {
            this.loading = true
            this.error = null

            this.filters = {
                ...this.filters,
                ...params,
            }

            try {
                const result = await fetchLines(buildCleanFilters(this.filters))

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

        async createLine(payload) {
            this.saving = true
            this.error = null

            try {
                return await createLine(payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async updateLine(lineId, payload) {
            this.saving = true
            this.error = null

            try {
                return await updateLine(lineId, payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async archiveLine(lineId) {
            this.archiving = true
            this.error = null

            try {
                return await archiveLine(lineId)
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
                await downloadLineImportTemplate()
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.downloadingTemplate = false
            }
        },

        async exportLines() {
            this.exporting = true
            this.error = null

            try {
                await exportLines(buildCleanFilters(this.filters))
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.exporting = false
            }
        },

        async importLines(file) {
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
                const summary = await importLines(file, (event) => {
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