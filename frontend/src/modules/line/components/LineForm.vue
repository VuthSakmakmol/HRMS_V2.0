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
    departments: {
        type: Array,
        default: () => [],
    },
    positions: {
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
    "department-change",
])

const { t } = useI18n()

const statusOptions = computed(() => [
    {
        label: t("organization.line.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.line.statusInactive"),
        value: "INACTIVE",
    },
])

const leaderOptions = computed(() => [
    {
        id: null,
        title: t("organization.line.noLeaderPosition"),
    },
    ...props.positions,
])

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
        class="line-form"
        @submit.prevent
    >
        <section class="line-form__section">
            <h3>{{ t("organization.line.organizationInformation") }}</h3>

            <div class="line-form__grid">
                <label class="enterprise-form-field">
                    <span>{{ t("organization.line.company") }} *</span>
                    <InputText
                        :model-value="companyName"
                        disabled
                    />
                    <small v-if="message('companyId')">{{ message("companyId") }}</small>
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.line.branch") }} *</span>
                    <InputText
                        :model-value="branchName"
                        disabled
                    />
                    <small v-if="message('branchId')">{{ message("branchId") }}</small>
                </label>

                <label class="enterprise-form-field enterprise-form-field--full">
                    <span>{{ t("organization.line.department") }} *</span>
                    <Select
                        v-model="form.departmentId"
                        :options="departments"
                        option-label="name"
                        option-value="id"
                        filter
                        :disabled="disabled || editing || !form.branchId"
                        @change="emit('department-change')"
                    />
                    <small v-if="message('departmentId')">{{ message("departmentId") }}</small>
                </label>
            </div>
        </section>

        <section class="line-form__section">
            <h3>{{ t("organization.line.lineInformation") }}</h3>

            <div class="line-form__grid">
                <label class="enterprise-form-field">
                    <span>{{ t("organization.line.code") }} *</span>
                    <InputText
                        v-model="form.code"
                        maxlength="30"
                        :disabled="disabled"
                        @input="emit('normalize-code')"
                    />
                    <small v-if="message('code')">{{ message("code") }}</small>
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.line.name") }} *</span>
                    <InputText
                        v-model="form.name"
                        maxlength="160"
                        :disabled="disabled"
                        @input="emit('clear-error', 'name')"
                    />
                    <small v-if="message('name')">{{ message("name") }}</small>
                </label>


                <label class="enterprise-form-field">
                    <span>{{ t("organization.line.leaderPosition") }}</span>
                    <Select
                        v-model="form.leaderPositionId"
                        :options="leaderOptions"
                        option-label="title"
                        option-value="id"
                        filter
                        :disabled="disabled || !form.departmentId"
                    />
                    <small v-if="message('leaderPositionId')">{{ message("leaderPositionId") }}</small>
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("common.status") }} *</span>
                    <Select
                        v-model="form.status"
                        :options="statusOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="disabled"
                    />
                </label>

                <label class="enterprise-form-field enterprise-form-field--full">
                    <span>{{ t("organization.line.description") }}</span>
                    <Textarea
                        v-model="form.description"
                        rows="3"
                        maxlength="500"
                        auto-resize
                        :disabled="disabled"
                    />
                </label>
            </div>
        </section>
    </form>
</template>

<style scoped>
.line-form {
    display: grid;
    gap: 1rem;
}

.line-form__section {
    display: grid;
    gap: 0.75rem;
}

.line-form__section + .line-form__section {
    padding-top: 1rem;
    border-top: 1px solid var(--p-content-border-color, #e2e8f0);
}

.line-form__section h3 {
    margin: 0;
    font-size: 0.9rem;
}

.line-form__grid {
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

@media (max-width: 680px) {
    .line-form__grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .enterprise-form-field--full {
        grid-column: auto;
    }
}
</style>
