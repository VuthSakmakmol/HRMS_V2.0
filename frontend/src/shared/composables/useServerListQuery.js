import { computed, onBeforeUnmount, reactive, ref } from "vue"

function normalizePagination(value = {}) {
    return {
        page: Number(value.page || 1),
        limit: Number(value.limit || 20),
        total: Number(value.total || 0),
        totalPages: Number(value.totalPages || 0),
        hasNext: Boolean(value.hasNext),
        hasPrevious: Boolean(value.hasPrevious),
    }
}

export function useServerListQuery({
    fetcher,
    initialQuery = {},
    initialLimit = 20,
    mapResponse = (response) => response?.data?.data ?? response?.data ?? response,
    debounceMs = 300,
} = {}) {
    if (typeof fetcher !== "function") {
        throw new TypeError("useServerListQuery requires a fetcher function")
    }

    const rows = ref([])
    const loading = ref(false)
    const error = ref(null)
    const query = reactive({
        page: 1,
        limit: initialLimit,
        search: "",
        sortBy: "createdAt",
        sortOrder: "desc",
        ...initialQuery,
    })
    const pagination = reactive(normalizePagination({ page: 1, limit: initialLimit }))

    let controller = null
    let debounceTimer = null
    let requestSequence = 0

    const hasData = computed(() => rows.value.length > 0)

    async function load(overrides = {}) {
        Object.assign(query, overrides)
        controller?.abort()
        controller = new AbortController()
        const sequence = ++requestSequence
        loading.value = true
        error.value = null

        try {
            const response = await fetcher({ ...query }, { signal: controller.signal })
            if (sequence !== requestSequence) return
            const payload = mapResponse(response) || {}
            rows.value = Array.isArray(payload.items) ? payload.items : []
            Object.assign(pagination, normalizePagination(payload.pagination || query))
        } catch (caughtError) {
            if (caughtError?.name === "CanceledError" || caughtError?.name === "AbortError") return
            if (sequence === requestSequence) error.value = caughtError
        } finally {
            if (sequence === requestSequence) loading.value = false
        }
    }

    function setSearch(value) {
        query.search = value ?? ""
        query.page = 1
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => load(), debounceMs)
    }

    function setFilters(filters = {}) {
        Object.assign(query, filters, { page: 1 })
        return load()
    }

    function setPage({ page, limit }) {
        query.page = page
        query.limit = limit
        return load()
    }

    function setSort({ sortBy, sortOrder }) {
        query.sortBy = sortBy
        query.sortOrder = sortOrder
        query.page = 1
        return load()
    }

    function refresh() {
        return load()
    }

    function reset(nextQuery = {}) {
        Object.assign(query, {
            page: 1,
            limit: initialLimit,
            search: "",
            sortBy: "createdAt",
            sortOrder: "desc",
            ...initialQuery,
            ...nextQuery,
        })
        return load()
    }

    onBeforeUnmount(() => {
        controller?.abort()
        clearTimeout(debounceTimer)
    })

    return {
        rows,
        loading,
        error,
        query,
        pagination,
        hasData,
        load,
        refresh,
        reset,
        setSearch,
        setFilters,
        setPage,
        setSort,
    }
}
