<script setup>
import { computed, reactive, ref, watch } from "vue"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Checkbox from "primevue/checkbox"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"

import {
    fetchManpowerPlanningGrid,
    saveManpowerPlanBatch,
} from "../services/manpowerPlan.api.js"

const props = defineProps({
    visible: {
        type: Boolean,
        default: false,
    },
    companies: {
        type: Array,
        default: () => [],
    },
    branches: {
        type: Array,
        default: () => [],
    },
    employeeTypes: {
        type: Array,
        default: () => [],
    },
    canSave: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(["update:visible", "saved"])
const toast = useToast()

const today = new Date()

const scope = reactive({
    companyId: "",
    branchId: "",
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    employeeTypeId: "",
    employeeTypeChildId: "",
})

const rows = ref([])
const selectedRows = ref([])
const search = ref("")
const fillBudget = ref(null)
const fillRoadmap = ref(null)
const loading = ref(false)
const saving = ref(false)
const loaded = ref(false)

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    label: String(index + 1),
    value: index + 1,
}))

const companyOptions = computed(() =>
    props.companies.map((item) => ({
        label: item.displayName || item.legalName || item.name || "-",
        value: item.id,
    })),
)

const branchOptions = computed(() =>
    props.branches
        .filter(
            (item) =>
                !scope.companyId || item.companyId === scope.companyId,
        )
        .map((item) => ({
            label: item.name,
            value: item.id,
        })),
)

const employeeTypeOptions = computed(() => [
    {
        label: "All employee types",
        value: "",
    },
    ...props.employeeTypes
        .filter(
            (item) =>
                !scope.companyId || item.companyId === scope.companyId,
        )
        .map((item) => ({
            label: item.name,
            value: item.id,
        })),
])

const employeeTypeChildOptions = computed(() => {
    const selectedType = props.employeeTypes.find(
        (item) => item.id === scope.employeeTypeId,
    )

    return [
        {
            label: "All child groups",
            value: "",
        },
        ...(selectedType?.children || []).map((item) => ({
            label: item.name,
            value: item.id,
        })),
    ]
})

const filteredRows = computed(() => {
    const keyword = search.value.trim().toLowerCase()

    if (!keyword) return rows.value

    return rows.value.filter((row) =>
        [
            row.department?.name,
            row.position?.name,
            row.line?.name,
            row.shift?.name,
            row.employeeTypeChildName,
        ]
            .filter(Boolean)
            .some((value) =>
                String(value).toLowerCase().includes(keyword),
            ),
    )
})

const summary = computed(() =>
    rows.value.reduce(
        (result, row) => {
            result.currentEmployees += Number(row.currentEmployees || 0)
            result.targetBudget += Number(row.targetBudget || 0)
            result.targetRoadmap += Number(row.targetRoadmap || 0)

            if (
                Number(row.targetBudget || 0) !== row._originalBudget ||
                Number(row.targetRoadmap || 0) !== row._originalRoadmap ||
                String(row.remark || "") !== row._originalRemark ||
                Boolean(row.archive)
            ) {
                result.changedRows += 1
            }

            return result
        },
        {
            currentEmployees: 0,
            targetBudget: 0,
            targetRoadmap: 0,
            changedRows: 0,
        },
    ),
)

function normalizeRow(row) {
    return {
        ...row,
        targetBudget: Number(row.targetBudget || 0),
        targetRoadmap: Number(row.targetRoadmap || 0),
        remark: row.remark || "",
        status: row.status || "ACTIVE",
        archive: false,
        _originalBudget: Number(row.targetBudget || 0),
        _originalRoadmap: Number(row.targetRoadmap || 0),
        _originalRemark: row.remark || "",
    }
}

function getErrorMessage(error) {
    return (
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        "Please review the entered information."
    )
}

function validateScope() {
    if (
        scope.companyId &&
        scope.branchId &&
        scope.year &&
        scope.month
    ) {
        return true
    }

    toast.add({
        severity: "warn",
        summary: "Planning scope required",
        detail: "Select company, branch, year and month.",
        life: 3500,
    })

    return false
}

async function loadGrid() {
    if (!validateScope()) return

    loading.value = true

    try {
        const result = await fetchManpowerPlanningGrid({
            companyId: scope.companyId,
            branchId: scope.branchId,
            year: Number(scope.year),
            month: Number(scope.month),
            employeeTypeId: scope.employeeTypeId || undefined,
            employeeTypeChildId:
                scope.employeeTypeChildId || undefined,
        })

        rows.value = (result.rows || []).map(normalizeRow)
        selectedRows.value = []
        loaded.value = true
    } catch (error) {
        toast.add({
            severity: "error",
            summary: "Failed to load planning grid",
            detail: getErrorMessage(error),
            life: 5000,
        })
    } finally {
        loading.value = false
    }
}

function fillSelectedRows() {
    const targetRows = selectedRows.value.length
        ? selectedRows.value
        : filteredRows.value

    for (const row of targetRows) {
        if (fillBudget.value !== null) {
            row.targetBudget = Number(fillBudget.value || 0)
        }

        if (fillRoadmap.value !== null) {
            row.targetRoadmap = Number(fillRoadmap.value || 0)
        }
    }
}

function clearSelection() {
    selectedRows.value = []
    fillBudget.value = null
    fillRoadmap.value = null
}

async function saveAll() {
    if (!props.canSave || !validateScope() || !rows.value.length) {
        return
    }

    saving.value = true

    try {
        const result = await saveManpowerPlanBatch({
            companyId: scope.companyId,
            branchId: scope.branchId,
            year: Number(scope.year),
            month: Number(scope.month),
            rows: rows.value.map((row) => ({
                id: row.id || undefined,
                departmentId: row.departmentId,
                positionId: row.positionId,
                lineId: row.lineId || null,
                shiftId: row.shiftId || null,
                employeeTypeId: row.employeeTypeId || null,
                employeeTypeChildId:
                    row.employeeTypeChildId || null,
                employeeTypeChildCode:
                    row.employeeTypeChildCode || "",
                employeeTypeChildName:
                    row.employeeTypeChildName || "",
                targetBudget: Number(row.targetBudget || 0),
                targetRoadmap: Number(row.targetRoadmap || 0),
                remark: String(row.remark || "").trim(),
                status: row.status || "ACTIVE",
                archive: Boolean(row.archive),
            })),
        })

        toast.add({
            severity: "success",
            summary: "Manpower plans saved",
            detail: `${Number(result.modified || 0) + Number(result.upserted || 0)} rows saved successfully.`,
            life: 3000,
        })

        await loadGrid()
        emit("saved")
    } catch (error) {
        toast.add({
            severity: "error",
            summary: "Batch save failed",
            detail: getErrorMessage(error),
            life: 5000,
        })
    } finally {
        saving.value = false
    }
}

function closeDialog() {
    emit("update:visible", false)
}

watch(
    () => scope.companyId,
    () => {
        scope.branchId = ""
        scope.employeeTypeId = ""
        scope.employeeTypeChildId = ""
        rows.value = []
        loaded.value = false
    },
)

watch(
    () => scope.employeeTypeId,
    () => {
        scope.employeeTypeChildId = ""
        loaded.value = false
    },
)

watch(
    () => [
        scope.branchId,
        scope.year,
        scope.month,
        scope.employeeTypeChildId,
    ],
    () => {
        loaded.value = false
    },
)
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        append-to="body"
        class="hrms-standard-dialog manpower-batch-dialog"
        header="Batch Manpower Planning"
        :draggable="false"
        :closable="!saving"
        :close-on-escape="!saving"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="hrms-dialog-form manpower-batch-form">
            <section class="hrms-form-section">
                <h3>Planning scope</h3>

                <div class="hrms-form-grid manpower-scope-grid">
                    <label class="hrms-form-field">
                        <span>Company</span>

                        <Select
                            v-model="scope.companyId"
                            :options="companyOptions"
                            option-label="label"
                            option-value="value"
                            placeholder="Select company"
                            filter
                        />
                    </label>

                    <label class="hrms-form-field">
                        <span>Branch</span>

                        <Select
                            v-model="scope.branchId"
                            :options="branchOptions"
                            option-label="label"
                            option-value="value"
                            placeholder="Select branch"
                            filter
                            :disabled="!scope.companyId"
                        />
                    </label>

                    <label class="hrms-form-field">
                        <span>Year</span>

                        <InputNumber
                            v-model="scope.year"
                            :use-grouping="false"
                            :min="2000"
                            :max="2100"
                            placeholder="Year"
                        />
                    </label>

                    <label class="hrms-form-field">
                        <span>Month</span>

                        <Select
                            v-model="scope.month"
                            :options="monthOptions"
                            option-label="label"
                            option-value="value"
                            placeholder="Select month"
                        />
                    </label>

                    <label class="hrms-form-field">
                        <span>Employee type</span>

                        <Select
                            v-model="scope.employeeTypeId"
                            :options="employeeTypeOptions"
                            option-label="label"
                            option-value="value"
                            placeholder="All employee types"
                            filter
                        />
                    </label>

                    <label class="hrms-form-field">
                        <span>Child group</span>

                        <Select
                            v-model="scope.employeeTypeChildId"
                            :options="employeeTypeChildOptions"
                            option-label="label"
                            option-value="value"
                            placeholder="All child groups"
                            filter
                            :disabled="!scope.employeeTypeId"
                        />
                    </label>
                </div>

                <div class="manpower-section-actions">
                    <Button
                        icon="pi pi-table"
                        label="Load Grid"
                        :loading="loading"
                        @click="loadGrid"
                    />
                </div>
            </section>

            <section
                v-if="loaded"
                class="hrms-form-section"
            >
                <h3>Batch entry tools</h3>

                <div class="manpower-tool-row">
                    <span class="app-filter-field app-filter-field--search manpower-grid-search">
                        <i class="pi pi-search" />

                        <InputText
                            v-model="search"
                            placeholder="Search department, position, line or shift"
                        />
                    </span>

                    <InputNumber
                        v-model="fillBudget"
                        :min="0"
                        :max="1000000"
                        :use-grouping="false"
                        placeholder="Fill budget"
                    />

                    <InputNumber
                        v-model="fillRoadmap"
                        :min="0"
                        :max="1000000"
                        :use-grouping="false"
                        placeholder="Fill roadmap"
                    />

                    <Button
                        severity="secondary"
                        outlined
                        icon="pi pi-arrow-down"
                        label="Fill Selected"
                        @click="fillSelectedRows"
                    />

                    <Button
                        severity="secondary"
                        outlined
                        icon="pi pi-times"
                        label="Clear"
                        @click="clearSelection"
                    />
                </div>

                <div class="manpower-summary-row">
                    <span>
                        Current
                        <strong>{{ summary.currentEmployees }}</strong>
                    </span>

                    <span>
                        Budget
                        <strong>{{ summary.targetBudget }}</strong>
                    </span>

                    <span>
                        Roadmap
                        <strong>{{ summary.targetRoadmap }}</strong>
                    </span>

                    <span>
                        Budget gap
                        <strong>
                            {{
                                summary.targetBudget -
                                summary.currentEmployees
                            }}
                        </strong>
                    </span>

                    <span>
                        Changed
                        <strong>{{ summary.changedRows }}</strong>
                    </span>
                </div>
            </section>

            <section
                v-if="loaded"
                class="hrms-form-section manpower-grid-section"
            >
                <h3>Manpower planning grid</h3>

                <div class="hrms-table-wrap manpower-grid-wrap">
                    <DataTable
                        v-model:selection="selectedRows"
                        class="hrms-standard-table hrms-standard-table--horizontal manpower-batch-table"
                        :value="filteredRows"
                        data-key="rowKey"
                        size="small"
                        striped-rows
                        scrollable
                        :loading="loading"
                        empty-message="No organization rows found."
                    >
                        <Column
                            selection-mode="multiple"
                            header-style="width: 3rem"
                            body-style="width: 3rem"
                        />

                        <Column
                            header="No"
                            style="min-width: 4rem"
                        >
                            <template #body="{ index }">
                                {{ index + 1 }}
                            </template>
                        </Column>

                        <Column
                            header="Department"
                            style="min-width: 12rem"
                        >
                            <template #body="{ data }">
                                {{ data.department?.name || "-" }}
                            </template>
                        </Column>

                        <Column
                            header="Position"
                            style="min-width: 12rem"
                        >
                            <template #body="{ data }">
                                {{ data.position?.name || "-" }}
                            </template>
                        </Column>

                        <Column
                            header="Line"
                            style="min-width: 10rem"
                        >
                            <template #body="{ data }">
                                {{ data.line?.name || "-" }}
                            </template>
                        </Column>

                        <Column
                            header="Shift"
                            style="min-width: 9rem"
                        >
                            <template #body="{ data }">
                                {{ data.shift?.name || "-" }}
                            </template>
                        </Column>

                        <Column
                            header="Child group"
                            style="min-width: 10rem"
                        >
                            <template #body="{ data }">
                                {{ data.employeeTypeChildName || "-" }}
                            </template>
                        </Column>

                        <Column
                            header="Current"
                            style="min-width: 7rem"
                        >
                            <template #body="{ data }">
                                {{ data.currentEmployees || 0 }}
                            </template>
                        </Column>

                        <Column
                            header="Budget"
                            style="min-width: 9rem"
                        >
                            <template #body="{ data }">
                                <InputNumber
                                    v-model="data.targetBudget"
                                    class="manpower-number-field"
                                    :min="0"
                                    :max="1000000"
                                    :use-grouping="false"
                                    input-class="manpower-number-input"
                                />
                            </template>
                        </Column>

                        <Column
                            header="Roadmap"
                            style="min-width: 9rem"
                        >
                            <template #body="{ data }">
                                <InputNumber
                                    v-model="data.targetRoadmap"
                                    class="manpower-number-field"
                                    :min="0"
                                    :max="1000000"
                                    :use-grouping="false"
                                    input-class="manpower-number-input"
                                />
                            </template>
                        </Column>

                        <Column
                            header="Gap"
                            style="min-width: 6rem"
                        >
                            <template #body="{ data }">
                                {{
                                    Number(data.targetBudget || 0) -
                                    Number(data.currentEmployees || 0)
                                }}
                            </template>
                        </Column>

                        <Column
                            header="Remark"
                            style="min-width: 15rem"
                        >
                            <template #body="{ data }">
                                <InputText
                                    v-model="data.remark"
                                    class="manpower-remark-field"
                                    placeholder="Remark"
                                />
                            </template>
                        </Column>

                        <Column
                            header="Archive"
                            style="min-width: 6rem"
                        >
                            <template #body="{ data }">
                                <Checkbox
                                    v-model="data.archive"
                                    binary
                                    :disabled="!data.id"
                                />
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </section>

            <div
                v-else
                class="manpower-empty-state"
            >
                Select the planning scope, then click
                <strong>Load Grid</strong>.
            </div>
        </div>

        <template #footer>
            <Button
                severity="secondary"
                outlined
                label="Cancel"
                :disabled="saving"
                @click="closeDialog"
            />

            <Button
                icon="pi pi-save"
                label="Save All"
                :loading="saving"
                :disabled="!canSave || !loaded || !rows.length"
                @click="saveAll"
            />
        </template>
    </Dialog>
</template>

<style scoped>
:global(.manpower-batch-dialog) {
    width: min(92rem, calc(100vw - 2rem));
    max-height: calc(100vh - 2rem);
    background: var(--hrms-surface);
}

:global(.manpower-batch-dialog .p-dialog-header),
:global(.manpower-batch-dialog .p-dialog-content),
:global(.manpower-batch-dialog .p-dialog-footer) {
    background: var(--hrms-surface);
}

:global(.manpower-batch-dialog .p-dialog-content) {
    max-height: calc(100vh - 10rem);
    overflow: auto;
}

.manpower-batch-form {
    min-width: 0;
}

.manpower-scope-grid {
    grid-template-columns: repeat(6, minmax(10rem, 1fr));
}

.manpower-section-actions {
    display: flex;
    justify-content: flex-end;
}

.manpower-tool-row {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.55rem;
    flex-wrap: wrap;
}

.manpower-tool-row > .p-inputnumber {
    width: 9.5rem;
}

.manpower-grid-search {
    width: min(22rem, 100%);
}

.manpower-summary-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    flex-wrap: wrap;
}

.manpower-summary-row > span {
    display: inline-flex;
    min-height: 2rem;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.65rem;
    color: var(--hrms-text-muted);
    background: var(--hrms-surface);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-sm);
    font-size: var(--hrms-font-size-sm);
}

.manpower-summary-row strong {
    color: var(--hrms-text);
}

.manpower-grid-section {
    min-width: 0;
}

.manpower-grid-wrap {
    max-height: 29rem;
    background: var(--hrms-surface);
}

.manpower-batch-table {
    min-width: 100%;
}

.manpower-number-field {
    width: 7rem;
}

:global(.manpower-number-input) {
    width: 100%;
    text-align: center;
}

.manpower-remark-field {
    width: 13rem;
}

.manpower-empty-state {
    display: grid;
    min-height: 10rem;
    place-items: center;
    padding: 1rem;
    color: var(--hrms-text-muted);
    background: var(--hrms-surface-muted);
    border: 1px dashed var(--hrms-border);
    border-radius: var(--hrms-radius-md);
    text-align: center;
}

@media (max-width: 1250px) {
    .manpower-scope-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

@media (max-width: 760px) {
    :global(.manpower-batch-dialog) {
        width: calc(100vw - 1rem);
        max-height: calc(100vh - 1rem);
    }

    .manpower-scope-grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .manpower-tool-row > *,
    .manpower-grid-search,
    .manpower-tool-row > .p-inputnumber {
        width: 100%;
    }
}
</style>
