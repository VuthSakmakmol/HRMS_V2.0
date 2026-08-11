<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import WorkforceRatioForm from "./WorkforceRatioForm.vue"

const props = defineProps({
    visible: Boolean,
    editing: Boolean,
    form: { type: Object, required: true },
    employeeTypes: { type: Array, default: () => [] },
    errors: { type: Object, default: () => ({}) },
    companyName: String,
    branchName: String,
    saving: Boolean,
})

const emit = defineEmits(["update:visible", "save", "clear-error"])
const { t } = useI18n()

const valid = computed(() => {
    const budgetYear = Number(props.form.budgetYear)
    const budgetRatio = Number(props.form.budgetRatio)

    return (props.form.directEmployeeTypeIds || []).length > 0 &&
        (props.form.indirectEmployeeTypeIds || []).length > 0 &&
        Number.isInteger(budgetYear) &&
        budgetYear >= 2000 &&
        budgetYear <= 2100 &&
        Number.isFinite(budgetRatio) &&
        budgetRatio > 0
})
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="editing ? t('workforceRatio.editTitle') : t('workforceRatio.createTitle')"
        width="54rem"
        :busy="saving"
        @update:visible="emit('update:visible', $event)"
    >
        <WorkforceRatioForm
            :form="form"
            :employee-types="employeeTypes"
            :errors="errors"
            :company-name="companyName"
            :branch-name="branchName"
            :disabled="saving"
            @clear-error="emit('clear-error', $event)"
        />

        <template #footer>
            <EnterpriseFormFooter
                :save-label="editing ? t('common.update') : t('common.save')"
                :saving="saving"
                :disabled="saving || !valid"
                @cancel="emit('update:visible', false)"
                @save="emit('save')"
            />
        </template>
    </EnterpriseDialog>
</template>
