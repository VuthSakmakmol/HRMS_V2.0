<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import DepartmentForm from "./DepartmentForm.vue"

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
    parentDepartments: {
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
    "company-change",
    "branch-change",
])

const { t } = useI18n()

const title = computed(() =>
    props.mode === "edit"
        ? t("organization.department.editTitle")
        : t("organization.department.createTitle"),
)
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="title"
        width="48rem"
        @update:visible="emit('update:visible', $event)"
    >
        <DepartmentForm
            :form="form"
            :errors="errors"
            :companies="companies"
            :branches="branches"
            :parent-departments="parentDepartments"
            :disabled="saving"
            :editing="mode === 'edit'"
            @clear-error="emit('clear-error', $event)"
            @normalize-code="emit('normalize-code')"
            @company-change="emit('company-change')"
            @branch-change="emit('branch-change')"
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
