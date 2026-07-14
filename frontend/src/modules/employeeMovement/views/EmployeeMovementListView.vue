
<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Card from "primevue/card"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import DatePicker from "primevue/datepicker"
import Dialog from "primevue/dialog"
import InputText from "primevue/inputtext"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { fetchEmployees } from "@/modules/employee/services/employee.api.js"
import { fetchCompaniesLookup } from "@/modules/organization/services/company.api.js"
import { fetchBranchesLookup } from "@/modules/organization/services/branch.api.js"
import { fetchDepartmentsLookup } from "@/modules/organization/services/department.api.js"
import { fetchPositionsLookup } from "@/modules/organization/services/position.api.js"
import { fetchLines } from "@/modules/line/services/line.api.js"
import { fetchEmployeeTypes } from "@/modules/employeeType/services/employeeType.api.js"

import { useEmployeeMovementStore } from "../stores/employeeMovement.store.js"

const toast = useToast()
const authStore = useAuthStore()
const movementStore = useEmployeeMovementStore()

const PERMISSIONS = Object.freeze({
    CREATE: "EMPLOYEE.MOVEMENT.CREATE",
    UPDATE: "EMPLOYEE.MOVEMENT.UPDATE",
    ARCHIVE: "EMPLOYEE.MOVEMENT.ARCHIVE",
    IMPORT: "EMPLOYEE.MOVEMENT.IMPORT",
    EXPORT: "EMPLOYEE.MOVEMENT.EXPORT",
})

const employees = ref([])
const companies = ref([])
const branches = ref([])
const departments = ref([])
const positions = ref([])
const lines = ref([])
const employeeTypes = ref([])
const loadingOptions = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedId = ref(null)
const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)
const importDialogVisible = ref(false)
const importResultDialogVisible = ref(false)
const selectedImportFile = ref(null)
const fileInputRef = ref(null)

const filters = reactive({
    search: "",
    status: "ACTIVE",
    movementType: "ALL",
    source: "ALL",
    companyId: "",
    branchId: "",
    departmentId: "",
    positionId: "",
    lineId: "",
    employeeTypeId: "",
    fromDate: null,
    toDate: null,
})

const form = reactive(createEmptyForm())

const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.CREATE))
const canUpdate = computed(() => authStore.hasPermission(PERMISSIONS.UPDATE))
const canArchive = computed(() => authStore.hasPermission(PERMISSIONS.ARCHIVE))
const canImport = computed(() => authStore.hasPermission(PERMISSIONS.IMPORT))
const canExport = computed(() => authStore.hasPermission(PERMISSIONS.EXPORT))

const movementTypeOptions = [
    { label: "All Types", value: "ALL" },
    "NEW_HIRE", "REJOIN", "RESIGN", "TERMINATE", "ABANDON", "PASSED_AWAY", "RETIRE", "TRANSFER", "DEPARTMENT_CHANGE", "POSITION_CHANGE", "LINE_CHANGE", "SHIFT_CHANGE", "EMPLOYEE_TYPE_CHANGE", "STATUS_CHANGE", "OTHER",
].map((item) => typeof item === "string" ? { label: item.replaceAll("_", " "), value: item } : item)
const formMovementTypeOptions = movementTypeOptions.filter((item) => item.value !== "ALL")
const statusOptions = [
    { label: "All", value: "ALL" },
    { label: "Active", value: "ACTIVE" },
    { label: "Inactive", value: "INACTIVE" },
    { label: "Archived", value: "ARCHIVED" },
]
const editableStatusOptions = [
    { label: "Active", value: "ACTIVE" },
    { label: "Inactive", value: "INACTIVE" },
]
const sourceOptions = [
    { label: "All Sources", value: "ALL" },
    { label: "Manual", value: "MANUAL" },
    { label: "Employee Profile", value: "EMPLOYEE_PROFILE" },
    { label: "Import", value: "IMPORT" },
]

const employeeOptions = computed(() => employees.value.map((item) => ({ label: `${item.employeeCode} - ${item.displayName}`, value: item.id })))
const companyFilterOptions = computed(() => [{ label: "All Companies", value: "" }, ...companies.value.map((item) => ({ label: `${item.code} - ${item.displayName}`, value: item.id }))])
const branchFilterOptions = computed(() => [{ label: "All Branches", value: "" }, ...branches.value.filter((item) => !filters.companyId || item.companyId === filters.companyId).map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))])
const departmentFilterOptions = computed(() => [{ label: "All Departments", value: "" }, ...departments.value.filter((item) => !filters.branchId || item.branchId === filters.branchId).map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))])
const positionFilterOptions = computed(() => [{ label: "All Positions", value: "" }, ...positions.value.filter((item) => !filters.departmentId || item.departmentId === filters.departmentId).map((item) => ({ label: `${item.code} - ${item.title}`, value: item.id }))])
const lineFilterOptions = computed(() => [{ label: "All Lines", value: "" }, ...lines.value.filter((item) => !filters.departmentId || item.departmentId === filters.departmentId).map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))])
const employeeTypeFilterOptions = computed(() => [{ label: "All Employee Types", value: "" }, ...employeeTypes.value.filter((item) => !filters.companyId || item.companyId === filters.companyId).map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))])
const dialogTitle = computed(() => dialogMode.value === "create" ? "Create Employee Movement" : "Edit Employee Movement")

function getErrorMessage(error) {
    return error?.response?.data?.error?.messageKey || error?.response?.data?.message || error?.message || "Something went wrong"
}

function createEmptyForm() {
    return {
        employeeId: "",
        movementType: "TRANSFER",
        effectiveDate: new Date(),
        reason: "",
        status: "ACTIVE",
    }
}

function assignForm(source = createEmptyForm()) {
    Object.assign(form, createEmptyForm(), {
        employeeId: source.employeeId || "",
        movementType: source.movementType || "TRANSFER",
        effectiveDate: source.effectiveDate ? new Date(source.effectiveDate) : new Date(),
        reason: source.reason || "",
        status: source.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    })
}

function buildPayload() {
    return {
        employeeId: form.employeeId,
        movementType: form.movementType,
        effectiveDate: form.effectiveDate,
        reason: form.reason || "",
        status: form.status,
    }
}

function buildFilterPayload() {
    return {
        ...filters,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
    }
}

async function loadOptions() {
    loadingOptions.value = true
    try {
        const [employeeResult, companyResult, branchResult, departmentResult, positionResult, lineResult, employeeTypeResult] = await Promise.all([
            fetchEmployees({ page: 1, limit: 100, recordStatus: "ACTIVE" }),
            fetchCompaniesLookup({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchBranchesLookup({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchDepartmentsLookup({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchPositionsLookup({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchLines({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchEmployeeTypes({ page: 1, limit: 100, status: "ACTIVE" }),
        ])
        employees.value = employeeResult.items || []
        companies.value = companyResult || []
        branches.value = branchResult || []
        departments.value = departmentResult || []
        positions.value = positionResult || []
        lines.value = lineResult.items || []
        employeeTypes.value = employeeTypeResult.items || []
    } catch (error) {
        toast.add({ severity: "error", summary: "Failed to load setup data", detail: getErrorMessage(error), life: 4500 })
    } finally {
        loadingOptions.value = false
    }
}

async function loadMovements(page = 1) {
    try {
        await movementStore.loadEmployeeMovements({ ...buildFilterPayload(), page })
    } catch (error) {
        toast.add({ severity: "error", summary: "Failed to load movements", detail: getErrorMessage(error), life: 4500 })
    }
}

function openCreateDialog() {
    dialogMode.value = "create"
    selectedId.value = null
    assignForm()
    dialogVisible.value = true
}

function openEditDialog(item) {
    dialogMode.value = "edit"
    selectedId.value = item.id
    assignForm(item)
    dialogVisible.value = true
}

async function submitForm() {
    try {
        if (dialogMode.value === "create") {
            await movementStore.createEmployeeMovement(buildPayload())
            toast.add({ severity: "success", summary: "Created", detail: "Employee movement created.", life: 2500 })
        } else {
            const { employeeId, ...payload } = buildPayload()
            await movementStore.updateEmployeeMovement(selectedId.value, payload)
            toast.add({ severity: "success", summary: "Updated", detail: "Employee movement updated.", life: 2500 })
        }
        dialogVisible.value = false
        await loadMovements(movementStore.pagination.page)
    } catch (error) {
        toast.add({ severity: "error", summary: "Save failed", detail: getErrorMessage(error), life: 4500 })
    }
}

function confirmArchive(item) {
    archiveCandidate.value = item
    archiveDialogVisible.value = true
}

async function archiveSelected() {
    try {
        await movementStore.archiveEmployeeMovement(archiveCandidate.value.id)
        toast.add({ severity: "success", summary: "Archived", detail: "Employee movement archived.", life: 2500 })
        archiveDialogVisible.value = false
        archiveCandidate.value = null
        await loadMovements(movementStore.pagination.page)
    } catch (error) {
        toast.add({ severity: "error", summary: "Archive failed", detail: getErrorMessage(error), life: 4500 })
    }
}

function onImportFileChange(event) {
    selectedImportFile.value = event.target.files?.[0] || null
}

async function submitImport() {
    if (!selectedImportFile.value) return
    try {
        await movementStore.importEmployeeMovements(selectedImportFile.value)
        importDialogVisible.value = false
        importResultDialogVisible.value = true
        selectedImportFile.value = null
        if (fileInputRef.value) fileInputRef.value.value = ""
        await loadMovements(1)
    } catch (error) {
        toast.add({ severity: "error", summary: "Import failed", detail: getErrorMessage(error), life: 4500 })
    }
}

onMounted(async () => {
    await loadOptions()
    await loadMovements(1)
})
</script>

<template>
    <section class="report-page">
        <Card class="report-card">
            <template #title>
                <div class="report-title-row">
                    <div>
                        <h1>Employee Movements</h1>
                        <p>Date-to-date history for new hire, resign, transfer, and assignment changes.</p>
                    </div>
                    <div class="report-actions">
                        <Button v-if="canImport" icon="pi pi-download" label="Sample" severity="secondary" :loading="movementStore.downloadingTemplate" @click="movementStore.downloadImportTemplate()" />
                        <Button v-if="canImport" icon="pi pi-upload" label="Import" severity="secondary" @click="importDialogVisible = true" />
                        <Button v-if="canExport" icon="pi pi-file-excel" label="Export" severity="secondary" :loading="movementStore.exporting" @click="movementStore.exportEmployeeMovements()" />
                        <Button v-if="canCreate" icon="pi pi-plus" label="New" @click="openCreateDialog" />
                    </div>
                </div>
            </template>

            <template #content>
                <div class="filter-grid">
                    <InputText v-model="filters.search" placeholder="Search" @keyup.enter="loadMovements(1)" />
                    <Select v-model="filters.companyId" :options="companyFilterOptions" option-label="label" option-value="value" placeholder="Company" filter show-clear />
                    <Select v-model="filters.branchId" :options="branchFilterOptions" option-label="label" option-value="value" placeholder="Branch" filter show-clear />
                    <Select v-model="filters.departmentId" :options="departmentFilterOptions" option-label="label" option-value="value" placeholder="Department" filter show-clear />
                    <Select v-model="filters.positionId" :options="positionFilterOptions" option-label="label" option-value="value" placeholder="Position" filter show-clear />
                    <Select v-model="filters.lineId" :options="lineFilterOptions" option-label="label" option-value="value" placeholder="Line" filter show-clear />
                    <Select v-model="filters.employeeTypeId" :options="employeeTypeFilterOptions" option-label="label" option-value="value" placeholder="Employee Type" filter show-clear />
                    <Select v-model="filters.movementType" :options="movementTypeOptions" option-label="label" option-value="value" placeholder="Movement Type" />
                    <Select v-model="filters.source" :options="sourceOptions" option-label="label" option-value="value" placeholder="Source" />
                    <Select v-model="filters.status" :options="statusOptions" option-label="label" option-value="value" placeholder="Status" />
                    <DatePicker v-model="filters.fromDate" placeholder="From Date" date-format="yy-mm-dd" show-icon />
                    <DatePicker v-model="filters.toDate" placeholder="To Date" date-format="yy-mm-dd" show-icon />
                    <Button icon="pi pi-search" label="Apply" :loading="movementStore.loading" @click="loadMovements(1)" />
                </div>

                <DataTable :value="movementStore.items" :loading="movementStore.loading || loadingOptions" data-key="id" paginator lazy :first="(movementStore.pagination.page - 1) * movementStore.pagination.limit" :rows="movementStore.pagination.limit" :total-records="movementStore.pagination.total" @page="loadMovements($event.page + 1)" scrollable scroll-height="62vh" size="small" class="compact-table">
                    <Column header="Date" style="min-width: 120px"><template #body="{ data }">{{ new Date(data.effectiveDate).toLocaleDateString() }}</template></Column>
                    <Column header="Employee" style="min-width: 190px"><template #body="{ data }"><strong>{{ data.employee?.employeeCode || '-' }}</strong><br><span>{{ data.employee?.displayName || '-' }}</span></template></Column>
                    <Column header="Type" style="min-width: 150px"><template #body="{ data }"><Tag :value="data.movementType" severity="info" /></template></Column>
                    <Column header="From" style="min-width: 220px"><template #body="{ data }"><span>{{ data.from.department?.name || '-' }}</span> / <span>{{ data.from.position?.title || '-' }}</span> / <span>{{ data.from.line?.name || '-' }}</span></template></Column>
                    <Column header="To" style="min-width: 220px"><template #body="{ data }"><span>{{ data.to.department?.name || '-' }}</span> / <span>{{ data.to.position?.title || '-' }}</span> / <span>{{ data.to.line?.name || '-' }}</span></template></Column>
                    <Column header="Employee Type" style="min-width: 190px"><template #body="{ data }">{{ data.to.employeeType?.name || '-' }}<span v-if="data.to.employeeTypeChildName"> / {{ data.to.employeeTypeChildName }}</span></template></Column>
                    <Column field="source" header="Source" style="min-width: 130px" />
                    <Column field="reason" header="Reason" style="min-width: 220px" />
                    <Column header="Status" style="min-width: 100px"><template #body="{ data }"><Tag :value="data.status" :severity="data.status === 'ACTIVE' ? 'success' : 'secondary'" /></template></Column>
                    <Column header="Action" frozen align-frozen="right" style="min-width: 150px"><template #body="{ data }"><div class="row-actions"><Button v-if="canUpdate" icon="pi pi-pencil" text rounded @click="openEditDialog(data)" /><Button v-if="canArchive && data.status !== 'ARCHIVED'" icon="pi pi-trash" text rounded severity="danger" @click="confirmArchive(data)" /></div></template></Column>
                </DataTable>
            </template>
        </Card>

        <Dialog v-model:visible="dialogVisible" :header="dialogTitle" modal class="report-dialog">
            <div class="form-grid">
                <Select v-model="form.employeeId" :options="employeeOptions" option-label="label" option-value="value" placeholder="Employee" filter :disabled="dialogMode === 'edit'" />
                <Select v-model="form.movementType" :options="formMovementTypeOptions" option-label="label" option-value="value" placeholder="Movement Type" />
                <DatePicker v-model="form.effectiveDate" placeholder="Effective Date" date-format="yy-mm-dd" show-icon />
                <Select v-model="form.status" :options="editableStatusOptions" option-label="label" option-value="value" placeholder="Status" />
                <Textarea v-model="form.reason" placeholder="Reason" rows="3" class="span-2" />
            </div>
            <template #footer><Button label="Cancel" severity="secondary" @click="dialogVisible = false" /><Button label="Save" :loading="movementStore.saving" @click="submitForm" /></template>
        </Dialog>

        <Dialog v-model:visible="archiveDialogVisible" header="Archive Employee Movement" modal><p>Archive this employee movement?</p><template #footer><Button label="Cancel" severity="secondary" @click="archiveDialogVisible = false" /><Button label="Archive" severity="danger" :loading="movementStore.archiving" @click="archiveSelected" /></template></Dialog>
        <Dialog v-model:visible="importDialogVisible" header="Import Employee Movements" modal><input ref="fileInputRef" type="file" accept=".xlsx" @change="onImportFileChange" /><ProgressBar v-if="movementStore.importing" :value="movementStore.importProgress" /><template #footer><Button label="Cancel" severity="secondary" @click="importDialogVisible = false" /><Button label="Import" :disabled="!selectedImportFile" :loading="movementStore.importing" @click="submitImport" /></template></Dialog>
        <Dialog v-model:visible="importResultDialogVisible" header="Import Result" modal><pre>{{ movementStore.importSummary }}</pre></Dialog>
    </section>
</template>

<style scoped>
.report-page { display: flex; flex-direction: column; gap: 1rem; }
.report-card { border-radius: 24px; }
.report-title-row { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
.report-title-row h1 { margin: 0; font-size: 1.25rem; }
.report-title-row p { margin: .3rem 0 0; color: var(--text-color-secondary); font-size: .82rem; }
.report-actions, .row-actions { display: flex; gap: .45rem; align-items: center; flex-wrap: wrap; }
.filter-grid, .form-grid { display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: .7rem; margin-bottom: 1rem; }
.form-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)); }
.span-2 { grid-column: span 2; }
.compact-table :deep(.p-datatable-thead > tr > th), .compact-table :deep(.p-datatable-tbody > tr > td) { text-align: center; font-size: .76rem; }
.report-dialog { width: min(760px, 96vw); }
pre { white-space: pre-wrap; font-size: .78rem; }
@media (max-width: 900px) { .filter-grid, .form-grid { grid-template-columns: 1fr; } .span-2 { grid-column: auto; } .report-title-row { flex-direction: column; } }
</style>
