<script setup>
import {
    computed,
} from "vue"

import {
    useI18n,
} from "vue-i18n"

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
        validator: (value) => [
            "create",
            "edit",
        ].includes(value),
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
    "company-change",
    "branch-change",
    "department-change",
])

const {
    t,
} = useI18n()

const dialogTitle = computed(() => {
    return props.mode === "edit"
        ? t("organization.position.editTitle")
        : t("organization.position.createTitle")
})

function closeDialog() {
    if (props.saving) {
        return
    }

    emit("update:visible", false)
}

function savePosition() {
    if (props.saving) {
        return
    }

    emit("save")
}
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="dialogTitle"
        width="50rem"
        :closable="!saving"
        :close-on-escape="!saving"
        @update:visible="emit('update:visible', $event)"
    >
        <PositionForm
            :form="form"
            :errors="errors"
            :companies="companies"
            :branches="branches"
            :departments="departments"
            :reports-to-positions="reportsToPositions"
            :disabled="saving"
            :editing="mode === 'edit'"
            @clear-error="emit('clear-error', $event)"
            @normalize-code="emit('normalize-code')"
            @company-change="emit('company-change')"
            @branch-change="emit('branch-change')"
            @department-change="emit('department-change')"
        />

        <template #footer>
            <EnterpriseFormFooter
                :save-label="t('common.save')"
                :cancel-label="t('common.cancel')"
                :saving="saving"
                @save="savePosition"
                @cancel="closeDialog"
            />
        </template>
    </EnterpriseDialog>
</template>