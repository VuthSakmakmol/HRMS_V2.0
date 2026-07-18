<script setup>
import Checkbox from "primevue/checkbox"
import InputNumber from "primevue/inputnumber"
import Select from "primevue/select"
import Textarea from "primevue/textarea"

defineProps({
    form: { type: Object, required: true },
    options: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false },
    editing: { type: Boolean, default: false },
})

const skills = Object.freeze([
    { key: "singleNeedle", label: "Single Needle" },
    { key: "overlock", label: "Overlock" },
    { key: "coverstitch", label: "Coverstitch" },
    { key: "totalMachines", label: "Total Machines" },
])
</script>

<template>
    <div class="employee-additional">
        <section class="employee-additional__card">
            <div class="employee-additional__heading">
                <i class="pi pi-cog" />
                <div>
                    <h4>Machine Skills</h4>
                    <p>Enter the employee’s machine skill counts.</p>
                </div>
            </div>

            <div class="employee-section-grid employee-additional__skill-grid">
                <label
                    v-for="skill in skills"
                    :key="skill.key"
                    class="enterprise-form-field"
                >
                    <span>{{ skill.label }}</span>
                    <InputNumber
                        v-model="form.machineSkills[skill.key]"
                        :min="0"
                        :max="999"
                        :use-grouping="false"
                        :disabled="disabled"
                    />
                </label>
            </div>
        </section>

        <section class="employee-additional__card">
            <div class="employee-additional__heading">
                <i class="pi pi-shield" />
                <div>
                    <h4>Access & Approval</h4>
                    <p>Configure approval routing and optional system access.</p>
                </div>
            </div>

            <div class="employee-section-grid">
                <label class="enterprise-form-field">
                    <span>Approval Policy</span>
                    <Select
                        v-model="form.approvalPolicyId"
                        :options="options.approvalPolicyId || []"
                        option-label="label"
                        option-value="value"
                        filter
                        show-clear
                        :disabled="disabled"
                    />
                </label>

                <label
                    v-if="!editing"
                    class="enterprise-form-field employee-form-checkbox"
                >
                    <Checkbox
                        v-model="form.createAccount"
                        binary
                        :disabled="disabled"
                        input-id="employee-create-account"
                    />
                    <span>Create system account</span>
                </label>

                <label
                    v-if="!editing && form.createAccount"
                    class="enterprise-form-field"
                >
                    <span>Default Role</span>
                    <Select
                        v-model="form.defaultRoleId"
                        :options="options.defaultRoleId || []"
                        option-label="label"
                        option-value="value"
                        filter
                        show-clear
                        :disabled="disabled"
                    />
                </label>
            </div>
        </section>

        <section class="employee-additional__card employee-additional__card--full">
            <div class="employee-additional__heading">
                <i class="pi pi-file-edit" />
                <div>
                    <h4>Additional Note</h4>
                    <p>Keep optional information that does not belong to another section.</p>
                </div>
            </div>

            <label class="enterprise-form-field">
                <span>Note</span>
                <Textarea
                    v-model="form.note"
                    rows="4"
                    maxlength="1000"
                    :disabled="disabled"
                />
            </label>
        </section>
    </div>
</template>

<style scoped>
.employee-additional {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}

.employee-additional__card {
    display: grid;
    min-width: 0;
    align-content: start;
    gap: 0.8rem;
    padding: 0.85rem;
    background: var(--hrms-surface);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-sm);
}

.employee-additional__card--full {
    grid-column: 1 / -1;
}

.employee-additional__heading {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
}

.employee-additional__heading > i {
    display: grid;
    width: 1.8rem;
    height: 1.8rem;
    flex: 0 0 auto;
    place-items: center;
    color: var(--p-primary-600);
    background: var(--p-primary-50);
    border-radius: var(--hrms-radius-sm);
}

.employee-additional__heading h4,
.employee-additional__heading p {
    margin: 0;
}

.employee-additional__heading h4 {
    color: var(--hrms-text);
    font-size: 0.8rem;
}

.employee-additional__heading p {
    margin-top: 0.15rem;
    color: var(--hrms-text-muted);
    font-size: 0.68rem;
}

.employee-additional__skill-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}

@media (max-width: 760px) {
    .employee-additional {
        grid-template-columns: minmax(0, 1fr);
    }

    .employee-additional__card--full {
        grid-column: auto;
    }
}
</style>
