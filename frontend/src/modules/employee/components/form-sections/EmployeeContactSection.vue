<script setup>
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Textarea from "primevue/textarea"
import { MARITAL_STATUS_OPTIONS } from "../../config/employee.filters.js"
defineProps({ form: { type: Object, required: true }, disabled: Boolean })
</script>
<template><div class="employee-section-grid">
  <label class="enterprise-form-field"><span>Email</span><InputText v-model="form.email" :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Phone Number</span><InputText v-model="form.phoneNumber" :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Emergency/Agent Person</span><InputText v-model="form.agentPerson" :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Emergency/Agent Phone</span><InputText v-model="form.agentPhoneNumber" :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Marital Status</span><Select v-model="form.maritalStatus" :options="MARITAL_STATUS_OPTIONS" option-label="label" option-value="value" :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Spouse Name</span><InputText v-model="form.spouseName" :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Spouse Contact Number</span><InputText v-model="form.spouseContactNumber" :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Nationality</span><InputText v-model="form.nationality" :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Education</span><InputText v-model="form.education" :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Religion</span><InputText v-model="form.religion" :disabled="disabled"/></label>
  <label class="enterprise-form-field enterprise-form-field--full"><span>Note</span><Textarea v-model="form.note" rows="3" :disabled="disabled" auto-resize/></label>
</div></template>
