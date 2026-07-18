<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import PositionForm from "./PositionForm.vue"

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
    departments: {
        type: Array,
        default: () => [],
    },
    reportsToPositions: {
        type: Array,
        default: () => [],
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
    "normalize-code",
    "department-change",
])

const { t } = useI18n()

const title = computed(() =>
    props.mode === "edit"
        ? t("organization.position.editTitle")
        : t("organization.position.createTitle"),
)
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="title"
        width="48rem"
        @update:visible="emit('update:visible', $event)"
    >
        <PositionForm
            :form="form"
            :errors="errors"
            :company-name="companyName"
            :branch-name="branchName"
            :departments="departments"
            :reports-to-positions="reportsToPositions"
            :disabled="saving"
            :editing="mode === 'edit'"
            @clear-error="emit('clear-error', $event)"
            @normalize-code="emit('normalize-code')"
            @department-change="emit('department-change')"
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
