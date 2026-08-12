<script setup>
import { computed } from "vue"

import Button from "primevue/button"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"

import EmployeeForm from "./EmployeeForm.vue"
import { EMPLOYEE_FORM_SECTIONS } from "../config/employee.form-sections.js"
import {
    employeeFieldSectionIndex,
    validateEmployeeForm,
    validateEmployeeSection,
} from "../config/employee.form-validation.js"

const props = defineProps({
    visible: Boolean,
    mode: { type: String, default: "create" },
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    options: { type: Object, default: () => ({}) },
    activeSection: { type: Number, default: 0 },
    saving: Boolean,
    loading: Boolean,
})

const emit = defineEmits([
    "update:visible",
    "update:active-section",
    "save",
    "clear-error",
    "company-change",
    "branch-change",
    "department-change",
])

const editing = computed(() => props.mode === "edit")
const isLastSection = computed(() => props.activeSection === EMPLOYEE_FORM_SECTIONS.length - 1)

const liveSectionErrors = computed(() =>
    validateEmployeeSection(props.form, props.activeSection, { editing: editing.value }),
)

const liveFormErrors = computed(() =>
    validateEmployeeForm(props.form, { editing: editing.value }),
)

const effectiveErrors = computed(() => ({
    ...liveSectionErrors.value,
    ...(props.errors || {}),
}))

function serverErrorFieldsForSection(index) {
    return Object.keys(props.errors || {}).filter((field) => employeeFieldSectionIndex(field) === index)
}

const currentIssueCount = computed(() => {
    const fields = new Set([
        ...Object.keys(liveSectionErrors.value),
        ...serverErrorFieldsForSection(props.activeSection),
    ])
    return fields.size
})

const totalIssueCount = computed(() => {
    const fields = new Set([
        ...Object.keys(liveFormErrors.value),
        ...Object.keys(props.errors || {}).filter((field) => employeeFieldSectionIndex(field) >= 0),
    ])
    return fields.size
})

const primaryDisabled = computed(() => {
    if (props.saving || props.loading) return true
    return isLastSection.value ? totalIssueCount.value > 0 : currentIssueCount.value > 0
})


function handlePrimaryAction() {
    if (primaryDisabled.value) return
    if (isLastSection.value) {
        emit("save")
        return
    }
    emit("update:active-section", props.activeSection + 1)
}
</script>

<template>
    <EnterpriseDialog
        class="employee-form-dialog"
        :visible="visible"
        :title="mode === 'edit' ? 'Edit Employee' : 'Create Employee'"
        width="88rem"
        :busy="saving || loading"
        @update:visible="emit('update:visible', $event)"
    >
        <EmployeeForm
            :form="form"
            :errors="effectiveErrors"
            :options="options"
            :active-section="activeSection"
            :disabled="saving || loading"
            :editing="editing"
            @update:active-section="emit('update:active-section', $event)"
            @clear-error="emit('clear-error', $event)"
            @company-change="emit('company-change')"
            @branch-change="emit('branch-change')"
            @department-change="emit('department-change')"
        />

        <template #footer>
            <EnterpriseFormFooter
                :save-label="isLastSection ? 'Save Employee' : 'Next'"
                cancel-label="Cancel"
                :saving="saving"
                :disabled="primaryDisabled"
                @cancel="emit('update:visible', false)"
                @save="handlePrimaryAction"
            >
                <div class="employee-form-dialog__footer-start">
                    <Button
                        v-if="activeSection > 0"
                        label="Previous"
                        icon="pi pi-arrow-left"
                        severity="secondary"
                        outlined
                        :disabled="saving || loading"
                        @click="emit('update:active-section', activeSection - 1)"
                    />
                </div>
            </EnterpriseFormFooter>
        </template>
    </EnterpriseDialog>
</template>

<style scoped>
:global(.employee-form-dialog) {
    display: flex;
    width: min(88rem, calc(100vw - 2rem)) !important;
    height: min(48rem, calc(100dvh - 2rem));
    max-height: calc(100dvh - 2rem) !important;
    flex-direction: column;
}

:global(.employee-form-dialog .p-dialog-header),
:global(.employee-form-dialog .p-dialog-footer) {
    flex: 0 0 auto;
}

:global(.employee-form-dialog .p-dialog-content) {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    overflow: hidden;
}

:global(.employee-form-dialog .enterprise-dialog__body) {
    display: flex;
    width: 100%;
    min-height: 0;
    max-height: none;
    flex: 1 1 auto;
    overflow: hidden;
}

.employee-form-dialog__footer-start {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.75rem;
}

@media (max-width: 680px) {
    :global(.employee-form-dialog) {
        width: calc(100vw - 0.5rem) !important;
        height: calc(100dvh - 0.5rem);
        max-height: calc(100dvh - 0.5rem) !important;
    }

    :global(.employee-form-dialog .p-dialog-header),
    :global(.employee-form-dialog .p-dialog-content),
    :global(.employee-form-dialog .p-dialog-footer) {
        padding-left: 0.75rem;
        padding-right: 0.75rem;
    }

    .employee-form-dialog__footer-start {
        gap: 0.4rem;
    }
}
</style>
