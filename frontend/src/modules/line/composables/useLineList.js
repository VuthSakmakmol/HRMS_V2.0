import {
    computed,
    onBeforeUnmount,
    reactive,
    ref,
} from "vue"

import {
    archiveLine,
    listLines,
} from "../api/line.api.js"

export function useLineList() {
    const rows = ref([])
    const loading = ref(false)
    const archiving = ref(false)
    const error = ref(null)
    let controller = null

    const query = reactive({
        page: 1,
        limit: 10,
        search: "",
        departmentId: "",
        positionId: "",
        status: "ALL",
        sortBy: "name",
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
                    query.departmentId ||
                    query.positionId,
            ) || query.status !== "ALL",
    )

    async function load(overrides = {}) {
        Object.assign(query, overrides)
        controller?.abort()
        controller = new AbortController()
        loading.value = true
        error.value = null

        try {
            const result = await listLines(
                {
                    ...query,
                    search: query.search || undefined,
                    departmentId: query.departmentId || undefined,
                    positionId: query.positionId || undefined,
                },
                controller.signal,
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
        Object.assign(query, {
            page: 1,
            search: "",
            departmentId: "",
            positionId: "",
            status: "ALL",
        })

        return load()
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

    async function archive(lineId) {
        archiving.value = true

        try {
            await archiveLine(lineId)
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
        controller?.abort()
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
