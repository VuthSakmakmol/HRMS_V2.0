import { reactive, ref } from "vue"

import { updateManpowerPlan } from "../api/manpowerPlan.api.js"

export function createEmptyManpowerPlanForm() {
    return {
        companyId: "",
        branchId: "",
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        departmentId: "",
        positionId: "",
        lineId: "",
        shiftId: "",
        employeeTypeId: "",
        employeeTypeChildId: "",
        targetBudget: 0,
        targetRoadmap: 0,
        remark: "",
        status: "ACTIVE",
    }
}

function mapFieldErrors(error) {
    const fields = error?.response?.data?.error?.fields ?? error?.fields ?? {}

    return Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
            key,
            Array.isArray(value) ? value[0] : value,
        ]),
    )
}

export function useManpowerPlanForm() {
    const planId = ref("")
    const saving = ref(false)
    const errors = ref({})
    const form = reactive(createEmptyManpowerPlanForm())

    function openEdit(plan, workspace) {
        planId.value = plan.id || plan._id
        errors.value = {}
        Object.assign(form, createEmptyManpowerPlanForm(), plan, {
            companyId: workspace.companyId,
            branchId: workspace.branchId,
            departmentId: plan.departmentId || "",
            positionId: plan.positionId || "",
            lineId: plan.lineId || "",
            shiftId: plan.shiftId || "",
            employeeTypeId: plan.employeeTypeId || "",
            employeeTypeChildId: plan.employeeTypeChildId || "",
            targetBudget: Number(plan.targetBudget || 0),
            targetRoadmap: Number(plan.targetRoadmap || 0),
            status: plan.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        })
    }

    function clearError(field) {
        if (!errors.value[field]) return
        const next = { ...errors.value }
        delete next[field]
        errors.value = next
    }

    async function save() {
        saving.value = true
        errors.value = {}

        try {
            const payload = {
                year: Number(form.year),
                month: Number(form.month),
                departmentId: form.departmentId || null,
                positionId: form.positionId || null,
                lineId: form.lineId || null,
                shiftId: form.shiftId || null,
                employeeTypeId: form.employeeTypeId || null,
                employeeTypeChildId: form.employeeTypeChildId || null,
                targetBudget: Number(form.targetBudget || 0),
                targetRoadmap: Number(form.targetRoadmap || 0),
                remark: String(form.remark || "").trim(),
                status: form.status,
            }

            return await updateManpowerPlan(planId.value, payload)
        } catch (error) {
            errors.value = mapFieldErrors(error)
            throw error
        } finally {
            saving.value = false
        }
    }

    return {
        planId,
        saving,
        errors,
        form,
        openEdit,
        clearError,
        save,
    }
}
