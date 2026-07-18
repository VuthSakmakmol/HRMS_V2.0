<script setup>
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Textarea from "primevue/textarea"
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import { createMonthOptions } from "../config/manpowerPlan.filters.js"

const props = defineProps({
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    companyName: { type: String, default: "—" },
    branchName: { type: String, default: "—" },
    departments: { type: Array, default: () => [] },
    positions: { type: Array, default: () => [] },
    lines: { type: Array, default: () => [] },
    shifts: { type: Array, default: () => [] },
    employeeTypes: { type: Array, default: () => [] },
    disabled: { type: Boolean, default: false },
})

const emit = defineEmits([
    "clear-error",
    "department-change",
    "employee-type-change",
])

const { t, locale } = useI18n()
const monthOptions = computed(() =>
    createMonthOptions(t, locale.value, false),
)
const statusOptions = computed(() => [
    { label: t("manpowerPlan.active"), value: "ACTIVE" },
    { label: t("manpowerPlan.inactive"), value: "INACTIVE" },
])
const childOptions = computed(() => {
    const type = props.employeeTypes.find(
        (item) => item.id === props.form.employeeTypeId,
    )

    return [
        { id: "", name: t("manpowerPlan.noChildGroup") },
        ...(type?.children || []),
    ]
})

function message(field) {
    const value = props.errors?.[field]
    if (!value) return ""
    const translated = t(value)
    return translated === value ? value : translated
}
</script>

<template>
    <form class="manpower-form" @submit.prevent>
        <section class="manpower-form__section">
            <h3>{{ t("manpowerPlan.planScope") }}</h3>
            <div class="manpower-form__grid">
                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>{{ t("manpowerPlan.company") }}</span>
                    <InputText :model-value="companyName" disabled />
                </label>
                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>{{ t("manpowerPlan.branch") }}</span>
                    <InputText :model-value="branchName" disabled />
                </label>
                <label class="enterprise-form-field">
                    <span>{{ t("manpowerPlan.year") }} *</span>
                    <InputNumber v-model="form.year" :min="2000" :max="2100" :use-grouping="false" :disabled="disabled" />
                    <small v-if="message('year')">{{ message("year") }}</small>
                </label>
                <label class="enterprise-form-field">
                    <span>{{ t("manpowerPlan.month") }} *</span>
                    <Select v-model="form.month" :options="monthOptions" option-label="label" option-value="value" :disabled="disabled" />
                    <small v-if="message('month')">{{ message("month") }}</small>
                </label>
                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>{{ t("manpowerPlan.department") }}</span>
                    <Select v-model="form.departmentId" :options="departments" option-label="name" option-value="id" filter show-clear :disabled="disabled" @change="emit('department-change')" />
                </label>
                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>{{ t("manpowerPlan.position") }}</span>
                    <Select v-model="form.positionId" :options="positions" option-label="title" option-value="id" filter show-clear :disabled="disabled || !form.departmentId" />
                </label>
                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>{{ t("manpowerPlan.line") }}</span>
                    <Select v-model="form.lineId" :options="lines" option-label="name" option-value="id" filter show-clear :disabled="disabled || !form.departmentId" />
                </label>
                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>{{ t("manpowerPlan.shift") }}</span>
                    <Select v-model="form.shiftId" :options="shifts" option-label="name" option-value="id" filter show-clear :disabled="disabled" />
                </label>
                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>{{ t("manpowerPlan.employeeType") }}</span>
                    <Select v-model="form.employeeTypeId" :options="employeeTypes" option-label="name" option-value="id" filter show-clear :disabled="disabled" @change="emit('employee-type-change')" />
                </label>
                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>{{ t("manpowerPlan.childGroup") }}</span>
                    <Select v-model="form.employeeTypeChildId" :options="childOptions" option-label="name" option-value="id" filter :disabled="disabled || !form.employeeTypeId" />
                </label>
                <label class="enterprise-form-field">
                    <span>{{ t("manpowerPlan.targetBudget") }}</span>
                    <InputNumber v-model="form.targetBudget" :min="0" :use-grouping="false" :disabled="disabled" />
                </label>
                <label class="enterprise-form-field">
                    <span>{{ t("manpowerPlan.targetRoadmap") }}</span>
                    <InputNumber v-model="form.targetRoadmap" :min="0" :use-grouping="false" :disabled="disabled" />
                </label>
                <label class="enterprise-form-field">
                    <span>{{ t("common.status") }}</span>
                    <Select v-model="form.status" :options="statusOptions" option-label="label" option-value="value" :disabled="disabled" />
                </label>
                <label class="enterprise-form-field enterprise-form-field--full">
                    <span>{{ t("manpowerPlan.remark") }}</span>
                    <Textarea v-model="form.remark" rows="3" maxlength="500" auto-resize :disabled="disabled" />
                </label>
            </div>
        </section>
    </form>
</template>

<style scoped>
.manpower-form,
.manpower-form__section {
    display: grid;
    gap: 1rem;
}

.manpower-form__section h3 {
    margin: 0;
    font-size: 1rem;
}

.manpower-form__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.9rem;
}

@media (max-width: 680px) {
    .manpower-form__grid {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
