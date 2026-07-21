<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import LineForm from "./LineForm.vue"

const props = defineProps({
    visible: Boolean,
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
    saving: Boolean,
})

const emit = defineEmits([
    "update:visible",
    "save",
    "clear-error",
    "normalize-code",
])

const { t } = useI18n()

const title = computed(() =>
    props.mode === "edit"
        ? t("organization.line.editTitle")
        : t("organization.line.createTitle"),
)
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="title"
        width="52rem"
        @update:visible="emit('update:visible', $event)"
    >
        <LineForm
            :form="form"
            :errors="errors"
            :company-name="companyName"
            :branch-name="branchName"
            :disabled="saving"
            @clear-error="emit('clear-error', $event)"
            @normalize-code="emit('normalize-code')"
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
