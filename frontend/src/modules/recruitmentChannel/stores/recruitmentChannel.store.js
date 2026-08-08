import { defineStore } from "pinia"

import {
    archiveRecruitmentChannel,
    createRecruitmentChannel,
    fetchRecruitmentChannelById,
    fetchRecruitmentChannels,
    updateRecruitmentChannel,
} from "../services/recruitmentChannel.api.js"

function cleanFilters(filters = {}) {
    const clean = { ...filters }

    for (const key of ["companyId", "branchId", "search"]) {
        if (!clean[key]) delete clean[key]
    }

    return clean
}

export const useRecruitmentChannelStore = defineStore("recruitmentChannel", {
    state: () => ({
        items: [],
        current: null,
        pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
        },
        filters: {
            page: 1,
            limit: 10,
            search: "",
            status: "ALL",
            companyId: "",
            branchId: "",
        },
        loading: false,
        loadingOne: false,
        saving: false,
        archiving: false,
        error: null,
    }),

    actions: {
        async loadRecruitmentChannels(params = {}) {
            this.loading = true
            this.error = null
            this.filters = {
                ...this.filters,
                ...params,
            }

            try {
                const result = await fetchRecruitmentChannels(
                    cleanFilters(this.filters),
                )

                this.items = result.items || []
                this.pagination = result.pagination || {
                    page: this.filters.page,
                    limit: this.filters.limit,
                    total: 0,
                    totalPages: 0,
                }

                return result
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.loading = false
            }
        },

        async loadRecruitmentChannel(recruitmentChannelId) {
            this.loadingOne = true
            this.error = null

            try {
                const item = await fetchRecruitmentChannelById(
                    recruitmentChannelId,
                )
                this.current = item
                return item
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.loadingOne = false
            }
        },

        async createRecruitmentChannel(payload) {
            this.saving = true
            this.error = null

            try {
                return await createRecruitmentChannel(payload)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async updateRecruitmentChannel(recruitmentChannelId, payload) {
            this.saving = true
            this.error = null

            try {
                return await updateRecruitmentChannel(
                    recruitmentChannelId,
                    payload,
                )
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.saving = false
            }
        },

        async archiveRecruitmentChannel(recruitmentChannelId) {
            this.archiving = true
            this.error = null

            try {
                return await archiveRecruitmentChannel(recruitmentChannelId)
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.archiving = false
            }
        },
    },
})
