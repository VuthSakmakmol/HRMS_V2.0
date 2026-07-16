<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import LocationForm from "./LocationForm.vue"
const props = defineProps({ visible: Boolean, mode: { type: String, default: "create" }, entity: { type: String, required: true }, form: { type: Object, required: true }, errors: { type: Object, default: () => ({}) }, saving: Boolean, countries: Array, provinces: Array, districts: Array, communes: Array, entityLabel: { type: String, default: "" } })
const emit = defineEmits(["update:visible","save","clear-error","normalize-code","country-change","province-change","district-change"])
const { t } = useI18n()
const title = computed(() => props.mode === "edit" ? t("organization.location.editTitle", { entity: props.entityLabel }) : t("organization.location.createTitle", { entity: props.entityLabel }))
</script>
<template><EnterpriseDialog :visible="visible" :title="title" width="48rem" :busy="saving" @update:visible="emit('update:visible',$event)"><LocationForm v-bind="props" :disabled="saving" @clear-error="(...args)=>emit('clear-error',...args)" @normalize-code="emit('normalize-code')" @country-change="emit('country-change')" @province-change="emit('province-change')" @district-change="emit('district-change')"/><template #footer><EnterpriseFormFooter :save-label="t('common.save')" :cancel-label="t('common.cancel')" :saving="saving" @save="emit('save')" @cancel="emit('update:visible',false)"/></template></EnterpriseDialog></template>
