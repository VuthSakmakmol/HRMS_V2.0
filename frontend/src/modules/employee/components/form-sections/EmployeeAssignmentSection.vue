<script setup>
import Select from "primevue/select"
import { useI18n } from "vue-i18n"

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
    "position-change",
])

const { t, te } = useI18n()

const fields = Object.freeze([
    { key: "companyId", label: "Company" },
    { key: "branchId", label: "Branch" },
    { key: "departmentId", label: "Department" },
    { key: "positionId", label: "Position" },
    { key: "lineId", label: "Line" },
    { key: "shiftId", label: "Shift" },
])

function translateMessage(message) {
    const value = String(message || "").trim()
    if (!value) return ""
    return te(value) ? t(value) : value
}

function fieldError(field) {
    const value = props.errors?.[field]
    const message = Array.isArray(value) ? value[0] : value || ""
    return translateMessage(message)
}

function fieldDisabled(field) {
    if (props.disabled) return true
    if (["companyId", "branchId"].includes(field)) return true
    if (field === "departmentId") return !props.form.branchId
    if (field === "positionId") return !props.form.departmentId
    if (field === "lineId") return !props.form.positionId
    if (field === "shiftId") return !props.form.branchId
    return false
}

function onChange(field) {
    emit("clear-error", field)
    if (field === "companyId") emit("company-change")
    if (field === "branchId") emit("branch-change")
    if (field === "departmentId") emit("department-change")
    if (field === "positionId") emit("position-change")
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
                option-disabled="disabled"
                filter
                :invalid="Boolean(fieldError(field.key))"
                :disabled="fieldDisabled(field.key)"
                @change="onChange(field.key)"
            >
                <template v-if="field.key === 'positionId'" #option="slotProps">
                    <div
                        class="employee-position-option"
                        :class="{
                            'employee-position-option--disabled': slotProps.option.disabled,
                        }"
                    >
                        <span class="employee-position-option__position">
                            {{ slotProps.option.label }}
                        </span>

                        <span
                            v-if="slotProps.option.disabled"
                            class="employee-position-option__problem"
                        >
                            <i class="pi pi-exclamation-circle" aria-hidden="true"></i>
                            {{ slotProps.option.configurationNote }}
                        </span>

                        <span
                            v-else-if="slotProps.option.employeeTypeCodeLabel"
                            class="employee-position-option__mapping"
                        >
                            {{ slotProps.option.employeeTypeCodeLabel }}
                        </span>
                    </div>
                </template>
            </Select>

            <small v-if="fieldError(field.key)">{{ fieldError(field.key) }}</small>
        </label>
    </div>
</template>

<style scoped>
.employee-position-option {
    display: grid;
    width: 100%;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
}

.employee-position-option__position {
    min-width: 0;
    overflow: hidden;
    color: var(--p-text-color, #334155);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.employee-position-option__mapping {
    flex: 0 0 auto;
    padding: 0.15rem 0.45rem;
    color: #1e3a8a;
    background: #dbeafe;
    border: 1px solid #bfdbfe;
    border-radius: 0.35rem;
    font-size: 0.68rem;
    font-weight: 800;
    line-height: 1.15;
    white-space: nowrap;
}

.employee-position-option__problem {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.3rem;
    color: var(--p-red-600, #dc2626);
    font-size: 0.68rem;
    font-weight: 750;
    line-height: 1.15;
    white-space: nowrap;
}

.employee-position-option--disabled .employee-position-option__position {
    color: var(--p-text-muted-color, #94a3b8);
}

@media (max-width: 680px) {
    .employee-position-option {
        grid-template-columns: minmax(0, 1fr);
        gap: 0.2rem;
    }

    .employee-position-option__mapping,
    .employee-position-option__problem {
        justify-self: start;
        white-space: normal;
    }
}
</style>
