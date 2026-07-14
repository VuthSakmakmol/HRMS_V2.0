<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { apiClient } from "@/shared/services/apiClient.js"
import { useAuthStore } from "@/app/stores/auth.store.js"
import AppFilterBar from "@/shared/components/filter/AppFilterBar.vue"
import AppTableActions from "@/shared/components/table/AppTableActions.vue"
import InternalCalendarDatePicker from "@/modules/calendar/components/InternalCalendarDatePicker.vue"
import { useEmployeeStore } from "../stores/employee.store.js"

const toast = useToast()
const authStore = useAuthStore()
const employeeStore = useEmployeeStore()

const PERMISSIONS = Object.freeze({
    CREATE: "EMPLOYEE.PROFILE.CREATE",
    UPDATE: "EMPLOYEE.PROFILE.UPDATE",
    ARCHIVE: "EMPLOYEE.PROFILE.ARCHIVE",
    IMPORT: "EMPLOYEE.PROFILE.IMPORT",
    EXPORT: "EMPLOYEE.PROFILE.EXPORT",
})

const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.CREATE))
const canUpdate = computed(() => authStore.hasPermission(PERMISSIONS.UPDATE))
const canArchive = computed(() => authStore.hasPermission(PERMISSIONS.ARCHIVE))
const canImport = computed(() => authStore.hasPermission(PERMISSIONS.IMPORT))
const canExport = computed(() => authStore.hasPermission(PERMISSIONS.EXPORT))

const options = reactive({
    companies: [], branches: [], departments: [], positions: [], lines: [], shifts: [], employeeTypes: [], recruitmentChannels: [],
    provinces: [], districts: [], communes: [], villages: [],
})

const loadingOptions = ref(false)
const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedEmployeeId = ref(null)
const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)
const importDialogVisible = ref(false)
const importResultDialogVisible = ref(false)
const selectedImportFile = ref(null)
const fileInputRef = ref(null)
const formErrors = ref({})
const showAdvancedFilters = ref(false)

const filters = reactive({
    search: "",
    employmentStatus: "ALL",
    recordStatus: "ACTIVE",
    companyId: "",
    branchId: "",
    departmentId: "",
    positionId: "",
    lineId: "",
    shiftId: "",
})

const form = reactive(createEmptyForm())


const employmentStatusOptions = [
    { label: "All employment statuses", value: "ALL" },
    { label: "Working", value: "WORKING" },
    { label: "Resigned", value: "RESIGNED" },
    { label: "Terminated", value: "TERMINATED" },
    { label: "Abandoned", value: "ABANDONED" },
    { label: "Passed Away", value: "PASSED_AWAY" },
    { label: "Retired", value: "RETIRED" },
]

const recordStatusOptions = [
    { label: "Active records", value: "ACTIVE" },
    { label: "Inactive records", value: "INACTIVE" },
    { label: "Archived records", value: "ARCHIVED" },
    { label: "All records", value: "ALL" },
]

const genderOptions = [
    { label: "Male", value: "MALE" },
    { label: "Female", value: "FEMALE" },
    { label: "Other", value: "OTHER" },
    { label: "Unknown", value: "UNKNOWN" },
]

const maritalOptions = [
    { label: "Single", value: "SINGLE" },
    { label: "Married", value: "MARRIED" },
    { label: "Divorced", value: "DIVORCED" },
    { label: "Widowed", value: "WIDOWED" },
    { label: "Unknown", value: "UNKNOWN" },
]

const statusEditOptions = employmentStatusOptions.filter((item) => item.value !== "ALL")
const recordEditOptions = recordStatusOptions.filter((item) => item.value !== "ALL" && item.value !== "ARCHIVED")

const dialogTitle = computed(() => dialogMode.value === "create" ? "Create Employee" : "Edit Employee")

function createEmptyForm() {
    return {
        employeeCode: "", profileImageUrl: "", createAccount: true, defaultRoleId: null,
        khmerFirstName: "", khmerLastName: "", englishFirstName: "", englishLastName: "", displayName: "",
        gender: "UNKNOWN", dateOfBirth: "",
        email: "", phoneNumber: "", agentPhoneNumber: "", agentPerson: "", note: "",
        maritalStatus: "UNKNOWN", spouseName: "", spouseContactNumber: "",
        education: "", religion: "", nationality: "Khmer",
        birthAddress: { provinceId: "", districtId: "", communeId: "", villageId: "", detail: "" },
        livingAddress: { provinceId: "", districtId: "", communeId: "", villageId: "", detail: "" },
        companyId: "", branchId: "", departmentId: "", positionId: "", lineId: "", shiftId: "",
        joinDate: "", employmentStatus: "WORKING", resignDate: "", resignReason: "", remark: "",
        documents: { idCardNo: "", idCardExpireDate: "", nssfNo: "", passportNo: "", passportExpireDate: "", visaExpireDate: "", medicalCheckNo: "", medicalCheckDate: "", workingBookNo: "" },
        sourceOfHiring: "", recruitmentChannelId: "", introducerEmployeeId: "", employeeTypeId: "",
        machineSkills: { singleNeedle: 0, overlock: 0, coverstitch: 0, totalMachines: 0 },
        recordStatus: "ACTIVE",
    }
}

function assignForm(source = createEmptyForm()) {
    const next = createEmptyForm()
    Object.assign(next, source)
    next.birthAddress = { ...createEmptyForm().birthAddress, ...(source.birthAddress || {}) }
    next.livingAddress = { ...createEmptyForm().livingAddress, ...(source.livingAddress || {}) }
    next.documents = { ...createEmptyForm().documents, ...(source.documents || {}) }
    next.machineSkills = { ...createEmptyForm().machineSkills, ...(source.machineSkills || {}) }
    Object.assign(form, next)
}

function optionLabel(item, primary = "name") {
    const code = item.code || item.employeeCode || ""
    const label = item[primary] || item.title || item.displayName || item.name || code
    return code ? `${code} - ${label}` : label
}

function mapOptions(items, primary) {
    return (items || []).map((item) => ({ label: optionLabel(item, primary), value: item.id }))
}

const companyOptions = computed(() => mapOptions(options.companies, "displayName"))
const filterCompanyOptions = computed(() => mapOptions(options.companies, "displayName"))
const filterBranchOptions = computed(() => mapOptions(
    options.branches.filter((item) => !filters.companyId || item.companyId === filters.companyId),
    "name",
))
const filterDepartmentOptions = computed(() => mapOptions(
    options.departments.filter((item) =>
        (!filters.companyId || item.companyId === filters.companyId) &&
        (!filters.branchId || item.branchId === filters.branchId),
    ),
    "name",
))
const filterPositionOptions = computed(() => mapOptions(
    options.positions.filter((item) => !filters.departmentId || item.departmentId === filters.departmentId),
    "title",
))
const filterLineOptions = computed(() => mapOptions(
    options.lines.filter((item) => !filters.departmentId || item.departmentId === filters.departmentId),
    "name",
))
const filterShiftOptions = computed(() => mapOptions(
    options.shifts.filter((item) => !filters.branchId || item.branchId === filters.branchId),
    "name",
))
const branchOptions = computed(() => mapOptions(options.branches.filter((item) => !form.companyId || item.companyId === form.companyId), "name"))
const departmentOptions = computed(() => mapOptions(options.departments.filter((item) => (!form.companyId || item.companyId === form.companyId) && (!form.branchId || item.branchId === form.branchId)), "name"))
const positionOptions = computed(() => mapOptions(options.positions.filter((item) => (!form.departmentId || item.departmentId === form.departmentId)), "title"))
const lineOptions = computed(() => mapOptions(options.lines.filter((item) => (!form.departmentId || item.departmentId === form.departmentId)), "name"))
const shiftOptions = computed(() => mapOptions(options.shifts.filter((item) => (!form.branchId || item.branchId === form.branchId)), "name"))
const employeeTypeOptions = computed(() => mapOptions(options.employeeTypes, "name"))
const recruitmentChannelOptions = computed(() =>
    mapOptions(
        options.recruitmentChannels.filter((item) => {
            if (item.companyId && form.companyId && item.companyId !== form.companyId) {
                return false
            }

            if (item.branchId && form.branchId && item.branchId !== form.branchId) {
                return false
            }

            return true
        }),
        "name",
    ),
)
const provinceOptions = computed(() => mapOptions(options.provinces, "name"))
const districtOptions = computed(() => mapOptions(options.districts, "name"))
const communeOptions = computed(() => mapOptions(options.communes, "name"))
const villageOptions = computed(() => mapOptions(options.villages, "name"))

function formatDate(value) {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return date.toISOString().slice(0, 10)
}

function toDateOrNull(value) {
    return value || null
}

function buildPayload() {
    return {
        ...form,
        dateOfBirth: toDateOrNull(form.dateOfBirth),
        joinDate: toDateOrNull(form.joinDate),
        resignDate: toDateOrNull(form.resignDate),
        documents: {
            ...form.documents,
            idCardExpireDate: toDateOrNull(form.documents.idCardExpireDate),
            passportExpireDate: toDateOrNull(form.documents.passportExpireDate),
            visaExpireDate: toDateOrNull(form.documents.visaExpireDate),
            medicalCheckDate: toDateOrNull(form.documents.medicalCheckDate),
        },
        introducerEmployeeId: form.introducerEmployeeId || null,
        employeeTypeId: form.employeeTypeId || null,
        recruitmentChannelId: form.recruitmentChannelId || null,
    }
}

function buildUpdatePayload() {
    const payload = buildPayload()
    delete payload.companyId
    delete payload.branchId
    delete payload.createAccount
    delete payload.defaultRoleId
    return payload
}

function getErrorMessage(error) {
    return error?.response?.data?.error?.messageKey || error?.message || "Something went wrong."
}

function applyBackendFieldErrors(error) {
    formErrors.value = error?.response?.data?.error?.fields || {}
}

function fieldError(field) {
    const value = formErrors.value[field]
    return Array.isArray(value) ? value[0] : ""
}

function normalizeCode() {
    form.employeeCode = form.employeeCode.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_-]/g, "")
}

function statusSeverity(status) {
    if (status === "WORKING" || status === "ACTIVE") return "success"
    if (status === "RESIGNED" || status === "RETIRED" || status === "INACTIVE") return "warn"
    if (status === "TERMINATED" || status === "ABANDONED" || status === "PASSED_AWAY" || status === "ARCHIVED") return "danger"
    return "secondary"
}

function cleanLookupParams(params = {}) {
    const clean = {}

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") {
            continue
        }

        clean[key] = value
    }

    return clean
}

async function fetchListPage(endpoint, params = {}) {
    const response = await apiClient.get(endpoint, {
        params: cleanLookupParams(params),
    })

    return response.data.data || {
        items: [],
        pagination: {
            page: params.page || 1,
            limit: params.limit || 100,
            total: 0,
            totalPages: 1,
        },
    }
}

async function fetchList(endpoint, params = {}) {
    const items = []
    const limit = 100
    let page = 1
    let totalPages = 1

    do {
        const data = await fetchListPage(endpoint, {
            page,
            limit,
            status: "ACTIVE",
            ...params,
        })

        const pageItems = data.items || []
        const pagination = data.pagination || {}

        items.push(...pageItems)

        totalPages = Number(pagination.totalPages || 1)
        page += 1
    } while (page <= totalPages)

    return items
}

async function fetchOptionalList(endpoints, params = {}) {
    for (const endpoint of endpoints) {
        try {
            return await fetchList(endpoint, params)
        } catch (error) {
            if (![404, 422].includes(error?.response?.status)) {
                throw error
            }
        }
    }

    return []
}

async function loadOptions() {
    loadingOptions.value = true
    try {
        const [companies, branches, departments, positions, lines, shifts, employeeTypes, recruitmentChannels, provinces, districts, communes, villages] = await Promise.all([
            fetchList("/organization/companies"),
            fetchList("/organization/branches"),
            fetchList("/organization/departments"),
            fetchList("/organization/positions"),
            fetchList("/organization/lines"),
            fetchList("/organization/shifts"),
            fetchOptionalList([
                "/organization/employee-types",
                "/employee-types",
                "/setup/employee-types",
            ]),
            fetchOptionalList([
                "/organization/recruitment-channels",
                "/recruitment-channels",
                "/setup/recruitment-channels",
            ]),
            fetchList("/organization/locations/provinces"),
            fetchList("/organization/locations/districts"),
            fetchList("/organization/locations/communes"),
            fetchList("/organization/locations/villages"),
        ])
        Object.assign(options, { companies, branches, departments, positions, lines, shifts, employeeTypes, recruitmentChannels, provinces, districts, communes, villages })
    } catch (error) {
        toast.add({ severity: "warn", summary: "Some dropdowns failed", detail: getErrorMessage(error), life: 5000 })
    } finally {
        loadingOptions.value = false
    }
}

async function loadEmployees(params = {}) {
    try { await employeeStore.loadEmployees(params) }
    catch (error) { toast.add({ severity: "error", summary: "Unable to load employees", detail: getErrorMessage(error), life: 5000 }) }
}

function onFilterCompanyChange() {
    filters.branchId = ""
    filters.departmentId = ""
    filters.positionId = ""
    filters.lineId = ""
    filters.shiftId = ""
}

function onFilterBranchChange() {
    filters.departmentId = ""
    filters.positionId = ""
    filters.lineId = ""
    filters.shiftId = ""
}

function onFilterDepartmentChange() {
    filters.positionId = ""
    filters.lineId = ""
}

function closeEmployeeDialog() {
    dialogVisible.value = false
    selectedEmployeeId.value = null
    formErrors.value = {}
}

function applyFilters() {
    loadEmployees({ page: 1, ...filters })
}

function clearFilters() {
    Object.assign(filters, { search: "", employmentStatus: "ALL", recordStatus: "ACTIVE", companyId: "", branchId: "", departmentId: "", positionId: "", lineId: "", shiftId: "" })
    applyFilters()
}

function onPage(event) {
    loadEmployees({ page: event.page + 1, limit: event.rows })
}

async function openCreateDialog() {
    formErrors.value = {}
    dialogMode.value = "create"
    selectedEmployeeId.value = null
    assignForm(createEmptyForm())
    dialogVisible.value = true
}

async function openEditDialog(employee) {
    formErrors.value = {}
    dialogMode.value = "edit"
    selectedEmployeeId.value = employee.id
    assignForm({
        ...employee,
        dateOfBirth: formatDate(employee.dateOfBirth),
        joinDate: formatDate(employee.joinDate),
        resignDate: formatDate(employee.resignDate),
        documents: {
            ...employee.documents,
            idCardExpireDate: formatDate(employee.documents?.idCardExpireDate),
            passportExpireDate: formatDate(employee.documents?.passportExpireDate),
            visaExpireDate: formatDate(employee.documents?.visaExpireDate),
            medicalCheckDate: formatDate(employee.documents?.medicalCheckDate),
        },
    })
    await previewApproval()
    dialogVisible.value = true
}

async function saveEmployee() {
    formErrors.value = {}
    try {
        if (dialogMode.value === "create") await employeeStore.createEmployee(buildPayload())
        else await employeeStore.updateEmployee(selectedEmployeeId.value, buildUpdatePayload())
        toast.add({ severity: "success", summary: "Employee saved", life: 3000 })
        dialogVisible.value = false
        await loadEmployees()
    } catch (error) {
        applyBackendFieldErrors(error)
        toast.add({ severity: "error", summary: "Unable to save employee", detail: getErrorMessage(error), life: 6000 })
    }
}

function openArchiveDialog(employee) {
    archiveCandidate.value = employee
    archiveDialogVisible.value = true
}

async function confirmArchive() {
    try {
        await employeeStore.archiveEmployee(archiveCandidate.value.id)
        archiveDialogVisible.value = false
        archiveCandidate.value = null
        toast.add({ severity: "success", summary: "Employee archived", life: 3000 })
        await loadEmployees()
    } catch (error) {
        toast.add({ severity: "error", summary: "Unable to archive", detail: getErrorMessage(error), life: 5000 })
    }
}

function resetRecruitmentChannelIfInvalid() {
    const selected = options.recruitmentChannels.find((item) => item.id === form.recruitmentChannelId)

    if (!selected) return

    if (selected.companyId && form.companyId && selected.companyId !== form.companyId) {
        form.recruitmentChannelId = ""
        return
    }

    if (selected.branchId && form.branchId && selected.branchId !== form.branchId) {
        form.recruitmentChannelId = ""
    }
}

async function previewApproval() {
    resetRecruitmentChannelIfInvalid()
    if (!form.companyId || !form.branchId) return
    try {
        await employeeStore.loadApprovalPreview({ moduleKey: "EMPLOYEE_CHANGE", companyId: form.companyId, branchId: form.branchId, departmentId: form.departmentId || undefined, positionId: form.positionId || undefined, lineId: form.lineId || undefined })
    } catch (error) {
        toast.add({ severity: "warn", summary: "Approval preview unavailable", detail: getErrorMessage(error), life: 4000 })
    }
}

async function downloadSample() {
    try { await employeeStore.downloadImportTemplate() }
    catch (error) { toast.add({ severity: "error", summary: "Unable to download sample", detail: getErrorMessage(error), life: 5000 }) }
}

async function exportExcel() {
    try { await employeeStore.exportEmployees() }
    catch (error) { toast.add({ severity: "error", summary: "Unable to export", detail: getErrorMessage(error), life: 5000 }) }
}

function onImportFileChange(event) {
    selectedImportFile.value = event.target.files?.[0] || null
}

async function submitImport() {
    if (!selectedImportFile.value) return toast.add({ severity: "warn", summary: "Please select an Excel file", life: 3000 })
    try {
        await employeeStore.importEmployees(selectedImportFile.value, { companyId: filters.companyId || undefined, branchId: filters.branchId || undefined })
        importDialogVisible.value = false
        importResultDialogVisible.value = true
        await loadEmployees()
    } catch (error) {
        toast.add({ severity: "error", summary: "Import failed", detail: getErrorMessage(error), life: 6000 })
    }
}

onMounted(async () => {
    await Promise.all([loadOptions(), loadEmployees()])
})
</script>

<template>
    <section class="employee-page hrms-list-page">
        <AppFilterBar :loading="employeeStore.loading || loadingOptions">
            <span class="app-filter-field app-filter-field--search employee-search">
                <i class="pi pi-search" aria-hidden="true" />
                <InputText
                    v-model="filters.search"
                    placeholder="Search employee ID, name, phone..."
                    @keyup.enter="applyFilters"
                />
            </span>

            <Select
                v-model="filters.companyId"
                class="app-filter-field"
                :options="[{ label: 'All companies', value: '' }, ...filterCompanyOptions]"
                option-label="label"
                option-value="value"
                placeholder="Company"
                @change="onFilterCompanyChange"
            />

            <Select
                v-model="filters.branchId"
                class="app-filter-field"
                :options="[{ label: 'All branches', value: '' }, ...filterBranchOptions]"
                option-label="label"
                option-value="value"
                placeholder="Branch"
                @change="onFilterBranchChange"
            />

            <Select
                v-model="filters.employmentStatus"
                class="app-filter-field"
                :options="employmentStatusOptions"
                option-label="label"
                option-value="value"
                placeholder="Employment status"
            />

            <Select
                v-model="filters.recordStatus"
                class="app-filter-field"
                :options="recordStatusOptions"
                option-label="label"
                option-value="value"
                placeholder="Record status"
            />

            <template #actions>
                <Button
                    icon="pi pi-filter"
                    label="Apply"
                    :loading="employeeStore.loading"
                    @click="applyFilters"
                />

                <Button
                    v-tooltip.top="showAdvancedFilters ? 'Hide advanced filters' : 'More filters'"
                    severity="secondary"
                    outlined
                    :icon="showAdvancedFilters ? 'pi pi-chevron-up' : 'pi pi-sliders-h'"
                    aria-label="More filters"
                    @click="showAdvancedFilters = !showAdvancedFilters"
                />

                <Button
                    v-tooltip.top="'Clear filters'"
                    severity="secondary"
                    outlined
                    icon="pi pi-times"
                    aria-label="Clear filters"
                    :disabled="employeeStore.loading"
                    @click="clearFilters"
                />

                <Button
                    v-tooltip.top="'Refresh'"
                    severity="secondary"
                    outlined
                    icon="pi pi-refresh"
                    aria-label="Refresh"
                    :loading="employeeStore.loading"
                    @click="loadEmployees"
                />

                <Button
                    v-if="canImport"
                    v-tooltip.top="'Download sample'"
                    severity="secondary"
                    outlined
                    icon="pi pi-download"
                    aria-label="Download sample"
                    :loading="employeeStore.downloadingTemplate"
                    @click="downloadSample"
                />

                <Button
                    v-if="canImport"
                    v-tooltip.top="'Import Excel'"
                    severity="secondary"
                    outlined
                    icon="pi pi-upload"
                    aria-label="Import Excel"
                    @click="importDialogVisible = true"
                />

                <Button
                    v-if="canExport"
                    v-tooltip.top="'Export Excel'"
                    severity="secondary"
                    outlined
                    icon="pi pi-file-export"
                    aria-label="Export Excel"
                    :loading="employeeStore.exporting"
                    @click="exportExcel"
                />

                <Button
                    v-if="canCreate"
                    icon="pi pi-plus"
                    label="New Employee"
                    @click="openCreateDialog"
                />
            </template>
        </AppFilterBar>

        <section v-if="showAdvancedFilters" class="employee-advanced-filters hrms-card hrms-compact">
            <Select
                v-model="filters.departmentId"
                :options="[{ label: 'All departments', value: '' }, ...filterDepartmentOptions]"
                option-label="label"
                option-value="value"
                placeholder="Department"
                @change="onFilterDepartmentChange"
            />
            <Select
                v-model="filters.positionId"
                :options="[{ label: 'All positions', value: '' }, ...filterPositionOptions]"
                option-label="label"
                option-value="value"
                placeholder="Position"
            />
            <Select
                v-model="filters.lineId"
                :options="[{ label: 'All lines', value: '' }, ...filterLineOptions]"
                option-label="label"
                option-value="value"
                placeholder="Line"
            />
            <Select
                v-model="filters.shiftId"
                :options="[{ label: 'All shifts', value: '' }, ...filterShiftOptions]"
                option-label="label"
                option-value="value"
                placeholder="Shift"
            />
        </section>

        <div class="employee-table-shell hrms-list-card">
            <div class="hrms-table-wrap employee-table-scroll">
                <DataTable
                    class="hrms-standard-table hrms-standard-table--horizontal"
                    lazy
                    paginator
                    striped-rows
                    data-key="id"
                    size="small"
                    :value="employeeStore.items"
                    :loading="employeeStore.loading"
                    :rows="employeeStore.pagination.limit"
                    :first="(employeeStore.pagination.page - 1) * employeeStore.pagination.limit"
                    :total-records="employeeStore.pagination.total"
                    :rows-per-page-options="[10, 20, 50, 100]"
                    empty-message="No employees found."
                    @page="onPage"
                >
                    <Column header="No" style="min-width: 4rem; width: 4rem">
                        <template #body="{ index }">
                            {{ (employeeStore.pagination.page - 1) * employeeStore.pagination.limit + index + 1 }}
                        </template>
                    </Column>

                    <Column field="employeeCode" header="Employee ID" style="min-width: 9rem">
                        <template #body="{ data }">
                            <span class="employee-code">{{ data.employeeCode || "-" }}</span>
                        </template>
                    </Column>

                    <Column header="Name" style="min-width: 14rem">
                        <template #body="{ data }">
                            <span>{{ data.displayName || `${data.englishFirstName || ""} ${data.englishLastName || ""}`.trim() || "-" }}</span>
                        </template>
                    </Column>

                    <Column header="Company" style="min-width: 11rem">
                        <template #body="{ data }">{{ data.company?.displayName || data.company?.name || "-" }}</template>
                    </Column>

                    <Column header="Branch" style="min-width: 10rem">
                        <template #body="{ data }">{{ data.branch?.name || "-" }}</template>
                    </Column>

                    <Column header="Department" style="min-width: 11rem">
                        <template #body="{ data }">{{ data.department?.name || "-" }}</template>
                    </Column>

                    <Column header="Position" style="min-width: 11rem">
                        <template #body="{ data }">{{ data.position?.title || data.position?.name || "-" }}</template>
                    </Column>

                    <Column header="Line" style="min-width: 9rem">
                        <template #body="{ data }">{{ data.line?.name || "-" }}</template>
                    </Column>

                    <Column header="Shift" style="min-width: 9rem">
                        <template #body="{ data }">{{ data.shift?.name || "-" }}</template>
                    </Column>

                    <Column header="Employee Type" style="min-width: 11rem">
                        <template #body="{ data }">{{ data.employeeType?.name || "-" }}</template>
                    </Column>

                    <Column header="Phone" style="min-width: 9rem">
                        <template #body="{ data }">{{ data.phoneNumber || "-" }}</template>
                    </Column>

                    <Column header="Join Date" style="min-width: 8rem">
                        <template #body="{ data }">{{ formatDate(data.joinDate) || "-" }}</template>
                    </Column>

                    <Column header="Employment" style="min-width: 9rem">
                        <template #body="{ data }">
                            <Tag class="employee-status-tag" :severity="statusSeverity(data.employmentStatus)" :value="data.employmentStatus || '-'" />
                        </template>
                    </Column>

                    <Column header="Record" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag class="employee-status-tag" :severity="statusSeverity(data.recordStatus)" :value="data.recordStatus || '-'" />
                        </template>
                    </Column>

                    <Column v-if="canUpdate || canArchive" header="Actions" style="min-width: 6.5rem">
                        <template #body="{ data }">
                            <AppTableActions
                                :can-edit="canUpdate && data.recordStatus !== 'ARCHIVED'"
                                :can-archive="canArchive && data.recordStatus !== 'ARCHIVED'"
                                :disabled="employeeStore.saving || employeeStore.archiving"
                                edit-label="Edit employee"
                                archive-label="Archive employee"
                                @edit="openEditDialog(data)"
                                @archive="openArchiveDialog(data)"
                            />
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            :header="dialogTitle"
            class="employee-dialog hrms-standard-dialog"
            :draggable="false"
            :closable="!employeeStore.saving"
        >
            <div class="employee-dialog-layout">
                <div class="employee-form-overview">
                    <i class="pi pi-info-circle" />
                    <span>All employee information is shown below. Scroll through each section and complete the fields you need.</span>
                </div>

                <div class="employee-form-content">
                    <section class="employee-form-section">
                        <div class="employee-section-heading">
                            <i class="pi pi-id-card" />
                            <div><h3>Identity</h3><p>Employee number and personal identity.</p></div>
                        </div>
                        <div class="employee-form-grid">
                            <label class="employee-field"><span>Employee ID *</span><InputText v-model="form.employeeCode" :disabled="dialogMode === 'edit'" placeholder="EMP001" @input="normalizeCode" /><small v-if="fieldError('employeeCode')">{{ fieldError("employeeCode") }}</small></label>
                            <label v-if="dialogMode === 'create'" class="employee-field employee-account-option"><span>Create Login Account</span><span class="employee-checkbox-line"><input v-model="form.createAccount" type="checkbox" /> Create account automatically</span><small>Login ID uses Employee ID. Initial password uses Employee ID + phone number.</small></label>
                            <label class="employee-field"><span>Display Name *</span><InputText v-model="form.displayName" placeholder="Employee display name" /></label>
                            <label class="employee-field"><span>English First Name</span><InputText v-model="form.englishFirstName" /></label>
                            <label class="employee-field"><span>English Last Name</span><InputText v-model="form.englishLastName" /></label>
                            <label class="employee-field"><span>Khmer First Name</span><InputText v-model="form.khmerFirstName" /></label>
                            <label class="employee-field"><span>Khmer Last Name</span><InputText v-model="form.khmerLastName" /></label>
                            <label class="employee-field"><span>Gender</span><Select v-model="form.gender" :options="genderOptions" option-label="label" option-value="value" /></label>
                            <label class="employee-field"><span>Date of Birth</span><InternalCalendarDatePicker v-model="form.dateOfBirth" :show-status="false" compact /></label>
                            <label class="employee-field employee-field--wide"><span>Profile Image URL</span><InputText v-model="form.profileImageUrl" placeholder="https://..." /></label>
                        </div>
                    </section>

                    <section class="employee-form-section">
                        <div class="employee-section-heading"><i class="pi pi-sitemap" /><div><h3>Organization Assignment</h3><p>Work location, role, shift, and employment status.</p></div></div>
                        <div class="employee-form-grid">
                            <label class="employee-field"><span>Company *</span><Select v-model="form.companyId" :disabled="dialogMode === 'edit'" :loading="loadingOptions" :options="companyOptions" option-label="label" option-value="value" placeholder="Select company" @change="previewApproval" /></label>
                            <label class="employee-field"><span>Branch *</span><Select v-model="form.branchId" :disabled="dialogMode === 'edit'" :options="branchOptions" option-label="label" option-value="value" placeholder="Select branch" @change="previewApproval" /></label>
                            <label class="employee-field"><span>Department</span><Select v-model="form.departmentId" :options="departmentOptions" option-label="label" option-value="value" placeholder="Select department" show-clear @change="previewApproval" /></label>
                            <label class="employee-field"><span>Position</span><Select v-model="form.positionId" :options="positionOptions" option-label="label" option-value="value" placeholder="Select position" show-clear @change="previewApproval" /></label>
                            <label class="employee-field"><span>Line</span><Select v-model="form.lineId" :options="lineOptions" option-label="label" option-value="value" placeholder="Select line" show-clear @change="previewApproval" /></label>
                            <label class="employee-field"><span>Shift</span><Select v-model="form.shiftId" :options="shiftOptions" option-label="label" option-value="value" placeholder="Select shift" show-clear /></label>
                            <label class="employee-field"><span>Employee Type</span><Select v-model="form.employeeTypeId" :options="employeeTypeOptions" option-label="label" option-value="value" placeholder="Select employee type" show-clear /></label>
                            <label class="employee-field"><span>Join Date *</span><InternalCalendarDatePicker v-model="form.joinDate" :company-id="form.companyId" :branch-id="form.branchId" compact /><small v-if="fieldError('joinDate')">{{ fieldError("joinDate") }}</small></label>
                            <label class="employee-field"><span>Employment Status</span><Select v-model="form.employmentStatus" :options="statusEditOptions" option-label="label" option-value="value" /></label>
                            <label class="employee-field"><span>Record Status</span><Select v-model="form.recordStatus" :options="recordEditOptions" option-label="label" option-value="value" /></label>
                            <label class="employee-field"><span>Resign Date</span><InternalCalendarDatePicker v-model="form.resignDate" :company-id="form.companyId" :branch-id="form.branchId" compact /></label>
                            <label class="employee-field"><span>Resign Reason</span><InputText v-model="form.resignReason" /></label>
                            <label class="employee-field"><span>Recruitment Channel</span><Select v-model="form.recruitmentChannelId" :options="recruitmentChannelOptions" option-label="label" option-value="value" placeholder="Select channel" show-clear /></label>
                            <label class="employee-field"><span>Source of Hiring</span><InputText v-model="form.sourceOfHiring" /></label>
                            <label class="employee-field employee-field--wide"><span>Remark</span><Textarea v-model="form.remark" rows="3" auto-resize /></label>
                        </div>
                    </section>

                    <section class="employee-form-section">
                        <div class="employee-section-heading"><i class="pi pi-address-book" /><div><h3>Contact & Family</h3><p>Contact details and personal background.</p></div></div>
                        <div class="employee-form-grid">
                            <label class="employee-field"><span>Phone Number *</span><InputText v-model="form.phoneNumber" placeholder="012345678" /><small v-if="fieldError('phoneNumber')">{{ fieldError("phoneNumber") }}</small></label>
                            <label class="employee-field"><span>Email</span><InputText v-model="form.email" type="email" /></label>
                            <label class="employee-field"><span>Agent Person</span><InputText v-model="form.agentPerson" /></label>
                            <label class="employee-field"><span>Agent Phone</span><InputText v-model="form.agentPhoneNumber" /></label>
                            <label class="employee-field"><span>Marital Status</span><Select v-model="form.maritalStatus" :options="maritalOptions" option-label="label" option-value="value" /></label>
                            <label class="employee-field"><span>Spouse Name</span><InputText v-model="form.spouseName" /></label>
                            <label class="employee-field"><span>Spouse Contact</span><InputText v-model="form.spouseContactNumber" /></label>
                            <label class="employee-field"><span>Education</span><InputText v-model="form.education" /></label>
                            <label class="employee-field"><span>Religion</span><InputText v-model="form.religion" /></label>
                            <label class="employee-field"><span>Nationality</span><InputText v-model="form.nationality" /></label>
                            <label class="employee-field employee-field--wide"><span>Note</span><Textarea v-model="form.note" rows="3" auto-resize /></label>
                        </div>
                    </section>

                    <section class="employee-form-section">
                        <div class="employee-section-heading"><i class="pi pi-map-marker" /><div><h3>Addresses</h3><p>Birthplace and current living address.</p></div></div>
                        <div class="employee-address-columns">
                            <div class="employee-address-card"><h4>Birth Address</h4><div class="employee-form-grid employee-form-grid--two"><label class="employee-field"><span>Province</span><Select v-model="form.birthAddress.provinceId" :options="provinceOptions" option-label="label" option-value="value" show-clear /></label><label class="employee-field"><span>District</span><Select v-model="form.birthAddress.districtId" :options="districtOptions" option-label="label" option-value="value" show-clear /></label><label class="employee-field"><span>Commune</span><Select v-model="form.birthAddress.communeId" :options="communeOptions" option-label="label" option-value="value" show-clear /></label><label class="employee-field"><span>Village</span><Select v-model="form.birthAddress.villageId" :options="villageOptions" option-label="label" option-value="value" show-clear /></label><label class="employee-field employee-field--wide"><span>Address Detail</span><Textarea v-model="form.birthAddress.detail" rows="3" auto-resize /></label></div></div>
                            <div class="employee-address-card"><h4>Living Address</h4><div class="employee-form-grid employee-form-grid--two"><label class="employee-field"><span>Province</span><Select v-model="form.livingAddress.provinceId" :options="provinceOptions" option-label="label" option-value="value" show-clear /></label><label class="employee-field"><span>District</span><Select v-model="form.livingAddress.districtId" :options="districtOptions" option-label="label" option-value="value" show-clear /></label><label class="employee-field"><span>Commune</span><Select v-model="form.livingAddress.communeId" :options="communeOptions" option-label="label" option-value="value" show-clear /></label><label class="employee-field"><span>Village</span><Select v-model="form.livingAddress.villageId" :options="villageOptions" option-label="label" option-value="value" show-clear /></label><label class="employee-field employee-field--wide"><span>Address Detail</span><Textarea v-model="form.livingAddress.detail" rows="3" auto-resize /></label></div></div>
                        </div>
                    </section>

                    <section class="employee-form-section">
                        <div class="employee-section-heading"><i class="pi pi-folder" /><div><h3>Documents & Skills</h3><p>Official documents and machine capabilities.</p></div></div>
                        <div class="employee-form-grid">
                            <label class="employee-field"><span>ID Card Number</span><InputText v-model="form.documents.idCardNo" /></label>
                            <label class="employee-field"><span>ID Card Expire</span><InternalCalendarDatePicker v-model="form.documents.idCardExpireDate" :show-status="false" compact /></label>
                            <label class="employee-field"><span>NSSF Number</span><InputText v-model="form.documents.nssfNo" /></label>
                            <label class="employee-field"><span>Passport Number</span><InputText v-model="form.documents.passportNo" /></label>
                            <label class="employee-field"><span>Passport Expire</span><InternalCalendarDatePicker v-model="form.documents.passportExpireDate" :show-status="false" compact /></label>
                            <label class="employee-field"><span>Visa Expire</span><InternalCalendarDatePicker v-model="form.documents.visaExpireDate" :show-status="false" compact /></label>
                            <label class="employee-field"><span>Medical Check Number</span><InputText v-model="form.documents.medicalCheckNo" /></label>
                            <label class="employee-field"><span>Medical Check Date</span><InternalCalendarDatePicker v-model="form.documents.medicalCheckDate" :company-id="form.companyId" :branch-id="form.branchId" compact /></label>
                            <label class="employee-field"><span>Working Book Number</span><InputText v-model="form.documents.workingBookNo" /></label>
                            <label class="employee-field"><span>Single Needle</span><InputNumber v-model="form.machineSkills.singleNeedle" :min="0" :max="999" /></label>
                            <label class="employee-field"><span>Overlock</span><InputNumber v-model="form.machineSkills.overlock" :min="0" :max="999" /></label>
                            <label class="employee-field"><span>Coverstitch</span><InputNumber v-model="form.machineSkills.coverstitch" :min="0" :max="999" /></label>
                            <label class="employee-field"><span>Total Machines</span><InputNumber v-model="form.machineSkills.totalMachines" :min="0" :max="999" /></label>
                        </div>
                    </section>

                    <section class="employee-form-section">
                        <div class="employee-section-heading"><i class="pi pi-check-circle" /><div><h3>Approval Chain Preview</h3><p>Resolved approval path based on the current organization assignment.</p></div></div>
                        <div v-if="employeeStore.approvalLoading" class="employee-empty-state"><i class="pi pi-spin pi-spinner" /><span>Loading approval chain...</span></div>
                        <div v-else-if="employeeStore.approvalPreview?.steps?.length" class="employee-approval-list"><div v-for="step in employeeStore.approvalPreview.steps" :key="step.level" class="employee-approval-step"><span class="employee-approval-level">{{ step.level }}</span><div><strong>{{ step.approverType }}</strong><span>{{ step.resolvedApprover ? `${step.resolvedApprover.employeeCode} - ${step.resolvedApprover.displayName}` : "No approver resolved" }}</span></div></div></div>
                        <div v-else class="employee-empty-state"><i class="pi pi-info-circle" /><span>No approval policy matched yet. The employee can still be saved.</span></div>
                    </section>
                </div>
            </div>

            <template #footer>
                <Button severity="secondary" outlined label="Cancel" :disabled="employeeStore.saving" @click="closeEmployeeDialog" />
                <Button icon="pi pi-save" label="Save Employee" :loading="employeeStore.saving" @click="saveEmployee" />
            </template>
        </Dialog>

        <Dialog v-model:visible="archiveDialogVisible" modal header="Archive Employee" :draggable="false" class="employee-small-dialog">
            <p>Archive <strong>{{ archiveCandidate?.displayName || archiveCandidate?.employeeCode }}</strong>? The employee record will remain available for history.</p>
            <template #footer><Button severity="secondary" outlined label="Cancel" @click="archiveDialogVisible = false" /><Button severity="danger" icon="pi pi-inbox" label="Archive" :loading="employeeStore.archiving" @click="confirmArchive" /></template>
        </Dialog>

        <Dialog v-model:visible="importDialogVisible" modal header="Import Employees" :draggable="false" class="employee-small-dialog" :closable="!employeeStore.importing">
            <div class="employee-import-box"><p>Upload the completed Employee Excel template. Company and branch filters are used as defaults when those columns are empty.</p><div class="employee-import-note"><i class="pi pi-info-circle" /><span>When createAccount is YES: Login ID = Employee ID, and initial password = Employee ID + phone number.</span></div><input ref="fileInputRef" type="file" accept=".xlsx" :disabled="employeeStore.importing" @change="onImportFileChange" /><span v-if="selectedImportFile" class="employee-muted">{{ selectedImportFile.name }}</span><div v-if="employeeStore.importing" class="employee-import-progress"><ProgressBar :value="employeeStore.importProgress" /><span>Processing {{ employeeStore.importProgress }}%</span></div></div>
            <template #footer><Button severity="secondary" outlined label="Cancel" :disabled="employeeStore.importing" @click="importDialogVisible = false" /><Button icon="pi pi-upload" label="Import" :loading="employeeStore.importing" :disabled="!selectedImportFile" @click="submitImport" /></template>
        </Dialog>

        <Dialog v-model:visible="importResultDialogVisible" modal header="Employee Import Result" :draggable="false" class="employee-result-dialog">
            <div v-if="employeeStore.importSummary" class="employee-result-grid"><div><span>Total</span><strong>{{ employeeStore.importSummary.totalRows }}</strong></div><div><span>Created</span><strong>{{ employeeStore.importSummary.created }}</strong></div><div><span>Updated</span><strong>{{ employeeStore.importSummary.updated }}</strong></div><div><span>Skipped</span><strong>{{ employeeStore.importSummary.skipped }}</strong></div><div><span>Accounts Created</span><strong>{{ employeeStore.importSummary.accountsCreated || 0 }}</strong></div><div><span>Accounts Existing</span><strong>{{ employeeStore.importSummary.accountsExisting || 0 }}</strong></div><div><span>Accounts Skipped</span><strong>{{ employeeStore.importSummary.accountsSkipped || 0 }}</strong></div></div>
            <DataTable v-if="employeeStore.importSummary?.errors?.length" class="hrms-standard-table" size="small" :value="employeeStore.importSummary.errors"><Column field="rowNumber" header="Row" /><Column field="field" header="Field" /><Column field="messageKey" header="Issue" /></DataTable>
            <template #footer><Button label="Close" @click="importResultDialogVisible = false" /></template>
        </Dialog>
    </section>
</template>
<style scoped>
.employee-page { width: 100%; min-width: 0; }
.employee-search { position: relative; display: flex; align-items: center; }
.employee-search > i { position: absolute; left: 0.75rem; z-index: 1; color: var(--hrms-text-muted); pointer-events: none; }
.employee-search :deep(.p-inputtext) { width: 100%; padding-left: 2.25rem; }
.employee-advanced-filters { display: grid; grid-template-columns: repeat(4, minmax(10rem, 1fr)); gap: var(--hrms-filter-gap); margin: calc(var(--hrms-page-gap) * -0.45) 0 var(--hrms-page-gap); }
.employee-advanced-filters :deep(.p-select) { width: 100%; }
.employee-table-shell { min-width: 0; overflow: hidden; }
.employee-table-scroll { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scroll-behavior: smooth; overscroll-behavior-inline: contain; }
.employee-table-scroll :deep(.p-datatable) { min-width: 112rem; }
.employee-code { color: var(--hrms-color-primary); font-weight: 400; }
.employee-status-tag { font-weight: 400; }
:deep(.employee-status-tag .p-tag-label) { font-weight: 400; }
:deep(.p-datatable-thead > tr > th) { text-align: center; vertical-align: middle; white-space: nowrap; font-weight: 700; }
:deep(.p-datatable-tbody > tr > td) { text-align: center; vertical-align: middle; white-space: nowrap; font-weight: 400; }
.employee-dialog { width: min(76rem, calc(100vw - 1.5rem)); }
.employee-dialog-layout { display: grid; gap: 0.85rem; min-height: min(36rem, calc(100vh - 13rem)); max-height: calc(100vh - 13rem); overflow: hidden; }
.employee-form-overview { display: flex; align-items: center; gap: 0.55rem; padding: 0.7rem 0.8rem; border: 1px solid var(--surface-border); border-radius: 0.65rem; background: var(--surface-50); color: var(--text-color-secondary); font-size: 0.78rem; }
.employee-form-overview i { color: var(--primary-color); }
.employee-form-content { display: grid; gap: 0.85rem; min-width: 0; overflow-y: auto; padding: 0.15rem 0.35rem 1rem 0.15rem; scroll-behavior: smooth; overscroll-behavior: contain; }
.employee-form-section { display: grid; gap: 1rem; padding: 1rem; border: 1px solid var(--surface-border); border-radius: 0.75rem; background: var(--surface-card); }
.employee-section-heading { display: flex; align-items: flex-start; gap: 0.7rem; padding-bottom: 0.8rem; border-bottom: 1px solid var(--hrms-border-color); }
.employee-section-heading > i { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 0.55rem; color: var(--hrms-color-primary); background: var(--hrms-color-primary-soft); }
.employee-section-heading h3 { margin: 0; font-size: 0.95rem; }
.employee-section-heading p { margin: 0.2rem 0 0; color: var(--hrms-text-muted); font-size: 0.76rem; }
.employee-form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.8rem; }
.employee-form-grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.employee-field { display: grid; align-content: start; gap: 0.35rem; min-width: 0; }
.employee-field > span:first-child { color: var(--hrms-text-muted); font-size: 0.75rem; font-weight: 700; }
.employee-field > small { color: var(--hrms-color-danger); font-size: 0.7rem; line-height: 1.35; }
.employee-field--wide { grid-column: 1 / -1; }
.employee-field :deep(.p-component), .employee-field :deep(.p-inputtext), .employee-field :deep(.p-select), .employee-field :deep(.p-inputnumber), .employee-field :deep(.p-inputnumber-input), .employee-field :deep(textarea) { width: 100%; }
.employee-account-option { padding: 0.65rem 0.75rem; border: 1px solid var(--hrms-border-color); border-radius: 0.65rem; background: var(--hrms-surface-ground); }
.employee-checkbox-line { display: inline-flex; align-items: center; gap: 0.45rem; min-height: 1.75rem; font-size: 0.78rem; }
.employee-address-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.8rem; }
.employee-address-card { min-width: 0; padding: 0.9rem; border: 1px solid var(--hrms-border-color); border-radius: 0.75rem; background: var(--hrms-surface-ground); }
.employee-address-card h4 { margin: 0 0 0.8rem; font-size: 0.84rem; }
.employee-approval-list { display: grid; gap: 0.6rem; }
.employee-approval-step { display: grid; grid-template-columns: 2rem minmax(0, 1fr); align-items: center; gap: 0.7rem; padding: 0.7rem; border: 1px solid var(--hrms-border-color); border-radius: 0.7rem; }
.employee-approval-step > div { display: grid; gap: 0.15rem; }
.employee-approval-step span { color: var(--hrms-text-muted); font-size: 0.75rem; }
.employee-approval-level { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 999px; color: var(--hrms-color-primary) !important; background: var(--hrms-color-primary-soft); font-weight: 700; }
.employee-empty-state { display: flex; align-items: center; justify-content: center; gap: 0.5rem; min-height: 10rem; color: var(--hrms-text-muted); font-size: 0.8rem; }
.employee-small-dialog { width: min(34rem, calc(100vw - 1.5rem)); }
.employee-result-dialog { width: min(58rem, calc(100vw - 1.5rem)); }
.employee-import-box { display: grid; gap: 0.9rem; }
.employee-import-box p { margin: 0; line-height: 1.5; }
.employee-import-note { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.7rem; border-radius: 0.65rem; background: var(--hrms-color-primary-soft); color: var(--hrms-text-muted); font-size: 0.76rem; }
.employee-import-progress { display: grid; gap: 0.35rem; }
.employee-import-progress span, .employee-muted { color: var(--hrms-text-muted); font-size: 0.75rem; }
.employee-result-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.65rem; margin-bottom: 1rem; }
.employee-result-grid > div { display: grid; gap: 0.2rem; padding: 0.75rem; border: 1px solid var(--hrms-border-color); border-radius: 0.65rem; background: var(--hrms-surface-ground); }
.employee-result-grid span { color: var(--hrms-text-muted); font-size: 0.72rem; }
.employee-result-grid strong { font-size: 1.2rem; }
@media (max-width: 1050px) {
    .employee-advanced-filters {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .employee-dialog-layout {
        max-height: calc(100vh - 12rem);
    }

    .employee-form-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 720px) {
    .employee-advanced-filters,
    .employee-form-grid,
    .employee-form-grid--two,
    .employee-address-columns,
    .employee-result-grid {
        grid-template-columns: 1fr;
    }

    .employee-dialog {
        width: calc(100vw - 0.75rem);
    }

    .employee-dialog-layout {
        min-height: calc(100vh - 11rem);
        max-height: calc(100vh - 11rem);
    }

    .employee-form-section {
        padding: 0.8rem;
    }

    .employee-field--wide {
        grid-column: auto;
    }
}
</style>
