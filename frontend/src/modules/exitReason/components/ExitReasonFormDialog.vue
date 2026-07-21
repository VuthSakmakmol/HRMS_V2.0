<script setup>
import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import ExitReasonForm from "./ExitReasonForm.vue"
defineProps({ visible:Boolean, mode:{type:String,default:"create"}, form:{type:Object,required:true}, errors:{type:Object,default:()=>({})}, companyName:String, branchName:String, saving:Boolean })
const emit=defineEmits(["update:visible","save","normalize-code","clear-error"])
</script>
<template>
    <EnterpriseDialog :visible="visible" :title="mode === 'edit' ? 'Edit Exit Reason' : 'New Exit Reason'" width="46rem" :busy="saving" @update:visible="emit('update:visible',$event)">
        <ExitReasonForm :form="form" :errors="errors" :company-name="companyName" :branch-name="branchName" :editing="mode==='edit'" :disabled="saving" @normalize-code="emit('normalize-code')" @clear-error="emit('clear-error',$event)" />
        <template #footer><EnterpriseFormFooter :saving="saving" :disabled="!form.code || !form.name" @cancel="emit('update:visible',false)" @save="emit('save')" /></template>
    </EnterpriseDialog>
</template>
