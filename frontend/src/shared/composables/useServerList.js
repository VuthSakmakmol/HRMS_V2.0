import { computed, onBeforeUnmount, reactive, ref } from "vue"

export function useServerList({ fetcher, initialQuery = {}, initialLimit = 25 }) {
    const items = ref([])
    const loading = ref(false)
    const error = ref(null)
    const query = reactive({
        page: 1,
        limit: initialLimit,
        search: "",
        sort: "createdAt",
        order: "desc",
        ...initialQuery,
    })
    const pagination = reactive({
        page: 1,
        limit: initialLimit,
        total: 0,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
    })

    let controller = null
    let requestSequence = 0

    async function load(overrides = {}) {
        Object.assign(query, overrides)
        controller?.abort()
        controller = new AbortController()
        const sequence = ++requestSequence
        loading.value = true
        error.value = null

        try {
            const response = await fetcher({
                ...query,
                signal: controller.signal,
            })

            if (sequence !== requestSequence) {
                return
            }

            const payload = response?.data?.data || response?.data || response || {}
            items.value = payload.items || payload.rows || []
            Object.assign(pagination, payload.pagination || {
                page: query.page,
                limit: query.limit,
                total: payload.total || items.value.length,
                totalPages: payload.totalPages || 1,
            })
        } catch (loadError) {
            if (loadError?.name !== "CanceledError" && loadError?.code !== "ERR_CANCELED") {
                error.value = loadError
            }
        } finally {
            if (sequence === requestSequence) {
                loading.value = false
            }
        }
    }

    function setPage(page) {
        return load({ page })
    }

    function setLimit(limit) {
        return load({ page: 1, limit })
    }

    function setFilters(filters) {
        return load({ page: 1, ...filters })
    }

    function refresh() {
        return load()
    }

    onBeforeUnmount(() => controller?.abort())

    return {
        items,
        loading,
        error,
        query,
        pagination,
        isEmpty: computed(() => !loading.value && items.value.length === 0),
        load,
        refresh,
        setPage,
        setLimit,
        setFilters,
    }
}
