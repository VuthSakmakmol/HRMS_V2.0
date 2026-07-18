<script setup>
import Button from "primevue/button"
import EmployeeBasicSection from "./form-sections/EmployeeBasicSection.vue"
import EmployeeContactSection from "./form-sections/EmployeeContactSection.vue"
import EmployeeAssignmentSection from "./form-sections/EmployeeAssignmentSection.vue"
import EmployeeEmploymentSection from "./form-sections/EmployeeEmploymentSection.vue"
import EmployeeAddressSection from "./form-sections/EmployeeAddressSection.vue"
import EmployeeDocumentSection from "./form-sections/EmployeeDocumentSection.vue"
import EmployeeSkillsSection from "./form-sections/EmployeeSkillsSection.vue"
import { EMPLOYEE_FORM_SECTIONS } from "../config/employee.form-sections.js"

defineProps({ form: { type: Object, required: true }, errors: { type: Object, default: () => ({}) }, options: { type: Object, default: () => ({}) }, activeSection: { type: Number, default: 0 }, disabled: Boolean, editing: Boolean })
const emit = defineEmits(["update:active-section", "clear-error", "company-change", "branch-change", "department-change"])
const components = [EmployeeBasicSection, EmployeeContactSection, EmployeeAssignmentSection, EmployeeEmploymentSection, EmployeeAddressSection, EmployeeDocumentSection, EmployeeSkillsSection]
</script>
<template><div class="employee-form">
  <nav class="employee-form__steps" aria-label="Employee form sections">
    <Button v-for="(section,index) in EMPLOYEE_FORM_SECTIONS" :key="section.key" type="button" :icon="section.icon" :label="section.label" :severity="activeSection===index?'primary':'secondary'" :outlined="activeSection!==index" size="small" @click="emit('update:active-section',index)"/>
  </nav>
  <section class="employee-form__content"><component :is="components[activeSection]" :form="form" :errors="errors" :options="options" :disabled="disabled" :editing="editing" @clear-error="emit('clear-error',$event)" @company-change="emit('company-change')" @branch-change="emit('branch-change')" @department-change="emit('department-change')"/></section>
</div></template>
<style scoped>
.employee-form{display:grid;gap:1rem}.employee-form__steps{display:flex;gap:.45rem;padding-bottom:.75rem;overflow-x:auto;border-bottom:1px solid var(--p-content-border-color,#e2e8f0)}.employee-form__steps :deep(.p-button){flex:0 0 auto}.employee-form__content{min-height:20rem}.employee-form :deep(.employee-section-grid){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}.employee-form :deep(.enterprise-form-field){display:grid;min-width:0;gap:.3rem}.employee-form :deep(.enterprise-form-field>span){color:var(--p-text-color,#334155);font-size:.75rem;font-weight:600}.employee-form :deep(.enterprise-form-field small){color:var(--p-red-500,#ef4444);font-size:.7rem}.employee-form :deep(.enterprise-form-field--full){grid-column:1/-1}.employee-form :deep(.p-inputtext),.employee-form :deep(.p-select),.employee-form :deep(.p-inputnumber),.employee-form :deep(.p-inputnumber-input),.employee-form :deep(.p-textarea),.employee-form :deep(.p-datepicker),.employee-form :deep(.internal-calendar-picker){width:100%;min-width:0}.employee-form :deep(.employee-form-checkbox){display:flex;align-items:center;align-self:end;gap:.5rem;min-height:2.25rem}@media(max-width:680px){.employee-form :deep(.employee-section-grid){grid-template-columns:minmax(0,1fr)}.employee-form :deep(.enterprise-form-field--full){grid-column:auto}}
</style>
