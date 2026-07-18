<script setup>
import InputText from "primevue/inputtext"
import Select from "primevue/select"
const props = defineProps({ form: { type: Object, required: true }, options: { type: Object, default: () => ({}) }, disabled: Boolean })
const groups = [
  { key: "birthAddress", label: "Birth Address" }, { key: "livingAddress", label: "Living Address" },
  { key: "permanentAddress", label: "Permanent Address" }, { key: "emergencyContactAddress", label: "Emergency Contact Address" },
  { key: "familyAddress", label: "Family Address" },
]
</script>
<template><div class="employee-addresses">
  <section v-for="group in groups" :key="group.key" class="employee-address"><h4>{{ group.label }}</h4><div class="employee-section-grid">
    <label v-for="field in ['countryId','provinceId','districtId','communeId','villageId']" :key="field" class="enterprise-form-field"><span>{{ ({countryId:'Country',provinceId:'Province',districtId:'District',communeId:'Commune',villageId:'Village'})[field] }}</span><Select v-model="form[group.key][field]" :options="options[field] || []" option-label="label" option-value="value" filter show-clear :disabled="disabled"/></label>
    <label class="enterprise-form-field enterprise-form-field--full"><span>Address Detail</span><InputText v-model="form[group.key].detail" :disabled="disabled" maxlength="500"/></label>
  </div></section>
</div></template>
<style scoped>.employee-addresses{display:grid;gap:1rem}.employee-address{display:grid;gap:.65rem;padding-bottom:1rem;border-bottom:1px solid var(--p-content-border-color,#e2e8f0)}.employee-address:last-child{padding-bottom:0;border-bottom:0}.employee-address h4{margin:0;font-size:.8rem}</style>
