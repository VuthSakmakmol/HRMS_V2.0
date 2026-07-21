<script setup>
import InputText from "primevue/inputtext"
import Textarea from "primevue/textarea"
import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"

defineProps({ visible:Boolean, form:{type:Object,required:true}, editing:Boolean, saving:Boolean, companyId:String, branchId:String })
const emit=defineEmits(["update:visible","save"])
</script>
<template>
    <EnterpriseDialog :visible="visible" :title="editing ? 'Correct Attendance Record' : 'Add Attendance Record'" width="44rem" :busy="saving" @update:visible="emit('update:visible',$event)">
        <div class="record-form">
            <label><span>Employee ID <b>*</b></span><InputText v-model.trim="form.employeeCode" :disabled="editing||saving" placeholder="Employee code" /></label>
            <label><span>Attendance Date <b>*</b></span><EnterpriseCalendarDatePicker v-model="form.attendanceDate" :company-id="companyId" :branch-id="branchId" compact :show-status="false" :disabled="editing||saving" /></label>
            <label><span>First In</span><input v-model="form.firstInAt" type="datetime-local" :disabled="saving"></label>
            <label><span>Last Out</span><input v-model="form.lastOutAt" type="datetime-local" :disabled="saving"></label>
            <label class="wide"><span>Correction Reason / Note <b>*</b></span><Textarea v-model="form.note" rows="3" maxlength="1000" :disabled="saving" /></label>
        </div>
        <template #footer><EnterpriseFormFooter :saving="saving" :disabled="!form.employeeCode||!form.attendanceDate||!form.note.trim()" @cancel="emit('update:visible',false)" @save="emit('save')" /></template>
    </EnterpriseDialog>
</template>
<style scoped>
.record-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem 1rem}.record-form label{display:grid;gap:.3rem;font-size:.76rem;font-weight:600}.record-form b{color:var(--p-red-500)}.record-form .wide{grid-column:1/-1}.record-form input{width:100%;height:2.35rem;padding:0 .65rem;border:1px solid var(--p-form-field-border-color);border-radius:var(--p-form-field-border-radius);background:var(--p-form-field-background);color:var(--p-form-field-color)}@media(max-width:640px){.record-form{grid-template-columns:1fr}.record-form .wide{grid-column:auto}}
</style>
