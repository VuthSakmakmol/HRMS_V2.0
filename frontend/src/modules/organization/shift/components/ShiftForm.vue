<script setup>
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Textarea from "primevue/textarea"
import Message from "primevue/message"
import { computed, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { fetchAttendancePolicies } from "@/modules/attendance/services/attendance.api.js"

const props = defineProps({
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    companyName: { type: String, default: "—" },
    branchName: { type: String, default: "—" },
    disabled: { type: Boolean, default: false },
})
const emit = defineEmits(["clear-error"])
const { t } = useI18n()
const policyOptions = ref([])
const loadingPolicies = ref(false)

const statusOptions = computed(() => [
    { label: t("organization.shift.statusActive"), value: "ACTIVE" },
    { label: t("organization.shift.statusInactive"), value: "INACTIVE" },
])
const overnight = computed(() => Boolean(props.form.startTime && props.form.endTime && props.form.endTime <= props.form.startTime))

function message(field) {
    const value = props.errors?.[field]
    const key = Array.isArray(value) ? value[0] : value
    if (!key) return ""
    const translated = t(key)
    return translated === key ? key : translated
}
function normalizeCode() {
    props.form.code = String(props.form.code ?? "").trimStart().toUpperCase()
    emit("clear-error", "code")
}
async function loadPolicies() {
    if (!props.form.companyId || !props.form.branchId) {
        policyOptions.value = []
        return
    }
    loadingPolicies.value = true
    try {
        const result = await fetchAttendancePolicies({
            companyId: props.form.companyId,
            branchId: props.form.branchId,
            status: "ACTIVE",
            page: 1,
            limit: 100,
        })
        policyOptions.value = (result?.items || []).map((item) => ({
            label: `${item.code} — ${item.name}`,
            value: item.id,
        }))
    } finally {
        loadingPolicies.value = false
    }
}
watch(() => [props.form.companyId, props.form.branchId], loadPolicies, { immediate: true })
</script>

<template>
    <form class="shift-form" @submit.prevent>
        <section class="shift-form__section">
            <h3>Organization</h3>
            <div class="shift-form__grid">
                <label class="enterprise-form-field"><span>Company *</span><InputText :model-value="companyName" disabled /></label>
                <label class="enterprise-form-field"><span>Branch *</span><InputText :model-value="branchName" disabled /></label>
            </div>
        </section>

        <section class="shift-form__section">
            <h3>Shift Information</h3>
            <div class="shift-form__grid">
                <label class="enterprise-form-field"><span>Shift Code *</span><InputText v-model="form.code" maxlength="30" :disabled="disabled" @input="normalizeCode" /><small v-if="message('code')">{{ message('code') }}</small></label>
                <label class="enterprise-form-field"><span>Shift Name *</span><InputText v-model="form.name" maxlength="160" :disabled="disabled" @input="emit('clear-error','name')" /><small v-if="message('name')">{{ message('name') }}</small></label>
                <label class="enterprise-form-field"><span>Attendance Policy</span><Select v-model="form.attendancePolicyId" :options="policyOptions" option-label="label" option-value="value" show-clear filter :loading="loadingPolicies" :disabled="disabled" placeholder="Use system defaults" /><small v-if="message('attendancePolicyId')">{{ message('attendancePolicyId') }}</small></label>
                <label class="enterprise-form-field"><span>Status</span><Select v-model="form.status" :options="statusOptions" option-label="label" option-value="value" :disabled="disabled" /></label>
            </div>
        </section>

        <section class="shift-form__section">
            <h3>Schedule</h3>
            <div class="shift-form__grid">
                <label class="enterprise-form-field"><span>Start Time *</span><InputText v-model="form.startTime" type="time" :disabled="disabled" /></label>
                <label class="enterprise-form-field"><span>End Time *</span><InputText v-model="form.endTime" type="time" :disabled="disabled" /></label>
                <label class="enterprise-form-field"><span>Break Start</span><InputText v-model="form.breakStartTime" type="time" :disabled="disabled" /></label>
                <label class="enterprise-form-field"><span>Break End</span><InputText v-model="form.breakEndTime" type="time" :disabled="disabled" /></label>
            </div>
            <Message :severity="overnight ? 'info' : 'secondary'" :closable="false">
                {{ overnight ? 'Overnight shift detected automatically. The end time belongs to the next calendar day.' : 'Normal same-day shift.' }}
            </Message>
        </section>

        <section class="shift-form__section">
            <h3>Description</h3>
            <label class="enterprise-form-field enterprise-form-field--full"><Textarea v-model="form.description" rows="3" maxlength="500" :disabled="disabled" /></label>
        </section>
    </form>
</template>

<style scoped>
.shift-form { display: grid; gap: 1rem; }
.shift-form__section { padding: 1rem; border: 1px solid var(--surface-border); border-radius: 10px; background: var(--surface-card); }
.shift-form__section h3 { margin: 0 0 .85rem; font-size: .95rem; }
.shift-form__grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .85rem; }
.enterprise-form-field { display: grid; gap: .35rem; font-size: .85rem; }
.enterprise-form-field small { color: var(--p-red-500); }
.enterprise-form-field--full { width: 100%; }
@media (max-width: 720px) { .shift-form__grid { grid-template-columns: 1fr; } }
</style>
