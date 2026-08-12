<script setup>
import { watch } from "vue"

import Select from "primevue/select"
import Textarea from "primevue/textarea"

import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import {
    EMPLOYMENT_STATUS_OPTIONS,
    RECORD_STATUS_OPTIONS,
} from "../../config/employee.filters.js"
import { EXIT_EMPLOYMENT_STATUSES } from "../../config/employee.form-validation.js"

const props = defineProps({
    form: { type: Object, required: true },
    options: { type: Object, default: () => ({}) },
    errors: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false },
})

const emit = defineEmits(["clear-error"])

const isExitStatus = (status) => EXIT_EMPLOYMENT_STATUSES.has(status)

function fieldError(field) {
    const value = props.errors?.[field]
    return Array.isArray(value) ? value[0] : value || ""
}

watch(
    () => props.form.employmentStatus,
    (status) => {
        emit("clear-error", "employmentStatus")
        if (!isExitStatus(status)) {
            props.form.resignDate = ""
            props.form.exitReasonId = null
            props.form.resignReason = ""
            emit("clear-error", "resignDate")
            emit("clear-error", "exitReasonId")
        }
    },
)
</script>

<template>
    <div class="employee-section-grid">
        <label class="enterprise-form-field">
            <span>Join Date <strong class="employee-required-star">*</strong></span>
            <EnterpriseCalendarDatePicker
                v-model="form.joinDate"
                :company-id="form.companyId"
                :branch-id="form.branchId"
                :disabled="disabled"
                :show-status="false"
                :class="{ 'employee-calendar--invalid': Boolean(fieldError('joinDate')) }"
                @update:model-value="emit('clear-error', 'joinDate')"
            />
            <small v-if="fieldError('joinDate')">{{ fieldError('joinDate') }}</small>
        </label>

        <label class="enterprise-form-field">
            <span>Recruitment Channel <strong class="employee-required-star">*</strong></span>
            <Select
                v-model="form.recruitmentChannelId"
                :options="options.recruitmentChannelId || []"
                option-label="label"
                option-value="value"
                filter
                :invalid="Boolean(fieldError('recruitmentChannelId'))"
                :disabled="disabled"
                @change="emit('clear-error', 'recruitmentChannelId')"
            />
            <small v-if="fieldError('recruitmentChannelId')">{{ fieldError('recruitmentChannelId') }}</small>
        </label>

        <label class="enterprise-form-field">
            <span>Employment Status <strong class="employee-required-star">*</strong></span>
            <Select
                v-model="form.employmentStatus"
                :options="EMPLOYMENT_STATUS_OPTIONS.filter((item) => item.value !== 'ALL')"
                option-label="label"
                option-value="value"
                :invalid="Boolean(fieldError('employmentStatus'))"
                :disabled="disabled"
            />
            <small v-if="fieldError('employmentStatus')">{{ fieldError('employmentStatus') }}</small>
        </label>

        <label class="enterprise-form-field">
            <span>Reporting Record Status</span>
            <Select
                v-model="form.recordStatus"
                :options="RECORD_STATUS_OPTIONS.filter((item) => !['ALL', 'ARCHIVED'].includes(item.value))"
                option-label="label"
                option-value="value"
                :disabled="disabled"
            />
        </label>

        <template v-if="isExitStatus(form.employmentStatus)">
            <label class="enterprise-form-field">
                <span>Exit Date <strong class="employee-required-star">*</strong></span>
                <EnterpriseCalendarDatePicker
                    v-model="form.resignDate"
                    :company-id="form.companyId"
                    :branch-id="form.branchId"
                    :min-date="form.joinDate"
                    :disabled="disabled"
                    :show-status="false"
                    :class="{ 'employee-calendar--invalid': Boolean(fieldError('resignDate')) }"
                    @update:model-value="emit('clear-error', 'resignDate')"
                />
                <small v-if="fieldError('resignDate')">{{ fieldError('resignDate') }}</small>
            </label>

            <label class="enterprise-form-field">
                <span>Exit Reason <strong class="employee-required-star">*</strong></span>
                <Select
                    v-model="form.exitReasonId"
                    :options="options.exitReasonId || []"
                    option-label="label"
                    option-value="value"
                    filter
                    :invalid="Boolean(fieldError('exitReasonId'))"
                    :disabled="disabled"
                    @change="emit('clear-error', 'exitReasonId')"
                />
                <small v-if="fieldError('exitReasonId')">{{ fieldError('exitReasonId') }}</small>
            </label>

            <label class="enterprise-form-field enterprise-form-field--span-2">
                <span>Exit Note</span>
                <Textarea
                    v-model="form.resignReason"
                    rows="2"
                    :disabled="disabled"
                    placeholder="Optional additional exit note"
                />
            </label>
        </template>

        <label class="enterprise-form-field">
            <span>Introducer Employee</span>
            <Select
                v-model="form.introducerEmployeeId"
                :options="options.introducerEmployeeId || []"
                option-label="label"
                option-value="value"
                filter
                show-clear
                :disabled="disabled"
            />
        </label>
    </div>
</template>

