<script setup>
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Textarea from "primevue/textarea"
import { computed } from "vue"
import { useI18n } from "vue-i18n"

const props = defineProps({
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    companyName: { type: String, default: "—" },
    branchName: { type: String, default: "—" },
    departmentOptions: { type: Array, default: () => [] },
    positionOptions: { type: Array, default: () => [] },
    disabled: { type: Boolean, default: false },
})

const emit = defineEmits([
    "clear-error",
    "normalize-code",
    "department-change",
])

const { t, te } = useI18n()

const statusOptions = computed(() => [
    { label: t("organization.line.statusActive"), value: "ACTIVE" },
    { label: t("organization.line.statusInactive"), value: "INACTIVE" },
])

function message(field) {
    const raw = props.errors?.[field]
    const value = Array.isArray(raw) ? raw[0] : raw
    if (!value) return ""
    return te(value) ? t(value) : value
}

function onDepartmentChange() {
    emit("clear-error", "departmentId")
    emit("department-change")
}
</script>

<template>
    <form class="line-form" @submit.prevent>
        <section class="line-form__section">
            <h3>{{ t("organization.line.organizationInformation") }}</h3>

            <div class="line-form__grid">
                <label class="enterprise-form-field">
                    <span>{{ t("organization.line.company") }} <strong class="required-star">*</strong></span>
                    <InputText :model-value="companyName" disabled />
                    <small v-if="message('companyId')">{{ message("companyId") }}</small>
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.line.branch") }} <strong class="required-star">*</strong></span>
                    <InputText :model-value="branchName" disabled />
                    <small v-if="message('branchId')">{{ message("branchId") }}</small>
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.line.department") }} <strong class="required-star">*</strong></span>
                    <Select
                        v-model="form.departmentId"
                        :options="departmentOptions"
                        option-label="label"
                        option-value="value"
                        filter
                        :invalid="Boolean(message('departmentId'))"
                        :disabled="disabled"
                        :placeholder="t('organization.line.selectDepartment')"
                        @change="onDepartmentChange"
                    />
                    <small v-if="message('departmentId')">{{ message("departmentId") }}</small>
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.line.position") }} <strong class="required-star">*</strong></span>
                    <Select
                        v-model="form.positionId"
                        :options="positionOptions"
                        option-label="label"
                        option-value="value"
                        filter
                        :invalid="Boolean(message('positionId'))"
                        :disabled="disabled || !form.departmentId"
                        :placeholder="t('organization.line.selectPosition')"
                        @change="emit('clear-error', 'positionId')"
                    />
                    <small v-if="message('positionId')">{{ message("positionId") }}</small>
                </label>
            </div>
        </section>

        <section class="line-form__section">
            <h3>{{ t("organization.line.lineInformation") }}</h3>

            <div class="line-form__grid">
                <label class="enterprise-form-field">
                    <span>{{ t("organization.line.code") }} <strong class="required-star">*</strong></span>
                    <InputText
                        v-model="form.code"
                        maxlength="30"
                        :invalid="Boolean(message('code'))"
                        :disabled="disabled"
                        @input="emit('normalize-code')"
                    />
                    <small v-if="message('code')">{{ message("code") }}</small>
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.line.name") }} <strong class="required-star">*</strong></span>
                    <InputText
                        v-model="form.name"
                        maxlength="160"
                        :invalid="Boolean(message('name'))"
                        :disabled="disabled"
                        @input="emit('clear-error', 'name')"
                    />
                    <small v-if="message('name')">{{ message("name") }}</small>
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("common.status") }} <strong class="required-star">*</strong></span>
                    <Select
                        v-model="form.status"
                        :options="statusOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="disabled"
                    />
                </label>

                <label class="enterprise-form-field enterprise-form-field--full">
                    <span>{{ t("organization.line.descriptionLabel") }}</span>
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

.required-star {
    margin-left: 0.08rem;
    color: var(--p-red-500, #ef4444);
    font-size: 1rem;
    font-weight: 900;
    line-height: 0;
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
