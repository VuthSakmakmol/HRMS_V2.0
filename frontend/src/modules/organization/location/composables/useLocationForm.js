import { computed, reactive, ref } from "vue"
import { createLocation, updateLocation } from "../api/location.api.js"

function emptyForm() { return { countryId: "", provinceId: "", districtId: "", communeId: "", code: "", name: "", nationality: "", phoneCode: "", description: "", status: "ACTIVE" } }
function fieldErrors(error) {
    const details = error?.response?.data?.error?.details
    if (!Array.isArray(details)) return {}
    return Object.fromEntries(details.map((item) => [item.path?.at?.(-1) || item.field, item.messageKey || item.message]).filter(([key]) => key))
}
export function useLocationForm() {
    const mode = ref("create"), id = ref(null), saving = ref(false), errors = ref({})
    const form = reactive(emptyForm())
    const isEdit = computed(() => mode.value === "edit")
    function replace(row = {}) { Object.assign(form, emptyForm(), row, { countryId: row.countryId ?? row.country?.id ?? "", provinceId: row.provinceId ?? row.province?.id ?? "", districtId: row.districtId ?? row.district?.id ?? "", communeId: row.communeId ?? row.commune?.id ?? "", status: row.status === "INACTIVE" ? "INACTIVE" : "ACTIVE" }) }
    function openCreate() { mode.value = "create"; id.value = null; errors.value = {}; replace() }
    function openEdit(row) { mode.value = "edit"; id.value = row.id ?? row._id; errors.value = {}; replace(row) }
    function clearError(field) { if (!errors.value[field]) return; const next = { ...errors.value }; delete next[field]; errors.value = next }
    function normalizeCode() { form.code = String(form.code || "").toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_-]/g, ""); clearError("code") }
    async function save(entity) {
        saving.value = true; errors.value = {}
        try {
            const allowed = { countries: ["code","name","nationality","phoneCode","description","status"], provinces: ["countryId","code","name","description","status"], districts: ["countryId","provinceId","code","name","description","status"], communes: ["countryId","provinceId","districtId","code","name","description","status"], villages: ["countryId","provinceId","districtId","communeId","code","name","description","status"] }[entity]
            const payload = Object.fromEntries(allowed.map((key) => [key, form[key]]))
            return isEdit.value ? await updateLocation(entity, id.value, payload) : await createLocation(entity, payload)
        } catch (caught) { errors.value = fieldErrors(caught); throw caught } finally { saving.value = false }
    }
    return { mode, id, saving, errors, form, isEdit, openCreate, openEdit, clearError, normalizeCode, save }
}
