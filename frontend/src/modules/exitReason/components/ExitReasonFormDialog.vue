<script setup>
import { useI18n } from "vue-i18n"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import ExitReasonForm from "./ExitReasonForm.vue"

const props = defineProps({
    visible: Boolean,
    mode: { type: String, default: "create" },
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    companyName: String,
    branchName: String,
    saving: Boolean,
})

const emit = defineEmits([
    "update:visible",
    "save",
    "normalize-code",
    "clear-error",
])

const { t } = useI18n()

function requestSave() {
    if (props.saving) return
    emit("save")
}
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="mode === 'edit' ? t('exitReason.editTitle') : t('exitReason.createTitle')"
        width="46rem"
        :busy="saving"
        @update:visible="emit('update:visible', $event)"
    >
        <ExitReasonForm
            :form="form"
            :errors="errors"
            :company-name="companyName"
            :branch-name="branchName"
            :editing="mode === 'edit'"
            :disabled="saving"
            @normalize-code="emit('normalize-code')"
            @clear-error="emit('clear-error', $event)"
        />

        <template #footer>
            <EnterpriseFormFooter
                :save-label="mode === 'edit' ? t('common.update') : t('common.save')"
                :saving="saving"
                :disabled="saving || !form.code?.trim() || !form.name?.trim()"
                @cancel="emit('update:visible', false)"
                @save="requestSave"
            />
        </template>
    </EnterpriseDialog>
</template>
