<script setup>
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import MultiSelect from "primevue/multiselect"
import Select from "primevue/select"
import Textarea from "primevue/textarea"
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import {
    createPositionAssignmentModeOptions,
} from "../config/employeeType.filters.js"

const props = defineProps({
    form: {
        type: Object,
        required: true,
    },
    errors: {
        type: Object,
        default: () => ({}),
    },
    companyName: {
        type: String,
        default: "—",
    },
    branchName: {
        type: String,
        default: "—",
    },
    positions: {
        type: Array,
        default: () => [],
    },
    positionsLoading: {
        type: Boolean,
        default: false,
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
    "add-child",
    "remove-child",
])

const { t } = useI18n()


const assignmentOptions = computed(() =>
    createPositionAssignmentModeOptions(t),
)

const statusOptions = computed(() => [
    {
        label: t("organization.employeeType.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.employeeType.statusInactive"),
        value: "INACTIVE",
    },
])

const structureOptions = computed(() => [
    {
        label: t("organization.employeeType.directStructure"),
        value: "DIRECT",
    },
    {
        label: t("organization.employeeType.childStructure"),
        value: "CHILD",
    },
])

const companyPositions = computed(() => {
    if (!props.form.companyId || !props.form.branchId) {
        return []
    }

    /*
     * The backend Position lookup is the source of truth and already applies
     * Company + Branch + ACTIVE filters. Do not filter the returned rows again
     * in the browser because lookup response shapes may differ between modules.
     */
    return props.positions
})

function message(field) {
    const value = props.errors?.[field]

    if (!value) {
        return ""
    }

    const rawMessage = Array.isArray(value)
        ? value[0]
        : value

    const translated = t(rawMessage)

    return translated === rawMessage
        ? rawMessage
        : translated
}

function clearFieldError(field) {
    emit("clear-error", field)
}
</script>

<template>
    <form
        class="employee-type-form"
        @submit.prevent
    >
        <section class="employee-type-form__section">
            <div class="employee-type-form__heading">
                <h3>
                    {{ t("organization.employeeType.basicInformation") }}
                </h3>
            </div>

            <div class="employee-type-form__grid">
                <label class="enterprise-form-field enterprise-form-field--full">
                    <span>
                        {{ t("organization.employeeType.company") }} *
                    </span>

                    <InputText
                        :model-value="companyName"
                        disabled
                    />

                    <small v-if="message('companyId')">
                        {{ message("companyId") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.employeeType.branch") }} *
                    </span>

                    <InputText
                        :model-value="branchName"
                        disabled
                    />

                    <small v-if="message('branchId')">
                        {{ message("branchId") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.employeeType.code") }} *
                    </span>

                    <InputText
                        v-model="form.code"
                        :disabled="disabled"
                        maxlength="30"
                        @input="clearFieldError('code')"
                    />

                    <small v-if="message('code')">
                        {{ message("code") }}
                    </small>
                </label>

                <label class="enterprise-form-field enterprise-form-field--full">
                    <span>
                        {{ t("organization.employeeType.name") }} *
                    </span>

                    <InputText
                        v-model="form.name"
                        :disabled="disabled"
                        maxlength="160"
                        @input="clearFieldError('name')"
                    />

                    <small v-if="message('name')">
                        {{ message("name") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.employeeType.dashboardCategory") }}
                    </span>

                    <InputText
                        v-model="form.dashboardCategory"
                        :placeholder="t('organization.employeeType.dashboardCategoryPlaceholder')"
                        :disabled="disabled"
                        maxlength="80"
                        @input="clearFieldError('dashboardCategory')"
                    />

                    <small v-if="message('dashboardCategory')">
                        {{ message("dashboardCategory") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("common.status") }}
                    </span>

                    <Select
                        v-model="form.status"
                        :options="statusOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="disabled"
                        @change="clearFieldError('status')"
                    />

                    <small v-if="message('status')">
                        {{ message("status") }}
                    </small>
                </label>
            </div>
        </section>

        <section class="employee-type-form__section">
            <div class="employee-type-form__heading">
                <h3>
                    {{ t("organization.employeeType.assignmentInformation") }}
                </h3>
            </div>

            <div class="employee-type-form__grid">
                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.employeeType.structure") }}
                    </span>

                    <Select
                        v-model="form.structureMode"
                        :options="structureOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="disabled"
                        @change="clearFieldError('structureMode')"
                    />

                    <small v-if="message('structureMode')">
                        {{ message("structureMode") }}
                    </small>
                </label>

                <label
                    v-if="form.structureMode === 'DIRECT'"
                    class="enterprise-form-field"
                >
                    <span>
                        {{ t("organization.employeeType.positionAssignmentMode") }}
                    </span>

                    <Select
                        v-model="form.positionAssignmentMode"
                        :options="assignmentOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="disabled"
                        @change="clearFieldError('positionAssignmentMode')"
                    />

                    <small v-if="message('positionAssignmentMode')">
                        {{ message("positionAssignmentMode") }}
                    </small>
                </label>

                <label
                    v-if="
                        form.structureMode === 'DIRECT' &&
                        form.positionAssignmentMode === 'SPECIFIC_POSITIONS'
                    "
                    class="enterprise-form-field enterprise-form-field--full"
                >
                    <span>
                        {{ t("organization.employeeType.positions") }} *
                    </span>

                    <MultiSelect
                        v-model="form.positionIds"
                        :options="companyPositions"
                        option-label="title"
                        :loading="positionsLoading"
                        option-value="id"
                        filter
                        :virtual-scroller-options="{ itemSize: 38 }"
                        :max-selected-labels="3"
                        display="chip"
                        :disabled="disabled || !form.companyId || !form.branchId"
                        @change="clearFieldError('positionIds')"
                    />

                    <small v-if="message('positionIds')">
                        {{ message("positionIds") }}
                    </small>
                </label>

                <div
                    v-if="form.structureMode === 'CHILD'"
                    class="employee-type-children enterprise-form-field--full"
                >
                    <div class="employee-type-children__header">
                        <div>
                            <strong>
                                {{ t("organization.employeeType.childGroups") }}
                            </strong>

                            <small>
                                {{ t("organization.employeeType.childGroupsHelp") }}
                            </small>
                        </div>

                        <Button
                            type="button"
                            size="small"
                            icon="pi pi-plus"
                            :label="t('organization.employeeType.addChild')"
                            :disabled="disabled"
                            @click="emit('add-child')"
                        />
                    </div>

                    <div
                        v-for="(child, index) in form.children"
                        :key="child.id || index"
                        class="employee-type-child-card"
                    >
                        <div class="employee-type-child-card__header">
                            <strong>
                                {{ t("organization.employeeType.childGroupNumber", { number: index + 1 }) }}
                            </strong>

                            <Button
                                type="button"
                                icon="pi pi-trash"
                                severity="danger"
                                text
                                rounded
                                :disabled="disabled"
                                :aria-label="t('common.remove')"
                                @click="emit('remove-child', index)"
                            />
                        </div>

                        <div class="employee-type-child-card__grid">
                            <label class="enterprise-form-field">
                                <span>
                                    {{ t("organization.employeeType.childCode") }} *
                                </span>

                                <InputText
                                    v-model="child.code"
                                    :disabled="disabled"
                                    maxlength="30"
                                />
                            </label>

                            <label class="enterprise-form-field">
                                <span>
                                    {{ t("organization.employeeType.childName") }} *
                                </span>

                                <InputText
                                    v-model="child.name"
                                    :disabled="disabled"
                                    maxlength="160"
                                />
                            </label>

                            <label class="enterprise-form-field">
                                <span>
                                    {{ t("organization.employeeType.dashboardCategory") }}
                                </span>

                                <InputText
                                    v-model="child.dashboardCategory"
                                    :placeholder="t('organization.employeeType.dashboardCategoryPlaceholder')"
                                    :disabled="disabled"
                                    maxlength="80"
                                />
                            </label>

                            <label class="enterprise-form-field">
                                <span>
                                    {{ t("organization.employeeType.positionAssignmentMode") }}
                                </span>

                                <Select
                                    v-model="child.positionAssignmentMode"
                                    :options="assignmentOptions"
                                    option-label="label"
                                    option-value="value"
                                    :disabled="disabled"
                                />
                            </label>

                            <label
                                v-if="child.positionAssignmentMode === 'SPECIFIC_POSITIONS'"
                                class="enterprise-form-field enterprise-form-field--full"
                            >
                                <span>
                                    {{ t("organization.employeeType.positions") }} *
                                </span>

                                <MultiSelect
                                    v-model="child.positionIds"
                                    :options="companyPositions"
                                    option-label="title"
                                    option-value="id"
                                    filter
                                    :virtual-scroller-options="{ itemSize: 38 }"
                                    :max-selected-labels="3"
                                    display="chip"
                                    :disabled="disabled || !form.companyId || !form.branchId"
                                />
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="employee-type-form__section">
            <div class="employee-type-form__heading">
                <h3>
                    {{ t("organization.employeeType.additionalInformation") }}
                </h3>
            </div>

            <div class="employee-type-form__grid">
                <label class="enterprise-form-field enterprise-form-field--full">
                    <span>
                        {{ t("common.description") }}
                    </span>

                    <Textarea
                        v-model="form.description"
                        :disabled="disabled"
                        rows="3"
                        maxlength="500"
                        auto-resize
                        @input="clearFieldError('description')"
                    />

                    <small v-if="message('description')">
                        {{ message("description") }}
                    </small>
                </label>
            </div>
        </section>
    </form>
</template>

<style scoped>
.employee-type-form {
    display: grid;
    gap: 1rem;
}

.employee-type-form__section {
    display: grid;
    gap: 0.75rem;
}

.employee-type-form__section + .employee-type-form__section {
    padding-top: 0.25rem;
    border-top: 1px solid var(--p-content-border-color, #e2e8f0);
}

.employee-type-form__heading h3 {
    margin: 0;
    font-size: 0.9rem;
}

.employee-type-form__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}

.enterprise-form-field {
    display: grid;
    min-width: 0;
    gap: 0.3rem;
}

.enterprise-form-field > span {
    color: var(--p-text-color, #334155);
    font-size: 0.75rem;
    font-weight: 600;
}

.enterprise-form-field small {
    color: var(--p-red-500, #ef4444);
    font-size: 0.7rem;
}

.enterprise-form-field--full {
    grid-column: 1 / -1;
}

.enterprise-form-field :deep(.p-inputtext),
.enterprise-form-field :deep(.p-select),
.enterprise-form-field :deep(.p-multiselect),
.enterprise-form-field :deep(.p-textarea) {
    width: 100%;
    min-width: 0;
}

.enterprise-form-field :deep(.p-select),
.enterprise-form-field :deep(.p-multiselect) {
    display: flex;
}

.enterprise-form-field :deep(.p-select-label),
.enterprise-form-field :deep(.p-multiselect-label) {
    min-width: 0;
    flex: 1 1 auto;
}

.employee-type-children {
    display: grid;
    gap: 0.75rem;
}

.employee-type-children__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.employee-type-children__header > div {
    display: grid;
    gap: 0.2rem;
}

.employee-type-children__header strong {
    color: var(--p-text-color, #334155);
    font-size: 0.8rem;
}

.employee-type-children__header small {
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.7rem;
}

.employee-type-child-card {
    display: grid;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--p-content-border-color, #e2e8f0);
    border-radius: 0.65rem;
    background: var(--p-content-background, #ffffff);
}

.employee-type-child-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.employee-type-child-card__header strong {
    font-size: 0.78rem;
}

.employee-type-child-card__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}

@media (max-width: 680px) {
    .employee-type-form__grid,
    .employee-type-child-card__grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .enterprise-form-field--full {
        grid-column: auto;
    }

    .employee-type-children__header {
        align-items: stretch;
        flex-direction: column;
    }
}
</style>
