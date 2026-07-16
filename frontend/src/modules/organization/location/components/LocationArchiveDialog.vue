<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import EnterpriseConfirmDialog from "@/shared/components/enterprise/EnterpriseConfirmDialog.vue"
const props = defineProps({ visible: Boolean, row: { type: Object, default: null }, busy: Boolean })
const emit = defineEmits(["update:visible","confirm"])
const { t } = useI18n()
const message = computed(() => t("organization.location.archiveMessage", { name: props.row?.name || "" }))
</script>
<template><EnterpriseConfirmDialog :visible="visible" :title="t('organization.location.archiveTitle')" :message="message" :confirm-label="t('common.archive')" :cancel-label="t('common.cancel')" :busy="busy" @update:visible="emit('update:visible',$event)" @confirm="emit('confirm')"/></template>
