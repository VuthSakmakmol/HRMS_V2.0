<script setup>
import Checkbox from "primevue/checkbox"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
const model=defineModel({type:Object,required:true})
defineProps({companyName:String,branchName:String,companyId:String,branchId:String,disabled:Boolean,editing:Boolean})
const methods=[{label:"Floor",value:"FLOOR"},{label:"Ceil",value:"CEIL"},{label:"Nearest",value:"NEAREST"}],statuses=[{label:"Active",value:"ACTIVE"},{label:"Inactive",value:"INACTIVE"}]
</script>
<template><div class="policy-form">
 <div class="scope"><div><small>Company</small><strong>{{companyName||'—'}}</strong></div><i class="pi pi-angle-right"/><div><small>Branch</small><strong>{{branchName||'—'}}</strong></div></div>
 <label><span>Code <b>*</b></span><InputText v-model.trim="model.code" :disabled="disabled||editing"/></label><label><span>Policy Name <b>*</b></span><InputText v-model.trim="model.name" :disabled="disabled"/></label>
 <label><span>Effective From</span><EnterpriseCalendarDatePicker v-model="model.effectiveFrom" :company-id="companyId" :branch-id="branchId" compact :show-status="false" :disabled="disabled"/></label><label><span>Effective To</span><EnterpriseCalendarDatePicker v-model="model.effectiveTo" :company-id="companyId" :branch-id="branchId" compact :show-status="false" :disabled="disabled"/></label>
 <label><span>Grace In (minutes)</span><InputNumber v-model="model.graceInMinutes" :min="0" :max="240" :use-grouping="false"/></label><label><span>Grace Out (minutes)</span><InputNumber v-model="model.graceOutMinutes" :min="0" :max="240" :use-grouping="false"/></label><label><span>Minimum Worked Minutes</span><InputNumber v-model="model.minimumWorkedMinutes" :min="0" :max="1440" :use-grouping="false"/></label><label><span>Status</span><Select v-model="model.status" :options="statuses" option-label="label" option-value="value"/></label>
 <label><span>Late Round Unit</span><InputNumber v-model="model.lateRoundUnitMinutes" :min="1" :max="240" :use-grouping="false"/></label><label><span>Late Round Method</span><Select v-model="model.lateRoundMethod" :options="methods" option-label="label" option-value="value"/></label><label><span>Early Leave Round Unit</span><InputNumber v-model="model.earlyLeaveRoundUnitMinutes" :min="1" :max="240" :use-grouping="false"/></label><label><span>Early Leave Round Method</span><Select v-model="model.earlyLeaveRoundMethod" :options="methods" option-label="label" option-value="value"/></label>
 <div class="check"><Checkbox v-model="model.autoGenerateAbsent" binary input-id="autoAbsent"/><label for="autoAbsent">Automatically generate absence</label></div><div class="check"><Checkbox v-model="model.treatSundayAsRestDay" binary input-id="sundayRest"/><label for="sundayRest">Treat Sunday as rest day</label></div>
</div></template>
<style scoped>.policy-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem 1rem}.policy-form>label{display:grid;gap:.3rem;font-size:.75rem;font-weight:600}.policy-form b{color:var(--p-red-500)}.scope{grid-column:1/-1;display:flex;align-items:center;gap:1rem;padding:.7rem;border:1px solid var(--p-content-border-color);border-radius:.55rem;background:var(--p-surface-50)}.scope div{display:grid}.scope small{color:var(--p-text-muted-color)}.check{display:flex;align-items:center;gap:.55rem;font-size:.78rem}@media(max-width:640px){.policy-form{grid-template-columns:1fr}.scope{grid-column:auto}}</style>
