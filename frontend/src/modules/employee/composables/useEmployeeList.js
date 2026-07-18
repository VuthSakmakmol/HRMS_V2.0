import { computed, reactive, ref } from "vue"
import { archiveEmployee, fetchEmployees } from "../api/employee.api.js"

export function useEmployeeList() {
    const rows = ref([])
    const loading = ref(false)
    const error = ref(null)
    const pagination = reactive({ page: 1, limit: 10, total: 0, totalPages: 1 })
    const filters = reactive({ search: "", employmentStatus: "ALL", recordStatus: "ACTIVE", companyId: "", branchId: "", departmentId: "", positionId: "", lineId: "", shiftId: "" })

    const query = computed(() => ({
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "")),
    }))

    async function load() {
        loading.value = true
        error.value = null
        try {
            const result = await fetchEmployees(query.value)
            rows.value = result.items ?? []
            Object.assign(pagination, result.pagination ?? {})
        } catch (nextError) {
            error.value = nextError
            throw nextError
        } finally {
            loading.value = false
        }
    }

    async function archive(employeeId) {
        await archiveEmployee(employeeId)
        await load()
    }

    function applyFilters() { pagination.page = 1; return load() }
    function clearFilters() { Object.assign(filters, { search: "", employmentStatus: "ALL", recordStatus: "ACTIVE", companyId: "", branchId: "", departmentId: "", positionId: "", lineId: "", shiftId: "" }); return applyFilters() }
    function changePage({ page, rows: limit }) { pagination.page = page + 1; pagination.limit = limit; return load() }

    return { rows, loading, error, pagination, filters, query, load, archive, applyFilters, clearFilters, changePage }
}
