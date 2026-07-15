import {
    computed,
    onBeforeUnmount,
    reactive,
    ref,
} from "vue"

import {
    archivePosition,
    listPositions,
} from "../api/position.api.js"

export function usePositionList() {
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
        branchId: "",
        departmentId: "",
        status: "ALL",
        sortBy: "level",
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
        () =>
            Boolean(
                query.search ||
                    query.companyId ||
                    query.branchId ||
                    query.departmentId,
            ) || query.status !== "ALL",
    )

    async function load(overrides = {}) {
        Object.assign(query, overrides)
        requestController.value?.abort()
        requestController.value = new AbortController()
        loading.value = true
        error.value = null

        try {
            const result = await listPositions(
                {
                    page: query.page,
                    limit: query.limit,
                    search: query.search || undefined,
                    companyId: query.companyId || undefined,
                    branchId: query.branchId || undefined,
                    departmentId: query.departmentId || undefined,
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
        return load({
            page: 1,
        })
    }

    function clearFilters() {
        query.search = ""
        query.companyId = ""
        query.branchId = ""
        query.departmentId = ""
        query.status = "ALL"

        return load({
            page: 1,
        })
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

    async function archive(positionId) {
        archiving.value = true

        try {
            await archivePosition(positionId)
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
