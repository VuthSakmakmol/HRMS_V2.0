<script setup>
import { useI18n } from "vue-i18n"

import EnterpriseConfirmDialog from "@/shared/components/enterprise/EnterpriseConfirmDialog.vue"

const props = defineProps({
    visible: Boolean,
    line: {
        type: Object,
        default: null,
    },
    loading: Boolean,
})

const emit = defineEmits([
    "update:visible",
    "confirm",
])

const { t } = useI18n()
</script>

<template>
    <EnterpriseConfirmDialog
        :visible="visible"
        :title="t('organization.line.archiveTitle')"
        :message="
            t('organization.line.archiveMessage', {
                name: line?.name || '—',
            })
        "
        :confirm-label="t('common.archive')"
        :cancel-label="t('common.cancel')"
        :loading="loading"
        severity="danger"
        @update:visible="emit('update:visible', $event)"
        @confirm="emit('confirm')"
    />
</template>
