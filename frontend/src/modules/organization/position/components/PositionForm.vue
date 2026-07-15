<script setup>
import Checkbox from "primevue/checkbox"
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

const { t } = useI18n()

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

function message(field) {
    const value = props.errors?.[field]

    if (!value) {
        return ""
    }

    const translated = t(value)

    return translated === value
        ? value
        : translated
}
</script>

<template>
    <form
        class="position-form"
        @submit.prevent
    >
        <section class="position-form__section">
            <div class="position-form__heading">
                <h3>
                    {{ t("organization.position.basicInfo") }}
                </h3>
            </div>

            <div class="position-form__grid">
                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>
                        {{ t("organization.position.company") }} *
                    </span>

                    <Select
                        v-model="form.companyId"
                        :options="companies"
                        option-label="displayName"
                        option-value="id"
                        filter
                        :disabled="disabled || editing"
                        @change="emit('company-change')"
                    />

                    <small v-if="message('companyId')">
                        {{ message("companyId") }}
                    </small>
                </label>

                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>
                        {{ t("organization.position.branch") }} *
                    </span>

                    <Select
                        v-model="form.branchId"
                        :options="branches"
                        option-label="name"
                        option-value="id"
                        filter
                        :disabled="disabled || editing || !form.companyId"
                        @change="emit('branch-change')"
                    />

                    <small v-if="message('branchId')">
                        {{ message("branchId") }}
                    </small>
                </label>

                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>
                        {{ t("organization.position.department") }} *
                    </span>

                    <Select
                        v-model="form.departmentId"
                        :options="departments"
                        option-label="name"
                        option-value="id"
                        filter
                        :disabled="disabled || editing || !form.branchId"
                        @change="emit('department-change')"
                    />

                    <small v-if="message('departmentId')">
                        {{ message("departmentId") }}
                    </small>
                </label>

                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>
                        {{ t("organization.position.reportsTo") }}
                    </span>

                    <Select
                        v-model="form.reportsToPositionId"
                        :options="reportsToOptions"
                        option-label="title"
                        option-value="id"
                        filter
                        :disabled="disabled || !form.departmentId"
                        @change="emit('clear-error', 'reportsToPositionId')"
                    />

                    <small v-if="message('reportsToPositionId')">
                        {{ message("reportsToPositionId") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.position.code") }} *
                    </span>

                    <InputText
                        v-model="form.code"
                        :disabled="disabled"
                        maxlength="30"
                        @input="emit('normalize-code')"
                    />

                    <small v-if="message('code')">
                        {{ message("code") }}
                    </small>
                </label>

                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>
                        {{ t("organization.position.titleField") }} *
                    </span>

                    <InputText
                        v-model="form.title"
                        :disabled="disabled"
                        maxlength="160"
                        @input="emit('clear-error', 'title')"
                    />

                    <small v-if="message('title')">
                        {{ message("title") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.position.level") }}
                    </span>

                    <InputNumber
                        v-model="form.level"
                        :disabled="disabled"
                        :min="0"
                        :max="99"
                        :use-grouping="false"
                        @input="emit('clear-error', 'level')"
                    />

                    <small v-if="message('level')">
                        {{ message("level") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("organization.position.status") }}
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

                <label class="enterprise-form-field position-form__checkbox">
                    <Checkbox
                        v-model="form.isManager"
                        binary
                        :disabled="disabled"
                        input-id="position-is-manager"
                    />

                    <span>
                        {{ t("organization.position.markAsManager") }}
                    </span>
                </label>

                <label class="enterprise-form-field enterprise-form-field--full">
                    <span>
                        {{ t("organization.position.descriptionLabel") }}
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
.position-form {
    display: grid;
    gap: 1rem;
}

.position-form__section {
    display: grid;
    gap: 0.75rem;
}

.position-form__heading h3 {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 700;
}

.position-form__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}

.position-form__checkbox {
    min-height: 2.25rem;
    flex-direction: row;
    align-items: center;
    align-self: end;
    gap: 0.5rem;
}

.position-form__checkbox > span {
    margin: 0;
}

@media (max-width: 680px) {
    .position-form__grid {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
