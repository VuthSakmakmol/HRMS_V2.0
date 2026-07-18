<script setup>
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Textarea from "primevue/textarea"
import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import { EMPLOYMENT_STATUS_OPTIONS, RECORD_STATUS_OPTIONS } from "../../config/employee.filters.js"
defineProps({ form: { type: Object, required: true }, options: { type: Object, default: () => ({}) }, disabled: Boolean })
</script>
<template><div class="employee-section-grid">
  <label class="enterprise-form-field"><span>Join Date *</span><EnterpriseCalendarDatePicker v-model="form.joinDate" :disabled="disabled" :show-status="false"/></label>
  <label class="enterprise-form-field"><span>Employment Status</span><Select v-model="form.employmentStatus" :options="EMPLOYMENT_STATUS_OPTIONS.filter(x=>x.value!=='ALL')" option-label="label" option-value="value" :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Resign Date</span><EnterpriseCalendarDatePicker v-model="form.resignDate" :disabled="disabled" :show-status="false"/></label>
  <label class="enterprise-form-field"><span>Exit Reason</span><Select v-model="form.exitReasonId" :options="options.exitReasonId || []" option-label="label" option-value="value" filter :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Recruitment Channel</span><Select v-model="form.recruitmentChannelId" :options="options.recruitmentChannelId || []" option-label="label" option-value="value" filter :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Source of Hiring</span><InputText v-model="form.sourceOfHiring" :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Introducer Employee</span><Select v-model="form.introducerEmployeeId" :options="options.introducerEmployeeId || []" option-label="label" option-value="value" filter :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Record Status</span><Select v-model="form.recordStatus" :options="RECORD_STATUS_OPTIONS.filter(x=>!['ALL','ARCHIVED'].includes(x.value))" option-label="label" option-value="value" :disabled="disabled"/></label>
  <label class="enterprise-form-field enterprise-form-field--full"><span>Resign Reason</span><Textarea v-model="form.resignReason" rows="2" :disabled="disabled" auto-resize/></label>
  <label class="enterprise-form-field enterprise-form-field--full"><span>Remark</span><Textarea v-model="form.remark" rows="3" :disabled="disabled" auto-resize/></label>
</div></template>
