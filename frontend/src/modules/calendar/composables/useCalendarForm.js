import { computed, reactive, ref } from "vue"
import { createCalendarDay, updateCalendarDay } from "../api/calendar.api.js"

export function createEmptyCalendarForm() {
    return { scopeLevel: "GLOBAL", companyId: "", branchId: "", dateKey: "", dayType: "HOLIDAY", name: "", holidayCategory: "", isPaidHoliday: false, description: "", status: "ACTIVE" }
}

function fieldErrors(error) {
    const fields = error?.response?.data?.error?.fields ?? error?.fields ?? {}
    return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]))
}

export function useCalendarForm() {
    const mode = ref("create")
    const calendarDayId = ref(null)
    const saving = ref(false)
    const errors = ref({})
    const form = reactive(createEmptyCalendarForm())
    const isEdit = computed(() => mode.value === "edit")
    function replaceForm(day = {}) { Object.assign(form, createEmptyCalendarForm(), day, { companyId: day.companyId ?? day.company?.id ?? "", branchId: day.branchId ?? day.branch?.id ?? "", isPaidHoliday: Boolean(day.isPaidHoliday), status: day.status === "INACTIVE" ? "INACTIVE" : "ACTIVE" }) }
    function openCreate() { mode.value = "create"; calendarDayId.value = null; errors.value = {}; replaceForm() }
    function openEdit(day) { mode.value = "edit"; calendarDayId.value = day.id ?? day._id; errors.value = {}; replaceForm(day) }
    function clearError(field) { const next = { ...errors.value }; delete next[field]; errors.value = next }
    async function save() {
        saving.value = true; errors.value = {}
        try {
            const payload = JSON.parse(JSON.stringify(form))
            if (isEdit.value) { delete payload.scopeLevel; delete payload.companyId; delete payload.branchId; delete payload.dateKey }
            else { if (payload.scopeLevel === "GLOBAL") { delete payload.companyId; delete payload.branchId } else if (payload.scopeLevel === "COMPANY") delete payload.branchId }
            const result = isEdit.value ? await updateCalendarDay(calendarDayId.value, payload) : await createCalendarDay(payload)
            replaceForm(result); return result
        } catch (error) { errors.value = fieldErrors(error); throw error } finally { saving.value = false }
    }
    return { mode, calendarDayId, saving, errors, form, isEdit, openCreate, openEdit, clearError, save }
}
