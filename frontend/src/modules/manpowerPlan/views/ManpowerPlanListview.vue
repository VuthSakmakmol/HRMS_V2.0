<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
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

import { useAuthStore } from "@/app/stores/auth.store.js"
import AppFilterBar from "@/shared/components/filter/AppFilterBar.vue"
import AppTableActions from "@/shared/components/table/AppTableActions.vue"
import AppPaginator from "@/shared/components/table/AppPaginator.vue"
import { fetchBranchesLookup } from "@/modules/organization/services/branch.api.js"
import { fetchCompaniesLookup } from "@/modules/organization/services/company.api.js"
import { fetchDepartmentsLookup } from "@/modules/organization/services/department.api.js"
import { fetchPositionsLookup } from "@/modules/organization/services/position.api.js"
import { fetchLines } from "@/modules/line/services/line.api.js"
import { fetchShifts } from "@/modules/shift/services/shift.api.js"
import { fetchEmployeeTypes } from "@/modules/employeeType/services/employeeType.api.js"

import { useManpowerPlanStore } from "../stores/manpowerPlan.store.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const manpowerPlanStore = useManpowerPlanStore()

const PERMISSIONS = Object.freeze({
    CREATE: "REPORT.MANPOWER_PLAN.CREATE",
    UPDATE: "REPORT.MANPOWER_PLAN.UPDATE",
    ARCHIVE: "REPORT.MANPOWER_PLAN.ARCHIVE",
    IMPORT: "REPORT.MANPOWER_PLAN.IMPORT",
    EXPORT: "REPORT.MANPOWER_PLAN.EXPORT",
})

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

const companies = ref([])
const branches = ref([])
const departments = ref([])
const positions = ref([])
const lines = ref([])
const shifts = ref([])
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

const filters = reactive(createDefaultFilters())
const form = reactive(createEmptyForm())

const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.CREATE))
const canUpdate = computed(() => authStore.hasPermission(PERMISSIONS.UPDATE))
const canArchive = computed(() => authStore.hasPermission(PERMISSIONS.ARCHIVE))
const canImport = computed(() => authStore.hasPermission(PERMISSIONS.IMPORT))
const canExport = computed(() => authStore.hasPermission(PERMISSIONS.EXPORT))

const statusOptions = computed(() => [
    { label: t("manpowerPlan.all"), value: "ALL" },
    { label: t("manpowerPlan.active"), value: "ACTIVE" },
    { label: t("manpowerPlan.inactive"), value: "INACTIVE" },
    { label: t("manpowerPlan.archived"), value: "ARCHIVED" },
])

const editableStatusOptions = computed(() => [
    { label: t("manpowerPlan.active"), value: "ACTIVE" },
    { label: t("manpowerPlan.inactive"), value: "INACTIVE" },
])

const monthOptions = computed(() => [
    { label: t("manpowerPlan.allMonths"), value: "" },
    ...Array.from({ length: 12 }, (_, index) => ({
        label: String(index + 1),
        value: index + 1,
    })),
])

const formMonthOptions = Array.from({ length: 12 }, (_, index) => ({
    label: String(index + 1),
    value: index + 1,
}))

const companyOptions = computed(() =>
    companies.value.map((item) => ({
        label: `${item.code} - ${item.displayName}`,
        value: item.id,
    })),
)

const companyFilterOptions = computed(() => [
    { label: t("manpowerPlan.company"), value: "" },
    ...companyOptions.value,
])

const filteredBranchesForFilter = computed(() =>
    branches.value.filter(
        (item) => !filters.companyId || item.companyId === filters.companyId,
    ),
)

const branchFilterOptions = computed(() => [
    { label: t("manpowerPlan.branch"), value: "" },
    ...filteredBranchesForFilter.value.map((item) => ({
        label: `${item.code} - ${item.name}`,
        value: item.id,
    })),
])

const departmentFilterOptions = computed(() => [
    { label: t("manpowerPlan.department"), value: "" },
    ...departments.value
        .filter((item) => !filters.branchId || item.branchId === filters.branchId)
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: item.id,
        })),
])

const positionFilterOptions = computed(() => [
    { label: t("manpowerPlan.position"), value: "" },
    ...positions.value
        .filter(
            (item) =>
                !filters.departmentId ||
                item.departmentId === filters.departmentId,
        )
        .map((item) => ({
            label: `${item.code} - ${item.title}`,
            value: item.id,
        })),
])

const lineFilterOptions = computed(() => [
    { label: t("manpowerPlan.line"), value: "" },
    ...lines.value
        .filter((item) => matchesDepartment(item, filters.departmentId))
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: item.id,
        })),
])

const shiftFilterOptions = computed(() => [
    { label: t("manpowerPlan.shift"), value: "" },
    ...shifts.value
        .filter((item) => !filters.branchId || item.branchId === filters.branchId)
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: item.id,
        })),
])

const employeeTypeFilterOptions = computed(() => [
    { label: t("manpowerPlan.employeeType"), value: "" },
    ...employeeTypes.value
        .filter(
            (item) => !filters.companyId || item.companyId === filters.companyId,
        )
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: item.id,
        })),
])

const employeeTypeChildFilterOptions = computed(() => {
    const employeeType = employeeTypes.value.find(
        (item) => item.id === filters.employeeTypeId,
    )

    return [
        { label: t("manpowerPlan.childGroup"), value: "" },
        ...(employeeType?.children || []).map((child) => ({
            label: `${child.code} - ${child.name}`,
            value: child.id,
        })),
    ]
})

const branchOptions = computed(() =>
    branches.value
        .filter((item) => !form.companyId || item.companyId === form.companyId)
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: item.id,
        })),
)

const departmentOptions = computed(() =>
    departments.value
        .filter((item) => !form.branchId || item.branchId === form.branchId)
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: item.id,
        })),
)

const positionOptions = computed(() =>
    positions.value
        .filter(
            (item) =>
                !form.departmentId || item.departmentId === form.departmentId,
        )
        .map((item) => ({
            label: `${item.code} - ${item.title}`,
            value: item.id,
        })),
)

const lineOptions = computed(() =>
    lines.value
        .filter((item) => matchesDepartment(item, form.departmentId))
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: item.id,
        })),
)

const shiftOptions = computed(() =>
    shifts.value
        .filter((item) => !form.branchId || item.branchId === form.branchId)
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: item.id,
        })),
)

const employeeTypeOptions = computed(() =>
    employeeTypes.value
        .filter((item) => !form.companyId || item.companyId === form.companyId)
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: item.id,
        })),
)

const childOptions = computed(() => {
    const employeeType = employeeTypes.value.find(
        (item) => item.id === form.employeeTypeId,
    )

    return [
        { label: "Directly under type", value: "" },
        ...(employeeType?.children || []).map((child) => ({
            label: `${child.code} - ${child.name}`,
            value: child.id,
        })),
    ]
})

const dialogTitle = computed(() =>
    dialogMode.value === "create"
        ? t("manpowerPlan.createTitle")
        : t("manpowerPlan.editTitle"),
)

function createDefaultFilters() {
    return {
        search: "",
        status: "ACTIVE",
        companyId: "",
        branchId: "",
        year: currentYear,
        month: "",
        departmentId: "",
        positionId: "",
        lineId: "",
        shiftId: "",
        employeeTypeId: "",
        employeeTypeChildId: "",
    }
}

function createEmptyForm() {
    return {
        companyId: "",
        branchId: "",
        year: currentYear,
        month: currentMonth,
        departmentId: "",
        positionId: "",
        lineId: "",
        shiftId: "",
        employeeTypeId: "",
        employeeTypeChildId: "",
        targetBudget: 0,
        targetRoadmap: 0,
        remark: "",
        status: "ACTIVE",
    }
}

function matchesDepartment(item, departmentId) {
    if (!departmentId) return true

    if (item.departmentId === departmentId) return true

    return Array.isArray(item.departmentIds) &&
        item.departmentIds.includes(departmentId)
}

function getErrorMessage(error) {
    const messageKey = error?.response?.data?.error?.messageKey

    if (messageKey) {
        const translated = t(messageKey)
        return translated === messageKey ? t("errors.internal") : translated
    }

    return (
        error?.response?.data?.message ||
        error?.message ||
        t("errors.internal")
    )
}

function assignForm(source = createEmptyForm()) {
    Object.assign(form, createEmptyForm(), {
        ...source,
        companyId: source.companyId || "",
        branchId: source.branchId || "",
        departmentId: source.departmentId || "",
        positionId: source.positionId || "",
        lineId: source.lineId || "",
        shiftId: source.shiftId || "",
        employeeTypeId: source.employeeTypeId || "",
        employeeTypeChildId: source.employeeTypeChildId || "",
        targetBudget: Number(source.targetBudget || 0),
        targetRoadmap: Number(source.targetRoadmap || 0),
        status: source.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    })
}

function buildPayload() {
    return {
        companyId: form.companyId,
        branchId: form.branchId,
        year: Number(form.year),
        month: Number(form.month),
        departmentId: form.departmentId || null,
        positionId: form.positionId || null,
        lineId: form.lineId || null,
        shiftId: form.shiftId || null,
        employeeTypeId: form.employeeTypeId || null,
        employeeTypeChildId: form.employeeTypeChildId || null,
        targetBudget: Number(form.targetBudget || 0),
        targetRoadmap: Number(form.targetRoadmap || 0),
        remark: form.remark?.trim() || "",
        status: form.status,
    }
}

function validateForm() {
    if (!form.companyId || !form.branchId || !form.year || !form.month) {
        toast.add({
            severity: "warn",
            summary: t("errors.validationFailed"),
            detail: "Company, branch, year and month are required.",
            life: 3500,
        })
        return false
    }

    return true
}

async function loadOptions() {
    loadingOptions.value = true

    try {
        const [
            companyResult,
            branchResult,
            departmentResult,
            positionResult,
            lineResult,
            shiftResult,
            employeeTypeResult,
        ] = await Promise.all([
            fetchCompaniesLookup({ page: 1, limit: 1000, status: "ACTIVE" }),
            fetchBranchesLookup({ page: 1, limit: 1000, status: "ACTIVE" }),
            fetchDepartmentsLookup({ page: 1, limit: 1000, status: "ACTIVE" }),
            fetchPositionsLookup({ page: 1, limit: 1000, status: "ACTIVE" }),
            fetchLines({ page: 1, limit: 1000, status: "ACTIVE" }),
            fetchShifts({ page: 1, limit: 1000, status: "ACTIVE" }),
            fetchEmployeeTypes({ page: 1, limit: 1000, status: "ACTIVE" }),
        ])

        companies.value = companyResult || []
        branches.value = branchResult || []
        departments.value = departmentResult || []
        positions.value = positionResult || []
        lines.value = lineResult?.items || lineResult || []
        shifts.value = shiftResult?.items || shiftResult || []
        employeeTypes.value = employeeTypeResult?.items || employeeTypeResult || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: "Failed to load setup data",
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        loadingOptions.value = false
    }
}

async function loadPlans(page = manpowerPlanStore.pagination.page, limit = manpowerPlanStore.pagination.limit) {
    try {
        await manpowerPlanStore.loadManpowerPlans({
            ...filters,
            page,
            limit,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: "Failed to load manpower plans",
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function applyFilters() {
    loadPlans(1, manpowerPlanStore.pagination.limit)
}

function clearFilters() {
    Object.assign(filters, createDefaultFilters())
    loadPlans(1, manpowerPlanStore.pagination.limit)
}

function onPage(event) {
    loadPlans(event.page, event.rows)
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
    if (!validateForm()) return

    try {
        if (dialogMode.value === "create") {
            await manpowerPlanStore.createManpowerPlan(buildPayload())
            toast.add({
                severity: "success",
                summary: "Created",
                detail: "Manpower plan created.",
                life: 2500,
            })
        } else {
            await manpowerPlanStore.updateManpowerPlan(
                selectedId.value,
                buildPayload(),
            )
            toast.add({
                severity: "success",
                summary: "Updated",
                detail: "Manpower plan updated.",
                life: 2500,
            })
        }

        dialogVisible.value = false
        await loadPlans()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: "Save failed",
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function confirmArchive(item) {
    archiveCandidate.value = item
    archiveDialogVisible.value = true
}

async function archiveSelected() {
    if (!archiveCandidate.value?.id) return

    try {
        await manpowerPlanStore.archiveManpowerPlan(archiveCandidate.value.id)
        toast.add({
            severity: "success",
            summary: "Archived",
            detail: "Manpower plan archived.",
            life: 2500,
        })
        archiveDialogVisible.value = false
        archiveCandidate.value = null
        await loadPlans()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: "Archive failed",
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

async function downloadSample() {
    try {
        await manpowerPlanStore.downloadImportTemplate()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: "Download failed",
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

async function exportPlans() {
    try {
        manpowerPlanStore.filters = {
            ...manpowerPlanStore.filters,
            ...filters,
        }
        await manpowerPlanStore.exportManpowerPlans()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: "Export failed",
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function onImportFileChange(event) {
    selectedImportFile.value = event.target.files?.[0] || null
}

function closeImportDialog() {
    if (manpowerPlanStore.importing) return

    importDialogVisible.value = false
    selectedImportFile.value = null

    if (fileInputRef.value) {
        fileInputRef.value.value = ""
    }
}

async function submitImport() {
    if (!selectedImportFile.value) return

    try {
        await manpowerPlanStore.importManpowerPlans(selectedImportFile.value)
        closeImportDialog()
        importResultDialogVisible.value = true
        await loadPlans(1, manpowerPlanStore.pagination.limit)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: "Import failed",
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function getStatusSeverity(status) {
    if (status === "ACTIVE") return "success"
    if (status === "ARCHIVED") return "danger"
    return "secondary"
}

function getStatusLabel(status) {
    const option = statusOptions.value.find((item) => item.value === status)
    return option?.label || status || "-"
}

function getEmployeeTypeDisplay(data) {
    if (!data.employeeType?.name) return "-"

    return data.employeeTypeChildName
        ? `${data.employeeType.name} / ${data.employeeTypeChildName}`
        : data.employeeType.name
}

function formatDateTime(value) {
    if (!value) return "-"

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "-"

    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date)
}

watch(
    () => filters.companyId,
    () => {
        filters.branchId = ""
        filters.departmentId = ""
        filters.positionId = ""
        filters.lineId = ""
        filters.shiftId = ""
        filters.employeeTypeId = ""
        filters.employeeTypeChildId = ""
    },
)

watch(
    () => filters.branchId,
    () => {
        filters.departmentId = ""
        filters.positionId = ""
        filters.lineId = ""
        filters.shiftId = ""
    },
)

watch(
    () => filters.departmentId,
    () => {
        filters.positionId = ""
        filters.lineId = ""
    },
)

watch(
    () => filters.employeeTypeId,
    () => {
        filters.employeeTypeChildId = ""
    },
)

watch(
    () => form.companyId,
    (value, oldValue) => {
        if (oldValue === undefined) return
        form.branchId = ""
        form.departmentId = ""
        form.positionId = ""
        form.lineId = ""
        form.shiftId = ""
        form.employeeTypeId = ""
        form.employeeTypeChildId = ""
    },
)

watch(
    () => form.branchId,
    (value, oldValue) => {
        if (oldValue === undefined) return
        form.departmentId = ""
        form.positionId = ""
        form.lineId = ""
        form.shiftId = ""
    },
)

watch(
    () => form.departmentId,
    (value, oldValue) => {
        if (oldValue === undefined) return
        form.positionId = ""
        form.lineId = ""
    },
)

watch(
    () => form.employeeTypeId,
    (value, oldValue) => {
        if (oldValue === undefined) return
        form.employeeTypeChildId = ""
    },
)

onMounted(async () => {
    await Promise.all([loadOptions(), loadPlans(1)])
})
</script>

<template>
    <section class="manpower-plan-page hrms-list-page">
        <AppFilterBar :loading="manpowerPlanStore.loading || loadingOptions">
            <span class="app-filter-field app-filter-field--search manpower-search">
                <i class="pi pi-search" />

                <InputText
                    v-model="filters.search"
                    :placeholder="t('manpowerPlan.search')"
                    @keyup.enter="applyFilters"
                />
            </span>

            <Select
                v-model="filters.companyId"
                class="app-filter-field"
                :options="companyFilterOptions"
                option-label="label"
                option-value="value"
                filter
            />

            <Select
                v-model="filters.branchId"
                class="app-filter-field"
                :options="branchFilterOptions"
                option-label="label"
                option-value="value"
                filter
                :disabled="!filters.companyId"
            />

            <InputNumber
                v-model="filters.year"
                class="app-filter-field manpower-year-filter"
                :placeholder="t('manpowerPlan.year')"
                :min="2000"
                :max="2100"
                :use-grouping="false"
                @keyup.enter="applyFilters"
            />

            <Select
                v-model="filters.month"
                class="app-filter-field manpower-month-filter"
                :options="monthOptions"
                option-label="label"
                option-value="value"
                :placeholder="t('manpowerPlan.month')"
            />

            <Select
                v-model="filters.employeeTypeId"
                class="app-filter-field"
                :options="employeeTypeFilterOptions"
                option-label="label"
                option-value="value"
                filter
            />

            <Select
                v-model="filters.status"
                class="app-filter-field manpower-status-filter"
                :options="statusOptions"
                option-label="label"
                option-value="value"
            />


            <Select
                v-model="filters.departmentId"
                class="app-filter-field"
                :options="departmentFilterOptions"
                option-label="label"
                option-value="value"
                placeholder="Department"
                filter
                show-clear
                :disabled="!filters.branchId"
            />

            <Select
                v-model="filters.positionId"
                class="app-filter-field"
                :options="positionFilterOptions"
                option-label="label"
                option-value="value"
                placeholder="Position"
                filter
                show-clear
                :disabled="!filters.departmentId"
            />

            <Select
                v-model="filters.lineId"
                class="app-filter-field"
                :options="lineFilterOptions"
                option-label="label"
                option-value="value"
                placeholder="Line"
                filter
                show-clear
                :disabled="!filters.departmentId"
            />

            <Select
                v-model="filters.shiftId"
                class="app-filter-field"
                :options="shiftFilterOptions"
                option-label="label"
                option-value="value"
                placeholder="Shift"
                filter
                show-clear
                :disabled="!filters.branchId"
            />

            <Select
                v-model="filters.employeeTypeChildId"
                class="app-filter-field"
                :options="employeeTypeChildFilterOptions"
                option-label="label"
                option-value="value"
                placeholder="Child group"
                filter
                show-clear
                :disabled="!filters.employeeTypeId"
            />

            <template #actions>
                <Button
                    icon="pi pi-filter"
                    :label="t('manpowerPlan.apply')"
                    :loading="manpowerPlanStore.loading"
                    @click="applyFilters"
                />

                <Button
                    v-tooltip.top="t('common.clear')"
                    severity="secondary"
                    outlined
                    icon="pi pi-times"
                    :aria-label="t('common.clear')"
                    :disabled="manpowerPlanStore.loading"
                    @click="clearFilters"
                />

                <Button
                    v-tooltip.top="t('common.refresh')"
                    severity="secondary"
                    outlined
                    icon="pi pi-refresh"
                    :aria-label="t('common.refresh')"
                    :loading="manpowerPlanStore.loading"
                    @click="loadPlans()"
                />

                <Button
                    v-if="canImport"
                    v-tooltip.top="t('manpowerPlan.sample')"
                    severity="secondary"
                    outlined
                    icon="pi pi-download"
                    :aria-label="t('manpowerPlan.sample')"
                    :loading="manpowerPlanStore.downloadingTemplate"
                    @click="downloadSample"
                />

                <Button
                    v-if="canImport"
                    v-tooltip.top="t('manpowerPlan.import')"
                    severity="secondary"
                    outlined
                    icon="pi pi-upload"
                    :aria-label="t('manpowerPlan.import')"
                    @click="importDialogVisible = true"
                />

                <Button
                    v-if="canExport"
                    v-tooltip.top="t('manpowerPlan.export')"
                    severity="secondary"
                    outlined
                    icon="pi pi-file-excel"
                    :aria-label="t('manpowerPlan.export')"
                    :loading="manpowerPlanStore.exporting"
                    @click="exportPlans"
                />

                <Button
                    v-if="canCreate"
                    icon="pi pi-plus"
                    :label="t('manpowerPlan.new')"
                    :disabled="manpowerPlanStore.loading"
                    @click="openCreateDialog"
                />
            </template>
        </AppFilterBar>


        <div class="manpower-table-shell hrms-list-card">
            <div class="hrms-table-wrap manpower-table-wrap">
                <DataTable
                    class="hrms-standard-table hrms-standard-table--horizontal manpower-table"
                    lazy
                    striped-rows
                    data-key="id"
                    size="small"
                    :value="manpowerPlanStore.items"
                    :loading="manpowerPlanStore.loading || loadingOptions"
                    :rows="manpowerPlanStore.pagination.limit"
                >
                    <Column header="No" style="min-width: 4rem">
                        <template #body="{ index }">
                            {{
                                (manpowerPlanStore.pagination.page - 1) *
                                    manpowerPlanStore.pagination.limit +
                                index +
                                1
                            }}
                        </template>
                    </Column>

                    <Column
                        field="year"
                        :header="t('manpowerPlan.year')"
                        style="min-width: 5rem"
                    />

                    <Column
                        field="month"
                        :header="t('manpowerPlan.month')"
                        style="min-width: 5rem"
                    />

                    <Column
                        :header="t('manpowerPlan.company')"
                        style="min-width: 11rem"
                    >
                        <template #body="{ data }">
                            <span class="manpower-cell" :title="data.company?.displayName || ''">
                                {{ data.company?.displayName || data.company?.name || "-" }}
                            </span>
                        </template>
                    </Column>

                    <Column
                        :header="t('manpowerPlan.branch')"
                        style="min-width: 10rem"
                    >
                        <template #body="{ data }">
                            <span class="manpower-cell" :title="data.branch?.name || ''">
                                {{ data.branch?.name || "-" }}
                            </span>
                        </template>
                    </Column>

                    <Column
                        :header="t('manpowerPlan.department')"
                        style="min-width: 11rem"
                    >
                        <template #body="{ data }">
                            <span class="manpower-cell" :title="data.department?.name || ''">
                                {{ data.department?.name || "-" }}
                            </span>
                        </template>
                    </Column>

                    <Column
                        :header="t('manpowerPlan.position')"
                        style="min-width: 12rem"
                    >
                        <template #body="{ data }">
                            <span class="manpower-cell" :title="data.position?.title || ''">
                                {{ data.position?.title || "-" }}
                            </span>
                        </template>
                    </Column>

                    <Column
                        :header="t('manpowerPlan.line')"
                        style="min-width: 9rem"
                    >
                        <template #body="{ data }">
                            <span class="manpower-cell" :title="data.line?.name || ''">
                                {{ data.line?.name || "-" }}
                            </span>
                        </template>
                    </Column>

                    <Column
                        :header="t('manpowerPlan.shift')"
                        style="min-width: 9rem"
                    >
                        <template #body="{ data }">
                            <span class="manpower-cell" :title="data.shift?.name || ''">
                                {{ data.shift?.name || "-" }}
                            </span>
                        </template>
                    </Column>

                    <Column
                        :header="t('manpowerPlan.type')"
                        style="min-width: 13rem"
                    >
                        <template #body="{ data }">
                            <span class="manpower-cell" :title="getEmployeeTypeDisplay(data)">
                                {{ getEmployeeTypeDisplay(data) }}
                            </span>
                        </template>
                    </Column>

                    <Column
                        field="targetBudget"
                        :header="t('manpowerPlan.budget')"
                        style="min-width: 7rem"
                    />

                    <Column
                        field="targetRoadmap"
                        :header="t('manpowerPlan.roadmap')"
                        style="min-width: 8rem"
                    />

                    <Column
                        :header="t('manpowerPlan.remark')"
                        style="min-width: 14rem"
                    >
                        <template #body="{ data }">
                            <span class="manpower-cell" :title="data.remark || ''">
                                {{ data.remark || "-" }}
                            </span>
                        </template>
                    </Column>

                    <Column
                        :header="t('manpowerPlan.status')"
                        style="min-width: 7rem"
                    >
                        <template #body="{ data }">
                            <Tag
                                class="manpower-status-tag"
                                :value="getStatusLabel(data.status)"
                                :severity="getStatusSeverity(data.status)"
                            />
                        </template>
                    </Column>

                    <Column header="Updated" style="min-width: 10rem">
                        <template #body="{ data }">
                            {{ formatDateTime(data.updatedAt) }}
                        </template>
                    </Column>

                    <Column
                        v-if="canUpdate || canArchive"
                        :header="t('manpowerPlan.action')"
                        style="min-width: 6rem"
                    >
                        <template #body="{ data }">
                            <AppTableActions
                                :can-edit="canUpdate && data.status !== 'ARCHIVED'"
                                :can-archive="canArchive && data.status !== 'ARCHIVED'"
                                :edit-label="t('common.edit')"
                                :archive-label="t('common.archive')"
                                :disabled="manpowerPlanStore.saving || manpowerPlanStore.archiving"
                                @edit="openEditDialog(data)"
                                @archive="confirmArchive(data)"
                            />
                        </template>
                    </Column>
                </DataTable>
            </div>

            <AppPaginator
                :page="manpowerPlanStore.pagination.page"
                :rows="manpowerPlanStore.pagination.limit"
                :total-records="manpowerPlanStore.pagination.total"
                :disabled="manpowerPlanStore.loading"
                @page="onPage"
            />
        </div>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            class="manpower-dialog hrms-standard-dialog"
            :header="dialogTitle"
            :draggable="false"
        >
            <div class="hrms-dialog-form">
                <section class="hrms-form-section">
                    <h3>Plan period and organization</h3>

                    <div class="hrms-form-grid">
                        <label class="hrms-form-field">
                            <span>{{ t("manpowerPlan.company") }} *</span>
                            <Select
                                v-model="form.companyId"
                                :options="companyOptions"
                                option-label="label"
                                option-value="value"
                                filter
                                :placeholder="t('manpowerPlan.company')"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("manpowerPlan.branch") }} *</span>
                            <Select
                                v-model="form.branchId"
                                :options="branchOptions"
                                option-label="label"
                                option-value="value"
                                filter
                                :disabled="!form.companyId"
                                :placeholder="t('manpowerPlan.branch')"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("manpowerPlan.year") }} *</span>
                            <InputNumber
                                v-model="form.year"
                                :min="2000"
                                :max="2100"
                                :use-grouping="false"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("manpowerPlan.month") }} *</span>
                            <Select
                                v-model="form.month"
                                :options="formMonthOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("manpowerPlan.department") }}</span>
                            <Select
                                v-model="form.departmentId"
                                :options="departmentOptions"
                                option-label="label"
                                option-value="value"
                                filter
                                show-clear
                                :disabled="!form.branchId"
                                :placeholder="t('manpowerPlan.department')"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("manpowerPlan.position") }}</span>
                            <Select
                                v-model="form.positionId"
                                :options="positionOptions"
                                option-label="label"
                                option-value="value"
                                filter
                                show-clear
                                :disabled="!form.departmentId"
                                :placeholder="t('manpowerPlan.position')"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("manpowerPlan.line") }}</span>
                            <Select
                                v-model="form.lineId"
                                :options="lineOptions"
                                option-label="label"
                                option-value="value"
                                filter
                                show-clear
                                :disabled="!form.departmentId"
                                :placeholder="t('manpowerPlan.line')"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("manpowerPlan.shift") }}</span>
                            <Select
                                v-model="form.shiftId"
                                :options="shiftOptions"
                                option-label="label"
                                option-value="value"
                                filter
                                show-clear
                                :disabled="!form.branchId"
                                :placeholder="t('manpowerPlan.shift')"
                            />
                        </label>
                    </div>
                </section>

                <section class="hrms-form-section">
                    <h3>Employee type and targets</h3>

                    <div class="hrms-form-grid">
                        <label class="hrms-form-field">
                            <span>{{ t("manpowerPlan.employeeType") }}</span>
                            <Select
                                v-model="form.employeeTypeId"
                                :options="employeeTypeOptions"
                                option-label="label"
                                option-value="value"
                                filter
                                show-clear
                                :placeholder="t('manpowerPlan.employeeType')"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("manpowerPlan.childGroup") }}</span>
                            <Select
                                v-model="form.employeeTypeChildId"
                                :options="childOptions"
                                option-label="label"
                                option-value="value"
                                filter
                                show-clear
                                :disabled="!form.employeeTypeId"
                                :placeholder="t('manpowerPlan.childGroup')"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("manpowerPlan.targetBudget") }}</span>
                            <InputNumber
                                v-model="form.targetBudget"
                                :min="0"
                                :use-grouping="false"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("manpowerPlan.targetRoadmap") }}</span>
                            <InputNumber
                                v-model="form.targetRoadmap"
                                :min="0"
                                :use-grouping="false"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("manpowerPlan.status") }}</span>
                            <Select
                                v-model="form.status"
                                :options="editableStatusOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </label>

                        <label class="hrms-form-field hrms-form-field--wide">
                            <span>{{ t("manpowerPlan.remark") }}</span>
                            <Textarea
                                v-model="form.remark"
                                rows="3"
                                auto-resize
                                :placeholder="t('manpowerPlan.remark')"
                            />
                        </label>
                    </div>
                </section>
            </div>

            <template #footer>
                <Button
                    :label="t('common.cancel')"
                    severity="secondary"
                    outlined
                    :disabled="manpowerPlanStore.saving"
                    @click="dialogVisible = false"
                />

                <Button
                    icon="pi pi-check"
                    :label="t('common.save')"
                    :loading="manpowerPlanStore.saving"
                    @click="submitForm"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="archiveDialogVisible"
            modal
            class="hrms-standard-dialog--small"
            :header="t('manpowerPlan.archiveTitle')"
            :draggable="false"
        >
            <p class="manpower-confirm-message">
                {{ t("manpowerPlan.archiveMessage") }}
            </p>

            <template #footer>
                <Button
                    :label="t('common.cancel')"
                    severity="secondary"
                    outlined
                    :disabled="manpowerPlanStore.archiving"
                    @click="archiveDialogVisible = false"
                />

                <Button
                    icon="pi pi-inbox"
                    :label="t('manpowerPlan.archive')"
                    severity="danger"
                    :loading="manpowerPlanStore.archiving"
                    @click="archiveSelected"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importDialogVisible"
            modal
            class="hrms-standard-dialog--small"
            :header="t('manpowerPlan.importTitle')"
            :draggable="false"
            :closable="!manpowerPlanStore.importing"
        >
            <div class="manpower-import-content">
                <label class="manpower-file-field">
                    <span>{{ t("manpowerPlan.import") }}</span>
                    <input
                        ref="fileInputRef"
                        type="file"
                        accept=".xlsx"
                        :disabled="manpowerPlanStore.importing"
                        @change="onImportFileChange"
                    />
                </label>

                <ProgressBar
                    v-if="manpowerPlanStore.importing"
                    :value="manpowerPlanStore.importProgress"
                />
            </div>

            <template #footer>
                <Button
                    :label="t('common.cancel')"
                    severity="secondary"
                    outlined
                    :disabled="manpowerPlanStore.importing"
                    @click="closeImportDialog"
                />

                <Button
                    icon="pi pi-upload"
                    :label="t('manpowerPlan.import')"
                    :disabled="!selectedImportFile"
                    :loading="manpowerPlanStore.importing"
                    @click="submitImport"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importResultDialogVisible"
            modal
            class="hrms-standard-dialog--small"
            :header="t('manpowerPlan.importResultTitle')"
            :draggable="false"
        >
            <pre class="manpower-import-summary">{{ manpowerPlanStore.importSummary }}</pre>

            <template #footer>
                <Button
                    :label="t('common.close')"
                    @click="importResultDialogVisible = false"
                />
            </template>
        </Dialog>
    </section>
</template>

<style scoped>
.manpower-plan-page {
    min-width: 0;
}

.manpower-search {
    position: relative;
}

.manpower-search > i {
    position: absolute;
    z-index: 2;
    top: 50%;
    left: 0.7rem;
    color: var(--hrms-text-muted);
    pointer-events: none;
    transform: translateY(-50%);
}

.manpower-search :deep(.p-inputtext) {
    width: 100%;
    padding-left: 2rem;
}

.manpower-table-wrap {
    width: 100%;
    min-width: 0;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    -webkit-overflow-scrolling: touch;
}

.manpower-table {
    min-width: 96rem;
}

.manpower-cell {
    display: block;
    max-width: 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 400;
}

.manpower-status-tag {
    font-weight: 400;
}

.manpower-confirm-message {
    margin: 0;
    line-height: 1.6;
}

.manpower-import-content,
.manpower-file-field {
    display: grid;
    gap: 0.65rem;
}

.manpower-file-field > span {
    color: var(--hrms-text-muted);
    font-size: var(--hrms-font-size-sm);
    font-weight: 700;
}

.manpower-import-summary {
    max-height: 24rem;
    margin: 0;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
}
</style>
