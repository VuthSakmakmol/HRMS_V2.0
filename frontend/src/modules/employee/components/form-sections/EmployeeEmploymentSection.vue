<script setup>
import { watch } from "vue"

import Select from "primevue/select"
import Textarea from "primevue/textarea"

import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import {
    EMPLOYMENT_STATUS_OPTIONS,
    RECORD_STATUS_OPTIONS,
} from "../../config/employee.filters.js"

const props = defineProps({
    form: { type: Object, required: true },
    options: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false },
})

watch(
    () => props.form.employmentStatus,
    (status) => {
        if (status === "WORKING") {
            props.form.resignDate = ""
            props.form.exitReasonId = null
            props.form.resignReason = ""
        }
    },
)
</script>

<template>
    <div class="employee-section-grid">
        <label class="enterprise-form-field">
            <span>Join Date *</span>
            <EnterpriseCalendarDatePicker
                v-model="form.joinDate"
                :company-id="form.companyId"
                :branch-id="form.branchId"
                :disabled="disabled"
                :show-status="false"
            />
        </label>

        <label class="enterprise-form-field">
            <span>Employment Status</span>
            <Select
                v-model="form.employmentStatus"
                :options="EMPLOYMENT_STATUS_OPTIONS.filter((item) => item.value !== 'ALL')"
                option-label="label"
                option-value="value"
                :disabled="disabled"
            />
        </label>

        <label class="enterprise-form-field">
            <span>Record Status</span>
            <Select
                v-model="form.recordStatus"
                :options="RECORD_STATUS_OPTIONS.filter((item) => !['ALL', 'ARCHIVED'].includes(item.value))"
                option-label="label"
                option-value="value"
                :disabled="disabled"
            />
        </label>

        <label v-if="form.employmentStatus !== 'WORKING'" class="enterprise-form-field">
            <span>Resign Date *</span>
            <EnterpriseCalendarDatePicker
                v-model="form.resignDate"
                :company-id="form.companyId"
                :branch-id="form.branchId"
                :min-date="form.joinDate"
                :disabled="disabled"
                :show-status="false"
            />
        </label>

        <template v-if="form.employmentStatus !== 'WORKING' && form.resignDate">
            <label class="enterprise-form-field">
                <span>Exit Reason</span>
                <Select
                    v-model="form.exitReasonId"
                    :options="options.exitReasonId || []"
                    option-label="label"
                    option-value="value"
                    filter
                    show-clear
                    :disabled="disabled"
                />
            </label>

            <label class="enterprise-form-field enterprise-form-field--full">
                <span>Resign Reason</span>
                <Textarea
                    v-model="form.resignReason"
                    rows="2"
                    :disabled="disabled"
                />
            </label>
        </template>

        <label class="enterprise-form-field">
            <span>Recruitment Channel</span>
            <Select
                v-model="form.recruitmentChannelId"
                :options="options.recruitmentChannelId || []"
                option-label="label"
                option-value="value"
                filter
                show-clear
                :disabled="disabled"
            />
        </label>

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
