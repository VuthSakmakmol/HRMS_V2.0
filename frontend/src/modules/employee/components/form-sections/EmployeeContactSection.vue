<script setup>
import { watch } from "vue"

import InputText from "primevue/inputtext"
import Select from "primevue/select"

import { MARITAL_STATUS_OPTIONS } from "../../config/employee.filters.js"

const props = defineProps({
    form: { type: Object, required: true },
    errors: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false },
})

const emit = defineEmits(["clear-error"])

function fieldError(field) {
    const value = props.errors?.[field]
    return Array.isArray(value) ? value[0] : value || ""
}

function digitsOnly(field, value) {
    props.form[field] = String(value || "").replace(/\D/g, "")
    emit("clear-error", field)
}

function textOnly(event) {
    props.form.nationality = String(event?.target?.value || "").replace(
        /[^\p{L}\s'-]/gu,
        "",
    )
}

watch(
    () => props.form.maritalStatus,
    (status) => {
        if (status !== "MARRIED") {
            props.form.spouseName = ""
            props.form.spouseContactNumber = ""
        }
    },
)
</script>

<template>
    <div class="employee-section-grid">
        <label class="enterprise-form-field">
            <span>Email</span>
            <InputText
                v-model.trim="form.email"
                type="email"
                autocomplete="email"
                :invalid="Boolean(fieldError('email'))"
                :disabled="disabled"
                @input="emit('clear-error', 'email')"
            />
            <small v-if="fieldError('email')">{{ fieldError('email') }}</small>
        </label>

        <label class="enterprise-form-field">
            <span>Phone Number <strong class="employee-required-star">*</strong></span>
            <InputText
                :model-value="form.phoneNumber"
                inputmode="numeric"
                autocomplete="tel"
                maxlength="40"
                :invalid="Boolean(fieldError('phoneNumber'))"
                :disabled="disabled"
                @update:model-value="digitsOnly('phoneNumber', $event)"
            />
            <small v-if="fieldError('phoneNumber')">{{ fieldError('phoneNumber') }}</small>
        </label>

        <label class="enterprise-form-field">
            <span>Emergency/Agent Person</span>
            <InputText v-model="form.agentPerson" :disabled="disabled" />
        </label>

        <label class="enterprise-form-field">
            <span>Emergency/Agent Phone</span>
            <InputText
                :model-value="form.agentPhoneNumber"
                inputmode="numeric"
                maxlength="40"
                :disabled="disabled"
                @update:model-value="digitsOnly('agentPhoneNumber', $event)"
            />
        </label>

        <label class="enterprise-form-field">
            <span>Marital Status</span>
            <Select
                v-model="form.maritalStatus"
                :options="MARITAL_STATUS_OPTIONS"
                option-label="label"
                option-value="value"
                :disabled="disabled"
            />
        </label>

        <label class="enterprise-form-field">
            <span>Nationality</span>
            <InputText
                :model-value="form.nationality"
                :disabled="disabled"
                @input="textOnly"
            />
        </label>

        <template v-if="form.maritalStatus === 'MARRIED'">
            <label class="enterprise-form-field">
                <span>Spouse Name</span>
                <InputText v-model="form.spouseName" :disabled="disabled" />
            </label>

            <label class="enterprise-form-field">
                <span>Spouse Contact Number</span>
                <InputText
                    :model-value="form.spouseContactNumber"
                    inputmode="numeric"
                    maxlength="40"
                    :disabled="disabled"
                    @update:model-value="digitsOnly('spouseContactNumber', $event)"
                />
            </label>
        </template>

        <label class="enterprise-form-field">
            <span>Education</span>
            <InputText v-model="form.education" :disabled="disabled" />
        </label>

        <label class="enterprise-form-field">
            <span>Religion</span>
            <InputText v-model="form.religion" :disabled="disabled" />
        </label>
    </div>
</template>
