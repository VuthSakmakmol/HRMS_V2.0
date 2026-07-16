<script setup>
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Textarea from "primevue/textarea"
import { computed } from "vue"
import { useI18n } from "vue-i18n"

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
    "company-change",
])

const { t } = useI18n()

const statusOptions = computed(() => [
    {
        label: t("organization.shift.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.shift.statusInactive"),
        value: "INACTIVE",
    },
])

function message(field) {
    const value = props.errors?.[field]

    if (!value) {
        return ""
    }

    const key = Array.isArray(value)
        ? value[0]
        : value

    const translated = t(key)

    return translated === key
        ? key
        : translated
}

function normalizeCode() {
    props.form.code = String(props.form.code ?? "")
        .trimStart()
        .toUpperCase()

    emit("clear-error", "code")
}
</script>

<template>
    <form
        class="shift-form"
        @submit.prevent
    >
        <section class="shift-form__section">
            <div class="shift-form__heading">
                <h3>
                    {{ t("organization.shift.organizationInformation") }}
                </h3>
            </div>

            <div class="shift-form__grid">
                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.shift.company") }} *
                    </span>

                    <Select
                        v-model="form.companyId"
                        :options="companies"
                        option-label="displayName"
                        option-value="id"
                        filter
                        :placeholder="t('organization.shift.selectCompany')"
                        :disabled="disabled || editing"
                        @change="emit('company-change')"
                    />

                    <small v-if="message('companyId')">
                        {{ message("companyId") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.shift.branch") }} *
                    </span>

                    <Select
                        v-model="form.branchId"
                        :options="branches"
                        option-label="name"
                        option-value="id"
                        filter
                        :placeholder="t('organization.shift.selectBranch')"
                        :disabled="disabled || editing || !form.companyId"
                        @change="emit('clear-error', 'branchId')"
                    />

                    <small v-if="message('branchId')">
                        {{ message("branchId") }}
                    </small>
                </label>
            </div>
        </section>

        <section class="shift-form__section">
            <div class="shift-form__heading">
                <h3>
                    {{ t("organization.shift.basicInformation") }}
                </h3>
            </div>

            <div class="shift-form__grid">
                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.shift.code") }} *
                    </span>

                    <InputText
                        v-model="form.code"
                        :disabled="disabled"
                        maxlength="30"
                        autocomplete="off"
                        @input="normalizeCode"
                    />

                    <small v-if="message('code')">
                        {{ message("code") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.shift.name") }} *
                    </span>

                    <InputText
                        v-model="form.name"
                        :disabled="disabled"
                        maxlength="160"
                        autocomplete="off"
                        @input="emit('clear-error', 'name')"
                    />

                    <small v-if="message('name')">
                        {{ message("name") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.shift.shortName") }}
                    </span>

                    <InputText
                        v-model="form.shortName"
                        :disabled="disabled"
                        maxlength="80"
                        autocomplete="off"
                        @input="emit('clear-error', 'shortName')"
                    />

                    <small v-if="message('shortName')">
                        {{ message("shortName") }}
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
                        @change="emit('clear-error', 'status')"
                    />

                    <small v-if="message('status')">
                        {{ message("status") }}
                    </small>
                </label>
            </div>
        </section>

        <section class="shift-form__section">
            <div class="shift-form__heading">
                <h3>
                    {{ t("organization.shift.scheduleInformation") }}
                </h3>
            </div>

            <div class="shift-form__grid">
                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.shift.startTime") }} *
                    </span>

                    <InputText
                        v-model="form.startTime"
                        type="time"
                        :disabled="disabled"
                        @input="emit('clear-error', 'startTime')"
                    />

                    <small v-if="message('startTime')">
                        {{ message("startTime") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.shift.endTime") }} *
                    </span>

                    <InputText
                        v-model="form.endTime"
                        type="time"
                        :disabled="disabled"
                        @input="emit('clear-error', 'endTime')"
                    />

                    <small v-if="message('endTime')">
                        {{ message("endTime") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.shift.breakStartTime") }}
                    </span>

                    <InputText
                        v-model="form.breakStartTime"
                        type="time"
                        :disabled="disabled"
                        @input="emit('clear-error', 'breakStartTime')"
                    />

                    <small v-if="message('breakStartTime')">
                        {{ message("breakStartTime") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.shift.breakEndTime") }}
                    </span>

                    <InputText
                        v-model="form.breakEndTime"
                        type="time"
                        :disabled="disabled"
                        @input="emit('clear-error', 'breakEndTime')"
                    />

                    <small v-if="message('breakEndTime')">
                        {{ message("breakEndTime") }}
                    </small>
                </label>
            </div>
        </section>

        <section class="shift-form__section">
            <div class="shift-form__heading">
                <h3>
                    {{ t("organization.shift.attendanceRules") }}
                </h3>
            </div>

            <div class="shift-form__grid">
                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.shift.graceInMinutes") }}
                    </span>

                    <InputNumber
                        v-model="form.graceInMinutes"
                        :disabled="disabled"
                        :min="0"
                        :max="240"
                        :use-grouping="false"
                        show-buttons
                        button-layout="horizontal"
                        @input="emit('clear-error', 'graceInMinutes')"
                    />

                    <small v-if="message('graceInMinutes')">
                        {{ message("graceInMinutes") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.shift.graceOutMinutes") }}
                    </span>

                    <InputNumber
                        v-model="form.graceOutMinutes"
                        :disabled="disabled"
                        :min="0"
                        :max="240"
                        :use-grouping="false"
                        show-buttons
                        button-layout="horizontal"
                        @input="emit('clear-error', 'graceOutMinutes')"
                    />

                    <small v-if="message('graceOutMinutes')">
                        {{ message("graceOutMinutes") }}
                    </small>
                </label>

                <label class="enterprise-form-field enterprise-form-field--full">
                    <span>
                        {{ t("organization.shift.descriptionLabel") }}
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
.shift-form {
    display: grid;
    gap: 1rem;
}

.shift-form__section {
    display: grid;
    gap: 0.75rem;
}

.shift-form__section + .shift-form__section {
    padding-top: 0.9rem;
    border-top: 1px solid var(--p-content-border-color, #e2e8f0);
}

.shift-form__heading h3 {
    margin: 0;
    color: var(--p-text-color, #334155);
    font-size: 0.9rem;
    font-weight: 700;
}

.shift-form__grid {
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
.enterprise-form-field :deep(.p-inputnumber),
.enterprise-form-field :deep(.p-inputnumber-input),
.enterprise-form-field :deep(.p-textarea) {
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

.enterprise-form-field :deep(.p-inputnumber-button) {
    width: 2.25rem;
}

@media (max-width: 680px) {
    .shift-form__grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .enterprise-form-field--full {
        grid-column: auto;
    }
}
</style>
