<script setup>
import InputText from "primevue/inputtext"

import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"

const props = defineProps({
    form: { type: Object, required: true },
    disabled: { type: Boolean, default: false },
})

const fields = Object.freeze([
    {
        numberKey: "idCardNo",
        numberLabel: "ID Card Number",
        dateKey: "idCardExpireDate",
        dateLabel: "ID Card Expiry Date",
        expiry: true,
    },
    {
        numberKey: "nssfNo",
        numberLabel: "NSSF Number",
    },
    {
        numberKey: "passportNo",
        numberLabel: "Passport Number",
        dateKey: "passportExpireDate",
        dateLabel: "Passport Expiry Date",
        expiry: true,
    },
    {
        dateKey: "visaExpireDate",
        dateLabel: "Visa Expiry Date",
        expiry: true,
    },
    {
        numberKey: "medicalCheckNo",
        numberLabel: "Medical Check Number",
        dateKey: "medicalCheckDate",
        dateLabel: "Medical Check Date",
    },
    {
        numberKey: "workingBookNo",
        numberLabel: "Working Book Number",
    },
])

function daysFromToday(value) {
    if (!value) return null
    const target = new Date(`${String(value).slice(0, 10)}T00:00:00`)
    if (Number.isNaN(target.getTime())) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

function expiryText(value) {
    const days = daysFromToday(value)
    if (days === null) return ""
    if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
    if (days === 0) return "Expires today"
    return `${days} day${days === 1 ? "" : "s"} remaining`
}

function expiryClass(value) {
    const days = daysFromToday(value)
    if (days === null) return ""
    if (days < 0) return "employee-document__expiry--expired"
    if (days <= 30) return "employee-document__expiry--warning"
    return "employee-document__expiry--safe"
}
</script>

<template>
    <div class="employee-documents">
        <section
            v-for="field in fields"
            :key="field.numberKey || field.dateKey"
            class="employee-document"
        >
            <label v-if="field.numberKey" class="enterprise-form-field">
                <span>{{ field.numberLabel }}</span>
                <InputText
                    v-model="form.documents[field.numberKey]"
                    :disabled="disabled"
                />
            </label>

            <label v-if="field.dateKey" class="enterprise-form-field">
                <span>{{ field.dateLabel }}</span>
                <EnterpriseCalendarDatePicker
                    v-model="form.documents[field.dateKey]"
                    :company-id="form.companyId"
                    :branch-id="form.branchId"
                    :disabled="disabled"
                    :show-status="false"
                />
                <small
                    v-if="field.expiry && form.documents[field.dateKey]"
                    class="employee-document__expiry"
                    :class="expiryClass(form.documents[field.dateKey])"
                >
                    {{ expiryText(form.documents[field.dateKey]) }}
                </small>
            </label>
        </section>
    </div>
</template>

<style scoped>
.employee-documents {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.7rem;
}

.employee-document {
    display: grid;
    min-width: 0;
    align-content: start;
    gap: 0.7rem;
    padding: 0.7rem;
    background: var(--hrms-surface-muted);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-sm);
}

.employee-document__expiry {
    font-weight: 700;
}

.employee-document__expiry--expired {
    color: var(--hrms-danger) !important;
}

.employee-document__expiry--warning {
    color: var(--hrms-warning) !important;
}

.employee-document__expiry--safe {
    color: var(--hrms-success) !important;
}

@media (max-width: 1000px) {
    .employee-documents {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 680px) {
    .employee-documents {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
