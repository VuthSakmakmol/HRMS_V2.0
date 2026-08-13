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
const isMaternityStatus = (status) => status === "MATERNITY_LEAVE"
const isAbandonedReinstatement = () =>
    props.form._initialEmploymentStatus === "ABANDONED" &&
    props.form.employmentStatus === "WORKING"

function fieldError(field) {
    const value = props.errors?.[field]
    return Array.isArray(value) ? value[0] : value || ""
}

function normalizeDateKey(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/)
    return match ? `${match[1]}-${match[2]}-${match[3]}` : ""
}

function addCalendarDays(value, amount) {
    const key = normalizeDateKey(value)
    if (!key) return ""
    const [year, month, day] = key.split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day + amount, 12, 0, 0, 0))
    return date.toISOString().slice(0, 10)
}

function syncMaternityDates() {
    if (!isMaternityStatus(props.form.employmentStatus)) return
    const start = normalizeDateKey(props.form.maternityLeaveStartDate)
    props.form.maternityLeaveEndDate = start ? addCalendarDays(start, 89) : ""
    props.form.maternityExpectedReturnDate = start ? addCalendarDays(start, 90) : ""
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
        if (isMaternityStatus(status)) syncMaternityDates()
        if (!isAbandonedReinstatement()) {
            props.form.returnToWorkDate = ""
            props.form.returnToWorkNote = ""
            emit("clear-error", "returnToWorkDate")
            emit("clear-error", "returnToWorkNote")
        }
    },
)

watch(
    () => props.form.maternityLeaveStartDate,
    () => {
        emit("clear-error", "maternityLeaveStartDate")
        syncMaternityDates()
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

        <template v-if="isAbandonedReinstatement()">
            <label class="enterprise-form-field">
                <span>Return to Work Date <strong class="employee-required-star">*</strong></span>
                <EnterpriseCalendarDatePicker
                    v-model="form.returnToWorkDate"
                    :company-id="form.companyId"
                    :branch-id="form.branchId"
                    :min-date="form._initialExitDate || form.joinDate"
                    :max-date="new Date()"
                    :disabled="disabled"
                    :show-status="false"
                    :class="{ 'employee-calendar--invalid': Boolean(fieldError('returnToWorkDate')) }"
                    @update:model-value="emit('clear-error', 'returnToWorkDate')"
                />
                <small v-if="fieldError('returnToWorkDate')">{{ fieldError('returnToWorkDate') }}</small>
            </label>

            <label class="enterprise-form-field enterprise-form-field--span-2">
                <span>Return Reason / Note <strong class="employee-required-star">*</strong></span>
                <Textarea
                    v-model="form.returnToWorkNote"
                    rows="2"
                    :disabled="disabled"
                    :invalid="Boolean(fieldError('returnToWorkNote'))"
                    @input="emit('clear-error', 'returnToWorkNote')"
                />
                <small v-if="fieldError('returnToWorkNote')">{{ fieldError('returnToWorkNote') }}</small>
            </label>
        </template>

        <template v-if="isMaternityStatus(form.employmentStatus)">
            <label class="enterprise-form-field">
                <span>Maternity Leave Start Date <strong class="employee-required-star">*</strong></span>
                <EnterpriseCalendarDatePicker
                    v-model="form.maternityLeaveStartDate"
                    :company-id="form.companyId"
                    :branch-id="form.branchId"
                    :min-date="form.joinDate"
                    :disabled="disabled"
                    :show-status="false"
                    :class="{ 'employee-calendar--invalid': Boolean(fieldError('maternityLeaveStartDate')) }"
                    @update:model-value="emit('clear-error', 'maternityLeaveStartDate')"
                />
                <small v-if="fieldError('maternityLeaveStartDate')">{{ fieldError('maternityLeaveStartDate') }}</small>
            </label>

            <label class="enterprise-form-field">
                <span>Maternity Leave End Date</span>
                <EnterpriseCalendarDatePicker
                    v-model="form.maternityLeaveEndDate"
                    :company-id="form.companyId"
                    :branch-id="form.branchId"
                    disabled
                    :show-status="false"
                />
            </label>

            <label class="enterprise-form-field">
                <span>Expected Return Date</span>
                <EnterpriseCalendarDatePicker
                    v-model="form.maternityExpectedReturnDate"
                    :company-id="form.companyId"
                    :branch-id="form.branchId"
                    disabled
                    :show-status="false"
                />
            </label>
        </template>

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
