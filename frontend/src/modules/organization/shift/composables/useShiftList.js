import {
    computed,
    onBeforeUnmount,
    reactive,
    ref,
} from "vue"

import {
    archiveShift,
    listShifts,
} from "../api/shift.api.js"

export function useShiftList() {
    const rows = ref([])
    const loading = ref(false)
    const archiving = ref(false)
    const error = ref(null)
    const requestController = ref(null)

    const query = reactive({
        page: 1,
        limit: 10,
        search: "",
        companyId: "",
        branchId: "",
        status: "ALL",
        sortBy: "code",
        sortOrder: "asc",
    })

    const pagination = reactive({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
    })

    const hasActiveFilters = computed(
        () =>
            Boolean(
                query.search ||
                    query.companyId ||
                    query.branchId,
            ) || query.status !== "ALL",
    )

    async function load(overrides = {}) {
        Object.assign(query, overrides)
        requestController.value?.abort()
        requestController.value = new AbortController()
        loading.value = true
        error.value = null

        try {
            const result = await listShifts(
                {
                    page: query.page,
                    limit: query.limit,
                    search: query.search || undefined,
                    companyId: query.companyId || undefined,
                    branchId: query.branchId || undefined,
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
        query.companyId = ""
        query.branchId = ""
        query.status = "ALL"

        return load({ page: 1 })
    }

    function changePage(event) {
        return load({
            page: event.page,
            limit: event.limit,
        })
    }

    function changeSort(event) {
        return load({
            page: 1,
            sortBy: event.sortBy,
            sortOrder: event.sortOrder,
        })
    }

    async function archive(shiftId) {
        archiving.value = true

        try {
            await archiveShift(shiftId)
            await load({
                page:
                    rows.value.length === 1 && query.page > 1
                        ? query.page - 1
                        : query.page,
            })
        } finally {
            archiving.value = false
        }
    }

    onBeforeUnmount(() => {
        requestController.value?.abort()
    })

    return {
        rows,
        loading,
        archiving,
        error,
        query,
        pagination,
        hasActiveFilters,
        load,
        applyFilters,
        clearFilters,
        changePage,
        changeSort,
        archive,
    }
}
