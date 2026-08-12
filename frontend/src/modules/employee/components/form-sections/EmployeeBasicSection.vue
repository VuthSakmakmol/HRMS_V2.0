<script setup>
import { computed } from "vue"

import InputText from "primevue/inputtext"
import Select from "primevue/select"

import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import { GENDER_OPTIONS } from "../../config/employee.filters.js"

const props = defineProps({
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    disabled: Boolean,
    editing: Boolean,
})

const emit = defineEmits(["clear-error"])

const adultBirthDateLimit = computed(() => {
    const limit = new Date()
    limit.setHours(0, 0, 0, 0)
    limit.setFullYear(limit.getFullYear() - 18)
    return limit
})

const employeeAge = computed(() => {
    if (!props.form.dateOfBirth) return null

    const birthDate = new Date(`${String(props.form.dateOfBirth).slice(0, 10)}T00:00:00`)
    if (Number.isNaN(birthDate.getTime())) return null

    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const birthdayHasPassed =
        today.getMonth() > birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate())

    if (!birthdayHasPassed) age -= 1
    return age >= 0 ? age : null
})

function fieldError(field) {
    const value = props.errors?.[field]
    return Array.isArray(value) ? value[0] : value || ""
}
</script>

<template>
    <div class="employee-section-grid">
        <label class="enterprise-form-field">
            <span>Employee Code <strong class="employee-required-star">*</strong></span>
            <InputText
                v-model="form.employeeCode"
                :invalid="Boolean(fieldError('employeeCode'))"
                :disabled="disabled || editing"
                maxlength="40"
                @input="emit('clear-error', 'employeeCode')"
            />
            <small v-if="fieldError('employeeCode')">{{ fieldError('employeeCode') }}</small>
        </label>

        <label class="enterprise-form-field">
            <span>Display Name</span>
            <InputText v-model="form.displayName" :disabled="disabled" maxlength="240" />
        </label>

        <label class="enterprise-form-field">
            <span>Khmer First Name</span>
            <InputText v-model="form.khmerFirstName" :disabled="disabled" />
        </label>

        <label class="enterprise-form-field">
            <span>Khmer Last Name</span>
            <InputText v-model="form.khmerLastName" :disabled="disabled" />
        </label>

        <label class="enterprise-form-field">
            <span>English First Name</span>
            <InputText v-model="form.englishFirstName" :disabled="disabled" />
        </label>

        <label class="enterprise-form-field">
            <span>English Last Name</span>
            <InputText v-model="form.englishLastName" :disabled="disabled" />
        </label>

        <label class="enterprise-form-field">
            <span>Gender</span>
            <Select
                v-model="form.gender"
                :options="GENDER_OPTIONS.filter((item) => item.value !== 'ALL')"
                option-label="label"
                option-value="value"
                :disabled="disabled"
            />
        </label>

        <label class="enterprise-form-field">
            <span class="employee-birth-label">
                Date of Birth <strong class="employee-required-star">*</strong>
                <em v-if="employeeAge !== null">({{ employeeAge }} years old)</em>
            </span>
            <EnterpriseCalendarDatePicker
                v-model="form.dateOfBirth"
                :company-id="form.companyId"
                :branch-id="form.branchId"
                :max-date="adultBirthDateLimit"
                :disabled="disabled"
                :show-status="false"
                :class="{ 'employee-calendar--invalid': Boolean(fieldError('dateOfBirth')) }"
                @update:model-value="emit('clear-error', 'dateOfBirth')"
            />
            <small v-if="fieldError('dateOfBirth')">{{ fieldError('dateOfBirth') }}</small>
        </label>

        <label class="enterprise-form-field enterprise-form-field--span-2">
            <span>Profile Image URL</span>
            <InputText v-model="form.profileImageUrl" :disabled="disabled" maxlength="1000" />
        </label>
    </div>
</template>

<style scoped>
.employee-birth-label {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
}

.employee-birth-label em {
    color: var(--hrms-text-muted, #64748b) !important;
    font-size: 0.68rem;
    font-style: normal;
    font-weight: 500;
}
</style>
