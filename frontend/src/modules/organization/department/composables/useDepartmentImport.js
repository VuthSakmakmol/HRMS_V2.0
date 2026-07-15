import {
    computed,
    ref,
} from "vue"

import {
    importDepartments,
} from "../api/department.api.js"

export function useDepartmentImport() {
    const file = ref(null)
    const importing = ref(false)
    const progress = ref(0)
    const result = ref(null)
    const error = ref(null)

    const canImport = computed(() => {
        return Boolean(file.value) && !importing.value
    })

    function reset() {
        file.value = null
        importing.value = false
        progress.value = 0
        result.value = null
        error.value = null
    }

    function setFile(nextFile) {
        file.value = nextFile ?? null
        progress.value = 0
        result.value = null
        error.value = null
    }

    async function submit() {
        if (!file.value || importing.value) {
            return null
        }

        importing.value = true
        progress.value = 0
        result.value = null
        error.value = null

        try {
            result.value = await importDepartments(
                file.value,
                (event) => {
                    if (!event.total) {
                        return
                    }

                    progress.value = Math.min(
                        100,
                        Math.round((event.loaded * 100) / event.total),
                    )
                },
            )

            progress.value = 100

            return result.value
        } catch (caught) {
            error.value = caught
            throw caught
        } finally {
            importing.value = false
        }
    }

    return {
        file,
        importing,
        progress,
        result,
        error,
        canImport,
        reset,
        setFile,
        submit,
    }
}
