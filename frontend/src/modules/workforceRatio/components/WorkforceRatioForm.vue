<script setup>
import InputNumber from "primevue/inputnumber"
import MultiSelect from "primevue/multiselect"
import Select from "primevue/select"
import { computed } from "vue"
import { useI18n } from "vue-i18n"

const props = defineProps({
    form: { type: Object, required: true },
    employeeTypes: { type: Array, default: () => [] },
    errors: { type: Object, default: () => ({}) },
    companyName: { type: String, default: "—" },
    branchName: { type: String, default: "—" },
    disabled: Boolean,
})

const emit = defineEmits(["clear-error"])
const { t } = useI18n()

const statusOptions = computed(() => [
    { label: t("common.active"), value: "ACTIVE" },
    { label: t("common.inactive"), value: "INACTIVE" },
])

function normalizeOptions(disabledIds = []) {
    const disabledSet = new Set((disabledIds || []).map(String))

    return props.employeeTypes.map((item) => ({
        label: item.label || `${item.code} - ${item.name}`,
        value: item.id,
        disabled: disabledSet.has(String(item.id)),
    }))
}

const directOptions = computed(() =>
    normalizeOptions(props.form.indirectEmployeeTypeIds),
)

const indirectOptions = computed(() =>
    normalizeOptions(props.form.directEmployeeTypeIds),
)

function fieldError(field) {
    const value = props.errors?.[field]

    if (!value) return ""
    return Array.isArray(value) ? value[0] || "" : value
}
</script>

<template>
    <div class="workforce-ratio-form">
        <div class="workforce-ratio-form__scope">
            <i class="pi pi-building" aria-hidden="true" />
            <div>
                <small>{{ t("workforceRatio.company") }}</small>
                <strong>{{ companyName }}</strong>
            </div>
            <div>
                <small>{{ t("workforceRatio.branch") }}</small>
                <strong>{{ branchName }}</strong>
            </div>
        </div>

        <div class="workforce-ratio-form__groups">
            <label class="workforce-ratio-form__group workforce-ratio-form__group--direct">
                <span>{{ t("workforceRatio.directEmployeeTypes") }} *</span>
                <MultiSelect
                    v-model="form.directEmployeeTypeIds"
                    :options="directOptions"
                    option-label="label"
                    option-value="value"
                    option-disabled="disabled"
                    display="chip"
                    filter
                    :disabled="disabled"
                    :placeholder="t('workforceRatio.selectDirect')"
                    @change="emit('clear-error', 'directEmployeeTypeIds')"
                />
                <small v-if="fieldError('directEmployeeTypeIds')" class="error">
                    {{ fieldError("directEmployeeTypeIds") }}
                </small>
                <small v-else class="hint">
                    {{ t("workforceRatio.directHint") }}
                </small>
            </label>

            <label class="workforce-ratio-form__group workforce-ratio-form__group--indirect">
                <span>{{ t("workforceRatio.indirectEmployeeTypes") }} *</span>
                <MultiSelect
                    v-model="form.indirectEmployeeTypeIds"
                    :options="indirectOptions"
                    option-label="label"
                    option-value="value"
                    option-disabled="disabled"
                    display="chip"
                    filter
                    :disabled="disabled"
                    :placeholder="t('workforceRatio.selectIndirect')"
                    @change="emit('clear-error', 'indirectEmployeeTypeIds')"
                />
                <small v-if="fieldError('indirectEmployeeTypeIds')" class="error">
                    {{ fieldError("indirectEmployeeTypeIds") }}
                </small>
                <small v-else class="hint">
                    {{ t("workforceRatio.indirectHint") }}
                </small>
            </label>
        </div>

        <section class="workforce-ratio-form__budget">
            <div class="workforce-ratio-form__budget-heading">
                <i class="pi pi-chart-line" aria-hidden="true" />
                <div>
                    <strong>{{ t("workforceRatio.budgetTitle") }}</strong>
                    <small>{{ t("workforceRatio.budgetHint") }}</small>
                </div>
            </div>

            <div class="workforce-ratio-form__budget-fields">
                <label>
                    <span>{{ t("workforceRatio.budgetYear") }} *</span>
                    <InputNumber
                        v-model="form.budgetYear"
                        :use-grouping="false"
                        :min="2000"
                        :max="2100"
                        :disabled="disabled"
                        @update:model-value="emit('clear-error', 'budgetYear')"
                    />
                    <small v-if="fieldError('budgetYear')" class="error">
                        {{ fieldError("budgetYear") }}
                    </small>
                </label>

                <label>
                    <span>{{ t("workforceRatio.budgetRatio") }} *</span>
                    <InputNumber
                        v-model="form.budgetRatio"
                        :min="0.01"
                        :max="100"
                        :min-fraction-digits="2"
                        :max-fraction-digits="4"
                        :use-grouping="false"
                        :disabled="disabled"
                        placeholder="1.01"
                        @update:model-value="emit('clear-error', 'budgetRatio')"
                    />
                    <small v-if="fieldError('budgetRatio')" class="error">
                        {{ fieldError("budgetRatio") }}
                    </small>
                </label>
            </div>
        </section>

        <label class="workforce-ratio-form__status">
            <span>{{ t("common.status") }}</span>
            <Select
                v-model="form.status"
                :options="statusOptions"
                option-label="label"
                option-value="value"
                :disabled="disabled"
            />
        </label>

        <div class="workforce-ratio-form__note">
            <i class="pi pi-info-circle" aria-hidden="true" />
            <span>{{ t("workforceRatio.sourceOfTruthNote") }}</span>
        </div>
    </div>
</template>

<style scoped>
.workforce-ratio-form {
    display: grid;
    gap: 1rem;
}

.workforce-ratio-form__scope {
    display: grid;
    grid-template-columns: auto repeat(2, minmax(0, 1fr));
    align-items: center;
    gap: 0.8rem;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--p-content-border-color, #dbe3ec);
    border-radius: 0.6rem;
    background: var(--p-surface-50, #f8fafc);
}

.workforce-ratio-form__scope i {
    color: #0b2d6b;
    font-size: 1.1rem;
}

.workforce-ratio-form__scope div {
    display: grid;
    gap: 0.15rem;
}

.workforce-ratio-form__scope small,
.hint,
.workforce-ratio-form__budget-heading small {
    color: var(--p-text-muted-color, #64748b);
}

.workforce-ratio-form__groups {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.9rem;
}

.workforce-ratio-form__group,
.workforce-ratio-form__status,
.workforce-ratio-form__budget-fields label {
    display: grid;
    gap: 0.35rem;
    min-width: 0;
    font-size: 0.78rem;
    font-weight: 700;
}

.workforce-ratio-form__group {
    padding: 0.9rem;
    border: 1px solid var(--p-content-border-color, #dbe3ec);
    border-radius: 0.65rem;
    background: #ffffff;
}

.workforce-ratio-form__group--direct {
    border-top: 3px solid #2563eb;
}

.workforce-ratio-form__group--indirect {
    border-top: 3px solid #0ea5e9;
}

.workforce-ratio-form__group :deep(.p-multiselect),
.workforce-ratio-form__status :deep(.p-select),
.workforce-ratio-form__budget-fields :deep(.p-inputnumber) {
    width: 100%;
}

.workforce-ratio-form__budget {
    display: grid;
    gap: 0.8rem;
    padding: 0.9rem;
    border: 1px solid #bfdbfe;
    border-radius: 0.65rem;
    background: #f8fbff;
}

.workforce-ratio-form__budget-heading {
    display: flex;
    align-items: center;
    gap: 0.6rem;
}

.workforce-ratio-form__budget-heading i {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: 50%;
    background: #dbeafe;
    color: #0b2d6b;
}

.workforce-ratio-form__budget-heading div {
    display: grid;
    gap: 0.1rem;
}

.workforce-ratio-form__budget-heading small {
    font-size: 0.7rem;
    font-weight: 500;
}

.workforce-ratio-form__budget-fields {
    display: grid;
    grid-template-columns: minmax(9rem, 0.65fr) minmax(12rem, 1fr);
    gap: 0.8rem;
}

.workforce-ratio-form__status {
    max-width: 14rem;
}

.workforce-ratio-form__note {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    padding: 0.7rem 0.8rem;
    border-radius: 0.55rem;
    background: #eff6ff;
    color: #334155;
    font-size: 0.74rem;
    line-height: 1.4;
}

.workforce-ratio-form__note i {
    margin-top: 0.1rem;
    color: #2563eb;
}

.error {
    color: var(--p-red-500, #ef4444);
}

@media (max-width: 720px) {
    .workforce-ratio-form__groups,
    .workforce-ratio-form__scope,
    .workforce-ratio-form__budget-fields {
        grid-template-columns: 1fr;
    }

    .workforce-ratio-form__scope > i {
        display: none;
    }
}
</style>
