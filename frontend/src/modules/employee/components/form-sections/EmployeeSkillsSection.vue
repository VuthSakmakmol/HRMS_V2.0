<script setup>
import Checkbox from "primevue/checkbox"
import InputNumber from "primevue/inputnumber"
import Select from "primevue/select"
defineProps({ form: { type: Object, required: true }, options: { type: Object, default: () => ({}) }, disabled: Boolean, editing: Boolean })
const skills=[{key:'singleNeedle',label:'Single Needle'},{key:'overlock',label:'Overlock'},{key:'coverstitch',label:'Coverstitch'},{key:'totalMachines',label:'Total Machines'}]
</script>
<template><div class="employee-section-grid">
  <label v-for="skill in skills" :key="skill.key" class="enterprise-form-field"><span>{{ skill.label }}</span><InputNumber v-model="form.machineSkills[skill.key]" :min="0" :max="999" :use-grouping="false" :disabled="disabled"/></label>
  <label class="enterprise-form-field enterprise-form-field--full"><span>Approval Policy</span><Select v-model="form.approvalPolicyId" :options="options.approvalPolicyId || []" option-label="label" option-value="value" filter show-clear :disabled="disabled"/></label>
  <label v-if="!editing" class="enterprise-form-field employee-form-checkbox"><Checkbox v-model="form.createAccount" binary :disabled="disabled" input-id="employee-create-account"/><span>Create system account</span></label>
  <label v-if="!editing && form.createAccount" class="enterprise-form-field"><span>Default Role</span><Select v-model="form.defaultRoleId" :options="options.defaultRoleId || []" option-label="label" option-value="value" filter show-clear :disabled="disabled"/></label>
</div></template>
