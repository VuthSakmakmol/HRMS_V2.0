import { computed, ref } from "vue"

import { importManpowerPlans } from "../api/manpowerPlan.api.js"

export function useManpowerPlanImport() {
    const file = ref(null)
    const importing = ref(false)
    const progress = ref(0)
    const result = ref(null)
    const error = ref(null)

    const canImport = computed(() => Boolean(file.value) && !importing.value)

    function setFile(nextFile) {
        file.value = nextFile || null
        progress.value = 0
        result.value = null
        error.value = null
    }

    function reset() {
        setFile(null)
        importing.value = false
    }

    async function submit() {
        if (!canImport.value) return null

        importing.value = true
        progress.value = 0
        result.value = null
        error.value = null

        try {
            result.value = await importManpowerPlans(
                file.value,
                (event) => {
                    if (!event.total) return
                    progress.value = Math.round(
                        (event.loaded * 100) / event.total,
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
        setFile,
        reset,
        submit,
    }
}
