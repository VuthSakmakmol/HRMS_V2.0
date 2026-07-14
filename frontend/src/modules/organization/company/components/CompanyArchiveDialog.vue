<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import EnterpriseConfirmDialog from "@/shared/components/enterprise/EnterpriseConfirmDialog.vue"

const props = defineProps({
    visible: { type: Boolean, default: false },
    company: { type: Object, default: null },
    busy: { type: Boolean, default: false },
})

const emit = defineEmits(["update:visible", "confirm", "cancel"])
const { t } = useI18n()

const message = computed(() => {
    const name = props.company?.displayName || props.company?.code || ""
    const translated = t("organization.company.archiveMessage", { name })
    return translated === "organization.company.archiveMessage"
        ? `Archive ${name}? Archived companies will no longer be available for normal operations.`
        : translated
})
</script>

<template>
    <EnterpriseConfirmDialog
        :visible="visible"
        :title="t('organization.company.archiveTitle')"
        :message="message"
        :confirm-label="t('organization.company.archive')"
        :cancel-label="t('common.cancel')"
        :busy="busy"
        severity="danger"
        @update:visible="emit('update:visible', $event)"
        @confirm="emit('confirm')"
        @cancel="emit('cancel')"
    />
</template>
