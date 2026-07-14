<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import CompanyForm from "./CompanyForm.vue"

const props = defineProps({
    visible: { type: Boolean, default: false },
    mode: { type: String, default: "create" },
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    saving: { type: Boolean, default: false },
})

const emit = defineEmits([
    "update:visible",
    "save",
    "cancel",
    "clear-error",
    "normalize-code",
    "normalize-country-code",
    "normalize-currency-code",
])

const { t } = useI18n()
const title = computed(() =>
    props.mode === "edit"
        ? t("organization.company.editTitle")
        : t("organization.company.createTitle"),
)

function close() {
    if (props.saving) return
    emit("update:visible", false)
    emit("cancel")
}
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="title"
        width="58rem"
        :busy="saving"
        @update:visible="emit('update:visible', $event)"
        @hide="emit('cancel')"
    >
        <CompanyForm
            :form="form"
            :errors="errors"
            :disabled="saving"
            @clear-error="emit('clear-error', $event)"
            @normalize-code="emit('normalize-code')"
            @normalize-country-code="emit('normalize-country-code')"
            @normalize-currency-code="emit('normalize-currency-code')"
        />

        <template #footer>
            <EnterpriseFormFooter
                :save-label="t('common.save')"
                :cancel-label="t('common.cancel')"
                :saving="saving"
                @save="emit('save')"
                @cancel="close"
            />
        </template>
    </EnterpriseDialog>
</template>
