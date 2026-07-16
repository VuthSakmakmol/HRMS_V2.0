<script setup>
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Textarea from "primevue/textarea"
import { computed } from "vue"
import { useI18n } from "vue-i18n"
const props = defineProps({ entity: { type: String, required: true }, form: { type: Object, required: true }, errors: { type: Object, default: () => ({}) }, countries: { type: Array, default: () => [] }, provinces: { type: Array, default: () => [] }, districts: { type: Array, default: () => [] }, communes: { type: Array, default: () => [] }, disabled: { type: Boolean, default: false } })
const emit = defineEmits(["clear-error","normalize-code","country-change","province-change","district-change"])
const { t } = useI18n()
const statusOptions = computed(() => [{ label: t("organization.location.statusActive"), value: "ACTIVE" }, { label: t("organization.location.statusInactive"), value: "INACTIVE" }])
const needsCountry = computed(() => props.entity !== "countries")
const needsProvince = computed(() => ["districts","communes","villages"].includes(props.entity))
const needsDistrict = computed(() => ["communes","villages"].includes(props.entity))
const needsCommune = computed(() => props.entity === "villages")
function msg(field) { const value = props.errors?.[field]; if (!value) return ""; const translated = t(value); return translated === value ? value : translated }
</script>
<template>
<form class="enterprise-form" @submit.prevent>
    <section class="enterprise-form-section">
        <h3 class="enterprise-form-section__title">{{ t("organization.location.parentInformation") }}</h3>
        <div class="enterprise-form-grid">
            <div v-if="needsCountry" class="enterprise-form-field">
                <label>{{ t("organization.location.country") }} *</label>
                <Select v-model="form.countryId" :options="countries" option-label="label" option-value="value" filter fluid :disabled="disabled" :invalid="Boolean(errors.countryId)" @change="emit('country-change')" />
                <small v-if="msg('countryId')" class="p-error">{{ msg("countryId") }}</small>
            </div>
            <div v-if="needsProvince" class="enterprise-form-field">
                <label>{{ t("organization.location.province") }} *</label>
                <Select v-model="form.provinceId" :options="provinces" option-label="label" option-value="value" filter fluid :disabled="disabled || !form.countryId" :invalid="Boolean(errors.provinceId)" @change="emit('province-change')" />
                <small v-if="msg('provinceId')" class="p-error">{{ msg("provinceId") }}</small>
            </div>
            <div v-if="needsDistrict" class="enterprise-form-field">
                <label>{{ t("organization.location.district") }} *</label>
                <Select v-model="form.districtId" :options="districts" option-label="label" option-value="value" filter fluid :disabled="disabled || !form.provinceId" :invalid="Boolean(errors.districtId)" @change="emit('district-change')" />
                <small v-if="msg('districtId')" class="p-error">{{ msg("districtId") }}</small>
            </div>
            <div v-if="needsCommune" class="enterprise-form-field">
                <label>{{ t("organization.location.commune") }} *</label>
                <Select v-model="form.communeId" :options="communes" option-label="label" option-value="value" filter fluid :disabled="disabled || !form.districtId" :invalid="Boolean(errors.communeId)" @change="emit('clear-error','communeId')" />
                <small v-if="msg('communeId')" class="p-error">{{ msg("communeId") }}</small>
            </div>
        </div>
    </section>
    <section class="enterprise-form-section">
        <h3 class="enterprise-form-section__title">{{ t("organization.location.basicInformation") }}</h3>
        <div class="enterprise-form-grid">
            <div class="enterprise-form-field"><label>{{ t("organization.location.code") }} *</label><InputText v-model="form.code" fluid :disabled="disabled" :invalid="Boolean(errors.code)" @blur="emit('normalize-code')" @input="emit('clear-error','code')"/><small v-if="msg('code')" class="p-error">{{ msg("code") }}</small></div>
            <div class="enterprise-form-field"><label>{{ t("organization.location.name") }} *</label><InputText v-model="form.name" fluid :disabled="disabled" :invalid="Boolean(errors.name)" @input="emit('clear-error','name')"/><small v-if="msg('name')" class="p-error">{{ msg("name") }}</small></div>
            <div v-if="entity === 'countries'" class="enterprise-form-field"><label>{{ t("organization.location.nationality") }}</label><InputText v-model="form.nationality" fluid :disabled="disabled"/></div>
            <div v-if="entity === 'countries'" class="enterprise-form-field"><label>{{ t("organization.location.phoneCode") }}</label><InputText v-model="form.phoneCode" fluid :disabled="disabled"/></div>
            <div class="enterprise-form-field"><label>{{ t("common.status") }}</label><Select v-model="form.status" :options="statusOptions" option-label="label" option-value="value" fluid :disabled="disabled"/></div>
        </div>
    </section>
    <section class="enterprise-form-section"><h3 class="enterprise-form-section__title">{{ t("organization.location.additionalInformation") }}</h3><div class="enterprise-form-field enterprise-form-field--full"><label>{{ t("common.description") }}</label><Textarea v-model="form.description" rows="3" auto-resize fluid :disabled="disabled"/></div></section>
</form>
</template>
