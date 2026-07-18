import {
    computed,
    onBeforeUnmount,
    reactive,
    ref,
} from "vue"

import {
    archiveManpowerPlan,
    listManpowerPlans,
} from "../api/manpowerPlan.api.js"

export function useManpowerPlanList() {
    const rows = ref([])
    const loading = ref(false)
    const archiving = ref(false)
    const error = ref(null)
    const controller = ref(null)

    const query = reactive({
        page: 1,
        limit: 10,
        search: "",
        year: new Date().getFullYear(),
        month: "",
        employeeTypeId: "",
        employeeTypeChildId: "",
        departmentId: "",
        positionId: "",
        lineId: "",
        shiftId: "",
        status: "ALL",
        sortBy: "year",
        sortOrder: "desc",
    })

    const pagination = reactive({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
    })

    const hasActiveFilters = computed(() =>
        Boolean(
            query.search ||
            query.month ||
            query.employeeTypeId ||
            query.employeeTypeChildId ||
            query.departmentId ||
            query.positionId ||
            query.lineId ||
            query.shiftId ||
            query.status !== "ALL",
        ),
    )

    function params() {
        return Object.fromEntries(
            Object.entries(query).filter(
                ([, value]) => value !== "" && value !== null && value !== undefined,
            ),
        )
    }

    async function load(overrides = {}) {
        Object.assign(query, overrides)
        controller.value?.abort()
        controller.value = new AbortController()
        loading.value = true
        error.value = null

        try {
            const result = await listManpowerPlans(
                params(),
                controller.value.signal,
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
        Object.assign(query, {
            page: 1,
            search: "",
            year: new Date().getFullYear(),
            month: "",
            employeeTypeId: "",
            employeeTypeChildId: "",
            departmentId: "",
            positionId: "",
            lineId: "",
            shiftId: "",
            status: "ALL",
        })

        return load()
    }

    function changePage(event) {
        return load({ page: event.page, limit: event.limit })
    }

    function changeSort(event) {
        return load({
            page: 1,
            sortBy: event.sortBy,
            sortOrder: event.sortOrder,
        })
    }

    async function archive(id) {
        archiving.value = true

        try {
            await archiveManpowerPlan(id)
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

    onBeforeUnmount(() => controller.value?.abort())

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
