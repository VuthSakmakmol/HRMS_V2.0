<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseConfirmDialog from "@/shared/components/enterprise/EnterpriseConfirmDialog.vue"

const props = defineProps({
    visible: Boolean,
    reason: { type: Object, default: null },
    busy: Boolean,
})

const emit = defineEmits(["update:visible", "confirm"])
const { t } = useI18n()

const message = computed(() =>
    t("exitReason.archiveMessage", {
        name: props.reason?.name || t("exitReason.thisReason"),
    }),
)
</script>

<template>
    <EnterpriseConfirmDialog
        :visible="visible"
        :title="t('exitReason.archiveTitle')"
        :message="message"
        :confirm-label="t('exitReason.archive')"
        :busy="busy"
        @update:visible="emit('update:visible', $event)"
        @confirm="emit('confirm')"
    />
</template>
