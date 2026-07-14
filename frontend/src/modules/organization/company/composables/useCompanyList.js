import { computed, onBeforeUnmount, reactive, ref } from "vue"
import {
    archiveCompany,
    listCompanies,
} from "../api/company.api.js"

export function useCompanyList() {
    const rows = ref([])
    const loading = ref(false)
    const archiving = ref(false)
    const error = ref(null)
    const requestController = ref(null)

    const query = reactive({
        page: 1,
        limit: 20,
        search: "",
        status: "ALL",
        sortBy: "displayName",
        sortOrder: "asc",
    })

    const pagination = reactive({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
    })

    const hasActiveFilters = computed(
        () => Boolean(query.search) || query.status !== "ALL",
    )

    async function load(overrides = {}) {
        Object.assign(query, overrides)
        requestController.value?.abort()
        requestController.value = new AbortController()
        loading.value = true
        error.value = null

        try {
            const result = await listCompanies(
                {
                    page: query.page,
                    limit: query.limit,
                    search: query.search || undefined,
                    status: query.status,
                    sortBy: query.sortBy,
                    sortOrder: query.sortOrder,
                },
                requestController.value.signal,
            )

            rows.value = result.items
            Object.assign(pagination, result.pagination)
        } catch (caught) {
            if (caught?.code !== "ERR_CANCELED") {
                error.value = caught
                throw caught
            }
        } finally {
            loading.value = false
        }
    }

    function applyFilters() {
        return load({ page: 1 })
    }

    function clearFilters() {
        query.search = ""
        query.status = "ALL"
        return load({ page: 1 })
    }

    function changePage(event) {
        return load({ page: event.page, limit: event.limit })
    }

    function changeSort(event) {
        return load({
            page: 1,
            sortBy: event.sortBy,
            sortOrder: event.sortOrder,
        })
    }

    async function archive(companyId) {
        archiving.value = true
        try {
            await archiveCompany(companyId)
            const nextPage = rows.value.length === 1 && query.page > 1
                ? query.page - 1
                : query.page
            await load({ page: nextPage })
        } finally {
            archiving.value = false
        }
    }

    onBeforeUnmount(() => requestController.value?.abort())

    return {
        rows,
        query,
        pagination,
        loading,
        archiving,
        error,
        hasActiveFilters,
        load,
        applyFilters,
        clearFilters,
        changePage,
        changeSort,
        archive,
    }
}
