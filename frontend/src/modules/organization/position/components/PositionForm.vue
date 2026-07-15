<script setup>
import Checkbox from "primevue/checkbox"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Textarea from "primevue/textarea"

import {
    computed,
} from "vue"

import {
    useI18n,
} from "vue-i18n"

const props = defineProps({
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

    disabled: {
        type: Boolean,
        default: false,
    },

    editing: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits([
    "clear-error",
    "normalize-code",
    "company-change",
    "branch-change",
    "department-change",
])

const {
    t,
} = useI18n()

const statusOptions = computed(() => [
    {
        label: t("organization.position.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.position.statusInactive"),
        value: "INACTIVE",
    },
])

const reportsToOptions = computed(() => [
    {
        id: "",
        title: t("organization.position.noReportsTo"),
    },
    ...props.reportsToPositions,
])

function getErrorMessage(field) {
    const value = props.errors?.[field]

    if (!value) {
        return ""
    }

    const translated = t(value)

    return translated === value
        ? value
        : translated
}

function clearError(field) {
    emit("clear-error", field)
}
</script>

<template>
    <form
        class="position-enterprise-form"
        @submit.prevent
    >
        <section class="position-enterprise-form__section">
            <div class="position-enterprise-form__section-header">
                <h3>
                    {{ t("organization.position.organizationInformation") }}
                </h3>
            </div>

            <div class="position-enterprise-form__grid">
                <label class="enterprise-form-field">
                    <span class="enterprise-form-field__label">
                        {{ t("organization.position.company") }}
                        <strong>*</strong>
                    </span>

                    <Select
                        v-model="form.companyId"
                        :options="companies"
                        option-label="displayName"
                        option-value="id"
                        filter
                        fluid
                        :disabled="disabled || editing"
                        @change="emit('company-change')"
                    />

                    <small
                        v-if="getErrorMessage('companyId')"
                        class="enterprise-form-field__error"
                    >
                        {{ getErrorMessage("companyId") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span class="enterprise-form-field__label">
                        {{ t("organization.position.branch") }}
                        <strong>*</strong>
                    </span>

                    <Select
                        v-model="form.branchId"
                        :options="branches"
                        option-label="name"
                        option-value="id"
                        filter
                        fluid
                        :disabled="
                            disabled ||
                            editing ||
                            !form.companyId
                        "
                        @change="emit('branch-change')"
                    />

                    <small
                        v-if="getErrorMessage('branchId')"
                        class="enterprise-form-field__error"
                    >
                        {{ getErrorMessage("branchId") }}
                    </small>
                </label>

                <label class="enterprise-form-field enterprise-form-field--full">
                    <span class="enterprise-form-field__label">
                        {{ t("organization.position.department") }}
                        <strong>*</strong>
                    </span>

                    <Select
                        v-model="form.departmentId"
                        :options="departments"
                        option-label="name"
                        option-value="id"
                        filter
                        fluid
                        :disabled="
                            disabled ||
                            editing ||
                            !form.branchId
                        "
                        @change="emit('department-change')"
                    />

                    <small
                        v-if="getErrorMessage('departmentId')"
                        class="enterprise-form-field__error"
                    >
                        {{ getErrorMessage("departmentId") }}
                    </small>
                </label>
            </div>
        </section>

        <section class="position-enterprise-form__section">
            <div class="position-enterprise-form__section-header">
                <h3>
                    {{ t("organization.position.positionInformation") }}
                </h3>
            </div>

            <div class="position-enterprise-form__grid">
                <label class="enterprise-form-field">
                    <span class="enterprise-form-field__label">
                        {{ t("organization.position.code") }}
                        <strong>*</strong>
                    </span>

                    <InputText
                        v-model="form.code"
                        fluid
                        maxlength="30"
                        :disabled="disabled"
                        @input="emit('normalize-code')"
                    />

                    <small
                        v-if="getErrorMessage('code')"
                        class="enterprise-form-field__error"
                    >
                        {{ getErrorMessage("code") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span class="enterprise-form-field__label">
                        {{ t("organization.position.titleField") }}
                        <strong>*</strong>
                    </span>

                    <InputText
                        v-model="form.title"
                        fluid
                        maxlength="160"
                        :disabled="disabled"
                        @input="clearError('title')"
                    />

                    <small
                        v-if="getErrorMessage('title')"
                        class="enterprise-form-field__error"
                    >
                        {{ getErrorMessage("title") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span class="enterprise-form-field__label">
                        {{ t("organization.position.reportsTo") }}
                    </span>

                    <Select
                        v-model="form.reportsToPositionId"
                        :options="reportsToOptions"
                        option-label="title"
                        option-value="id"
                        filter
                        fluid
                        :disabled="
                            disabled ||
                            !form.departmentId
                        "
                        @change="clearError('reportsToPositionId')"
                    />

                    <small
                        v-if="getErrorMessage('reportsToPositionId')"
                        class="enterprise-form-field__error"
                    >
                        {{ getErrorMessage("reportsToPositionId") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span class="enterprise-form-field__label">
                        {{ t("organization.position.level") }}
                    </span>

                    <InputNumber
                        v-model="form.level"
                        fluid
                        :min="0"
                        :max="99"
                        :use-grouping="false"
                        :disabled="disabled"
                        @input="clearError('level')"
                    />

                    <small
                        v-if="getErrorMessage('level')"
                        class="enterprise-form-field__error"
                    >
                        {{ getErrorMessage("level") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span class="enterprise-form-field__label">
                        {{ t("organization.position.status") }}
                        <strong>*</strong>
                    </span>

                    <Select
                        v-model="form.status"
                        :options="statusOptions"
                        option-label="label"
                        option-value="value"
                        fluid
                        :disabled="disabled"
                        @change="clearError('status')"
                    />

                    <small
                        v-if="getErrorMessage('status')"
                        class="enterprise-form-field__error"
                    >
                        {{ getErrorMessage("status") }}
                    </small>
                </label>

                <div class="enterprise-form-field">
                    <span class="enterprise-form-field__label">
                        {{ t("organization.position.managerPosition") }}
                    </span>

                    <label
                        class="position-enterprise-form__checkbox"
                        for="position-is-manager"
                    >
                        <Checkbox
                            v-model="form.isManager"
                            input-id="position-is-manager"
                            binary
                            :disabled="disabled"
                            @change="clearError('isManager')"
                        />

                        <span>
                            {{ t("organization.position.markAsManager") }}
                        </span>
                    </label>

                    <small
                        v-if="getErrorMessage('isManager')"
                        class="enterprise-form-field__error"
                    >
                        {{ getErrorMessage("isManager") }}
                    </small>
                </div>

                <label class="enterprise-form-field enterprise-form-field--full">
                    <span class="enterprise-form-field__label">
                        {{ t("organization.position.descriptionLabel") }}
                    </span>

                    <Textarea
                        v-model="form.description"
                        fluid
                        rows="3"
                        maxlength="500"
                        auto-resize
                        :disabled="disabled"
                        @input="clearError('description')"
                    />

                    <small
                        v-if="getErrorMessage('description')"
                        class="enterprise-form-field__error"
                    >
                        {{ getErrorMessage("description") }}
                    </small>
                </label>
            </div>
        </section>
    </form>
</template>

<style scoped>
.position-enterprise-form {
    display: grid;
    gap: 1rem;
}

.position-enterprise-form__section {
    display: grid;
    gap: 0.75rem;
}

.position-enterprise-form__section + .position-enterprise-form__section {
    padding-top: 1rem;
    border-top: 1px solid var(--p-content-border-color, #e2e8f0);
}

.position-enterprise-form__section-header {
    display: flex;
    min-width: 0;
    align-items: center;
}

.position-enterprise-form__section-header h3 {
    margin: 0;
    color: var(--p-text-color, #0f172a);
    font-size: 0.82rem;
    font-weight: 700;
    line-height: 1.25rem;
}

.position-enterprise-form__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}

.enterprise-form-field {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.3rem;
}

.enterprise-form-field--full {
    grid-column: 1 / -1;
}

.enterprise-form-field__label {
    min-height: 1rem;
    color: var(--p-text-color, #334155);
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1rem;
}

.enterprise-form-field__label strong {
    color: var(--p-red-500, #ef4444);
    font-weight: 700;
}

.enterprise-form-field__error {
    color: var(--p-red-500, #ef4444);
    font-size: 0.68rem;
    line-height: 1rem;
}

.position-enterprise-form__checkbox {
    display: flex;
    min-height: 2.25rem;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.65rem;
    border: 1px solid var(--p-form-field-border-color, #cbd5e1);
    border-radius: var(--p-form-field-border-radius, 6px);
    background: var(--p-form-field-background, #fff);
    cursor: pointer;
}

.position-enterprise-form__checkbox span {
    color: var(--p-text-color, #334155);
    font-size: 0.75rem;
    line-height: 1;
}

.position-enterprise-form :deep(.p-inputtext),
.position-enterprise-form :deep(.p-select),
.position-enterprise-form :deep(.p-inputnumber-input) {
    width: 100%;
    min-height: 2.25rem;
    height: 2.25rem;
    font-size: 0.78rem;
}

.position-enterprise-form :deep(.p-select-label) {
    display: flex;
    min-height: 2.25rem;
    height: 2.25rem;
    align-items: center;
    padding-block: 0;
    font-size: 0.78rem;
}

.position-enterprise-form :deep(.p-select-dropdown) {
    width: 2rem;
    min-width: 2rem;
    height: 2.25rem;
}

.position-enterprise-form :deep(.p-textarea) {
    width: 100%;
    min-height: 5rem;
    font-size: 0.78rem;
    resize: vertical;
}

@media (max-width: 680px) {
    .position-enterprise-form__grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .enterprise-form-field--full {
        grid-column: auto;
    }
}
</style>