import { defineStore } from "pinia"

import { apiClient } from "@/shared/services/apiClient.js"
import {
    loadWorkspaceContext,
    saveWorkspaceContext,
    setActiveWorkspaceContext,
} from "@/shared/workspace/workspace.storage.js"

function itemsFrom(response) {
    return response?.data?.data?.items ?? []
}

function normalizeId(value) {
    return String(value?.id || value?._id || value || "")
}

export const useWorkspaceStore = defineStore("workspace", {
    state: () => ({
        accountId: "",
        companyId: "",
        branchId: "",
        companies: [],
        branches: [],
        loadingCompanies: false,
        loadingBranches: false,
        initialized: false,
        revision: 0,
    }),

    getters: {
        selectedCompany(state) {
            return state.companies.find(
                (item) => normalizeId(item) === state.companyId,
            ) || null
        },

        selectedBranch(state) {
            return state.branches.find(
                (item) => normalizeId(item) === state.branchId,
            ) || null
        },

        ready(state) {
            return Boolean(state.companyId && state.branchId)
        },
    },

    actions: {
        persist() {
            saveWorkspaceContext(this.accountId, {
                companyId: this.companyId,
                branchId: this.branchId,
            })
        },

        async initialize(user) {
            const accountId = String(user?.accountId || "")

            if (this.initialized && this.accountId === accountId) {
                return
            }

            this.$reset()
            this.accountId = accountId

            const stored = loadWorkspaceContext(accountId)
            this.companyId = stored.companyId
            this.branchId = stored.branchId
            setActiveWorkspaceContext(stored)

            await this.loadCompanies()

            const companyStillAllowed = this.companies.some(
                (item) => normalizeId(item) === this.companyId,
            )

            if (!companyStillAllowed) {
                this.companyId = this.companies.length === 1
                    ? normalizeId(this.companies[0])
                    : ""
                this.branchId = ""
            }

            if (this.companyId) {
                await this.loadBranches()
            }

            const branchStillAllowed = this.branches.some(
                (item) => normalizeId(item) === this.branchId,
            )

            if (!branchStillAllowed) {
                this.branchId = this.branches.length === 1
                    ? normalizeId(this.branches[0])
                    : ""
            }

            this.persist()
            this.initialized = true
        },

        async loadCompanies() {
            this.loadingCompanies = true

            try {
                const response = await apiClient.get(
                    "/organization/companies/lookup",
                    {
                        params: {
                            page: 1,
                            limit: 100,
                            status: "ACTIVE",
                        },
                        headers: {
                            "x-skip-workspace-context": "1",
                        },
                    },
                )

                this.companies = itemsFrom(response)
            } finally {
                this.loadingCompanies = false
            }
        },

        async loadBranches() {
            this.branches = []

            if (!this.companyId) {
                return
            }

            this.loadingBranches = true

            try {
                const response = await apiClient.get(
                    "/organization/branches/lookup",
                    {
                        params: {
                            page: 1,
                            limit: 100,
                            status: "ACTIVE",
                            companyId: this.companyId,
                        },
                        headers: {
                            "x-skip-workspace-context": "1",
                        },
                    },
                )

                this.branches = itemsFrom(response)
            } finally {
                this.loadingBranches = false
            }
        },

        async selectCompany(companyId) {
            this.companyId = normalizeId(companyId)
            this.branchId = ""
            setActiveWorkspaceContext({
                companyId: this.companyId,
                branchId: "",
            })

            await this.loadBranches()

            if (this.branches.length === 1) {
                this.branchId = normalizeId(this.branches[0])
            }

            this.persist()
            this.revision += 1
        },

        selectBranch(branchId) {
            this.branchId = normalizeId(branchId)
            this.persist()
            this.revision += 1
        },

        clear() {
            this.$reset()
            setActiveWorkspaceContext()
        },
    },
})
