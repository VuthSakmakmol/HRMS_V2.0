import { computed, onBeforeUnmount, reactive, ref } from "vue"
import { archiveEmployeeType, listEmployeeTypes } from "../api/employeeType.api.js"
export function useEmployeeTypeList() {
    const rows = ref([])
    const loading = ref(false)
    const archiving = ref(false)
    const error = ref(null)
    const requestController = ref(null)
    const query = reactive({ page: 1, limit: 10, search: "", companyId: "", dashboardCategory: "ALL", status: "ALL" })
    const pagination = reactive({ page: 1, limit: 10, total: 0, totalPages: 0 })
    const hasActiveFilters = computed(() => Boolean(query.search || query.companyId) || query.dashboardCategory !== "ALL" || query.status !== "ALL")
    async function load(overrides = {}) {
        Object.assign(query, overrides)
        requestController.value?.abort()
        requestController.value = new AbortController()
        loading.value = true
        error.value = null
        try {
            const result = await listEmployeeTypes({
                page: query.page, limit: query.limit,
                search: query.search || undefined,
                companyId: query.companyId || undefined,
                dashboardCategory: query.dashboardCategory,
                status: query.status,
            }, requestController.value.signal)
            rows.value = result.items
            Object.assign(pagination, result.pagination)
        } catch (caught) {
            if (caught?.code !== "ERR_CANCELED") { error.value = caught; throw caught }
        } finally { loading.value = false }
    }
    function applyFilters() { return load({ page: 1 }) }
    function clearFilters() { query.search = ""; query.companyId = ""; query.dashboardCategory = "ALL"; query.status = "ALL"; return load({ page: 1 }) }
    function changePage(event) { return load({ page: event.page, limit: event.limit }) }
    async function archive(id) { archiving.value = true; try { await archiveEmployeeType(id); await load({ page: rows.value.length === 1 && query.page > 1 ? query.page - 1 : query.page }) } finally { archiving.value = false } }
    onBeforeUnmount(() => requestController.value?.abort())
    return { rows, loading, archiving, error, query, pagination, hasActiveFilters, load, applyFilters, clearFilters, changePage, archive }
}
