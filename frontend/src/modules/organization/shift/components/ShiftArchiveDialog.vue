<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import EnterpriseConfirmDialog from "@/shared/components/enterprise/EnterpriseConfirmDialog.vue"
const props = defineProps({ visible: Boolean, shift: { type: Object, default: null }, busy: Boolean })
const emit = defineEmits(["update:visible", "confirm", "cancel"])
const { t } = useI18n()
const message = computed(() => t("organization.shift.archiveConfirmation", { name: props.shift?.name ?? props.shift?.code ?? "" }))
</script>
<template><EnterpriseConfirmDialog :visible="visible" :title="t('organization.shift.archiveTitle')" :message="message" :busy="busy" severity="danger" @update:visible="emit('update:visible',$event)" @confirm="emit('confirm')" @cancel="emit('cancel')" /></template>
