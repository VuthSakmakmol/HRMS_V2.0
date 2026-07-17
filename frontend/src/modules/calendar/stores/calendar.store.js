import { defineStore } from "pinia"

import {
    archiveCalendarDay,
    createCalendarDay,
    downloadCalendarImportTemplate,
    exportCalendarDays,
    fetchCalendarDays,
    importCalendarDays,
    resolveCalendarDay,
    resolveCalendarRange,
    updateCalendarDay,
} from "../services/calendar.api.js"

function buildCleanFilters(filters) {
    const cleanFilters = { ...filters }

    for (const field of ["companyId", "branchId", "startDate", "endDate", "search"]) {
        if (!cleanFilters[field]) {
            delete cleanFilters[field]
        }
    }

    return cleanFilters
}

export const useCalendarStore = defineStore("calendar", {
    state: () => ({
        items: [],
        pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 1,
        },
        filters: {
            page: 1,
            limit: 10,
            search: "",
            status: "ALL",
            scopeLevel: "ALL",
            dayType: "ALL",
            startDate: "",
            endDate: "",
            companyId: undefined,
            branchId: undefined,
        },
        loading: false,
        saving: false,
        archiving: false,
        resolving: false,
        downloadingTemplate: false,
        exporting: false,
        importing: false,
        importProgress: 0,
        importSummary: null,
        error: null,
    }),

    actions: {
        async loadCalendarDays(params = {}) {
            this.loading = true
            this.error = null
            this.filters = { ...this.filters, ...params }

            try {
                const result = await fetchCalendarDays(buildCleanFilters(this.filters))
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

        async createCalendarDay(payload) {
            this.saving = true
            this.error = null

            try {
                return await createCalendarDay(payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async updateCalendarDay(calendarDayId, payload) {
            this.saving = true
            this.error = null

            try {
                return await updateCalendarDay(calendarDayId, payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async archiveCalendarDay(calendarDayId) {
            this.archiving = true
            this.error = null

            try {
                return await archiveCalendarDay(calendarDayId)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.archiving = false
            }
        },

        async resolveDay(params) {
            this.resolving = true
            this.error = null

            try {
                return await resolveCalendarDay(params)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.resolving = false
            }
        },

        async resolveRange(params) {
            this.resolving = true
            this.error = null

            try {
                return await resolveCalendarRange(params)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.resolving = false
            }
        },

        async downloadImportTemplate() {
            this.downloadingTemplate = true
            this.error = null

            try {
                await downloadCalendarImportTemplate()
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.downloadingTemplate = false
            }
        },

        async exportCalendarDays() {
            this.exporting = true
            this.error = null

            try {
                await exportCalendarDays(buildCleanFilters(this.filters))
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.exporting = false
            }
        },

        async importCalendarDays(file) {
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
                const summary = await importCalendarDays(file, (event) => {
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
                window.setTimeout(() => {
                    this.importing = false
                }, 500)
            }
        },
    },
})
