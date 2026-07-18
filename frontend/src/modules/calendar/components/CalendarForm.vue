<script setup>
import Checkbox from "primevue/checkbox"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Textarea from "primevue/textarea"
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import {
    createCalendarDayTypeOptions,
    createCalendarScopeOptions,
    createCalendarStatusOptions,
} from "../config/calendar.filters.js"

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
    "scope-change",
])

const { t } = useI18n()

const scopeOptions = computed(() => createCalendarScopeOptions(t, false))
const dayTypeOptions = computed(() => createCalendarDayTypeOptions(t, false))
const statusOptions = computed(() =>
    createCalendarStatusOptions(t).filter(
        ({ value }) => value !== "ALL" && value !== "ARCHIVED",
    ),
)

function message(field) {
    const value = props.errors?.[field]

    if (!value) {
        return ""
    }

    const translated = t(value)
    return translated === value ? value : translated
}
</script>

<template>
    <form
        class="calendar-form"
        @submit.prevent
    >
        <section class="calendar-form__section">
            <div class="calendar-form__grid">
                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.calendar.day.scope") }} *
                    </span>

                    <Select
                        v-model="form.scopeLevel"
                        :options="scopeOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="disabled || editing"
                        @change="emit('scope-change')"
                    />

                    <small v-if="message('scopeLevel')">
                        {{ message("scopeLevel") }}
                    </small>
                </label>

                <label
                    v-if="form.scopeLevel !== 'GLOBAL'"
                    class="enterprise-form-field"
                >
                    <span>
                        {{ t("organization.calendar.day.company") }} *
                    </span>

                    <InputText
                        :model-value="companyName"
                        disabled
                    />

                    <small v-if="message('companyId')">
                        {{ message("companyId") }}
                    </small>
                </label>

                <label
                    v-if="form.scopeLevel === 'BRANCH'"
                    class="enterprise-form-field"
                >
                    <span>
                        {{ t("organization.calendar.day.branch") }} *
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
                        {{ t("organization.calendar.day.date") }} *
                    </span>

                    <EnterpriseCalendarDatePicker
                        v-model="form.dateKey"
                        :company-id="form.companyId"
                        :branch-id="form.branchId"
                        :disabled="disabled || editing"
                        :show-status="false"
                        @update:model-value="emit('clear-error', 'dateKey')"
                    />

                    <small v-if="message('dateKey')">
                        {{ message("dateKey") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.calendar.day.dayType") }} *
                    </span>

                    <Select
                        v-model="form.dayType"
                        :options="dayTypeOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="disabled"
                        @change="emit('clear-error', 'dayType')"
                    />

                    <small v-if="message('dayType')">
                        {{ message("dayType") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.calendar.day.name") }} *
                    </span>

                    <InputText
                        v-model="form.name"
                        :disabled="disabled"
                        maxlength="160"
                        @input="emit('clear-error', 'name')"
                    />

                    <small v-if="message('name')">
                        {{ message("name") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.calendar.day.category") }}
                    </span>

                    <InputText
                        v-model="form.holidayCategory"
                        :disabled="disabled"
                        maxlength="100"
                        @input="emit('clear-error', 'holidayCategory')"
                    />

                    <small v-if="message('holidayCategory')">
                        {{ message("holidayCategory") }}
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
                    />

                    <small v-if="message('status')">
                        {{ message("status") }}
                    </small>
                </label>

                <label class="enterprise-form-field calendar-form__checkbox">
                    <Checkbox
                        v-model="form.isPaidHoliday"
                        binary
                        :disabled="disabled"
                        input-id="calendar-paid-holiday"
                    />

                    <span>
                        {{ t("organization.calendar.day.paidHoliday") }}
                    </span>
                </label>

                <label class="enterprise-form-field enterprise-form-field--full">
                    <span>
                        {{ t("organization.calendar.day.descriptionLabel") }}
                    </span>

                    <Textarea
                        v-model="form.description"
                        :disabled="disabled"
                        rows="3"
                        maxlength="500"
                        auto-resize
                        @input="emit('clear-error', 'description')"
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
.calendar-form {
    display: grid;
    gap: 1rem;
}

.calendar-form__section {
    display: grid;
    gap: 0.75rem;
}

.calendar-form__grid {
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
.enterprise-form-field :deep(.p-textarea),
.enterprise-form-field :deep(.p-datepicker),
.enterprise-form-field :deep(.internal-calendar-picker) {
    width: 100%;
    min-width: 0;
}

.enterprise-form-field :deep(.p-select) {
    display: flex;
}

.enterprise-form-field :deep(.p-select-label) {
    min-width: 0;
    flex: 1 1 auto;
}

.calendar-form__checkbox {
    display: flex;
    min-height: 2.25rem;
    align-items: center;
    align-self: end;
    gap: 0.5rem;
}

.calendar-form__checkbox > span {
    margin: 0;
}

@media (max-width: 680px) {
    .calendar-form__grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .enterprise-form-field--full {
        grid-column: auto;
    }
}
</style>
