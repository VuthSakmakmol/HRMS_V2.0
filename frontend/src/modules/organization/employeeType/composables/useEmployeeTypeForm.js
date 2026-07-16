import { computed, reactive, ref } from "vue"
import { createEmployeeType, updateEmployeeType } from "../api/employeeType.api.js"
function emptyForm() { return { companyId: "", code: "", name: "", shortName: "", structureMode: "DIRECT", dashboardCategory: "CUSTOM", positionAssignmentMode: "SPECIFIC_POSITIONS", positionIds: [], children: [], description: "", status: "ACTIVE" } }
function normalizeCode(value) { return String(value || "").trim().replace(/\s+/g, "_").toUpperCase().replace(/[^A-Z0-9_-]/g, "") }
export function useEmployeeTypeForm() {
    const form = reactive(emptyForm())
    const errors = reactive({})
    const saving = ref(false)
    const mode = ref("create")
    const employeeTypeId = ref(null)
    const isEdit = computed(() => mode.value === "edit")
    function reset() { Object.assign(form, emptyForm()); Object.keys(errors).forEach((key) => delete errors[key]); employeeTypeId.value = null }
    function openCreate() { reset(); mode.value = "create" }
    function openEdit(row) { reset(); mode.value = "edit"; employeeTypeId.value = row.id; Object.assign(form, { companyId: row.companyId || "", code: row.code || "", name: row.name || "", shortName: row.shortName || "", structureMode: row.children?.length ? "CHILD" : "DIRECT", dashboardCategory: row.dashboardCategory || "CUSTOM", positionAssignmentMode: row.positionAssignmentMode || "SPECIFIC_POSITIONS", positionIds: [...(row.positionIds || [])], children: (row.children || []).map((child) => ({ id: child.id, code: child.code || "", name: child.name || "", dashboardCategory: child.dashboardCategory || "CUSTOM", positionAssignmentMode: child.positionAssignmentMode || "SPECIFIC_POSITIONS", positionIds: [...(child.positionIds || [])] })), description: row.description || "", status: row.status === "ARCHIVED" ? "INACTIVE" : row.status || "ACTIVE" }) }
    function addChild() { form.structureMode = "CHILD"; form.positionIds = []; form.children.push({ code: "", name: "", dashboardCategory: "CUSTOM", positionAssignmentMode: "SPECIFIC_POSITIONS", positionIds: [] }) }
    function removeChild(index) { form.children.splice(index, 1) }
    function clearError(field) { delete errors[field] }
    function buildPayload() { return { companyId: form.companyId, code: normalizeCode(form.code), name: form.name.trim(), shortName: form.shortName.trim(), dashboardCategory: form.dashboardCategory, positionAssignmentMode: form.structureMode === "DIRECT" ? form.positionAssignmentMode : "SPECIFIC_POSITIONS", positionIds: form.structureMode === "DIRECT" && form.positionAssignmentMode === "SPECIFIC_POSITIONS" ? [...form.positionIds] : [], children: form.structureMode === "CHILD" ? form.children.map((child) => ({ code: normalizeCode(child.code || child.name), name: child.name.trim(), dashboardCategory: child.dashboardCategory, positionAssignmentMode: child.positionAssignmentMode, positionIds: child.positionAssignmentMode === "SPECIFIC_POSITIONS" ? [...child.positionIds] : [] })) : [], description: form.description.trim(), status: form.status } }
    async function save() { saving.value = true; Object.keys(errors).forEach((key) => delete errors[key]); try { const payload = buildPayload(); return isEdit.value ? await updateEmployeeType(employeeTypeId.value, payload) : await createEmployeeType(payload) } catch (error) { const fields = error?.response?.data?.error?.fields || {}; Object.assign(errors, fields); throw error } finally { saving.value = false } }
    return { form, errors, saving, mode, employeeTypeId, isEdit, openCreate, openEdit, addChild, removeChild, clearError, save }
}
