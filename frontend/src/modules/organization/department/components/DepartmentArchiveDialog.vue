<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseConfirmDialog from "@/shared/components/enterprise/EnterpriseConfirmDialog.vue"

const props = defineProps({
    visible: {
        type: Boolean,
        default: false,
    },
    department: {
        type: Object,
        default: null,
    },
    busy: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits([
    "update:visible",
    "confirm",
    "cancel",
])

const { t } = useI18n()

const message = computed(() =>
    t("organization.department.archiveMessage", {
        name:
            props.department?.name ||
            props.department?.code ||
            "",
    }),
)
</script>

<template>
    <EnterpriseConfirmDialog
        :visible="visible"
        :title="t('organization.department.archiveTitle')"
        :message="message"
        :confirm-label="t('organization.department.archiveTitle')"
        :cancel-label="t('common.cancel')"
        :busy="busy"
        severity="danger"
        @update:visible="emit('update:visible', $event)"
        @confirm="emit('confirm')"
        @cancel="emit('cancel')"
    />
</template>
