<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import EnterpriseConfirmDialog from "@/shared/components/enterprise/EnterpriseConfirmDialog.vue"
const props = defineProps({
    visible: { type: Boolean, default: false },
    branch: { type: Object, default: null },
    busy: { type: Boolean, default: false },
})
const emit = defineEmits(["update:visible", "confirm", "cancel"])
const { t } = useI18n()
const message = computed(() =>
    t("organization.branch.archiveMessage", {
        name: props.branch?.name || props.branch?.code || "",
    }),
)
</script>
<template>
    <EnterpriseConfirmDialog
        :visible="visible"
        :title="t('organization.branch.archiveTitle')"
        :message="message"
        :confirm-label="t('organization.branch.archiveTitle')"
        :cancel-label="t('common.cancel')"
        :busy="busy"
        severity="danger"
        @update:visible="emit('update:visible', $event)"
        @confirm="emit('confirm')"
        @cancel="emit('cancel')"
    />
</template>
