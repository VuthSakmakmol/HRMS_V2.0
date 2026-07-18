import { ref } from "vue"

import {
    lookupDepartments,
    lookupEmployeeTypes,
    lookupLines,
    lookupPositions,
    lookupShifts,
} from "../api/manpowerPlan.api.js"

export function useManpowerPlanLookups() {
    const departments = ref([])
    const shifts = ref([])
    const employeeTypes = ref([])
    const filterPositions = ref([])
    const filterLines = ref([])
    const formPositions = ref([])
    const formLines = ref([])
    const loading = ref(false)

    async function loadBase() {
        loading.value = true

        try {
            const results = await Promise.all([
                lookupDepartments(),
                lookupShifts(),
                lookupEmployeeTypes(),
            ])

            departments.value = results[0]
            shifts.value = results[1]
            employeeTypes.value = results[2]
        } finally {
            loading.value = false
        }
    }

    async function loadDepartmentChildren(
        departmentId,
        positionsTarget,
        linesTarget,
    ) {
        positionsTarget.value = []
        linesTarget.value = []

        if (!departmentId) return

        const results = await Promise.all([
            lookupPositions({ departmentId }),
            lookupLines({ departmentId }),
        ])

        positionsTarget.value = results[0]
        linesTarget.value = results[1]
    }

    function loadFilterChildren(departmentId) {
        return loadDepartmentChildren(
            departmentId,
            filterPositions,
            filterLines,
        )
    }

    function loadFormChildren(departmentId) {
        return loadDepartmentChildren(
            departmentId,
            formPositions,
            formLines,
        )
    }

    function clear() {
        departments.value = []
        shifts.value = []
        employeeTypes.value = []
        filterPositions.value = []
        filterLines.value = []
        formPositions.value = []
        formLines.value = []
    }

    return {
        departments,
        shifts,
        employeeTypes,
        filterPositions,
        filterLines,
        formPositions,
        formLines,
        loading,
        loadBase,
        loadFilterChildren,
        loadFormChildren,
        clear,
    }
}
