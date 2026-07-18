import { computed, ref } from "vue"

import { importEmployees } from "../api/employee.api.js"

export function useEmployeeImport() {
    const visible = ref(false)
    const file = ref(null)
    const importing = ref(false)
    const progress = ref(0)
    const result = ref(null)

    const canImport = computed(() =>
        Boolean(file.value) && !importing.value,
    )

    function open() {
        file.value = null
        progress.value = 0
        result.value = null
        visible.value = true
    }

    function setFile(nextFile) {
        file.value = nextFile
        result.value = null
        progress.value = 0
    }

    async function submit(params = {}) {
        if (!canImport.value) {
            return null
        }

        importing.value = true
        result.value = null

        try {
            result.value = await importEmployees(
                file.value,
                params,
                (event) => {
                    progress.value = event.total
                        ? Math.round((event.loaded * 100) / event.total)
                        : 0
                },
            )

            return result.value
        } catch (error) {
            if (error.importSummary) {
                result.value = error.importSummary
            }

            throw error
        } finally {
            importing.value = false
        }
    }

    return {
        visible,
        file,
        importing,
        progress,
        result,
        canImport,
        open,
        setFile,
        submit,
    }
}
