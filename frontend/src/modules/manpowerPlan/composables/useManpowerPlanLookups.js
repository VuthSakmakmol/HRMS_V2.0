import { ref } from "vue"

import {
    lookupDepartments,
    lookupPositions,
} from "../api/manpowerPlan.api.js"

export function useManpowerPlanLookups() {
    const departments = ref([])
    const filterPositions = ref([])
    const formPositions = ref([])
    const loading = ref(false)

    async function loadBase() {
        loading.value = true

        try {
            departments.value = await lookupDepartments()
        } finally {
            loading.value = false
        }
    }

    async function loadPositions(departmentId, target) {
        target.value = []
        if (!departmentId) return
        target.value = await lookupPositions({ departmentId })
    }

    function loadFilterChildren(departmentId) {
        return loadPositions(departmentId, filterPositions)
    }

    function loadFormChildren(departmentId) {
        return loadPositions(departmentId, formPositions)
    }

    function clear() {
        departments.value = []
        filterPositions.value = []
        formPositions.value = []
    }

    return {
        departments,
        filterPositions,
        formPositions,
        loading,
        loadBase,
        loadFilterChildren,
        loadFormChildren,
        clear,
    }
}
