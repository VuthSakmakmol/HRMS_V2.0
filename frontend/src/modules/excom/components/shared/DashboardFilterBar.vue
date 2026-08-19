<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import Button from "primevue/button"
import Select from "primevue/select"
import MultiSelect from "primevue/multiselect"

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

const employeeTypeOptions = computed(() =>
    (props.lookups.employeeTypes || []).filter((item) =>
        (!props.modelValue.companyId ||
            item.companyId === props.modelValue.companyId) &&
        (!props.modelValue.branchId ||
            item.branchId === props.modelValue.branchId),
    ),
)

const employeeTypeParentOptions = computed(() =>
    employeeTypeOptions.value.filter((item) => item.type === "TYPE"),
)

const selectedEmployeeTypeKeys = computed(() => {
    const plural = Array.isArray(props.modelValue.employeeTypeFilterKeys)
        ? props.modelValue.employeeTypeFilterKeys
        : []

    if (plural.length) return plural
    if (props.modelValue.employeeTypeFilterKey) {
        return [props.modelValue.employeeTypeFilterKey]
    }

    return []
})

const selectedEmployeeTypeOptions = computed(() => {
    const optionMap = new Map(
        employeeTypeOptions.value.map((item) => [item.key, item]),
    )

    return selectedEmployeeTypeKeys.value
        .map((key) => optionMap.get(key))
        .filter(Boolean)
})

// Parent MultiSelect always displays the selected parent(s). If a child is
// selected, show its parent as selected in the first control and keep the
// child in the second control.
const selectedEmployeeTypeParentKeys = computed(() => {
    const keys = selectedEmployeeTypeOptions.value.map((item) =>
        item.type === "CHILD"
            ? `TYPE:${item.employeeTypeId}`
            : item.key,
    )

    return [...new Set(keys)]
})

const selectedSingleParentOption = computed(() => {
    if (selectedEmployeeTypeParentKeys.value.length !== 1) return null

    return employeeTypeParentOptions.value.find(
        (item) => item.key === selectedEmployeeTypeParentKeys.value[0],
    ) || null
})

const employeeTypeChildOptions = computed(() => {
    if (!selectedSingleParentOption.value) return []

    return employeeTypeOptions.value.filter((item) =>
        item.type === "CHILD" &&
        item.employeeTypeId === selectedSingleParentOption.value.employeeTypeId,
    )
})

const selectedEmployeeTypeChildKey = computed(() => {
    if (selectedEmployeeTypeOptions.value.length !== 1) return undefined

    const selected = selectedEmployeeTypeOptions.value[0]
    return selected?.type === "CHILD" ? selected.key : undefined
})

const selectedEmployeeTypeAllowedPositionIds = computed(() =>
    new Set(
        selectedEmployeeTypeOptions.value.flatMap(
            (item) => (item.positionIds || []).map(String),
        ),
    ),
)

const selectedEmployeeTypeUsesAllPositions = computed(() => {
    if (!selectedEmployeeTypeOptions.value.length) return true

    return selectedEmployeeTypeOptions.value.some(
        (item) => item.positionAssignmentMode === "ALL_POSITIONS",
    )
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
    if (!selectedEmployeeTypeOptions.value.length) return true
    if (selectedEmployeeTypeUsesAllPositions.value) return true

    return selectedEmployeeTypeAllowedPositionIds.value.has(String(position.id))
}

function departmentAllowedByEmployeeType(department) {
    if (!selectedEmployeeTypeOptions.value.length) return true
    if (selectedEmployeeTypeUsesAllPositions.value) return true

    return rawPositionOptions.value.some((position) =>
        position.departmentId === department.id &&
        positionAllowedByEmployeeType(position),
    )
}

function lineAllowedByEmployeeType(line) {
    if (!selectedEmployeeTypeOptions.value.length) return true
    if (selectedEmployeeTypeUsesAllPositions.value) return true

    const linePositionIds = line.positionIds || []

    if (linePositionIds.length > 0) {
        return linePositionIds.some((positionId) =>
            selectedEmployeeTypeAllowedPositionIds.value.has(String(positionId)),
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

const exitReasonOptions = computed(() =>
    (props.lookups.exitReasons || []).filter((item) =>
        (!item.companyId || !props.modelValue.companyId || item.companyId === props.modelValue.companyId) &&
        (!item.branchId || !props.modelValue.branchId || item.branchId === props.modelValue.branchId),
    ),
)

const shiftOptions = computed(() =>
    (props.lookups.shifts || []).filter((item) =>
        (!props.modelValue.companyId || item.companyId === props.modelValue.companyId) &&
        (!props.modelValue.branchId || item.branchId === props.modelValue.branchId),
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

function employeeTypeOptionLabel(item) {
    if (item?.type === "ALL") {
        return item.label || item.name
    }

    return item?.code || item?.name || item?.label || ""
}

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

    if (field === "departmentId") {
        emit("scope-change", nextValue)
    }
}

function updateEmployeeTypes(keys) {
    const normalizedKeys = [...new Set((keys || []).filter(Boolean))]
    const nextValue = {
        ...props.modelValue,
        employeeTypeFilterKeys: normalizedKeys,
        // Keep the legacy single key populated only for one selection. This
        // makes old cached/front-end code harmless while the plural field is
        // the source of truth for combined filtering.
        employeeTypeFilterKey:
            normalizedKeys.length === 1 ? normalizedKeys[0] : undefined,
        departmentId: undefined,
        positionId: undefined,
        lineId: undefined,
    }

    emit("update:modelValue", nextValue)
}

function updateEmployeeTypeChild(childKey) {
    const parentKey = selectedSingleParentOption.value?.key
    const selectedKey = childKey || parentKey

    updateEmployeeTypes(selectedKey ? [selectedKey] : [])
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
                :placeholder="t('excom.filters.startDate')"
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
                :placeholder="t('excom.filters.endDate')"
                @update:model-value="updateField('endDate', $event)"
            />

            <MultiSelect
                class="dashboard-filter-field dashboard-filter-field--employee-type"
                :model-value="selectedEmployeeTypeParentKeys"
                :options="employeeTypeParentOptions"
                :option-label="employeeTypeOptionLabel"
                option-value="key"
                :placeholder="t('excom.filters.allEmployeeTypes')"
                display="chip"
                filter
                :max-selected-labels="2"
                :loading="lookupLoading"
                @update:model-value="updateEmployeeTypes"
            />

            <Select
                v-if="employeeTypeChildOptions.length"
                class="dashboard-filter-field dashboard-filter-field--employee-type"
                :model-value="selectedEmployeeTypeChildKey"
                :options="employeeTypeChildOptions"
                :option-label="employeeTypeOptionLabel"
                option-value="key"
                :placeholder="t('excom.filters.allEmployeeTypeChildren')"
                show-clear
                filter
                :loading="lookupLoading"
                @update:model-value="updateEmployeeTypeChild"
            />

            <Select
                class="dashboard-filter-field"
                :model-value="modelValue.exitReasonId"
                :options="exitReasonOptions"
                :option-label="optionLabel"
                option-value="id"
                :placeholder="t('excom.filters.allExitReasons')"
                show-clear
                filter
                :loading="lookupLoading"
                @update:model-value="updateField('exitReasonId', $event)"
            />

            <Select
                class="dashboard-filter-field"
                :model-value="modelValue.shiftId"
                :options="shiftOptions"
                :option-label="optionLabel"
                option-value="id"
                :placeholder="t('excom.filters.allShifts')"
                show-clear
                filter
                :loading="lookupLoading"
                @update:model-value="updateField('shiftId', $event)"
            />

            <Select
                class="dashboard-filter-field"
                :model-value="modelValue.departmentId"
                :options="departmentOptions"
                :option-label="optionLabel"
                option-value="id"
                :placeholder="t('excom.filters.allDepartments')"
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
                :placeholder="t('excom.filters.allPositions')"
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
                :placeholder="t('excom.filters.allLines')"
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
    max-width: 20rem;
}

:deep(.dashboard-filter-field),
:deep(.dashboard-filter-field > .p-component),
:deep(.dashboard-filter-field > .p-inputtext),
:deep(.dashboard-filter-field > .p-select),
:deep(.dashboard-filter-field > .p-multiselect),
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
