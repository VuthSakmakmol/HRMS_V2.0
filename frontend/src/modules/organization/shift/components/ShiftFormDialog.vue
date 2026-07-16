<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import ShiftForm from "./ShiftForm.vue"

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
    companies: {
        type: Array,
        default: () => [],
    },
    branches: {
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
    "submit",
    "close",
    "clear-error",
    "company-change",
])

const { t } = useI18n()

const title = computed(() =>
    props.mode === "edit"
        ? t("organization.shift.editTitle")
        : t("organization.shift.createTitle"),
)

function closeDialog() {
    if (props.saving) {
        return
    }

    emit("close")
    emit("update:visible", false)
}
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="title"
        width="48rem"
        :busy="saving"
        @update:visible="emit('update:visible', $event)"
    >
        <ShiftForm
            :form="form"
            :errors="errors"
            :companies="companies"
            :branches="branches"
            :disabled="saving"
            :editing="mode === 'edit'"
            @clear-error="emit('clear-error', $event)"
            @company-change="emit('company-change')"
        />

        <template #footer>
            <EnterpriseFormFooter
                :save-label="t('common.save')"
                :cancel-label="t('common.cancel')"
                :saving="saving"
                @save="emit('submit')"
                @cancel="closeDialog"
            />
        </template>
    </EnterpriseDialog>
</template>
