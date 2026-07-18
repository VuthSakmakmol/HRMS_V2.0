<script setup>
import { computed } from "vue"

import InputText from "primevue/inputtext"
import Select from "primevue/select"
import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import { GENDER_OPTIONS } from "../../config/employee.filters.js"
const props = defineProps({ form: { type: Object, required: true }, errors: { type: Object, default: () => ({}) }, disabled: Boolean, editing: Boolean })
defineEmits(["clear-error"])

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
        (today.getMonth() === birthDate.getMonth() &&
            today.getDate() >= birthDate.getDate())

    if (!birthdayHasPassed) age -= 1
    return age >= 0 ? age : null
})
</script>
<template>
  <div class="employee-section-grid">
    <label class="enterprise-form-field"><span>Employee Code *</span><InputText v-model="form.employeeCode" :disabled="disabled || editing" maxlength="40" @input="$emit('clear-error','employeeCode')"/><small v-if="errors.employeeCode">{{ errors.employeeCode[0] || errors.employeeCode }}</small></label>
    <label class="enterprise-form-field"><span>Display Name</span><InputText v-model="form.displayName" :disabled="disabled" maxlength="240"/></label>
    <label class="enterprise-form-field"><span>Khmer First Name</span><InputText v-model="form.khmerFirstName" :disabled="disabled"/></label>
    <label class="enterprise-form-field"><span>Khmer Last Name</span><InputText v-model="form.khmerLastName" :disabled="disabled"/></label>
    <label class="enterprise-form-field"><span>English First Name</span><InputText v-model="form.englishFirstName" :disabled="disabled"/></label>
    <label class="enterprise-form-field"><span>English Last Name</span><InputText v-model="form.englishLastName" :disabled="disabled"/></label>
    <label class="enterprise-form-field"><span>Gender</span><Select v-model="form.gender" :options="GENDER_OPTIONS" option-label="label" option-value="value" :disabled="disabled"/></label>
    <label class="enterprise-form-field"><span class="employee-birth-label">Date of Birth <em v-if="employeeAge !== null">({{ employeeAge }} years old)</em></span><EnterpriseCalendarDatePicker v-model="form.dateOfBirth" :company-id="form.companyId" :branch-id="form.branchId" :max-date="adultBirthDateLimit" :disabled="disabled" :show-status="false"/></label>
    <label class="enterprise-form-field enterprise-form-field--full"><span>Profile Image URL</span><InputText v-model="form.profileImageUrl" :disabled="disabled" maxlength="1000"/></label>
  </div>
</template>

<style scoped>
.employee-birth-label {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
}

.employee-birth-label em {
    color: var(--hrms-text-muted);
    font-size: 0.7rem;
    font-style: normal;
    font-weight: 600;
}
</style>
