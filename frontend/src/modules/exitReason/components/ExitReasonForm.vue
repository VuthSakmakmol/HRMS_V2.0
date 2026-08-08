<script setup>
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Textarea from "primevue/textarea"
import { useI18n } from "vue-i18n"

const props = defineProps({
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    companyName: { type: String, default: "—" },
    branchName: { type: String, default: "—" },
    editing: Boolean,
    disabled: Boolean,
})

const emit = defineEmits(["normalize-code", "clear-error"])
const { t } = useI18n()

const editStatuses = [
    { label: t("exitReason.statusActive"), value: "ACTIVE" },
    { label: t("exitReason.statusInactive"), value: "INACTIVE" },
]

function translateMessage(value) {
    const message = Array.isArray(value) ? value[0] : value
    if (!message) return ""

    const translated = t(message)
    return translated === message ? message : translated
}

function fieldError(field) {
    return translateMessage(props.errors?.[field])
}
</script>

<template>
    <div class="exit-form">
        <div class="exit-form__scope">
            <div>
                <small>{{ t("exitReason.company") }}</small>
                <strong>{{ companyName }}</strong>
            </div>
            <i class="pi pi-angle-right" />
            <div>
                <small>{{ t("exitReason.branch") }}</small>
                <strong>{{ branchName }}</strong>
            </div>
        </div>

        <label class="field">
            <span>{{ t("exitReason.code") }} <b>*</b></span>
            <InputText
                v-model="form.code"
                :disabled="disabled || editing"
                maxlength="40"
                autocomplete="off"
                @input="emit('clear-error', 'code'); emit('normalize-code')"
            />
            <small v-if="fieldError('code')" class="error">
                {{ fieldError("code") }}
            </small>
            <small v-else-if="editing" class="hint">
                {{ t("exitReason.codeLockedHint") }}
            </small>
        </label>

        <label class="field">
            <span>{{ t("exitReason.name") }} <b>*</b></span>
            <InputText
                v-model="form.name"
                :disabled="disabled"
                maxlength="180"
                autocomplete="off"
                @input="emit('clear-error', 'name')"
            />
            <small v-if="fieldError('name')" class="error">
                {{ fieldError("name") }}
            </small>
        </label>

        <label class="field">
            <span>{{ t("exitReason.status") }}</span>
            <Select
                v-model="form.status"
                :disabled="disabled"
                :options="editStatuses"
                option-label="label"
                option-value="value"
                @change="emit('clear-error', 'status')"
            />
            <small v-if="fieldError('status')" class="error">
                {{ fieldError("status") }}
            </small>
        </label>

        <label class="field field--wide">
            <span>{{ t("exitReason.descriptionLabel") }}</span>
            <Textarea
                v-model="form.description"
                :disabled="disabled"
                rows="3"
                maxlength="800"
                @input="emit('clear-error', 'description')"
            />
            <div class="field__meta">
                <small v-if="fieldError('description')" class="error">
                    {{ fieldError("description") }}
                </small>
                <small class="counter">{{ form.description?.length || 0 }}/800</small>
            </div>
        </label>
    </div>
</template>

<style scoped>
.exit-form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: .8rem 1rem;
}

.exit-form__scope {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: .7rem .85rem;
    border: 1px solid var(--p-content-border-color);
    border-radius: .55rem;
    background: var(--p-surface-50);
}

.exit-form__scope div {
    display: grid;
    gap: .15rem;
}

.exit-form__scope small,
.exit-form__scope i,
.hint,
.counter {
    color: var(--p-text-muted-color);
}

.field {
    display: grid;
    gap: .3rem;
    min-width: 0;
    font-size: .76rem;
    font-weight: 600;
}

.field b,
.error {
    color: var(--p-red-500);
}

.field--wide {
    grid-column: 1 / -1;
}

.field__meta {
    display: flex;
    justify-content: space-between;
    gap: .75rem;
}

.counter {
    margin-left: auto;
    font-weight: 400;
}

.field :deep(.p-inputtext),
.field :deep(.p-select),
.field :deep(.p-textarea) {
    width: 100%;
}

@media (max-width: 640px) {
    .exit-form {
        grid-template-columns: 1fr;
    }

    .field--wide,
    .exit-form__scope {
        grid-column: auto;
    }
}
</style>
