<script setup>
import InputText from "primevue/inputtext"
import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
defineProps({ form: { type: Object, required: true }, disabled: Boolean })
const textFields = [{key:'idCardNo',label:'ID Card Number'},{key:'nssfNo',label:'NSSF Number'},{key:'passportNo',label:'Passport Number'},{key:'medicalCheckNo',label:'Medical Check Number'},{key:'workingBookNo',label:'Working Book Number'}]
const dateFields = [{key:'idCardExpireDate',label:'ID Card Expiry Date'},{key:'passportExpireDate',label:'Passport Expiry Date'},{key:'visaExpireDate',label:'Visa Expiry Date'},{key:'medicalCheckDate',label:'Medical Check Date'}]
</script>
<template><div class="employee-section-grid">
  <label v-for="field in textFields" :key="field.key" class="enterprise-form-field"><span>{{ field.label }}</span><InputText v-model="form.documents[field.key]" :disabled="disabled"/></label>
  <label v-for="field in dateFields" :key="field.key" class="enterprise-form-field"><span>{{ field.label }}</span><EnterpriseCalendarDatePicker v-model="form.documents[field.key]" :disabled="disabled" :show-status="false"/></label>
</div></template>
