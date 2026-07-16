import { reactive, ref } from "vue"
import { archiveLocation, listLocations } from "../api/location.api.js"

export function useLocationList() {
    const rows = ref([])
    const loading = ref(false)
    const archiving = ref(false)
    const error = ref(null)
    const pagination = reactive({ page: 1, limit: 10, total: 0, totalPages: 1 })
    const query = reactive({ page: 1, limit: 10, search: "", status: "ALL", countryId: "", provinceId: "", districtId: "", communeId: "" })

    function cleanQuery() {
        return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== "" && value !== undefined && value !== null))
    }
    async function load(entity) {
        loading.value = true; error.value = null
        try {
            const result = await listLocations(entity, cleanQuery())
            rows.value = Array.isArray(result.items) ? result.items : []
            Object.assign(pagination, result.pagination || { page: query.page, limit: query.limit, total: 0, totalPages: 1 })
        } catch (caught) { error.value = caught; throw caught } finally { loading.value = false }
    }
    async function apply(entity) { query.page = 1; await load(entity) }
    async function reset(entity) {
        Object.assign(query, { page: 1, limit: 10, search: "", status: "ALL", countryId: "", provinceId: "", districtId: "", communeId: "" })
        await load(entity)
    }
    async function changePage(entity, event) { query.page = event.page; query.limit = event.limit; await load(entity) }
    async function changeSort(entity, event) { query.sortBy = event.sortBy; query.sortOrder = event.sortOrder; query.page = 1; await load(entity) }
    async function archive(entity, id) { archiving.value = true; try { await archiveLocation(entity, id); await load(entity) } finally { archiving.value = false } }
    return { rows, loading, archiving, error, pagination, query, load, apply, reset, changePage, changeSort, archive }
}
