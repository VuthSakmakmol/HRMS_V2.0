<script setup>
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import { GENDER_OPTIONS } from "../../config/employee.filters.js"
defineProps({ form: { type: Object, required: true }, errors: { type: Object, default: () => ({}) }, disabled: Boolean, editing: Boolean })
defineEmits(["clear-error"])
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
    <label class="enterprise-form-field"><span>Date of Birth</span><EnterpriseCalendarDatePicker v-model="form.dateOfBirth" :disabled="disabled" :show-status="false"/></label>
    <label class="enterprise-form-field enterprise-form-field--full"><span>Profile Image URL</span><InputText v-model="form.profileImageUrl" :disabled="disabled" maxlength="1000"/></label>
  </div>
</template>
