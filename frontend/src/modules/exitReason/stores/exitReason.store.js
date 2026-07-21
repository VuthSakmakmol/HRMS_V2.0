import { defineStore } from "pinia"

import {
    archiveExitReason,
    createExitReason,
    fetchExitReasons,
    lookupExitReasons,
    updateExitReason,
} from "../services/exitReason.api.js"

export const useExitReasonStore = defineStore("exitReason", {
    state: () => ({
        items: [],
        lookupItems: [],
        pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 1,
        },
        loading: false,
        lookupLoading: false,
        saving: false,
        archiving: false,
    }),

    actions: {
        async loadExitReasons(params = {}) {
            this.loading = true

            try {
                const data = await fetchExitReasons(params)

                this.items = data.items || []
                this.pagination = data.pagination || this.pagination

                return data
            } finally {
                this.loading = false
            }
        },

        async loadLookup(params = {}) {
            this.lookupLoading = true

            try {
                const data = await lookupExitReasons(params)

                this.lookupItems = data.items || []

                return this.lookupItems
            } finally {
                this.lookupLoading = false
            }
        },

        async createExitReason(payload) {
            this.saving = true

            try {
                return await createExitReason(payload)
            } finally {
                this.saving = false
            }
        },

        async updateExitReason(exitReasonId, payload) {
            this.saving = true

            try {
                return await updateExitReason(exitReasonId, payload)
            } finally {
                this.saving = false
            }
        },

        async archiveExitReason(exitReasonId) {
            this.archiving = true

            try {
                return await archiveExitReason(exitReasonId)
            } finally {
                this.archiving = false
            }
        },
    },
})
