<script setup>
import Checkbox from "primevue/checkbox"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Textarea from "primevue/textarea"
import { computed } from "vue"
import { useI18n } from "vue-i18n"

const props = defineProps({
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    companies: { type: Array, default: () => [] },
    disabled: { type: Boolean, default: false },
})
const emit = defineEmits(["clear-error", "normalize-code", "normalize-country-code"])
const { t } = useI18n()
const statusOptions = computed(() => [
    { label: t("organization.branch.statusActive"), value: "ACTIVE" },
    { label: t("organization.branch.statusInactive"), value: "INACTIVE" },
])
function message(field) {
    const value = props.errors?.[field]
    if (!value) return ""
    const translated = t(value)
    return translated === value ? value : translated
}
</script>

<template>
    <form class="branch-form" @submit.prevent>
        <section class="branch-form__section">
            <div class="branch-form__heading">
                <h3>{{ t("organization.branch.basicInfo") }}</h3>
            </div>
            <div class="branch-form__grid">
                <label class="enterprise-form-field enterprise-form-field--wide">
                    <span>{{ t("organization.branch.company") }} *</span>
                    <Select
                        v-model="form.companyId"
                        :options="companies"
                        option-label="displayName"
                        option-value="id"
                        filter
                        :placeholder="t('organization.branch.selectCompany')"
                        :disabled="disabled"
                        :invalid="Boolean(errors.companyId)"
                        @change="emit('clear-error', 'companyId')"
                    />
                    <small v-if="message('companyId')" class="enterprise-form-field__error">{{
                        message("companyId")
                    }}</small>
                </label>
                <label class="enterprise-form-field"
                    ><span>{{ t("organization.branch.code") }} *</span
                    ><InputText
                        v-model="form.code"
                        :disabled="disabled"
                        :invalid="Boolean(errors.code)"
                        @input="emit('normalize-code')"
                    /><small v-if="message('code')" class="enterprise-form-field__error">{{
                        message("code")
                    }}</small></label
                >
                <label class="enterprise-form-field"
                    ><span>{{ t("organization.branch.shortName") }}</span
                    ><InputText v-model="form.shortName" :disabled="disabled"
                /></label>
                <label class="enterprise-form-field enterprise-form-field--wide"
                    ><span>{{ t("organization.branch.name") }} *</span
                    ><InputText
                        v-model="form.name"
                        :disabled="disabled"
                        :invalid="Boolean(errors.name)"
                        @input="emit('clear-error', 'name')"
                    /><small v-if="message('name')" class="enterprise-form-field__error">{{
                        message("name")
                    }}</small></label
                >
                <label class="enterprise-form-field"
                    ><span>{{ t("organization.branch.status") }}</span
                    ><Select
                        v-model="form.status"
                        :options="statusOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="disabled"
                /></label>
                <label class="enterprise-form-field"
                    ><span>{{ t("organization.branch.timezone") }}</span
                    ><InputText v-model="form.timezone" :disabled="disabled"
                /></label>
                <label class="branch-form__check"
                    ><Checkbox v-model="form.isHeadOffice" binary :disabled="disabled" /><span>{{
                        t("organization.branch.markAsHeadOffice")
                    }}</span></label
                >
            </div>
        </section>
        <section class="branch-form__section">
            <div class="branch-form__heading">
                <h3>{{ t("organization.branch.contactAddress") }}</h3>
            </div>
            <div class="branch-form__grid">
                <label class="enterprise-form-field"
                    ><span>{{ t("organization.branch.email") }}</span
                    ><InputText
                        v-model="form.contact.email"
                        type="email"
                        :disabled="disabled"
                        :invalid="Boolean(errors['contact.email'])"
                /></label>
                <label class="enterprise-form-field"
                    ><span>{{ t("organization.branch.phone") }}</span
                    ><InputText v-model="form.contact.phone" :disabled="disabled"
                /></label>
                <label class="enterprise-form-field enterprise-form-field--wide"
                    ><span>{{ t("organization.branch.addressLine1") }}</span
                    ><Textarea
                        v-model="form.address.addressLine1"
                        rows="2"
                        auto-resize
                        :disabled="disabled"
                /></label>
                <label class="enterprise-form-field enterprise-form-field--wide"
                    ><span>Address Line 2</span
                    ><InputText v-model="form.address.addressLine2" :disabled="disabled"
                /></label>
                <label class="enterprise-form-field"
                    ><span>{{ t("organization.branch.city") }}</span
                    ><InputText v-model="form.address.city" :disabled="disabled"
                /></label>
                <label class="enterprise-form-field"
                    ><span>{{ t("organization.branch.stateProvince") }}</span
                    ><InputText v-model="form.address.stateProvince" :disabled="disabled"
                /></label>
                <label class="enterprise-form-field"
                    ><span>{{ t("organization.branch.postalCode") }}</span
                    ><InputText v-model="form.address.postalCode" :disabled="disabled"
                /></label>
                <label class="enterprise-form-field"
                    ><span>{{ t("organization.branch.countryCode") }}</span
                    ><InputText
                        v-model="form.address.countryCode"
                        maxlength="2"
                        :disabled="disabled"
                        @input="emit('normalize-country-code')"
                /></label>
            </div>
        </section>
    </form>
</template>

<style scoped>
.branch-form {
    display: grid;
    gap: 1rem;
}
.branch-form__section {
    overflow: hidden;
    border: 1px solid var(--enterprise-border, #e5e7eb);
    border-radius: 0.65rem;
    background: var(--enterprise-surface, #fff);
}
.branch-form__heading {
    padding: 0.65rem 0.8rem;
    border-bottom: 1px solid var(--enterprise-border, #e5e7eb);
    background: var(--enterprise-surface-soft, #f8fafc);
}
.branch-form__heading h3 {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 700;
}
.branch-form__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    padding: 0.8rem;
}
.enterprise-form-field {
    display: grid;
    min-width: 0;
    gap: 0.3rem;
}
.enterprise-form-field > span,
.branch-form__check span {
    color: var(--text-color-secondary);
    font-size: 0.72rem;
    font-weight: 650;
}
.enterprise-form-field--wide {
    grid-column: 1/-1;
}
.enterprise-form-field__error {
    color: var(--p-red-600, #dc2626);
    font-size: 0.68rem;
}
.branch-form__check {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    align-self: end;
    min-height: 2.25rem;
}
@media (max-width: 720px) {
    .branch-form__grid {
        grid-template-columns: minmax(0, 1fr);
    }
    .enterprise-form-field--wide {
        grid-column: auto;
    }
}
</style>
