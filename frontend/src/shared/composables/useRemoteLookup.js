import { onBeforeUnmount, ref } from "vue"

export function useRemoteLookup({
    fetcher,
    minimumSearchLength = 0,
    pageSize = 30,
    debounceMs = 250,
    mapResponse = (response) => response?.data?.data ?? response?.data ?? response,
} = {}) {
    if (typeof fetcher !== "function") {
        throw new TypeError("useRemoteLookup requires a fetcher function")
    }

    const items = ref([])
    const loading = ref(false)
    const error = ref(null)
    let controller = null
    let timer = null
    let sequence = 0

    async function execute(searchTerm = "", params = {}) {
        if (searchTerm.length < minimumSearchLength) {
            items.value = []
            return
        }
        controller?.abort()
        controller = new AbortController()
        const current = ++sequence
        loading.value = true
        error.value = null

        try {
            const response = await fetcher(
                { search: searchTerm, limit: pageSize, ...params },
                { signal: controller.signal },
            )
            if (current !== sequence) return
            const payload = mapResponse(response) || {}
            items.value = Array.isArray(payload.items) ? payload.items : []
        } catch (caughtError) {
            if (caughtError?.name === "CanceledError" || caughtError?.name === "AbortError") return
            if (current === sequence) error.value = caughtError
        } finally {
            if (current === sequence) loading.value = false
        }
    }

    function search(term = "", params = {}) {
        clearTimeout(timer)
        timer = setTimeout(() => execute(term, params), debounceMs)
    }

    function reset() {
        controller?.abort()
        clearTimeout(timer)
        items.value = []
        error.value = null
    }

    onBeforeUnmount(reset)

    return { items, loading, error, search, execute, reset }
}
