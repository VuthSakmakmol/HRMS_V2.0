<script setup>
import { useI18n } from "vue-i18n"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import ManpowerPlanForm from "./ManpowerPlanForm.vue"

defineProps({
    visible: { type: Boolean, default: false },
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    companyName: { type: String, default: "—" },
    branchName: { type: String, default: "—" },
    departments: { type: Array, default: () => [] },
    positions: { type: Array, default: () => [] },
    lines: { type: Array, default: () => [] },
    shifts: { type: Array, default: () => [] },
    employeeTypes: { type: Array, default: () => [] },
    saving: { type: Boolean, default: false },
})

const emit = defineEmits([
    "update:visible",
    "save",
    "clear-error",
    "department-change",
    "employee-type-change",
])
const { t } = useI18n()
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="t('manpowerPlan.editTitle')"
        width="52rem"
        @update:visible="emit('update:visible', $event)"
    >
        <ManpowerPlanForm
            :form="form"
            :errors="errors"
            :company-name="companyName"
            :branch-name="branchName"
            :departments="departments"
            :positions="positions"
            :lines="lines"
            :shifts="shifts"
            :employee-types="employeeTypes"
            :disabled="saving"
            @clear-error="emit('clear-error', $event)"
            @department-change="emit('department-change')"
            @employee-type-change="emit('employee-type-change')"
        />
        <template #footer>
            <EnterpriseFormFooter
                :save-label="t('common.save')"
                :cancel-label="t('common.cancel')"
                :saving="saving"
                @save="emit('save')"
                @cancel="emit('update:visible', false)"
            />
        </template>
    </EnterpriseDialog>
</template>
