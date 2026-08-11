import { defineStore } from "pinia"

import {
    archiveWorkforceRatio,
    createWorkforceRatio,
    fetchCurrentWorkforceRatio,
    fetchWorkforceRatioEmployeeTypes,
    updateWorkforceRatio,
} from "../services/workforceRatio.api.js"

export const useWorkforceRatioStore = defineStore("workforceRatio", {
    state: () => ({
        setup: null,
        employeeTypes: [],
        loading: false,
        optionsLoading: false,
        saving: false,
        archiving: false,
    }),

    actions: {
        async loadCurrent(params) {
            this.loading = true

            try {
                const data = await fetchCurrentWorkforceRatio(params)
                this.setup = data.setup || null
                return this.setup
            } finally {
                this.loading = false
            }
        },

        async loadEmployeeTypes(params) {
            this.optionsLoading = true

            try {
                const data = await fetchWorkforceRatioEmployeeTypes(params)
                this.employeeTypes = data.items || []
                return this.employeeTypes
            } finally {
                this.optionsLoading = false
            }
        },

        async createSetup(payload) {
            this.saving = true

            try {
                this.setup = await createWorkforceRatio(payload)
                return this.setup
            } finally {
                this.saving = false
            }
        },

        async updateSetup(id, payload) {
            this.saving = true

            try {
                this.setup = await updateWorkforceRatio(id, payload)
                return this.setup
            } finally {
                this.saving = false
            }
        },

        async archiveSetup(id) {
            this.archiving = true

            try {
                await archiveWorkforceRatio(id)
                this.setup = null
            } finally {
                this.archiving = false
            }
        },

        clear() {
            this.setup = null
            this.employeeTypes = []
        },
    },
})
