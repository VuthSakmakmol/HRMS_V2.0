<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import CalendarForm from "./CalendarForm.vue"
const props = defineProps({ visible: Boolean, mode: { type: String, default: "create" }, form: { type: Object, required: true }, errors: { type: Object, default: () => ({}) }, companies: { type: Array, default: () => [] }, branches: { type: Array, default: () => [] }, saving: Boolean })
const emit = defineEmits(["update:visible", "save", "clear-error", "company-change", "scope-change"])
const { t } = useI18n(); const title = computed(() => t(props.mode === "edit" ? "organization.calendar.day.editTitle" : "organization.calendar.day.createTitle"))
</script>
<template><EnterpriseDialog :visible="visible" :title="title" width="48rem" :busy="saving" @update:visible="emit('update:visible', $event)"><CalendarForm :form="form" :errors="errors" :companies="companies" :branches="branches" :disabled="saving" :editing="mode === 'edit'" @clear-error="emit('clear-error', $event)" @company-change="emit('company-change')" @scope-change="emit('scope-change')" /><template #footer><EnterpriseFormFooter :saving="saving" :save-label="t('common.save')" :cancel-label="t('common.cancel')" @save="emit('save')" @cancel="emit('update:visible', false)" /></template></EnterpriseDialog></template>
