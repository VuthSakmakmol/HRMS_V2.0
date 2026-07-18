import { ref } from "vue"
import { fetchEmployee } from "../api/employee.api.js"

export function useEmployeeDetails() {
    const visible = ref(false)
    const loading = ref(false)
    const employee = ref(null)

    async function open(employeeId) {
        visible.value = true
        loading.value = true
        employee.value = null
        try { employee.value = await fetchEmployee(employeeId) }
        finally { loading.value = false }
    }

    function close() { visible.value = false; employee.value = null }
    return { visible, loading, employee, open, close }
}
