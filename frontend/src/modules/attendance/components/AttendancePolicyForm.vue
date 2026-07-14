<script setup>
import Checkbox from "primevue/checkbox"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"

const model = defineModel({
    type: Object,
    required: true,
})

const props = defineProps({
    companies: {
        type: Array,
        default: () => [],
    },
    branches: {
        type: Array,
        default: () => [],
    },
})

const roundMethods = [
    { label: "Floor", value: "FLOOR" },
    { label: "Ceil", value: "CEIL" },
    { label: "Nearest", value: "NEAREST" },
]

const statusOptions = [
    { label: "Active", value: "ACTIVE" },
    { label: "Inactive", value: "INACTIVE" },
]
</script>

<template>
    <div class="hrms-form-grid">
        <label class="hrms-form-field">
            <span>Company</span>
            <Select
                v-model="model.companyId"
                :options="props.companies"
                option-label="displayName"
                option-value="id"
                placeholder="Select company"
                filter
            />
        </label>

        <label class="hrms-form-field">
            <span>Branch</span>
            <Select
                v-model="model.branchId"
                :options="props.branches"
                option-label="name"
                option-value="id"
                placeholder="All branches"
                filter
                show-clear
            />
        </label>

        <label class="hrms-form-field">
            <span>Code</span>
            <InputText v-model.trim="model.code" placeholder="Policy code" />
        </label>

        <label class="hrms-form-field">
            <span>Name</span>
            <InputText v-model.trim="model.name" placeholder="Policy name" />
        </label>

        <label class="hrms-form-field">
            <span>Grace In (minutes)</span>
            <InputNumber v-model="model.graceInMinutes" :min="0" :use-grouping="false" />
        </label>

        <label class="hrms-form-field">
            <span>Grace Out (minutes)</span>
            <InputNumber v-model="model.graceOutMinutes" :min="0" :use-grouping="false" />
        </label>

        <label class="hrms-form-field">
            <span>Minimum Worked Minutes</span>
            <InputNumber v-model="model.minimumWorkedMinutes" :min="0" :use-grouping="false" />
        </label>

        <label class="hrms-form-field">
            <span>Status</span>
            <Select
                v-model="model.status"
                :options="statusOptions"
                option-label="label"
                option-value="value"
            />
        </label>

        <label class="hrms-form-field">
            <span>Late Round Unit</span>
            <InputNumber v-model="model.lateRoundUnitMinutes" :min="1" :use-grouping="false" />
        </label>

        <label class="hrms-form-field">
            <span>Late Round Method</span>
            <Select
                v-model="model.lateRoundMethod"
                :options="roundMethods"
                option-label="label"
                option-value="value"
            />
        </label>

        <label class="hrms-form-field">
            <span>Early Leave Round Unit</span>
            <InputNumber v-model="model.earlyLeaveRoundUnitMinutes" :min="1" :use-grouping="false" />
        </label>

        <label class="hrms-form-field">
            <span>Early Leave Round Method</span>
            <Select
                v-model="model.earlyLeaveRoundMethod"
                :options="roundMethods"
                option-label="label"
                option-value="value"
            />
        </label>

        <div class="hrms-form-field">
            <span>Absence Rule</span>
            <div class="attendance-checkbox-row">
                <Checkbox
                    v-model="model.autoGenerateAbsent"
                    binary
                    input-id="policyAutoAbsent"
                />
                <label for="policyAutoAbsent">Automatically generate absence</label>
            </div>
        </div>

        <div class="hrms-form-field">
            <span>Sunday Rule</span>
            <div class="attendance-checkbox-row">
                <Checkbox
                    v-model="model.treatSundayAsRestDay"
                    binary
                    input-id="policySundayRest"
                />
                <label for="policySundayRest">Treat Sunday as rest day</label>
            </div>
        </div>
    </div>
</template>
