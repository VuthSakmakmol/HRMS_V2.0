import { defineStore } from "pinia"

import {
    archiveHrDashboardTarget,
    createHrDashboardTarget,
    fetchHrDashboardTargets,
    updateHrDashboardTarget,
} from "../services/hrDashboardTarget.api.js"

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
            limit: 20,
            total: 0,
            totalPages: 1,
        },
        filters: {
            page: 1,
            limit: 20,
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
        error: null,
    }),

    actions: {
        async loadTargets(params = {}) {
            this.loading = true
            this.error = null
            this.filters = {
                ...this.filters,
                ...params,
            }

            try {
                const result = await fetchHrDashboardTargets(
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

        async createTarget(payload) {
            this.saving = true
            this.error = null

            try {
                return await createHrDashboardTarget(payload)
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
                return await updateHrDashboardTarget(id, payload)
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
                return await archiveHrDashboardTarget(id)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.archiving = false
            }
        },
    },
})
