import { defineStore } from "pinia"

import {
    fetchHrDashboard,
    fetchHrDashboardLookups,
} from "../services/hrDashboard.api.js"

const DATE_FILTER_FIELDS = new Set([
    "startDate",
    "endDate",
])

function formatDate(value) {
    if (!value) return value

    if (typeof value === "string") {
        return value.slice(0, 10)
    }

    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        return value
    }

    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")

    return `${year}-${month}-${day}`
}

function cleanFilterValue(key, value) {
    if (DATE_FILTER_FIELDS.has(key)) {
        return formatDate(value)
    }

    if (typeof value === "string") {
        return value.trim()
    }

    return value
}

function cleanFilters(filters) {
    return Object.fromEntries(
        Object.entries(filters)
            .filter(([, value]) =>
                value !== "" && value !== null && value !== undefined,
            )
            .map(([key, value]) => [key, cleanFilterValue(key, value)]),
    )
}

function currentYearRange() {
    const year = new Date().getFullYear()

    return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
    }
}

export const useHrDashboardStore = defineStore("hrDashboard", {
    state: () => ({
        dashboard: null,
        lookups: {
            companies: [],
            branches: [],
            departments: [],
            positions: [],
            lines: [],
            employeeTypes: [],
        },
        loading: false,
        lookupLoading: false,
        error: null,
        filters: {
            ...currentYearRange(),
            companyId: undefined,
            branchId: undefined,
            employeeTypeFilterKey: undefined,
            departmentId: undefined,
            positionId: undefined,
            lineId: undefined,
        },
    }),

    actions: {
        async loadLookups(filters = {}) {
            this.lookupLoading = true

            try {
                this.lookups = await fetchHrDashboardLookups(
                    cleanFilters({
                        companyId: filters.companyId,
                        branchId: filters.branchId,
                        departmentId: filters.departmentId,
                    }),
                )

                return this.lookups
            } finally {
                this.lookupLoading = false
            }
        },

        async loadDashboard(filters = {}) {
            this.loading = true
            this.error = null
            this.filters = {
                ...this.filters,
                ...filters,
            }

            try {
                this.dashboard = await fetchHrDashboard(cleanFilters(this.filters))
                return this.dashboard
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.loading = false
            }
        },
    },
})
