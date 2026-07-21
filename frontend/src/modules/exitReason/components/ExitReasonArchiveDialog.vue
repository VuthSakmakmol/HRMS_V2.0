<script setup>
import EnterpriseConfirmDialog from "@/shared/components/enterprise/EnterpriseConfirmDialog.vue"
defineProps({ visible:Boolean, reason:{type:Object,default:null}, busy:Boolean })
const emit=defineEmits(["update:visible","confirm"])
</script>
<template><EnterpriseConfirmDialog :visible="visible" title="Archive Exit Reason" :message="`Archive ${reason?.name || 'this exit reason'}? Existing employee history will remain unchanged.`" confirm-label="Archive" :busy="busy" @update:visible="emit('update:visible',$event)" @confirm="emit('confirm')" /></template>
