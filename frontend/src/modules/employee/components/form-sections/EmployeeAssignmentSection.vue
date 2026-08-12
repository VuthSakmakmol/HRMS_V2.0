<script setup>
import Select from "primevue/select"

const props = defineProps({
    form: { type: Object, required: true },
    options: { type: Object, default: () => ({}) },
    errors: { type: Object, default: () => ({}) },
    disabled: Boolean,
    editing: Boolean,
})

const emit = defineEmits([
    "clear-error",
    "company-change",
    "branch-change",
    "department-change",
])

const fields = Object.freeze([
    { key: "companyId", label: "Company" },
    { key: "branchId", label: "Branch" },
    { key: "departmentId", label: "Department" },
    { key: "positionId", label: "Position" },
    { key: "lineId", label: "Line" },
    { key: "shiftId", label: "Shift" },
])

function fieldError(field) {
    const value = props.errors?.[field]
    return Array.isArray(value) ? value[0] : value || ""
}

function fieldDisabled(field) {
    if (props.disabled) return true
    if (["companyId", "branchId"].includes(field)) return true
    if (field === "departmentId") return !props.form.branchId
    if (field === "positionId") return !props.form.departmentId
    if (["lineId", "shiftId"].includes(field)) return !props.form.branchId
    return false
}

function onChange(field) {
    emit("clear-error", field)
    if (field === "companyId") emit("company-change")
    if (field === "branchId") emit("branch-change")
    if (field === "departmentId") emit("department-change")
}
</script>

<template>
    <div class="employee-section-grid">
        <label
            v-for="field in fields"
            :key="field.key"
            class="enterprise-form-field"
        >
            <span>{{ field.label }} <strong class="employee-required-star">*</strong></span>
            <Select
                v-model="form[field.key]"
                :options="options[field.key] || []"
                option-label="label"
                option-value="value"
                filter
                :invalid="Boolean(fieldError(field.key))"
                :disabled="fieldDisabled(field.key)"
                @change="onChange(field.key)"
            />
            <small v-if="fieldError(field.key)">{{ fieldError(field.key) }}</small>
        </label>
    </div>
</template>
