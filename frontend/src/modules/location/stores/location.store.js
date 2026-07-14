import { defineStore } from "pinia"

import {
    archiveLocation,
    createLocation,
    downloadLocationImportTemplate,
    exportLocations,
    fetchLocations,
    importLocations,
    updateLocation,
} from "../services/location.api.js"

function buildCleanFilters(filters) {
    const cleanFilters = {
        ...filters,
    }

    for (const key of ["countryId", "provinceId", "districtId", "communeId"]) {
        if (!cleanFilters[key]) {
            delete cleanFilters[key]
        }
    }

    return cleanFilters
}

export const useLocationStore = defineStore("location", {
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
            countryId: undefined,
            provinceId: undefined,
            districtId: undefined,
            communeId: undefined,
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
        async loadLocations(entity, params = {}) {
            this.loading = true
            this.error = null

            this.filters = {
                ...this.filters,
                ...params,
            }

            try {
                const result = await fetchLocations(
                    entity,
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

        async createLocation(entity, payload) {
            this.saving = true
            this.error = null

            try {
                return await createLocation(entity, payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async updateLocation(entity, locationId, payload) {
            this.saving = true
            this.error = null

            try {
                return await updateLocation(entity, locationId, payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async archiveLocation(entity, locationId) {
            this.archiving = true
            this.error = null

            try {
                return await archiveLocation(entity, locationId)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.archiving = false
            }
        },

        async downloadImportTemplate(entity) {
            this.downloadingTemplate = true
            this.error = null

            try {
                await downloadLocationImportTemplate(entity)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.downloadingTemplate = false
            }
        },

        async exportLocations(entity) {
            this.exporting = true
            this.error = null

            try {
                await exportLocations(entity, buildCleanFilters(this.filters))
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.exporting = false
            }
        },

        async importLocations(entity, file) {
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
                const summary = await importLocations(entity, file, (event) => {
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
