<script setup>
import Button from "primevue/button"
import Checkbox from "primevue/checkbox"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import { computed, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import {
    getPlanningGrid,
    savePlanningGrid,
} from "../api/manpowerPlan.api.js"
import { createMonthOptions } from "../config/manpowerPlan.filters.js"

const props = defineProps({
    visible: { type: Boolean, default: false },
    employeeTypes: { type: Array, default: () => [] },
    canSave: { type: Boolean, default: false },
})

const emit = defineEmits(["update:visible", "saved"])
const { t, locale } = useI18n()
const toast = useToast()
const workspaceStore = useWorkspaceStore()

const scope = reactive({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
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
const expandedDepartments = ref(new Set())

const monthOptions = computed(() =>
    createMonthOptions(t, locale.value, false),
)
const employeeTypeOptions = computed(() => [
    { id: "", name: t("manpowerPlan.allEmployeeTypes") },
    ...props.employeeTypes,
])
const childOptions = computed(() => {
    const type = props.employeeTypes.find(
        (item) => item.id === scope.employeeTypeId,
    )

    return [
        { id: "", name: t("manpowerPlan.allChildGroups") },
        ...(type?.children || []),
    ]
})
const filteredRows = computed(() => {
    const keyword = search.value.trim().toLowerCase()
    if (!keyword) return rows.value

    return rows.value.filter((row) =>
        [
            row.department?.name,
            row.position?.name || row.position?.title,
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
            result.current += Number(row.currentEmployees || 0)
            result.budget += Number(row.targetBudget || 0)
            result.roadmap += Number(row.targetRoadmap || 0)
            if (
                Number(row.targetBudget || 0) !== row._budget ||
                Number(row.targetRoadmap || 0) !== row._roadmap ||
                String(row.remark || "") !== row._remark ||
                row.archive
            ) {
                result.changed += 1
            }
            return result
        },
        { current: 0, budget: 0, roadmap: 0, changed: 0 },
    ),
)

const departmentSummaries = computed(() => {
    const result = new Map()

    for (const row of filteredRows.value) {
        const key = row.departmentId || "none"
        const current = result.get(key) || {
            current: 0,
            budget: 0,
            roadmap: 0,
        }

        current.current += Number(row.currentEmployees || 0)
        current.budget += Number(row.targetBudget || 0)
        current.roadmap += Number(row.targetRoadmap || 0)
        result.set(key, current)
    }

    return result
})

const groupedRows = computed(() => {
    const groups = new Map()

    for (const row of filteredRows.value) {
        const key = row.departmentId || "none"

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                department: row.department,
                rows: [],
            })
        }

        groups.get(key).rows.push(row)
    }

    return [...groups.values()]
})

const selectedEmployeeType = computed(() =>
    props.employeeTypes.find(
        (item) => item.id === scope.employeeTypeId,
    ) || null,
)

function normalizedId(value) {
    return String(value?.id || value?._id || value || "")
}

function allowedPositionIds() {
    const type = selectedEmployeeType.value

    if (!type) {
        return null
    }

    if (scope.employeeTypeChildId) {
        const child = (type.children || []).find(
            (item) => item.id === scope.employeeTypeChildId,
        )

        if (!child || child.positionAssignmentMode === "ALL_POSITIONS") {
            return null
        }

        return new Set(
            (child.positionIds || []).map(normalizedId).filter(Boolean),
        )
    }

    if (type.children?.length) {
        if (
            type.children.some(
                (child) => child.positionAssignmentMode === "ALL_POSITIONS",
            )
        ) {
            return null
        }

        return new Set(
            type.children
                .flatMap((child) => child.positionIds || [])
                .map(normalizedId)
                .filter(Boolean),
        )
    }

    if (type.positionAssignmentMode === "ALL_POSITIONS") {
        return null
    }

    return new Set(
        (type.positionIds || []).map(normalizedId).filter(Boolean),
    )
}

function toggleDepartment(departmentId) {
    const next = new Set(expandedDepartments.value)

    if (next.has(departmentId)) {
        next.delete(departmentId)
    } else {
        next.add(departmentId)
    }

    expandedDepartments.value = next
}

function isDepartmentExpanded(departmentId) {
    return expandedDepartments.value.has(departmentId)
}

const allRowsSelected = computed(() =>
    filteredRows.value.length > 0 &&
    filteredRows.value.every((row) =>
        selectedRows.value.includes(row),
    ),
)

function toggleAllRows() {
    if (allRowsSelected.value) {
        const visibleRows = new Set(filteredRows.value)
        selectedRows.value = selectedRows.value.filter(
            (row) => !visibleRows.has(row),
        )
        return
    }

    selectedRows.value = [
        ...new Set([
            ...selectedRows.value,
            ...filteredRows.value,
        ]),
    ]
}

function departmentSummary(row) {
    return departmentSummaries.value.get(
        row.departmentId || "none",
    ) || {
        current: 0,
        budget: 0,
        roadmap: 0,
    }
}

function normalizeRow(row) {
    return {
        ...row,
        targetBudget: Number(row.targetBudget || 0),
        targetRoadmap: Number(row.targetRoadmap || 0),
        remark: row.remark || "",
        archive: false,
        _budget: Number(row.targetBudget || 0),
        _roadmap: Number(row.targetRoadmap || 0),
        _remark: row.remark || "",
    }
}

function errorText(error) {
    const key = error?.response?.data?.error?.messageKey
    if (!key) return t("errors.internal")
    const translated = t(key)
    return translated === key ? t("errors.internal") : translated
}

async function loadGrid() {
    if (!workspaceStore.ready || !scope.year || !scope.month) return
    loading.value = true

    try {
        const result = await getPlanningGrid({
            companyId: workspaceStore.companyId,
            branchId: workspaceStore.branchId,
            year: Number(scope.year),
            month: Number(scope.month),
            employeeTypeId: scope.employeeTypeId || undefined,
            employeeTypeChildId: scope.employeeTypeChildId || undefined,
        })
        const positionIds = allowedPositionIds()
        const exactRows = positionIds
            ? (result.rows || []).filter((row) =>
                  positionIds.has(normalizedId(row.positionId)),
              )
            : result.rows || []

        rows.value = exactRows.map(normalizeRow)
        selectedRows.value = []
        expandedDepartments.value = new Set()
        loaded.value = true
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("manpowerPlan.gridLoadFailed"),
            detail: errorText(error),
            life: 5000,
        })
    } finally {
        loading.value = false
    }
}

function fillSelected() {
    const targets = selectedRows.value.length
        ? selectedRows.value
        : filteredRows.value

    for (const row of targets) {
        if (fillBudget.value !== null) {
            row.targetBudget = Number(fillBudget.value || 0)
        }
        if (fillRoadmap.value !== null) {
            row.targetRoadmap = Number(fillRoadmap.value || 0)
        }
    }
}

async function saveAll() {
    if (!props.canSave || !loaded.value || !rows.value.length) return
    saving.value = true

    try {
        const result = await savePlanningGrid({
            companyId: workspaceStore.companyId,
            branchId: workspaceStore.branchId,
            year: Number(scope.year),
            month: Number(scope.month),
            rows: rows.value.map((row) => ({
                id: row.id || undefined,
                departmentId: row.departmentId,
                positionId: row.positionId,
                lineId: row.lineId || null,
                shiftId: row.shiftId || null,
                employeeTypeId: row.employeeTypeId || null,
                employeeTypeChildId: row.employeeTypeChildId || null,
                employeeTypeChildCode: row.employeeTypeChildCode || "",
                employeeTypeChildName: row.employeeTypeChildName || "",
                targetBudget: Number(row.targetBudget || 0),
                targetRoadmap: Number(row.targetRoadmap || 0),
                remark: String(row.remark || "").trim(),
                status: row.status || "ACTIVE",
                archive: Boolean(row.archive),
            })),
        })
        toast.add({
            severity: "success",
            summary: t("manpowerPlan.batchSaved"),
            detail: t("manpowerPlan.batchSavedDetail", {
                count: Number(result.modified || 0) + Number(result.upserted || 0),
            }),
            life: 3500,
        })
        await loadGrid()
        emit("saved")
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("manpowerPlan.saveFailed"),
            detail: errorText(error),
            life: 5000,
        })
    } finally {
        saving.value = false
    }
}

watch(
    () => scope.employeeTypeId,
    () => {
        scope.employeeTypeChildId = ""
        loaded.value = false
    },
)
watch(
    () => [scope.year, scope.month, scope.employeeTypeChildId],
    () => {
        loaded.value = false
    },
)
watch(
    () => workspaceStore.revision,
    () => {
        rows.value = []
        expandedDepartments.value = new Set()
        loaded.value = false
        emit("update:visible", false)
    },
)
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        title=""
        fullscreen
        hide-header
        :busy="saving"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="manpower-batch">
            <section class="manpower-batch__scope">
                <div class="manpower-batch__scope-grid">
                    <label class="enterprise-form-field">
                        <span>{{ t("manpowerPlan.year") }}</span>
                        <InputNumber v-model="scope.year" :min="2000" :max="2100" :use-grouping="false" />
                    </label>
                    <label class="enterprise-form-field">
                        <span>{{ t("manpowerPlan.month") }}</span>
                        <Select v-model="scope.month" :options="monthOptions" option-label="label" option-value="value" />
                    </label>
                    <label class="enterprise-form-field">
                        <span>{{ t("manpowerPlan.employeeType") }}</span>
                        <Select v-model="scope.employeeTypeId" :options="employeeTypeOptions" option-label="name" option-value="id" filter />
                    </label>
                    <label class="enterprise-form-field">
                        <span>{{ t("manpowerPlan.childGroup") }}</span>
                        <Select v-model="scope.employeeTypeChildId" :options="childOptions" option-label="name" option-value="id" filter :disabled="!scope.employeeTypeId" />
                    </label>

                    <div class="manpower-batch__scope-action">
                        <Button
                            icon="pi pi-table"
                            :label="t('manpowerPlan.loadGrid')"
                            :loading="loading"
                            :disabled="!scope.year || !scope.month"
                            @click="loadGrid"
                        />

                        <Button
                            icon="pi pi-times"
                            severity="secondary"
                            text
                            rounded
                            :aria-label="t('common.close')"
                            :disabled="saving"
                            @click="emit('update:visible', false)"
                        />
                    </div>
                </div>
            </section>

            <section v-if="loaded" class="manpower-batch__workspace">
                <div class="manpower-batch__tools">
                    <span class="enterprise-search-input manpower-batch__search">
                        <i class="pi pi-search" />
                        <InputText v-model="search" :placeholder="t('manpowerPlan.gridSearchPlaceholder')" />
                    </span>

                    <div class="manpower-batch__fill-tools">
                        <InputNumber v-model="fillBudget" :min="0" :use-grouping="false" :placeholder="t('manpowerPlan.fillBudget')" />
                        <InputNumber v-model="fillRoadmap" :min="0" :use-grouping="false" :placeholder="t('manpowerPlan.fillRoadmap')" />
                        <Button severity="secondary" outlined icon="pi pi-arrow-down" :label="t('manpowerPlan.fillSelected')" @click="fillSelected" />
                    </div>
                </div>

                <div class="manpower-batch__summary">
                    <span>{{ t("manpowerPlan.current") }} <strong>{{ summary.current }}</strong></span>
                    <span>{{ t("manpowerPlan.budget") }} <strong>{{ summary.budget }}</strong></span>
                    <span>{{ t("manpowerPlan.roadmap") }} <strong>{{ summary.roadmap }}</strong></span>
                    <span>{{ t("manpowerPlan.changed") }} <strong>{{ summary.changed }}</strong></span>
                </div>

                <div class="manpower-batch__table-wrap">
                    <table class="manpower-sheet">
                        <colgroup>
                            <col class="manpower-sheet__select-column" />
                            <col class="manpower-sheet__position-column" />
                            <col class="manpower-sheet__line-column" />
                            <col class="manpower-sheet__shift-column" />
                            <col class="manpower-sheet__child-column" />
                            <col class="manpower-sheet__current-column" />
                            <col class="manpower-sheet__number-column" />
                            <col class="manpower-sheet__number-column" />
                            <col class="manpower-sheet__remark-column" />
                            <col class="manpower-sheet__archive-column" />
                        </colgroup>

                        <thead>
                            <tr>
                                <th class="manpower-sheet__sticky-select">
                                    <Checkbox
                                        :model-value="allRowsSelected"
                                        binary
                                        @change="toggleAllRows"
                                    />
                                </th>
                                <th class="manpower-sheet__sticky-position">
                                    {{ t("manpowerPlan.position") }}
                                </th>
                                <th>{{ t("manpowerPlan.line") }}</th>
                                <th>{{ t("manpowerPlan.shift") }}</th>
                                <th>{{ t("manpowerPlan.childGroup") }}</th>
                                <th>{{ t("manpowerPlan.current") }}</th>
                                <th>{{ t("manpowerPlan.budget") }}</th>
                                <th>{{ t("manpowerPlan.roadmap") }}</th>
                                <th>{{ t("manpowerPlan.remark") }}</th>
                                <th>{{ t("common.archive") }}</th>
                            </tr>
                        </thead>

                        <template
                            v-for="group in groupedRows"
                            :key="group.key"
                        >
                            <tbody class="manpower-sheet__group">
                                <tr class="manpower-sheet__group-row">
                                    <td colspan="10">
                                        <div class="manpower-batch__department-row">
                                            <button
                                                type="button"
                                                class="manpower-batch__department-toggle"
                                                :aria-expanded="isDepartmentExpanded(group.key)"
                                                @click="toggleDepartment(group.key)"
                                            >
                                                <i
                                                    :class="[
                                                        'pi',
                                                        isDepartmentExpanded(group.key)
                                                            ? 'pi-chevron-down'
                                                            : 'pi-chevron-right',
                                                    ]"
                                                />

                                                <strong>
                                                    {{ group.department?.name || "—" }}
                                                </strong>

                                                <small>
                                                    {{ group.rows.length }}
                                                </small>
                                            </button>

                                            <div class="manpower-batch__department-totals">
                                                <span>
                                                    {{ t("manpowerPlan.current") }}
                                                    <b>{{ departmentSummary(group.rows[0]).current }}</b>
                                                </span>
                                                <span>
                                                    {{ t("manpowerPlan.budget") }}
                                                    <b>{{ departmentSummary(group.rows[0]).budget }}</b>
                                                </span>
                                                <span>
                                                    {{ t("manpowerPlan.roadmap") }}
                                                    <b>{{ departmentSummary(group.rows[0]).roadmap }}</b>
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                </tr>

                                <tr
                                    v-for="row in group.rows"
                                    v-show="isDepartmentExpanded(group.key)"
                                    :key="row.rowKey"
                                    class="manpower-sheet__data-row"
                                >
                                    <td class="manpower-sheet__sticky-select">
                                        <Checkbox
                                            v-model="selectedRows"
                                            :value="row"
                                        />
                                    </td>
                                    <td class="manpower-sheet__sticky-position manpower-sheet__position-cell">
                                        {{ row.position?.title || row.position?.name || "—" }}
                                    </td>
                                    <td>{{ row.line?.name || "—" }}</td>
                                    <td>{{ row.shift?.name || "—" }}</td>
                                    <td>{{ row.employeeTypeChildName || "—" }}</td>
                                    <td class="manpower-sheet__metric-cell">
                                        {{ row.currentEmployees || 0 }}
                                    </td>
                                    <td>
                                        <InputNumber
                                            v-model="row.targetBudget"
                                            class="manpower-batch__number"
                                            :min="0"
                                            :use-grouping="false"
                                        />
                                    </td>
                                    <td>
                                        <InputNumber
                                            v-model="row.targetRoadmap"
                                            class="manpower-batch__number"
                                            :min="0"
                                            :use-grouping="false"
                                        />
                                    </td>
                                    <td>
                                        <InputText
                                            v-model="row.remark"
                                            class="manpower-sheet__remark-input"
                                            :placeholder="t('manpowerPlan.remark')"
                                        />
                                    </td>
                                    <td>
                                        <Checkbox
                                            v-model="row.archive"
                                            binary
                                            :disabled="!row.id"
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </template>
                    </table>
                </div>
            </section>

            <div v-else class="manpower-batch__empty">
                {{ t("manpowerPlan.loadGridHint") }}
            </div>
        </div>

        <template #footer>
            <EnterpriseFormFooter
                :save-label="t('manpowerPlan.saveAll')"
                :cancel-label="t('common.cancel')"
                :saving="saving"
                :disabled="!canSave || !loaded || !rows.length"
                @save="saveAll"
                @cancel="emit('update:visible', false)"
            />
        </template>
    </EnterpriseDialog>
</template>

<style scoped>
:global(.enterprise-dialog--fullscreen .p-dialog-content) {
    padding: 0.45rem 0.55rem;
}

:global(.enterprise-dialog--fullscreen .enterprise-dialog__body) {
    max-height: none;
    overflow: hidden;
    padding: 0;
}

:global(.enterprise-dialog--fullscreen .p-dialog-footer) {
    padding: 0.3rem 0.55rem;
    border-top: 1px solid var(--hrms-border);
}

:global(.enterprise-dialog--fullscreen .p-dialog-footer .p-button) {
    min-height: 2rem;
    padding: 0.32rem 0.65rem;
    font-size: 0.76rem;
}

.manpower-batch {
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 0.45rem;
    height: 100%;
}

.manpower-batch__scope {
    z-index: 20;
    flex: 0 0 auto;
    padding: 0.4rem 0.5rem;
    background: var(--hrms-surface);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-sm);
}

.manpower-batch__scope-grid {
    display: grid;
    grid-template-columns: 7rem 9rem minmax(12rem, 1fr) minmax(12rem, 1fr) auto;
    align-items: end;
    gap: 0.4rem;
}

.enterprise-form-field {
    display: grid;
    min-width: 0;
    gap: 0.18rem;
}

.enterprise-form-field > span {
    color: var(--hrms-text);
    font-size: 0.64rem;
    font-weight: 600;
}

.enterprise-form-field :deep(.p-inputtext),
.enterprise-form-field :deep(.p-select),
.enterprise-form-field :deep(.p-inputnumber),
.enterprise-form-field :deep(.p-inputnumber-input) {
    width: 100%;
    min-width: 0;
    height: 1.9rem;
    min-height: 1.9rem;
    font-size: 0.76rem;
}

.enterprise-form-field :deep(.p-select-label) {
    min-width: 0;
    padding: 0.32rem 0.45rem;
    font-size: 0.76rem;
}

.enterprise-form-field :deep(.p-select-dropdown) {
    width: 1.8rem;
}

.manpower-batch__scope-action {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    margin-top: 2px;
}

.manpower-batch__scope-action :deep(.p-button) {
    min-height: 1.9rem;
    padding: 0.3rem 0.55rem;
    font-size: 0.74rem;
    white-space: nowrap;
}

.manpower-batch__workspace {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 0.4rem;
    overflow: hidden;
}

.manpower-batch__tools {
    display: flex;
    z-index: 18;
    align-items: center;
    flex: 0 0 auto;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.35rem 0.45rem;
    background: var(--hrms-surface);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-sm);
}

.manpower-batch__search {
    position: relative;
    display: block;
    width: 100%;
    min-width: 0;
    flex: 1 1 18rem;
}

.manpower-batch__search > i {
    position: absolute;
    z-index: 2;
    top: 50%;
    left: 0.55rem;
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
    pointer-events: none;
    transform: translateY(-50%);
}

.manpower-batch__search :deep(.p-inputtext) {
    width: 100%;
    padding-left: 1.7rem;
}

.manpower-batch__fill-tools {
    display: grid;
    width: min(100%, 26rem);
    min-width: 0;
    flex: 0 0 26rem;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 8.5rem;
    gap: 0.4rem;
    margin-left: auto;
}

.manpower-batch__fill-tools > .p-inputnumber {
    width: 100%;
    min-width: 0;
}

.manpower-batch__fill-tools :deep(.p-inputnumber-input) {
    width: 100%;
    min-width: 0;
}

.manpower-batch__fill-tools :deep(.p-button) {
    width: 100%;
    min-width: 0;
    justify-content: center;
    white-space: nowrap;
}

.manpower-batch__tools :deep(.p-inputtext),
.manpower-batch__tools :deep(.p-inputnumber-input),
.manpower-batch__tools :deep(.p-button) {
    height: 1.85rem;
    min-height: 1.85rem;
    font-size: 0.74rem;
}

.manpower-batch__tools :deep(.p-button) {
    padding: 0.28rem 0.5rem;
}

.manpower-batch__summary {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
    flex: 0 0 auto;
}

.manpower-batch__summary span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.42rem;
    color: var(--hrms-text-muted);
    background: var(--hrms-surface-muted);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-sm);
    font-size: 0.67rem;
}

.manpower-batch__summary strong {
    color: var(--hrms-text);
}

.manpower-batch__table-wrap {
    height: auto;
    min-height: 0;
    flex: 1 1 0;
    overflow: auto;
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-sm);
}

.manpower-sheet {
    width: 100%;
    min-width: 74rem;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
}

.manpower-sheet col.manpower-sheet__select-column { width: 3%; }
.manpower-sheet col.manpower-sheet__position-column { width: 18%; }
.manpower-sheet col.manpower-sheet__line-column { width: 11%; }
.manpower-sheet col.manpower-sheet__shift-column { width: 9%; }
.manpower-sheet col.manpower-sheet__child-column { width: 12%; }
.manpower-sheet col.manpower-sheet__current-column { width: 7%; }
.manpower-sheet col.manpower-sheet__number-column { width: 8%; }
.manpower-sheet col.manpower-sheet__remark-column { width: 17%; }
.manpower-sheet col.manpower-sheet__archive-column { width: 7%; }

.manpower-sheet thead {
    position: sticky;
    z-index: 30;
    top: 0;
}

.manpower-sheet th,
.manpower-sheet td {
    overflow: hidden;
    height: 1.9rem;
    padding: 0.2rem 0.35rem;
    border-right: 1px solid var(--hrms-border);
    border-bottom: 1px solid var(--hrms-border);
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.manpower-sheet th {
    color: var(--hrms-text);
    background: var(--hrms-surface-muted);
    border-top: 1px solid var(--hrms-border-strong);
    font-size: 0.66rem;
    font-weight: 700;
}

.manpower-sheet th:first-child,
.manpower-sheet td:first-child {
    border-left: 1px solid var(--hrms-border);
}

.manpower-sheet__data-row td {
    color: var(--hrms-text);
    background: var(--hrms-surface);
    font-size: 0.69rem;
}

.manpower-sheet__data-row:nth-child(odd) td {
    background: var(--hrms-surface-muted);
}

.manpower-sheet__sticky-select,
.manpower-sheet__sticky-position {
    position: sticky;
}

.manpower-sheet__sticky-select {
    z-index: 15;
    left: 0;
}

.manpower-sheet__sticky-position {
    z-index: 14;
    left: 2.2rem;
    box-shadow: 1px 0 0 var(--hrms-border-strong);
}

.manpower-sheet thead .manpower-sheet__sticky-select,
.manpower-sheet thead .manpower-sheet__sticky-position {
    z-index: 35;
    background: var(--hrms-surface-muted);
}

.manpower-sheet__position-cell {
    padding-left: 0.5rem !important;
    font-weight: 600;
    text-align: left !important;
}

.manpower-sheet__metric-cell {
    color: var(--p-primary-700) !important;
    font-weight: 700;
}

.manpower-sheet__group-row td {
    padding: 0;
    background: var(--hrms-surface);
}

.manpower-batch__department-row {
    display: flex;
    min-width: max-content;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.25rem 0.45rem;
    color: var(--p-primary-700);
    background: color-mix(in srgb, var(--p-primary-100) 75%, white);
    border-bottom: 1px solid var(--p-primary-200);
}

.manpower-batch__department-toggle {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 0.35rem;
    padding: 0;
    color: var(--p-primary-700);
    background: transparent;
    border: 0;
    cursor: pointer;
}

.manpower-batch__department-toggle i,
.manpower-batch__department-toggle small {
    font-size: 0.62rem;
}

.manpower-batch__department-toggle strong {
    overflow: hidden;
    font-size: 0.7rem;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.manpower-batch__department-toggle small {
    padding: 0.08rem 0.25rem;
    color: var(--hrms-text-muted);
    background: var(--hrms-surface);
    border-radius: 999px;
}

.manpower-batch__department-totals {
    display: flex;
    align-items: center;
    gap: 0.7rem;
}

.manpower-batch__department-totals span {
    display: inline-flex;
    align-items: center;
    gap: 0.22rem;
    color: var(--hrms-text-muted);
    font-size: 0.64rem;
}

.manpower-batch__department-totals b {
    color: var(--hrms-text);
}

.manpower-batch__number,
.manpower-sheet__remark-input {
    width: 100%;
}

.manpower-batch__number :deep(.p-inputnumber-input),
.manpower-sheet__remark-input {
    width: 100%;
    height: 1.55rem;
    min-height: 1.55rem;
    padding: 0.15rem 0.3rem;
    font-size: 0.68rem;
}

.manpower-batch__number :deep(.p-inputnumber-input) {
    text-align: center;
}

.manpower-batch__empty {
    display: grid;
    min-height: 0;
    flex: 1 1 auto;
    place-items: center;
    color: var(--hrms-text-muted);
    background: var(--hrms-surface-muted);
    border: 1px dashed var(--hrms-border);
    border-radius: var(--hrms-radius-sm);
    font-size: 0.75rem;
}

@media (max-width: 900px) {
    .manpower-batch__scope-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .manpower-batch__scope-action {
        grid-column: 1 / -1;
        justify-content: flex-end;
    }

    .manpower-batch__search {
        flex-basis: 100%;
    }

    .manpower-batch__fill-tools {
        width: 100%;
        flex-basis: 100%;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 8.5rem;
        margin-left: 0;
    }
}

@media (max-width: 620px) {
    .manpower-batch__scope-grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .manpower-batch__scope-action {
        grid-column: auto;
        justify-self: stretch;
    }

    .manpower-batch__fill-tools {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    .manpower-batch__fill-tools :deep(.p-button) {
        grid-column: 1 / -1;
        width: 100%;
    }

    .manpower-batch__scope-action > * {
        flex: 1 1 auto;
    }

    .manpower-batch__department-totals {
        display: none;
    }
}
</style>
