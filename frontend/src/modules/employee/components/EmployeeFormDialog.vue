<script setup>
import Button from "primevue/button"
import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import EmployeeForm from "./EmployeeForm.vue"
import { EMPLOYEE_FORM_SECTIONS } from "../config/employee.form-sections.js"
const props=defineProps({visible:Boolean,mode:{type:String,default:'create'},form:{type:Object,required:true},errors:{type:Object,default:()=>({})},options:{type:Object,default:()=>({})},activeSection:{type:Number,default:0},saving:Boolean,loading:Boolean})
const emit=defineEmits(['update:visible','update:active-section','save','clear-error','company-change','branch-change','department-change'])
</script>
<template><EnterpriseDialog :visible="visible" :title="mode==='edit'?'Edit Employee':'Create Employee'" width="72rem" :busy="saving||loading" @update:visible="emit('update:visible',$event)">
  <EmployeeForm :form="form" :errors="errors" :options="options" :active-section="activeSection" :disabled="saving||loading" :editing="mode==='edit'" @update:active-section="emit('update:active-section',$event)" @clear-error="emit('clear-error',$event)" @company-change="emit('company-change')" @branch-change="emit('branch-change')" @department-change="emit('department-change')"/>
  <template #footer><EnterpriseFormFooter :save-label="activeSection===EMPLOYEE_FORM_SECTIONS.length-1?'Save Employee':'Next'" cancel-label="Cancel" :saving="saving" @cancel="emit('update:visible',false)" @save="activeSection===EMPLOYEE_FORM_SECTIONS.length-1?emit('save'):emit('update:active-section',activeSection+1)"><Button v-if="activeSection>0" label="Previous" icon="pi pi-arrow-left" severity="secondary" outlined :disabled="saving" @click="emit('update:active-section',activeSection-1)"/></EnterpriseFormFooter></template>
</EnterpriseDialog></template>
