<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import BranchForm from "./BranchForm.vue"
const props = defineProps({
    visible: { type: Boolean, default: false },
    mode: { type: String, default: "create" },
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    companies: { type: Array, default: () => [] },
    saving: { type: Boolean, default: false },
})
const emit = defineEmits([
    "update:visible",
    "save",
    "cancel",
    "clear-error",
    "normalize-code",
    "normalize-country-code",
])
const { t } = useI18n()
const title = computed(() =>
    props.mode === "edit"
        ? t("organization.branch.editTitle")
        : t("organization.branch.createTitle"),
)
</script>
<template>
    <EnterpriseDialog
        :visible="visible"
        :title="title"
        width="54rem"
        :busy="saving"
        @update:visible="emit('update:visible', $event)"
        @hide="emit('cancel')"
        ><BranchForm
            :form="form"
            :errors="errors"
            :companies="companies"
            :disabled="saving"
            @clear-error="emit('clear-error', $event)"
            @normalize-code="emit('normalize-code')"
            @normalize-country-code="emit('normalize-country-code')" /><template #footer
            ><EnterpriseFormFooter
                :save-label="t('common.save')"
                :cancel-label="t('common.cancel')"
                :saving="saving"
                @save="emit('save')"
                @cancel="emit('update:visible', false)" /></template
    ></EnterpriseDialog>
</template>
