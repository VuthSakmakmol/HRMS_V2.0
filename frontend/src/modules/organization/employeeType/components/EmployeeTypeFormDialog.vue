<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import EmployeeTypeForm from "./EmployeeTypeForm.vue"

const props = defineProps({
    visible: {
        type: Boolean,
        default: false,
    },
    mode: {
        type: String,
        default: "create",
    },
    form: {
        type: Object,
        required: true,
    },
    errors: {
        type: Object,
        default: () => ({}),
    },
    companyName: {
        type: String,
        default: "—",
    },
    branchName: {
        type: String,
        default: "—",
    },
    positions: {
        type: Array,
        default: () => [],
    },
    positionsLoading: {
        type: Boolean,
        default: false,
    },
    saving: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits([
    "update:visible",
    "save",
    "clear-error",
    "add-child",
    "remove-child",
])

const { t } = useI18n()

const title = computed(() =>
    props.mode === "edit"
        ? t("organization.employeeType.editTitle")
        : t("organization.employeeType.createTitle"),
)
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="title"
        width="48rem"
        @update:visible="emit('update:visible', $event)"
    >
        <EmployeeTypeForm
            :form="form"
            :errors="errors"
            :company-name="companyName"
            :branch-name="branchName"
            :positions="positions"
            :positions-loading="positionsLoading"
            :disabled="saving"
            :editing="mode === 'edit'"
            @clear-error="emit('clear-error', $event)"
            @add-child="emit('add-child')"
            @remove-child="emit('remove-child', $event)"
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
