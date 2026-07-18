import { computed, reactive, ref } from "vue"
import { createShift, updateShift } from "../api/shift.api.js"

function emptyForm() {
    return {
        companyId: "",
        branchId: "",
        code: "",
        name: "",
        shortName: "",
        startTime: "07:00",
        endTime: "16:00",
        breakStartTime: "12:00",
        breakEndTime: "13:00",
        graceInMinutes: 0,
        graceOutMinutes: 0,
        description: "",
        status: "ACTIVE",
    }
}

export function useShiftForm() {
    const visible = ref(false)
    const mode = ref("create")
    const saving = ref(false)
    const errors = ref({})
    const selectedId = ref(null)
    const form = reactive(emptyForm())

    const isEdit = computed(() => mode.value === "edit")

    function clearErrors(field) {
        if (!field) {
            errors.value = {}
            return
        }
        const next = { ...errors.value }
        delete next[field]
        errors.value = next
    }

    function assign(source = {}) {
        Object.assign(form, emptyForm(), {
            companyId: source.companyId ?? source.company?.id ?? "",
            branchId: source.branchId ?? source.branch?.id ?? "",
            code: source.code ?? "",
            name: source.name ?? "",
            shortName: source.shortName ?? "",
            startTime: source.startTime ?? "07:00",
            endTime: source.endTime ?? "16:00",
            breakStartTime: source.breakStartTime ?? "",
            breakEndTime: source.breakEndTime ?? "",
            graceInMinutes: Number(source.graceInMinutes ?? 0),
            graceOutMinutes: Number(source.graceOutMinutes ?? 0),
            description: source.description ?? "",
            status: source.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        })
    }

    function openCreate(workspace = {}) {
        mode.value = "create"
        selectedId.value = null
        assign({
            companyId: workspace.companyId || "",
            branchId: workspace.branchId || "",
        })
        clearErrors()
        visible.value = true
    }

    function openEdit(shift) {
        mode.value = "edit"
        selectedId.value = shift.id
        assign(shift)
        clearErrors()
        visible.value = true
    }

    function close() {
        if (!saving.value) visible.value = false
    }

    function payload() {
        return {
            companyId: form.companyId,
            branchId: form.branchId,
            code: form.code,
            name: form.name,
            shortName: form.shortName,
            startTime: form.startTime,
            endTime: form.endTime,
            breakStartTime: form.breakStartTime || "",
            breakEndTime: form.breakEndTime || "",
            graceInMinutes: Number(form.graceInMinutes || 0),
            graceOutMinutes: Number(form.graceOutMinutes || 0),
            description: form.description,
            status: form.status,
        }
    }

    async function submit() {
        saving.value = true
        clearErrors()
        try {
            const data = payload()
            if (isEdit.value) {
                delete data.companyId
                delete data.branchId
                return await updateShift(selectedId.value, data)
            }
            return await createShift(data)
        } catch (error) {
            errors.value = error?.response?.data?.error?.fields ?? {}
            throw error
        } finally {
            saving.value = false
        }
    }

    return { visible, mode, isEdit, saving, errors, form, openCreate, openEdit, close, clearErrors, submit }
}
