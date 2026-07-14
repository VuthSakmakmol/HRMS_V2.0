<script setup>
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Textarea from "primevue/textarea"
import { computed } from "vue"
import { useI18n } from "vue-i18n"

const props = defineProps({
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false },
})

const emit = defineEmits([
    "clear-error",
    "normalize-code",
    "normalize-country-code",
    "normalize-currency-code",
])

const { t } = useI18n()

const statusOptions = computed(() => [
    { label: t("organization.company.statusActive"), value: "ACTIVE" },
    { label: t("organization.company.statusSuspended"), value: "SUSPENDED" },
])

const localeOptions = [
    { label: "English", value: "en-US" },
    { label: "ខ្មែរ", value: "km-KH" },
]

const weekStartOptions = computed(() => [
    { label: t("organization.company.sunday"), value: 0 },
    { label: t("organization.company.monday"), value: 1 },
    { label: t("organization.company.saturday"), value: 6 },
])

function message(field) {
    const value = props.errors?.[field]
    if (!value) return ""
    const translated = t(value)
    return translated === value ? value : translated
}
</script>

<template>
    <form class="company-form" @submit.prevent>
        <section class="company-form__section">
            <div class="company-form__section-heading">
                <h3>{{ t("organization.company.basicInformation") }}</h3>
            </div>

            <div class="company-form__grid">
                <label class="enterprise-form-field">
                    <span>{{ t("organization.company.code") }} *</span>
                    <InputText
                        v-model="form.code"
                        autocomplete="off"
                        :disabled="disabled"
                        :invalid="Boolean(errors.code)"
                        @input="emit('normalize-code')"
                    />
                    <small v-if="message('code')" class="enterprise-form-field__error">
                        {{ message("code") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.company.status") }} *</span>
                    <Select
                        v-model="form.status"
                        :options="statusOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="disabled"
                    />
                </label>

                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>{{ t("organization.company.displayName") }} *</span>
                    <InputText
                        v-model="form.displayName"
                        autocomplete="organization"
                        :disabled="disabled"
                        :invalid="Boolean(errors.displayName)"
                        @input="emit('clear-error', 'displayName')"
                    />
                    <small v-if="message('displayName')" class="enterprise-form-field__error">
                        {{ message("displayName") }}
                    </small>
                </label>

                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>{{ t("organization.company.legalName") }} *</span>
                    <InputText
                        v-model="form.legalName"
                        :disabled="disabled"
                        :invalid="Boolean(errors.legalName)"
                        @input="emit('clear-error', 'legalName')"
                    />
                    <small v-if="message('legalName')" class="enterprise-form-field__error">
                        {{ message("legalName") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.company.registrationNumber") }}</span>
                    <InputText v-model="form.registrationNumber" :disabled="disabled" />
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.company.taxNumber") }}</span>
                    <InputText v-model="form.taxNumber" :disabled="disabled" />
                </label>
            </div>
        </section>

        <section class="company-form__section">
            <div class="company-form__section-heading">
                <h3>{{ t("organization.company.contact") }}</h3>
            </div>

            <div class="company-form__grid">
                <label class="enterprise-form-field">
                    <span>{{ t("organization.company.email") }}</span>
                    <InputText
                        v-model="form.contact.email"
                        type="email"
                        autocomplete="email"
                        :disabled="disabled"
                        :invalid="Boolean(errors['contact.email'])"
                        @input="emit('clear-error', 'contact.email')"
                    />
                    <small v-if="message('contact.email')" class="enterprise-form-field__error">
                        {{ message("contact.email") }}
                    </small>
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.company.phone") }}</span>
                    <InputText
                        v-model="form.contact.phone"
                        autocomplete="tel"
                        :disabled="disabled"
                    />
                </label>

                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>{{ t("organization.company.website") }}</span>
                    <InputText
                        v-model="form.contact.website"
                        type="url"
                        placeholder="https://"
                        :disabled="disabled"
                    />
                </label>
            </div>
        </section>

        <section class="company-form__section">
            <div class="company-form__section-heading">
                <h3>{{ t("organization.company.address") }}</h3>
            </div>

            <div class="company-form__grid">
                <label class="enterprise-form-field enterprise-form-field--full">
                    <span>{{ t("organization.company.addressLine1") }}</span>
                    <Textarea
                        v-model="form.address.addressLine1"
                        rows="2"
                        auto-resize
                        :disabled="disabled"
                    />
                </label>

                <label class="enterprise-form-field enterprise-form-field--full">
                    <span>{{ t("organization.company.addressLine2") }}</span>
                    <InputText v-model="form.address.addressLine2" :disabled="disabled" />
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.company.city") }}</span>
                    <InputText v-model="form.address.city" :disabled="disabled" />
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.company.stateProvince") }}</span>
                    <InputText v-model="form.address.stateProvince" :disabled="disabled" />
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.company.postalCode") }}</span>
                    <InputText v-model="form.address.postalCode" :disabled="disabled" />
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.company.countryCode") }}</span>
                    <InputText
                        v-model="form.address.countryCode"
                        maxlength="2"
                        :disabled="disabled"
                        @input="emit('normalize-country-code')"
                    />
                </label>
            </div>
        </section>

        <section class="company-form__section">
            <div class="company-form__section-heading">
                <h3>{{ t("organization.company.settings") }}</h3>
            </div>

            <div class="company-form__grid">
                <label class="enterprise-form-field">
                    <span>{{ t("organization.company.defaultLocale") }}</span>
                    <Select
                        v-model="form.settings.defaultLocale"
                        :options="localeOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="disabled"
                    />
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.company.timezone") }}</span>
                    <InputText v-model="form.settings.timezone" :disabled="disabled" />
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.company.currencyCode") }}</span>
                    <InputText
                        v-model="form.settings.currencyCode"
                        maxlength="3"
                        :disabled="disabled"
                        @input="emit('normalize-currency-code')"
                    />
                </label>

                <label class="enterprise-form-field">
                    <span>{{ t("organization.company.weekStartsOn") }}</span>
                    <Select
                        v-model="form.settings.weekStartsOn"
                        :options="weekStartOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="disabled"
                    />
                </label>
            </div>
        </section>
    </form>
</template>

<style scoped>
.company-form {
    display: grid;
    gap: 1rem;
}

.company-form__section {
    border: 1px solid var(--enterprise-border, #e5e7eb);
    border-radius: 0.65rem;
    background: var(--enterprise-surface, #fff);
    overflow: hidden;
}

.company-form__section-heading {
    padding: 0.65rem 0.8rem;
    border-bottom: 1px solid var(--enterprise-border, #e5e7eb);
    background: var(--enterprise-surface-soft, #f8fafc);
}

.company-form__section-heading h3 {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 700;
}

.company-form__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    padding: 0.8rem;
}

.enterprise-form-field {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
}

.enterprise-form-field > span {
    font-size: 0.72rem;
    font-weight: 650;
    color: var(--text-color-secondary);
}

.enterprise-form-field--wide,
.enterprise-form-field--full {
    grid-column: 1 / -1;
}

.enterprise-form-field__error {
    color: var(--p-red-600, #dc2626);
    font-size: 0.68rem;
}

@media (max-width: 720px) {
    .company-form__grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .enterprise-form-field--wide,
    .enterprise-form-field--full {
        grid-column: auto;
    }
}
</style>
