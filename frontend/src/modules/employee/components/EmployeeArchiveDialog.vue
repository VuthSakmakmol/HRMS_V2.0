<script setup>
import EnterpriseConfirmDialog from "@/shared/components/enterprise/EnterpriseConfirmDialog.vue"
defineProps({visible:Boolean,employee:{type:Object,default:null},archiving:Boolean})
defineEmits(['update:visible','confirm'])
</script>
<template><EnterpriseConfirmDialog :visible="visible" title="Archive Employee" :message="`Archive ${employee?.displayName || employee?.employeeCode || 'this employee'}?`" confirm-label="Archive" severity="danger" :busy="archiving" @update:visible="$emit('update:visible',$event)" @confirm="$emit('confirm')"/></template>
