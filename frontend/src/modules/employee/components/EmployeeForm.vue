<script setup>
import { nextTick, ref, watch } from "vue"

import Button from "primevue/button"

import EmployeeBasicSection from "./form-sections/EmployeeBasicSection.vue"
import EmployeeContactSection from "./form-sections/EmployeeContactSection.vue"
import EmployeeAssignmentSection from "./form-sections/EmployeeAssignmentSection.vue"
import EmployeeEmploymentSection from "./form-sections/EmployeeEmploymentSection.vue"
import EmployeeAddressSection from "./form-sections/EmployeeAddressSection.vue"
import EmployeeDocumentSection from "./form-sections/EmployeeDocumentSection.vue"
import EmployeeSkillsSection from "./form-sections/EmployeeSkillsSection.vue"
import { EMPLOYEE_FORM_SECTIONS } from "../config/employee.form-sections.js"
import {
    employeeFieldSectionIndex,
    validateEmployeeSection,
} from "../config/employee.form-validation.js"

const props = defineProps({
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    options: { type: Object, default: () => ({}) },
    activeSection: { type: Number, default: 0 },
    disabled: Boolean,
    editing: Boolean,
})

const emit = defineEmits([
    "update:active-section",
    "clear-error",
    "company-change",
    "branch-change",
    "department-change",
])

const components = [
    EmployeeBasicSection,
    EmployeeContactSection,
    EmployeeAssignmentSection,
    EmployeeEmploymentSection,
    EmployeeAddressSection,
    EmployeeDocumentSection,
    EmployeeSkillsSection,
]

const contentRef = ref(null)

function issueCount(index) {
    const liveFields = Object.keys(validateEmployeeSection(props.form, index, { editing: props.editing }))
    const serverFields = Object.keys(props.errors || {}).filter((field) => employeeFieldSectionIndex(field) === index)
    return new Set([...liveFields, ...serverFields]).size
}

function navigateTo(index) {
    emit("update:active-section", index)
}

watch(
    () => props.activeSection,
    async () => {
        await nextTick()
        contentRef.value?.scrollTo({ top: 0, behavior: "smooth" })
    },
)
</script>

<template>
    <div class="employee-form">
        <nav class="employee-form__steps" aria-label="Employee form sections">
            <div
                v-for="(section, index) in EMPLOYEE_FORM_SECTIONS"
                :key="section.key"
                class="employee-form__step-wrap"
            >
                <Button
                    type="button"
                    :icon="section.icon"
                    :label="section.label"
                    :severity="activeSection === index ? 'primary' : 'secondary'"
                    :outlined="activeSection !== index"
                    size="small"
                    :disabled="disabled"
                    :class="{ 'employee-form__step--issue': issueCount(index) > 0 }"
                    @click="navigateTo(index)"
                />
                <span
                    v-if="issueCount(index) > 0"
                    class="employee-form__step-issue"
                    :aria-label="`${issueCount(index)} incomplete fields`"
                >
                    {{ issueCount(index) }}
                </span>
            </div>
        </nav>

        <section ref="contentRef" class="employee-form__content">
            <component
                :is="components[activeSection]"
                :form="form"
                :errors="errors"
                :options="options"
                :disabled="disabled"
                :editing="editing"
                @clear-error="emit('clear-error', $event)"
                @company-change="emit('company-change')"
                @branch-change="emit('branch-change')"
                @department-change="emit('department-change')"
            />
        </section>
    </div>
</template>

<style scoped>
.employee-form {
    display: grid;
    width: 100%;
    min-height: 0;
    flex: 1 1 auto;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.75rem;
    overflow: hidden;
}

.employee-form__steps {
    display: flex;
    gap: 0.45rem;
    padding: 0.1rem 0 0.65rem;
    overflow-x: auto;
    border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
    scrollbar-width: thin;
}

.employee-form__step-wrap {
    position: relative;
    flex: 0 0 auto;
}

.employee-form__steps :deep(.p-button) {
    min-height: 2rem;
    padding: 0.35rem 0.65rem;
    font-size: 0.76rem;
    white-space: nowrap;
}

.employee-form__steps :deep(.employee-form__step--issue:not(.p-button-primary)) {
    border-color: color-mix(in srgb, var(--p-red-500, #ef4444) 48%, transparent);
}

.employee-form__step-issue {
    position: absolute;
    top: -0.28rem;
    right: -0.28rem;
    display: grid;
    min-width: 1.05rem;
    height: 1.05rem;
    padding: 0 0.2rem;
    place-items: center;
    color: #fff;
    background: var(--p-red-500, #ef4444);
    border: 2px solid var(--p-content-background, #fff);
    border-radius: 999px;
    font-size: 0.58rem;
    font-weight: 800;
    line-height: 1;
}

.employee-form__content {
    min-height: 0;
    padding-right: 0.25rem;
    overflow: auto;
    scrollbar-gutter: stable;
    scroll-behavior: smooth;
}

.employee-form :deep(.employee-section-grid) {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.7rem 0.8rem;
    align-items: start;
}

.employee-form :deep(.enterprise-form-field) {
    display: grid;
    min-width: 0;
    align-content: start;
    gap: 0.3rem;
}

.employee-form :deep(.enterprise-form-field > span) {
    min-height: 1rem;
    color: var(--p-text-color, #334155);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.2;
}

.employee-form :deep(.employee-required-star) {
    display: inline-block;
    margin-left: 0.1rem;
    color: var(--p-red-600, #dc2626);
    font-size: 1rem;
    font-style: normal;
    font-weight: 900;
    line-height: 0.75;
    vertical-align: -0.08em;
}

.employee-form :deep(.enterprise-form-field small) {
    min-height: 0.9rem;
    color: var(--p-red-600, #dc2626);
    font-size: 0.68rem;
    line-height: 1.25;
}

.employee-form :deep(.enterprise-form-field--full) {
    grid-column: 1 / -1;
}

.employee-form :deep(.enterprise-form-field--span-2) {
    grid-column: span 2;
}

.employee-form :deep(.employee-calendar--invalid .p-inputtext) {
    border-color: var(--p-red-500, #ef4444);
}

.employee-form :deep(.employee-calendar--invalid .p-inputtext:focus) {
    box-shadow: 0 0 0 1px var(--p-red-500, #ef4444);
}

.employee-form :deep(.p-inputtext),
.employee-form :deep(.p-select),
.employee-form :deep(.p-inputnumber),
.employee-form :deep(.p-inputnumber-input),
.employee-form :deep(.p-textarea),
.employee-form :deep(.p-datepicker),
.employee-form :deep(.internal-calendar-picker) {
    width: 100%;
    min-width: 0;
}

.employee-form :deep(.employee-form-checkbox) {
    display: flex;
    min-height: 2.25rem;
    align-items: center;
    align-self: end;
    gap: 0.5rem;
}

@media (max-width: 1200px) {
    .employee-form :deep(.employee-section-grid) {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

@media (max-width: 900px) {
    .employee-form :deep(.employee-section-grid) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

}

@media (max-width: 600px) {
    .employee-form__steps {
        gap: 0.35rem;
        padding-bottom: 0.5rem;
    }

    .employee-form__steps :deep(.p-button) {
        padding-inline: 0.55rem;
        font-size: 0.72rem;
    }

    .employee-form__content {
        padding-right: 0.1rem;
    }

    .employee-form :deep(.employee-section-grid) {
        grid-template-columns: minmax(0, 1fr);
    }

    .employee-form :deep(.enterprise-form-field--full),
    .employee-form :deep(.enterprise-form-field--span-2) {
        grid-column: auto;
    }
}
</style>
