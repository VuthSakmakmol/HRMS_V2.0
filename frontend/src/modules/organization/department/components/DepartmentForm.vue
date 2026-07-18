<script setup>
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
    companyName: {
        type: String,
        default: "—",
    },
    branchName: {
        type: String,
        default: "—",
    },
    parentDepartments: {
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
])

const { t } = useI18n()

const statusOptions = computed(() => [
    {
        label: t("organization.department.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.department.statusInactive"),
        value: "INACTIVE",
    },
])

const parentOptions = computed(() => [
    {
        id: "",
        name: t("organization.department.noParent"),
    },
    ...props.parentDepartments,
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
        class="department-form"
        @submit.prevent
    >
        <section class="department-form__section">
            <div class="department-form__heading">
                <h3>
                    {{ t("organization.department.basicInformation") }}
                </h3>
            </div>

            <div class="department-form__grid">
                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>
                        {{ t("organization.department.company") }} *
                    </span>

                    <InputText
                        :model-value="companyName"
                        disabled
                    />

                    <small v-if="message('companyId')">
                        {{ message("companyId") }}
                    </small>
                </label>

                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>
                        {{ t("organization.department.branch") }} *
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
                        {{ t("organization.department.code") }} *
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
                        {{ t("organization.department.name") }} *
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

                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>
                        {{ t("organization.department.parentDepartment") }}
                    </span>

                    <Select
                        v-model="form.parentDepartmentId"
                        :options="parentOptions"
                        option-label="name"
                        option-value="id"
                        filter
                        :disabled="disabled || !form.branchId"
                    />

                    <small v-if="message('parentDepartmentId')">
                        {{ message("parentDepartmentId") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>
                        {{ t("common.status") }} *
                    </span>

                    <Select
                        v-model="form.status"
                        :options="statusOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="disabled"
                    />
                </label>

                <label class="enterprise-form-field enterprise-form-field--full">
                    <span>
                        {{ t("organization.department.description") }}
                    </span>

                    <Textarea
                        v-model="form.description"
                        :disabled="disabled"
                        rows="3"
                        maxlength="500"
                        auto-resize
                    />
                </label>
            </div>
        </section>
    </form>
</template>

<style scoped>
.department-form {
    display: grid;
    gap: 1rem;
}

.department-form__section {
    display: grid;
    gap: 0.75rem;
}

.department-form__heading h3 {
    margin: 0;
    font-size: 0.9rem;
}

.department-form__grid {
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

@media (max-width: 640px) {
    .department-form__grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .enterprise-form-field--full {
        grid-column: auto;
    }
}
</style>
