import { computed, onBeforeUnmount, reactive, ref } from "vue"
import { archiveBranch, listBranches } from "../api/branch.api.js"

export function useBranchList() {
    const rows = ref([])
    const loading = ref(false)
    const archiving = ref(false)
    const error = ref(null)
    const requestController = ref(null)

    const query = reactive({
        page: 1,
        limit: 20,
        search: "",
        companyId: "",
        status: "ALL",
        sortBy: "name",
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
        () => Boolean(query.search || query.companyId) || query.status !== "ALL",
    )

    async function load(overrides = {}) {
        Object.assign(query, overrides)
        requestController.value?.abort()
        requestController.value = new AbortController()
        loading.value = true
        error.value = null

        try {
            const result = await listBranches(
                {
                    page: query.page,
                    limit: query.limit,
                    search: query.search || undefined,
                    companyId: query.companyId || undefined,
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

    const applyFilters = () => load({ page: 1 })
    function clearFilters() {
        query.search = ""
        query.companyId = ""
        query.status = "ALL"
        return load({ page: 1 })
    }
    const changePage = (event) => load({ page: event.page, limit: event.limit })
    const changeSort = (event) =>
        load({ page: 1, sortBy: event.sortBy, sortOrder: event.sortOrder })

    async function archive(branchId) {
        archiving.value = true
        try {
            await archiveBranch(branchId)
            await load({
                page: rows.value.length === 1 && query.page > 1 ? query.page - 1 : query.page,
            })
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
