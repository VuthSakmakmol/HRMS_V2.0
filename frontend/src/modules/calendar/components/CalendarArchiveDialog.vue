<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import EnterpriseConfirmDialog from "@/shared/components/enterprise/EnterpriseConfirmDialog.vue"
const props = defineProps({ visible: Boolean, day: { type: Object, default: null }, busy: Boolean })
const emit = defineEmits(["update:visible", "confirm"])
const { t } = useI18n()
const message = computed(() => t("organization.calendar.day.archiveMessage", { name: props.day?.name || props.day?.dateKey || "" }))
</script>
<template><EnterpriseConfirmDialog :visible="visible" :title="t('organization.calendar.day.archiveTitle')" :message="message" :confirm-label="t('common.archive')" :cancel-label="t('common.cancel')" :busy="busy" severity="danger" @update:visible="emit('update:visible', $event)" @confirm="emit('confirm')" /></template>
