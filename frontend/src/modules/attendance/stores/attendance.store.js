import { defineStore } from "pinia"

import {
    createAttendanceRecord,
    downloadAttendanceTemplate,
    fetchAttendanceRecords,
    importAttendance,
    updateAttendanceRecord,
} from "../services/attendance.api.js"

const LIST_CACHE_TTL_MS = 15_000

function buildQueryKey(params = {}) {
    return JSON.stringify(
        Object.keys(params)
            .sort()
            .reduce((result, key) => {
                result[key] = params[key]
                return result
            }, {}),
    )
}

export const useAttendanceStore = defineStore("attendance", {
    state: () => ({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        loading: false,
        saving: false,
        importing: false,
        importProgress: 0,
        importSummary: null,
        error: null,
        listCache: {},
        pendingRequests: {},
    }),

    actions: {
        clearListCache() {
            this.listCache = {}
            this.pendingRequests = {}
        },

        applyResult(result) {
            this.items = result.items || []
            this.pagination = result.pagination || this.pagination
        },

        async load(params, options = {}) {
            const key = buildQueryKey(params)
            const cached = this.listCache[key]
            const force = Boolean(options.force)

            if (!force && cached && Date.now() - cached.loadedAt < LIST_CACHE_TTL_MS) {
                this.applyResult(cached.result)
                return cached.result
            }

            if (!force && this.pendingRequests[key]) {
                const result = await this.pendingRequests[key]
                this.applyResult(result)
                return result
            }

            this.loading = true
            this.error = null

            const request = fetchAttendanceRecords(params)
            this.pendingRequests[key] = request

            try {
                const result = await request
                this.listCache[key] = { result, loadedAt: Date.now() }
                this.applyResult(result)
                return result
            } catch (error) {
                this.error = error
                throw error
            } finally {
                delete this.pendingRequests[key]
                this.loading = false
            }
        },

        async save(payload, attendanceId = null) {
            this.saving = true
            this.error = null

            try {
                const record = attendanceId
                    ? await updateAttendanceRecord(attendanceId, payload)
                    : await createAttendanceRecord(payload)
                this.clearListCache()
                return record
            } finally {
                this.saving = false
            }
        },

        async downloadTemplate() {
            await downloadAttendanceTemplate()
        },

        async importFile(file) {
            this.importing = true
            this.importProgress = 1
            this.importSummary = null

            try {
                const summary = await importAttendance(file, (event) => {
                    if (event.total) {
                        this.importProgress = Math.min(95, Math.round((event.loaded * 100) / event.total))
                    }
                })
                this.importProgress = 100
                this.importSummary = summary
                this.clearListCache()
                return summary
            } finally {
                this.importing = false
            }
        },
    },
})
