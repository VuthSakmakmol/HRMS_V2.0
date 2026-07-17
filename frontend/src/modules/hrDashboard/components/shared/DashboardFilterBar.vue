<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import Button from "primevue/button"
import Select from "primevue/select"

import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"

const props = defineProps({
    modelValue: {
        type: Object,
        required: true,
    },
    lookups: {
        type: Object,
        required: true,
    },
    loading: {
        type: Boolean,
        default: false,
    },
    lookupLoading: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits([
    "update:modelValue",
    "apply",
    "reset",
    "refresh",
    "scope-change",
])

const { t } = useI18n()

const companyOptions = computed(() => props.lookups.companies || [])

const branchOptions = computed(() =>
    (props.lookups.branches || []).filter((item) =>
        !props.modelValue.companyId ||
        item.companyId === props.modelValue.companyId,
    ),
)

const employeeTypeOptions = computed(() =>
    (props.lookups.employeeTypes || []).filter((item) =>
        !props.modelValue.companyId ||
        item.companyId === props.modelValue.companyId,
    ),
)

const selectedEmployeeTypeOption = computed(() => {
    if (!props.modelValue.employeeTypeFilterKey) return null

    return employeeTypeOptions.value.find(
        (item) => item.key === props.modelValue.employeeTypeFilterKey,
    ) || null
})

const selectedEmployeeTypeAllowedPositionIds = computed(() =>
    new Set(selectedEmployeeTypeOption.value?.positionIds || []),
)

const selectedEmployeeTypeUsesAllPositions = computed(() => {
    if (!selectedEmployeeTypeOption.value) return true

    return selectedEmployeeTypeOption.value.positionAssignmentMode === "ALL_POSITIONS"
})

const rawDepartmentOptions = computed(() =>
    (props.lookups.departments || []).filter((item) =>
        (!props.modelValue.companyId ||
            item.companyId === props.modelValue.companyId) &&
        (!props.modelValue.branchId ||
            item.branchId === props.modelValue.branchId),
    ),
)

const rawPositionOptions = computed(() =>
    (props.lookups.positions || []).filter((item) =>
        (!props.modelValue.companyId ||
            item.companyId === props.modelValue.companyId) &&
        (!props.modelValue.branchId ||
            item.branchId === props.modelValue.branchId),
    ),
)

function positionAllowedByEmployeeType(position) {
    if (!selectedEmployeeTypeOption.value) return true
    if (selectedEmployeeTypeUsesAllPositions.value) return true

    return selectedEmployeeTypeAllowedPositionIds.value.has(position.id)
}

function departmentAllowedByEmployeeType(department) {
    if (!selectedEmployeeTypeOption.value) return true
    if (selectedEmployeeTypeUsesAllPositions.value) return true

    return rawPositionOptions.value.some((position) =>
        position.departmentId === department.id &&
        positionAllowedByEmployeeType(position),
    )
}

function lineAllowedByEmployeeType(line) {
    if (!selectedEmployeeTypeOption.value) return true
    if (selectedEmployeeTypeUsesAllPositions.value) return true

    const linePositionIds = line.positionIds || []

    if (linePositionIds.length > 0) {
        return linePositionIds.some((positionId) =>
            selectedEmployeeTypeAllowedPositionIds.value.has(positionId),
        )
    }

    return rawPositionOptions.value.some((position) =>
        position.departmentId === line.departmentId &&
        positionAllowedByEmployeeType(position),
    )
}

const departmentOptions = computed(() =>
    rawDepartmentOptions.value.filter(departmentAllowedByEmployeeType),
)

const positionOptions = computed(() =>
    rawPositionOptions.value.filter((item) =>
        (!props.modelValue.departmentId ||
            item.departmentId === props.modelValue.departmentId) &&
        positionAllowedByEmployeeType(item),
    ),
)

const lineOptions = computed(() =>
    (props.lookups.lines || []).filter((item) =>
        (!props.modelValue.companyId ||
            item.companyId === props.modelValue.companyId) &&
        (!props.modelValue.branchId ||
            item.branchId === props.modelValue.branchId) &&
        (!props.modelValue.departmentId ||
            item.departmentId === props.modelValue.departmentId) &&
        lineAllowedByEmployeeType(item),
    ),
)

function optionLabel(item) {
    return item.label || (item.code ? `${item.code} - ${item.name}` : item.name)
}

function updateField(field, value, dependentFields = []) {
    const nextValue = {
        ...props.modelValue,
        [field]: value || undefined,
    }

    for (const dependentField of dependentFields) {
        nextValue[dependentField] = undefined
    }

    emit("update:modelValue", nextValue)

    if (["companyId", "branchId", "departmentId"].includes(field)) {
        emit("scope-change", nextValue)
    }
}
</script>

<template>
    <section
        class="dashboard-filter-bar hrms-compact"
        :aria-busy="loading"
    >
        <div class="dashboard-filter-bar__fields">
            <EnterpriseCalendarDatePicker
                input-id="dashboard-start-date"
                class="dashboard-filter-field dashboard-filter-field--date"
                :model-value="modelValue.startDate || ''"
                :company-id="modelValue.companyId || ''"
                :branch-id="modelValue.branchId || ''"
                :max-date="modelValue.endDate || ''"
                date-format="dd/mm/yy"
                append-to="body"
                :base-z-index="21000"
                status-display="dot"
                compact
                show-status
                :placeholder="t('hrDashboard.filters.startDate')"
                @update:model-value="updateField('startDate', $event)"
            />

            <EnterpriseCalendarDatePicker
                input-id="dashboard-end-date"
                class="dashboard-filter-field dashboard-filter-field--date"
                :model-value="modelValue.endDate || ''"
                :company-id="modelValue.companyId || ''"
                :branch-id="modelValue.branchId || ''"
                :min-date="modelValue.startDate || ''"
                date-format="dd/mm/yy"
                append-to="body"
                :base-z-index="21000"
                status-display="dot"
                compact
                show-status
                :placeholder="t('hrDashboard.filters.endDate')"
                @update:model-value="updateField('endDate', $event)"
            />

            <Select
                class="dashboard-filter-field"
                :model-value="modelValue.companyId"
                :options="companyOptions"
                :option-label="optionLabel"
                option-value="id"
                :placeholder="t('hrDashboard.filters.allCompanies')"
                show-clear
                filter
                :loading="lookupLoading"
                @update:model-value="updateField(
                    'companyId',
                    $event,
                    [
                        'branchId',
                        'employeeTypeFilterKey',
                        'departmentId',
                        'positionId',
                        'lineId',
                    ],
                )"
            />

            <Select
                class="dashboard-filter-field"
                :model-value="modelValue.branchId"
                :options="branchOptions"
                :option-label="optionLabel"
                option-value="id"
                :placeholder="t('hrDashboard.filters.allBranches')"
                show-clear
                filter
                :loading="lookupLoading"
                @update:model-value="updateField(
                    'branchId',
                    $event,
                    ['departmentId', 'positionId', 'lineId'],
                )"
            />

            <Select
                class="dashboard-filter-field dashboard-filter-field--employee-type"
                :model-value="modelValue.employeeTypeFilterKey"
                :options="employeeTypeOptions"
                :option-label="optionLabel"
                option-value="key"
                :placeholder="t('hrDashboard.filters.allEmployeeTypes')"
                show-clear
                filter
                :loading="lookupLoading"
                @update:model-value="updateField(
                    'employeeTypeFilterKey',
                    $event,
                    ['departmentId', 'positionId', 'lineId'],
                )"
            />

            <Select
                class="dashboard-filter-field"
                :model-value="modelValue.departmentId"
                :options="departmentOptions"
                :option-label="optionLabel"
                option-value="id"
                :placeholder="t('hrDashboard.filters.allDepartments')"
                show-clear
                filter
                :loading="lookupLoading"
                @update:model-value="updateField(
                    'departmentId',
                    $event,
                    ['positionId', 'lineId'],
                )"
            />

            <Select
                class="dashboard-filter-field"
                :model-value="modelValue.positionId"
                :options="positionOptions"
                :option-label="optionLabel"
                option-value="id"
                :placeholder="t('hrDashboard.filters.allPositions')"
                show-clear
                filter
                :loading="lookupLoading"
                @update:model-value="updateField('positionId', $event)"
            />

            <Select
                class="dashboard-filter-field"
                :model-value="modelValue.lineId"
                :options="lineOptions"
                :option-label="optionLabel"
                option-value="id"
                :placeholder="t('hrDashboard.filters.allLines')"
                show-clear
                filter
                :loading="lookupLoading"
                @update:model-value="updateField('lineId', $event)"
            />
        </div>

        <div class="dashboard-filter-bar__actions">
            <Button
                icon="pi pi-filter"
                :label="t('common.apply')"
                :loading="loading"
                @click="emit('apply')"
            />

            <Button
                severity="secondary"
                outlined
                icon="pi pi-times"
                :label="t('common.clear')"
                :disabled="loading"
                @click="emit('reset')"
            />

            <Button
                severity="secondary"
                outlined
                icon="pi pi-refresh"
                :aria-label="t('common.refresh')"
                :loading="loading"
                @click="emit('refresh')"
            />
        </div>
    </section>
</template>

<style scoped>
.dashboard-filter-bar {
    position: relative;
    z-index: 12000;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    width: 100%;
    min-width: 0;
    margin: 0;
    padding: 0.5rem 0.875rem;
    background: var(--hrms-surface);
    border-top: 0;
    pointer-events: auto;
}

.dashboard-filter-bar__fields {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
}

.dashboard-filter-bar__actions {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.35rem;
}

.dashboard-filter-field {
    flex: 1 1 9.25rem;
    min-width: 8rem;
    max-width: 14rem;
}

.dashboard-filter-field--date {
    flex: 0 1 12rem;
    min-width: 10rem;
    max-width: 12rem;
}

.dashboard-filter-field--employee-type {
    flex-basis: 13rem;
    max-width: 18rem;
}

:deep(.dashboard-filter-field),
:deep(.dashboard-filter-field > .p-component),
:deep(.dashboard-filter-field > .p-inputtext),
:deep(.dashboard-filter-field > .p-select),
:deep(.dashboard-filter-field > .p-datepicker),
:deep(.dashboard-filter-field .p-datepicker),
:deep(.dashboard-filter-field .p-inputtext) {
    width: 100%;
}

:deep(.internal-calendar-picker) {
    position: relative;
}

:deep(.internal-calendar-picker__status--dot) {
    position: absolute;
    top: 50%;
    right: 2.4rem;
    z-index: 2;
    min-height: auto;
    transform: translateY(-50%);
    pointer-events: none;
}

:deep(.internal-calendar-picker__dot) {
    display: block;
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 999px;
    box-shadow: 0 0 0 2px var(--hrms-surface);
}

:deep(.internal-calendar-picker),
:deep(.internal-calendar-picker .p-datepicker),
:deep(.internal-calendar-picker .p-inputtext),
:deep(.internal-calendar-picker .p-button),
:deep(.internal-calendar-picker .p-datepicker-input-icon-container) {
    pointer-events: auto;
}

@media (max-width: 760px) {
    .dashboard-filter-bar {
        align-items: stretch;
        flex-direction: column;
        padding: 0.5rem 0.625rem;
    }

    .dashboard-filter-bar__actions {
        width: 100%;
    }

    .dashboard-filter-bar__actions :deep(.p-button) {
        flex: 1 1 auto;
    }

    .dashboard-filter-field,
    .dashboard-filter-field--date,
    .dashboard-filter-field--employee-type {
        flex: 1 1 10rem;
        max-width: none;
    }
}

@media (max-width: 520px) {
    .dashboard-filter-bar__fields {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        width: 100%;
    }

    .dashboard-filter-field,
    .dashboard-filter-field--date,
    .dashboard-filter-field--employee-type {
        width: 100%;
        min-width: 0;
    }
}
</style>
