import { computed, ref } from "vue"
import { importCalendarDays } from "../api/calendar.api.js"

export function useCalendarImport() {
    const file = ref(null), importing = ref(false), progress = ref(0), result = ref(null), error = ref(null)
    const canImport = computed(() => Boolean(file.value) && !importing.value)
    function reset() { file.value = null; importing.value = false; progress.value = 0; result.value = null; error.value = null }
    function setFile(next) { file.value = next ?? null; progress.value = 0; result.value = null; error.value = null }
    async function submit() {
        if (!canImport.value) return null
        importing.value = true; progress.value = 1; error.value = null
        try {
            result.value = await importCalendarDays(file.value, (event) => { if (event.total) progress.value = Math.max(1, Math.round((event.loaded * 95) / event.total)) })
            progress.value = 100; return result.value
        } catch (caught) { error.value = caught; throw caught } finally { importing.value = false }
    }
    return { file, importing, progress, result, error, canImport, reset, setFile, submit }
}
