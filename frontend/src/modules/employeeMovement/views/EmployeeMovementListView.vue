<script setup>
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useToast } from "primevue/usetoast"

import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import { lookupDepartments } from "@/modules/organization/department/api/department.api.js"
import EnterpriseActionMenu from "@/shared/components/enterprise/EnterpriseActionMenu.vue"
import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterpriseListControls from "@/shared/components/enterprise/EnterpriseListControls.vue"
import EnterpriseListPage from "@/shared/components/enterprise/EnterpriseListPage.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"

import EmployeeMovementDetailDialog from "../components/EmployeeMovementDetailDialog.vue"
import {
    EMPLOYEE_MOVEMENT_PERMISSIONS,
    movementColumns,
    movementTypeOptions,
    sourceOptions,
    statusOptions,
    titleCase,
} from "../config/employeeMovement.config.js"
import { useEmployeeMovementStore } from "../stores/employeeMovement.store.js"

const toast = useToast()
const workspaceStore = useWorkspaceStore()
const store = useEmployeeMovementStore()

const departments = ref([])
const detailVisible = ref(false)
let listSearchTimer
const query = store.filters

const rows = computed(() => store.items.map((item) => ({
    ...item,
    employeeCode: item.employee?.employeeCode || "—",
    employeeName: item.employee?.displayName || "—",
    fromDepartment: item.from?.department?.name || "—",
    toDepartment: item.to?.department?.name || "—",
    fromPosition: item.from?.position?.title || "—",
    toPosition: item.to?.position?.title || "—",
    fromLine: item.from?.line?.name || "—",
    toLine: item.to?.line?.name || "—",
    fromShift: item.from?.shift?.name || "—",
    toShift: item.to?.shift?.name || "—",
})))

const departmentOptions = computed(() => [
    { id: "", name: "All Departments" },
    ...departments.value,
])

const typeFilterOptions = computed(() => [
    { label: "All Movement Types", value: "ALL" },
    ...movementTypeOptions,
])

const activeFilterCount = computed(() => [
    query.search,
    query.departmentId,
    query.movementType !== "ALL",
    query.source !== "ALL",
    query.status !== "ALL",
    query.fromDate,
    query.toDate,
].filter(Boolean).length)

function errorMessage(error) {
    return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || "The request could not be completed."
}

async function load(overrides = {}) {
    if (!workspaceStore.ready) return
    try { await store.loadEmployeeMovements({ ...overrides }) }
    catch (error) { toast.add({ severity: "error", summary: "Unable to load movements", detail: errorMessage(error), life: 4500 }) }
}

async function loadDepartments() {
    if (!workspaceStore.ready) { departments.value = []; return }
    try {
        departments.value = await lookupDepartments({ companyId: workspaceStore.companyId, branchId: workspaceStore.branchId, status: "ACTIVE" })
    } catch { departments.value = [] }
}

function onListSearch() {
    clearTimeout(listSearchTimer)
    listSearchTimer = setTimeout(() => load({ page: 1 }), 350)
}

function clearFilters() {
    Object.assign(query, { page: 1, search: "", departmentId: undefined, movementType: "ALL", source: "ALL", status: "ALL", fromDate: undefined, toDate: undefined })
    load({ page: 1 })
}

async function openDetails(row) {
    detailVisible.value = true
    try {
        await store.loadEmployeeMovement(row.id)
    } catch (error) {
        detailVisible.value = false
        toast.add({ severity: "error", summary: "Unable to load movement", detail: errorMessage(error), life: 4500 })
    }
}

function rowActions(row) {
    return [
        { label: "View Details", icon: "pi pi-eye", command: () => openDetails(row) },
    ]
}

function formatDate(value) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
}

function statusSeverity(status) { return status === "ACTIVE" ? "success" : status === "INACTIVE" ? "warn" : "danger" }
function typeSeverity(type) { return ["RESIGN", "TERMINATE", "ABANDON"].includes(type) ? "danger" : type === "NEW_HIRE" ? "success" : "info" }

watch(() => workspaceStore.revision, async () => {
    Object.assign(query, { page: 1, departmentId: undefined })
    await Promise.all([loadDepartments(), load({ page: 1 })])
})

onMounted(async () => { await Promise.all([loadDepartments(), load({ page: 1 })]) })
onBeforeUnmount(() => { clearTimeout(listSearchTimer) })
</script>

<template>
    <EnterpriseListPage
        :rows="rows"
        :columns="movementColumns"
        :loading="store.loading"
        :error="store.error"
        :pagination="store.pagination"
        row-key="id"
        empty-title="No employee movements"
        empty-description="Employee assignment and employment changes will appear here."
        @retry="load"
        @page-change="load({ page: $event.page, limit: $event.limit })"
    >
        <template #controls>
            <EnterpriseListControls filter-label="Filters" hide-filter-label="Hide Filters" :active-filter-count="activeFilterCount">
                <template #start>
                    <Button label="Refresh" icon="pi pi-refresh" severity="secondary" text :loading="store.loading" @click="load" />
                    <PermissionButton :permission="EMPLOYEE_MOVEMENT_PERMISSIONS.EXPORT" label="Export" icon="pi pi-file-export" severity="secondary" text :loading="store.exporting" @click="store.exportEmployeeMovements()" />
                </template>
                <template #filters>
                    <EnterpriseFilterBar :loading="store.loading">
                        <EnterpriseFilterField class="movement-search" label="Search" search>
                            <span class="movement-search-input"><i class="pi pi-search" /><InputText v-model="query.search" placeholder="Reason, type or source" @input="onListSearch" @keyup.enter="load({ page: 1 })" /></span>
                        </EnterpriseFilterField>
                        <EnterpriseFilterField label="Department"><Select v-model="query.departmentId" :options="departmentOptions" option-label="name" option-value="id" filter /></EnterpriseFilterField>
                        <EnterpriseFilterField label="Movement Type"><Select v-model="query.movementType" :options="typeFilterOptions" option-label="label" option-value="value" /></EnterpriseFilterField>
                        <EnterpriseFilterField label="Source"><Select v-model="query.source" :options="sourceOptions" option-label="label" option-value="value" /></EnterpriseFilterField>
                        <EnterpriseFilterField label="Status"><Select v-model="query.status" :options="statusOptions" option-label="label" option-value="value" /></EnterpriseFilterField>
                        <EnterpriseFilterField label="From Date"><EnterpriseCalendarDatePicker v-model="query.fromDate" :company-id="workspaceStore.companyId" :branch-id="workspaceStore.branchId" compact :show-status="false" /></EnterpriseFilterField>
                        <EnterpriseFilterField label="To Date"><EnterpriseCalendarDatePicker v-model="query.toDate" :company-id="workspaceStore.companyId" :branch-id="workspaceStore.branchId" compact :show-status="false" /></EnterpriseFilterField>
                        <template #actions>
                            <Button label="Clear" icon="pi pi-times" severity="secondary" outlined :disabled="!activeFilterCount" @click="clearFilters" />
                            <Button label="Apply" icon="pi pi-check" :loading="store.loading" @click="load({ page: 1 })" />
                        </template>
                    </EnterpriseFilterBar>
                </template>
            </EnterpriseListControls>
        </template>

        <template #cell-effectiveDate="{ row }"><span class="enterprise-table__text">{{ formatDate(row.effectiveDate) }}</span></template>
        <template #cell-movementType="{ row }"><Tag :value="titleCase(row.movementType)" :severity="typeSeverity(row.movementType)" /></template>
        <template #cell-source="{ row }"><span class="enterprise-table__text">{{ titleCase(row.source) }}</span></template>
        <template #cell-status="{ row }"><Tag :value="titleCase(row.status)" :severity="statusSeverity(row.status)" /></template>
        <template #actions="{ row }"><EnterpriseActionMenu :items="rowActions(row)" aria-label="Movement actions" /></template>
    </EnterpriseListPage>

    <EmployeeMovementDetailDialog v-model:visible="detailVisible" :movement="store.selected" :loading="store.loadingDetail" />
</template>

<style scoped>
.movement-search { min-width: min(18rem, 100%); flex: 1 1 20rem; }
.movement-search-input { position: relative; display: block; }
.movement-search-input > i { position: absolute; z-index: 1; top: 50%; left: .7rem; transform: translateY(-50%); color: var(--p-text-muted-color); font-size: .75rem; pointer-events: none; }
.movement-search-input :deep(.p-inputtext) { width: 100%; padding-left: 2rem; }
</style>
