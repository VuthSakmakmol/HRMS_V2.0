import { defineStore } from "pinia"

import {
    archiveHrDashboardTarget,
    createHrDashboardTarget,
    fetchHrDashboardTargets,
    downloadHrDashboardTargetTemplate,
    exportHrDashboardTargets,
    importHrDashboardTargets,
    updateHrDashboardTarget,
} from "../services/hrDashboardTarget.api.js"

const LIST_CACHE_TTL_MS = 15_000

function normalizeFilterValue(value) {
    if (value === "" || value === null || value === undefined) return undefined
    return value
}

function buildCleanFilters(filters) {
    const cleanFilters = {}

    for (const [key, value] of Object.entries(filters || {})) {
        const normalized = normalizeFilterValue(value)

        if (normalized !== undefined) {
            cleanFilters[key] = normalized
        }
    }

    return cleanFilters
}

export const useHrDashboardTargetStore = defineStore("hrDashboardTarget", {
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
            status: "ACTIVE",
            metric: "",
            companyId: "",
            branchId: "",
            year: new Date().getFullYear(),
            month: "",
            departmentId: "",
            positionId: "",
            lineId: "",
            employeeTypeId: "",
            employeeTypeChildId: "",
        },
        loading: false,
        saving: false,
        archiving: false,
        importing: false,
        exporting: false,
        importProgress: 0,
        importSummary: null,
        error: null,
        listCache: {},
    }),

    actions: {
        clearListCache() {
            this.listCache = {}
        },

        async loadTargets(params = {}) {
            this.loading = true
            this.error = null
            this.filters = {
                ...this.filters,
                ...params,
            }

            try {
                const cleanFilters = buildCleanFilters(this.filters)
                const cacheKey = JSON.stringify(cleanFilters)
                const cached = this.listCache[cacheKey]
                const result = cached && Date.now() - cached.loadedAt < LIST_CACHE_TTL_MS
                    ? cached.result
                    : await fetchHrDashboardTargets(cleanFilters)

                if (!cached || result !== cached.result) {
                    this.listCache[cacheKey] = { result, loadedAt: Date.now() }
                }

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

        async createTarget(payload) {
            this.saving = true
            this.error = null

            try {
                const target = await createHrDashboardTarget(payload)
                this.clearListCache()
                return target
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async updateTarget(id, payload) {
            this.saving = true
            this.error = null

            try {
                const target = await updateHrDashboardTarget(id, payload)
                this.clearListCache()
                return target
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async archiveTarget(id) {
            this.archiving = true
            this.error = null

            try {
                const target = await archiveHrDashboardTarget(id)
                this.clearListCache()
                return target
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.archiving = false
            }
        },

        async downloadTemplate() {
            await downloadHrDashboardTargetTemplate()
        },

        async exportFile(params) {
            this.exporting = true
            try {
                await exportHrDashboardTargets(buildCleanFilters(params))
            } finally {
                this.exporting = false
            }
        },

        async importFile(file) {
            this.importing = true
            this.importProgress = 1
            this.importSummary = null
            try {
                const summary = await importHrDashboardTargets(file, (event) => {
                    if (event.total) {
                        this.importProgress = Math.min(
                            95,
                            Math.round((event.loaded * 100) / event.total),
                        )
                    }
                })
                this.importProgress = 100
                this.importSummary = summary
                this.clearListCache()
                return summary
            } catch (error) {
                this.importSummary =
                    error?.response?.data?.error?.details?.importSummary || null
                throw error
            } finally {
                this.importing = false
            }
        },
    },
})
