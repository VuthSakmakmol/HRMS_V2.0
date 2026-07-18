import { computed, onBeforeUnmount, reactive, ref } from "vue"
import { archiveCalendarDay, fetchCalendarDays } from "../api/calendar.api.js"

export function useCalendarList() {
    const rows = ref([])
    const loading = ref(false)
    const archiving = ref(false)
    const error = ref(null)
    let controller = null
    const query = reactive({ page: 1, limit: 10, search: "", startDate: "", endDate: "", includeInherited: true, scopeLevel: "ALL", dayType: "ALL", status: "ALL", sortBy: "dateKey", sortOrder: "asc" })
    const pagination = reactive({ page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrevious: false })
    const hasActiveFilters = computed(() => Boolean(query.search || query.startDate || query.endDate) || query.scopeLevel !== "ALL" || query.dayType !== "ALL" || query.status !== "ALL")

    async function load(overrides = {}) {
        Object.assign(query, overrides)
        controller?.abort()
        controller = new AbortController()
        loading.value = true
        error.value = null
        try {
            const result = await fetchCalendarDays(Object.fromEntries(Object.entries(query).filter(([, value]) => value !== "")))
            rows.value = result.items ?? []
            Object.assign(pagination, result.pagination ?? {})
        } catch (caught) {
            if (caught?.code !== "ERR_CANCELED") { error.value = caught; throw caught }
        } finally { loading.value = false }
    }

    function applyFilters() { return load({ page: 1 }) }
    function clearFilters() { Object.assign(query, { search: "", startDate: "", endDate: "", scopeLevel: "ALL", dayType: "ALL", status: "ALL" }); return load({ page: 1 }) }
    function changePage(event) { return load({ page: event.page, limit: event.limit }) }
    function changeSort(event) { return load({ page: 1, sortBy: event.sortBy, sortOrder: event.sortOrder }) }
    async function archive(id) { archiving.value = true; try { await archiveCalendarDay(id); await load({ page: rows.value.length === 1 && query.page > 1 ? query.page - 1 : query.page }) } finally { archiving.value = false } }
    onBeforeUnmount(() => controller?.abort())
    return { rows, loading, archiving, error, query, pagination, hasActiveFilters, load, applyFilters, clearFilters, changePage, changeSort, archive }
}
