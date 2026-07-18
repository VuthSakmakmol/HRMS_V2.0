<script setup>
import InputText from "primevue/inputtext"
import Select from "primevue/select"
defineProps({ form: { type: Object, required: true }, options: { type: Object, default: () => ({}) }, errors: { type: Object, default: () => ({}) }, disabled: Boolean, editing: Boolean })
defineEmits(["company-change", "branch-change", "department-change"])
</script>
<template><div class="employee-section-grid">
  <label v-for="field in ['companyId','branchId','departmentId','positionId','lineId','shiftId']" :key="field" class="enterprise-form-field"><span>{{ ({companyId:'Company',branchId:'Branch',departmentId:'Department',positionId:'Position',lineId:'Line',shiftId:'Shift'})[field] }} *</span><Select v-model="form[field]" :options="options[field] || []" option-label="label" option-value="value" filter :disabled="disabled || ['companyId','branchId'].includes(field) || (field==='departmentId'&&!form.branchId) || (['positionId','lineId'].includes(field)&&!form.departmentId) || (field==='shiftId'&&!form.branchId)" @change="field==='departmentId'?$emit('department-change'):null"/><small v-if="errors[field]">{{ errors[field][0] || errors[field] }}</small></label>
  <label class="enterprise-form-field"><span>Employee Type</span><Select v-model="form.employeeTypeId" :options="options.employeeTypeId || []" option-label="label" option-value="value" filter :disabled="disabled"/></label>
  <label class="enterprise-form-field"><span>Employee Type Child Code</span><InputText v-model="form.employeeTypeChildCode" :disabled="disabled || !form.employeeTypeId" maxlength="30"/></label>
  <label class="enterprise-form-field"><span>Employee Type Child Name</span><InputText v-model="form.employeeTypeChildName" :disabled="disabled || !form.employeeTypeId" maxlength="120"/></label>
</div></template>
