<script setup>
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Textarea from "primevue/textarea"

defineProps({
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    companyName: { type: String, default: "—" },
    branchName: { type: String, default: "—" },
    editing: Boolean,
    disabled: Boolean,
})
const emit = defineEmits(["normalize-code", "clear-error"])
const editStatuses = [{ label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }]
</script>

<template>
    <div class="exit-form">
        <div class="exit-form__scope">
            <div><small>Company</small><strong>{{ companyName }}</strong></div>
            <i class="pi pi-angle-right" />
            <div><small>Branch</small><strong>{{ branchName }}</strong></div>
        </div>

        <label class="field"><span>Code <b>*</b></span><InputText v-model="form.code" :disabled="disabled || editing" maxlength="40" @input="emit('clear-error', 'code'); emit('normalize-code')" /><small v-if="errors.code" class="error">{{ Array.isArray(errors.code) ? errors.code[0] : errors.code }}</small></label>
        <label class="field"><span>Exit Reason <b>*</b></span><InputText v-model="form.name" :disabled="disabled" maxlength="180" @input="emit('clear-error', 'name')" /><small v-if="errors.name" class="error">{{ Array.isArray(errors.name) ? errors.name[0] : errors.name }}</small></label>
        <label class="field"><span>Status</span><Select v-model="form.status" :disabled="disabled" :options="editStatuses" option-label="label" option-value="value" /></label>
        <label class="field field--wide"><span>Description</span><Textarea v-model="form.description" :disabled="disabled" rows="3" maxlength="800" /><small>{{ form.description?.length || 0 }}/800</small></label>
    </div>
</template>

<style scoped>
.exit-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem 1rem; }
.exit-form__scope { grid-column: 1/-1; display: flex; align-items: center; gap: 1rem; padding: .7rem .85rem; border: 1px solid var(--p-content-border-color); border-radius: .55rem; background: var(--p-surface-50); }
.exit-form__scope div { display: grid; gap: .15rem; }.exit-form__scope small { color: var(--p-text-muted-color); }.exit-form__scope i { color: var(--p-text-muted-color); }
.field { display: grid; gap: .3rem; min-width: 0; font-size: .76rem; font-weight: 600; }.field b,.error { color: var(--p-red-500); }.field--wide { grid-column: 1/-1; }.field--wide small { justify-self: end; color: var(--p-text-muted-color); font-weight: 400; }
.field :deep(.p-inputtext),.field :deep(.p-inputnumber),.field :deep(.p-select),.field :deep(.p-textarea) { width: 100%; }
@media(max-width:640px){.exit-form{grid-template-columns:1fr}.field--wide,.exit-form__scope{grid-column:auto}}
</style>
