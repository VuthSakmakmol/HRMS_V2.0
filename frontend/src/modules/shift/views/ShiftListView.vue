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
import { useUiStore } from "@/app/stores/ui.store.js"
import { useModulePermissions } from "@/shared/auth/useModulePermissions.js"
import AppFilterBar from "@/shared/components/filter/AppFilterBar.vue"
import AppTableActions from "@/shared/components/table/AppTableActions.vue"

import { fetchBranchesLookup } from "@/modules/organization/services/branch.api.js"
import { fetchCompaniesLookup } from "@/modules/organization/services/company.api.js"

import { useShiftStore } from "../stores/shift.store.js"

const { t, te } = useI18n()
const toast = useToast()

const authStore = useAuthStore()
const uiStore = useUiStore()
const shiftStore = useShiftStore()

function tr(key, fallback) {
    return te(key) ? t(key) : fallback
}

const SHIFT_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.SHIFT.VIEW",
    CREATE: "ORGANIZATION.SHIFT.CREATE",
    UPDATE: "ORGANIZATION.SHIFT.UPDATE",
    ARCHIVE: "ORGANIZATION.SHIFT.ARCHIVE",
    IMPORT: "ORGANIZATION.SHIFT.IMPORT",
    EXPORT: "ORGANIZATION.SHIFT.EXPORT",
    COMPANY_LOOKUP: "ORGANIZATION.COMPANY.LOOKUP",
    BRANCH_LOOKUP: "ORGANIZATION.BRANCH.LOOKUP",
})

const companies = ref([])
const branches = ref([])

const companyLoading = ref(false)
const branchLoading = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedShiftId = ref(null)

const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)

const importDialogVisible = ref(false)
const importResultDialogVisible = ref(false)
const selectedImportFile = ref(null)
const fileInputRef = ref(null)

const formErrors = ref({})

const filters = reactive({
    search: "",
    status: "ALL",
    companyId: "",
    branchId: "",
})

const form = reactive(createEmptyForm())

const permissions = useModulePermissions({
    view: SHIFT_PERMISSIONS.VIEW,
    create: SHIFT_PERMISSIONS.CREATE,
    update: SHIFT_PERMISSIONS.UPDATE,
    archive: SHIFT_PERMISSIONS.ARCHIVE,
    import: SHIFT_PERMISSIONS.IMPORT,
    export: SHIFT_PERMISSIONS.EXPORT,
})

const canLookupCompany = computed(() =>
    authStore.hasPermission(SHIFT_PERMISSIONS.COMPANY_LOOKUP),
)
const canLookupBranch = computed(() =>
    authStore.hasPermission(SHIFT_PERMISSIONS.BRANCH_LOOKUP),
)

const canCreateShift = computed(
    () =>
        permissions.canCreate.value &&
        canLookupCompany.value &&
        canLookupBranch.value,
)

const canUpdateShift = computed(
    () =>
        permissions.canUpdate.value &&
        canLookupCompany.value &&
        canLookupBranch.value,
)

const canArchiveShift = computed(() => permissions.canArchive.value)
const canImportShift = computed(() => permissions.canImport.value)
const canExportShift = computed(() => permissions.canExport.value)

const canShowRowActions = computed(
    () => canUpdateShift.value || canArchiveShift.value,
)

const dialogTitle = computed(() => {
    return dialogMode.value === "create"
        ? t("organization.shift.createTitle")
        : t("organization.shift.editTitle")
})

const companyOptions = computed(() =>
    companies.value.map((company) => ({
        label: `${company.code} - ${company.displayName}`,
        value: company.id,
    })),
)

const companyFilterOptions = computed(() => [
    {
        label: t("organization.shift.allCompanies"),
        value: "",
    },
    ...companyOptions.value,
])

const branchOptions = computed(() =>
    branches.value
        .filter((branch) => {
            if (!form.companyId) {
                return true
            }

            return branch.companyId === form.companyId
        })
        .map((branch) => ({
            label: `${branch.code} - ${branch.name}`,
            value: branch.id,
        })),
)

const branchFilterOptions = computed(() => [
    {
        label: t("organization.shift.allBranches"),
        value: "",
    },
    ...branches.value
        .filter((branch) => {
            if (!filters.companyId) {
                return true
            }

            return branch.companyId === filters.companyId
        })
        .map((branch) => ({
            label: `${branch.code} - ${branch.name}`,
            value: branch.id,
        })),
])

const statusOptions = computed(() => [
    {
        label: t("organization.shift.statusAll"),
        value: "ALL",
    },
    {
        label: t("organization.shift.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.shift.statusInactive"),
        value: "INACTIVE",
    },
    {
        label: t("organization.shift.statusArchived"),
        value: "ARCHIVED",
    },
])

const editableStatusOptions = computed(() => [
    {
        label: t("organization.shift.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.shift.statusInactive"),
        value: "INACTIVE",
    },
])

const durationPreview = computed(() => {
    const totalMinutes = calculateDurationMinutes(form.startTime, form.endTime)
    const breakMinutes =
        form.breakStartTime && form.breakEndTime
            ? calculateDurationMinutes(form.breakStartTime, form.breakEndTime)
            : 0

    if (!totalMinutes || totalMinutes <= 0) {
        return {
            totalMinutes: 0,
            breakMinutes: 0,
            workingMinutes: 0,
            isOvernight: false,
        }
    }

    return {
        totalMinutes,
        breakMinutes,
        workingMinutes: Math.max(totalMinutes - breakMinutes, 0),
        isOvernight: isOvernightTime(form.startTime, form.endTime),
    }
})

function createEmptyForm() {
    return {
        companyId: "",
        branchId: "",
        code: "",
        name: "",
        shortName: "",
        startTime: "07:00",
        endTime: "16:00",
        breakStartTime: "12:00",
        breakEndTime: "13:00",
        graceInMinutes: 0,
        graceOutMinutes: 0,
        description: "",
        status: "ACTIVE",
    }
}

function assignForm(source) {
    const nextForm = source || createEmptyForm()

    form.companyId = nextForm.companyId || ""
    form.branchId = nextForm.branchId || ""
    form.code = nextForm.code || ""
    form.name = nextForm.name || ""
    form.shortName = nextForm.shortName || ""
    form.startTime = nextForm.startTime || "07:00"
    form.endTime = nextForm.endTime || "16:00"
    form.breakStartTime = nextForm.breakStartTime || ""
    form.breakEndTime = nextForm.breakEndTime || ""
    form.graceInMinutes = Number(nextForm.graceInMinutes || 0)
    form.graceOutMinutes = Number(nextForm.graceOutMinutes || 0)
    form.description = nextForm.description || ""
    form.status = nextForm.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"
}

function buildCreatePayload() {
    return {
        companyId: form.companyId,
        branchId: form.branchId,
        code: form.code,
        name: form.name,
        shortName: form.shortName,
        startTime: form.startTime,
        endTime: form.endTime,
        breakStartTime: form.breakStartTime || "",
        breakEndTime: form.breakEndTime || "",
        graceInMinutes: Number(form.graceInMinutes || 0),
        graceOutMinutes: Number(form.graceOutMinutes || 0),
        description: form.description,
        status: form.status,
    }
}

function buildUpdatePayload() {
    return {
        code: form.code,
        name: form.name,
        shortName: form.shortName,
        startTime: form.startTime,
        endTime: form.endTime,
        breakStartTime: form.breakStartTime || "",
        breakEndTime: form.breakEndTime || "",
        graceInMinutes: Number(form.graceInMinutes || 0),
        graceOutMinutes: Number(form.graceOutMinutes || 0),
        description: form.description,
        status: form.status,
    }
}

function getErrorMessage(error) {
    const messageKey = error?.response?.data?.error?.messageKey

    if (messageKey) {
        const translated = t(messageKey)

        return translated === messageKey ? t("errors.internal") : translated
    }

    return t("errors.internal")
}

function applyBackendFieldErrors(error) {
    const fields = error?.response?.data?.error?.fields || {}
    const nextErrors = {}

    for (const [field, messages] of Object.entries(fields)) {
        nextErrors[field] = Array.isArray(messages)
            ? messages.map((messageKey) => {
                  const translated = t(messageKey)

                  return translated === messageKey
                      ? t("errors.validationFailed")
                      : translated
              })
            : [t("errors.validationFailed")]
    }

    formErrors.value = nextErrors
}

function getFieldError(fieldName) {
    const messages = formErrors.value[fieldName]

    if (!messages?.length) {
        return ""
    }

    return messages[0]
}

function clearFieldError(fieldName) {
    if (!formErrors.value[fieldName]) {
        return
    }

    formErrors.value = {
        ...formErrors.value,
        [fieldName]: undefined,
    }
}

function normalizeCodeInput() {
    form.code = form.code
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_-]/g, "")

    clearFieldError("code")
}

function normalizeTimeInput(fieldName) {
    form[fieldName] = String(form[fieldName] || "")
        .replace(/[^\d:]/g, "")
        .slice(0, 5)

    clearFieldError(fieldName)
}

function parseTimeToMinutes(time) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ""))) {
        return null
    }

    const [hour, minute] = String(time).split(":").map(Number)

    return hour * 60 + minute
}

function isOvernightTime(startTime, endTime) {
    const startMinutes = parseTimeToMinutes(startTime)
    const endMinutes = parseTimeToMinutes(endTime)

    if (startMinutes === null || endMinutes === null) {
        return false
    }

    return endMinutes <= startMinutes
}

function calculateDurationMinutes(startTime, endTime) {
    const startMinutes = parseTimeToMinutes(startTime)
    let endMinutes = parseTimeToMinutes(endTime)

    if (startMinutes === null || endMinutes === null) {
        return 0
    }

    if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60
    }

    return endMinutes - startMinutes
}

function formatMinutes(minutes) {
    const safeMinutes = Number(minutes || 0)

    if (safeMinutes <= 0) {
        return "0h"
    }

    const hours = Math.floor(safeMinutes / 60)
    const mins = safeMinutes % 60

    if (hours && mins) {
        return `${hours}h ${mins}m`
    }

    if (hours) {
        return `${hours}h`
    }

    return `${mins}m`
}

function getStatusSeverity(status) {
    if (status === "ACTIVE") {
        return "success"
    }

    if (status === "INACTIVE") {
        return "warn"
    }

    if (status === "ARCHIVED") {
        return "danger"
    }

    return "secondary"
}

function getStatusLabel(status) {
    if (status === "ACTIVE") {
        return t("organization.shift.statusActive")
    }

    if (status === "INACTIVE") {
        return t("organization.shift.statusInactive")
    }

    if (status === "ARCHIVED") {
        return t("organization.shift.statusArchived")
    }

    return status || "-"
}

function formatDateTime(value) {
    if (!value) {
        return "-"
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return "-"
    }

    return new Intl.DateTimeFormat(uiStore.locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date)
}

async function loadCompanies() {
    companyLoading.value = true

    try {
        const result = await fetchCompaniesLookup({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            search: "",
        })

        companies.value = Array.isArray(result) ? result : []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.shift.companyLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        companyLoading.value = false
    }
}

async function loadBranches(companyId = "") {
    branchLoading.value = true

    try {
        const result = await fetchBranchesLookup({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            companyId: companyId || undefined,
            search: "",
        })

        branches.value = Array.isArray(result) ? result : []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.shift.branchLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        branchLoading.value = false
    }
}

async function loadShifts(params = {}) {
    try {
        await shiftStore.loadShifts(params)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.shift.loadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function applyFilters() {
    loadShifts({
        page: 1,
        limit: shiftStore.filters.limit,
        search: filters.search,
        status: filters.status,
        companyId: filters.companyId || undefined,
        branchId: filters.branchId || undefined,
    })
}

function clearFilters() {
    filters.search = ""
    filters.status = "ALL"
    filters.companyId = ""
    filters.branchId = ""

    loadShifts({
        page: 1,
        search: "",
        status: "ALL",
        companyId: undefined,
        branchId: undefined,
    })
}

function onPage(event) {
    loadShifts({
        page: event.page + 1,
        limit: event.rows,
    })
}

async function onFilterCompanyChange() {
    filters.branchId = ""

    await loadBranches(filters.companyId)

    applyFilters()
}

async function onFilterBranchChange() {
    applyFilters()
}

async function onFormCompanyChange() {
    form.branchId = ""

    clearFieldError("companyId")

    await loadBranches(form.companyId)
}

function onFormBranchChange() {
    clearFieldError("branchId")
}

async function openCreateDialog() {
    if (!canCreateShift.value) {
        return
    }

    if (companies.value.length === 0) {
        await loadCompanies()
    }

    if (branches.value.length === 0) {
        await loadBranches()
    }

    dialogMode.value = "create"
    selectedShiftId.value = null
    formErrors.value = {}

    assignForm(createEmptyForm())

    if (companies.value.length === 1) {
        form.companyId = companies.value[0].id
        await loadBranches(form.companyId)
    }

    if (branchOptions.value.length === 1) {
        form.branchId = branchOptions.value[0].value
    }

    dialogVisible.value = true
}

async function openEditDialog(shift) {
    if (!canUpdateShift.value) {
        return
    }

    dialogMode.value = "edit"
    selectedShiftId.value = shift.id
    formErrors.value = {}

    assignForm(shift)

    await loadBranches(form.companyId)

    dialogVisible.value = true
}

function closeDialog() {
    dialogVisible.value = false
    selectedShiftId.value = null
    formErrors.value = {}
}

async function saveShift() {
    formErrors.value = {}

    try {
        if (dialogMode.value === "create") {
            await shiftStore.createShift(buildCreatePayload())

            toast.add({
                severity: "success",
                summary: t("organization.shift.created"),
                detail: t("organization.shift.createdDetail"),
                life: 3000,
            })
        } else {
            await shiftStore.updateShift(
                selectedShiftId.value,
                buildUpdatePayload(),
            )

            toast.add({
                severity: "success",
                summary: t("organization.shift.updated"),
                detail: t("organization.shift.updatedDetail"),
                life: 3000,
            })
        }

        closeDialog()
        await loadShifts()
    } catch (error) {
        applyBackendFieldErrors(error)

        toast.add({
            severity: "error",
            summary: t("organization.shift.saveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function openArchiveDialog(shift) {
    if (!canArchiveShift.value) {
        return
    }

    archiveCandidate.value = shift
    archiveDialogVisible.value = true
}

function closeArchiveDialog() {
    archiveDialogVisible.value = false
    archiveCandidate.value = null
}

async function confirmArchiveShift() {
    if (!archiveCandidate.value?.id) {
        return
    }

    try {
        await shiftStore.archiveShift(archiveCandidate.value.id)

        toast.add({
            severity: "success",
            summary: t("organization.shift.archived"),
            detail: t("organization.shift.archivedDetail"),
            life: 3000,
        })

        closeArchiveDialog()
        await loadShifts()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.shift.archiveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

async function downloadSample() {
    try {
        await shiftStore.downloadImportTemplate()

        toast.add({
            severity: "success",
            summary: t("organization.shift.sampleDownloaded"),
            detail: t("organization.shift.sampleDownloadedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.shift.sampleDownloadFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

async function exportExcel() {
    try {
        await shiftStore.exportShifts()

        toast.add({
            severity: "success",
            summary: t("organization.shift.exported"),
            detail: t("organization.shift.exportedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.shift.exportFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function openImportDialog() {
    selectedImportFile.value = null
    importDialogVisible.value = true
}

function closeImportDialog() {
    if (shiftStore.importing) {
        return
    }

    importDialogVisible.value = false
    selectedImportFile.value = null

    if (fileInputRef.value) {
        fileInputRef.value.value = ""
    }
}

function onImportFileChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
        selectedImportFile.value = null
        return
    }

    selectedImportFile.value = file
}

async function submitImport() {
    if (!selectedImportFile.value) {
        toast.add({
            severity: "warn",
            summary: t("organization.shift.importFileRequired"),
            detail: t("organization.shift.importFileRequiredDetail"),
            life: 3500,
        })

        return
    }

    try {
        await shiftStore.importShifts(selectedImportFile.value)

        importDialogVisible.value = false
        importResultDialogVisible.value = true

        await loadShifts()

        toast.add({
            severity:
                shiftStore.importSummary?.errors?.length > 0
                    ? "warn"
                    : "success",
            summary: t("organization.shift.importFinished"),
            detail:
                shiftStore.importSummary?.errors?.length > 0
                    ? t("organization.shift.importFinishedWithErrors")
                    : t("organization.shift.importFinishedSuccess"),
            life: 4500,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.shift.importFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function translateImportError(error) {
    const translated = t(error.messageKey)

    return translated === error.messageKey
        ? t("errors.validationFailed")
        : translated
}

watch(
    () => filters.companyId,
    () => {
        if (
            filters.branchId &&
            !branchFilterOptions.value.some(
                (option) => option.value === filters.branchId,
            )
        ) {
            filters.branchId = ""
        }
    },
)

onMounted(async () => {
    const tasks = [loadShifts()]

    if (canLookupCompany.value) {
        tasks.push(loadCompanies())
    }

    if (canLookupBranch.value) {
        tasks.push(loadBranches())
    }

    await Promise.all(tasks)
})
</script>

<template>
    <section class="hrms-list-page hrms-compact">

        <AppFilterBar :loading="shiftStore.loading">
            <span class="app-filter-field app-filter-field--search shift-search">
                <i class="pi pi-search" />

                <InputText
                    v-model="filters.search"
                    class="shift-search__input"
                    :placeholder="t('organization.shift.searchPlaceholder')"
                    @keyup.enter="applyFilters"
                />
            </span>

            <div
                v-if="canLookupCompany"
                class="app-filter-field"
            >
                <Select
                    v-model="filters.companyId"
                    class="shift-filter-select"
                    :placeholder="tr('organization.shift.allCompanies', 'All companies')"
                    :options="companyFilterOptions"
                    option-label="label"
                    option-value="value"
                    :loading="companyLoading"
                    @change="onFilterCompanyChange"
                />
            </div>

            <div
                v-if="canLookupBranch"
                class="app-filter-field"
            >
                <Select
                    v-model="filters.branchId"
                    class="shift-filter-select"
                    :placeholder="tr('organization.shift.allBranches', 'All branches')"
                    :options="branchFilterOptions"
                    option-label="label"
                    option-value="value"
                    :loading="branchLoading"
                    @change="onFilterBranchChange"
                />
            </div>

            <div class="app-filter-field shift-status-field">
                <Select
                    v-model="filters.status"
                    class="shift-filter-select"
                    :placeholder="tr('organization.shift.statusAll', 'All statuses')"
                    :options="statusOptions"
                    option-label="label"
                    option-value="value"
                    @change="applyFilters"
                />
            </div>

            <template #actions>
                <Button
                    icon="pi pi-filter"
                    :label="t('common.apply')"
                    @click="applyFilters"
                />

                <Button
                    severity="secondary"
                    outlined
                    icon="pi pi-times"
                    :label="t('common.clear')"
                    @click="clearFilters"
                />

                <Button
                    severity="secondary"
                    outlined
                    icon="pi pi-refresh"
                    :aria-label="t('common.refresh')"
                    :loading="shiftStore.loading"
                    @click="loadShifts"
                />

                <Button
                    v-if="canImportShift"
                    severity="secondary"
                    outlined
                    icon="pi pi-download"
                    :loading="shiftStore.downloadingTemplate"
                    :aria-label="t('organization.shift.downloadSample')"
                    v-tooltip.top="t('organization.shift.downloadSample')"
                    @click="downloadSample"
                />

                <Button
                    v-if="canImportShift"
                    severity="secondary"
                    outlined
                    icon="pi pi-upload"
                    :aria-label="t('organization.shift.importExcel')"
                    v-tooltip.top="t('organization.shift.importExcel')"
                    @click="openImportDialog"
                />

                <Button
                    v-if="canExportShift"
                    severity="secondary"
                    outlined
                    icon="pi pi-file-export"
                    :loading="shiftStore.exporting"
                    :aria-label="t('organization.shift.exportExcel')"
                    v-tooltip.top="t('organization.shift.exportExcel')"
                    @click="exportExcel"
                />

                <Button
                    v-if="canCreateShift"
                    icon="pi pi-plus"
                    :label="t('organization.shift.newShift')"
                    @click="openCreateDialog"
                />
            </template>
        </AppFilterBar>

        <div class="hrms-list-card">
            <div class="hrms-table-wrap">
                    <DataTable
                        class="hrms-standard-table hrms-standard-table--horizontal"
                        lazy
                        paginator
                        striped-rows
                        data-key="id"
                        size="small"
                        scrollable
                        scroll-height="flex"
                        :value="shiftStore.items"
                        :loading="shiftStore.loading"
                        :rows="shiftStore.pagination.limit"
                        :first="
                            (shiftStore.pagination.page - 1) *
                            shiftStore.pagination.limit
                        "
                        :total-records="shiftStore.pagination.total"
                        :rows-per-page-options="[10, 20, 50, 100]"
                        :empty-message="t('organization.shift.empty')"
                        @page="onPage"
                    >
                        <Column
                            field="code"
                            :header="t('organization.shift.code')"
                            frozen
                            style="min-width: 8rem"
                        >
                            <template #body="{ data }">
                                <span class="shift-code">
                                    {{ data.code }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.shift.shiftName')"
                            style="min-width: 15rem"
                        >
                            <template #body="{ data }">
                                <div class="shift-name-cell">
                                    <span>{{ data.name }}</span>
                                    <span>{{ data.shortName || "-" }}</span>
                                </div>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.shift.branch')"
                            style="min-width: 13rem"
                        >
                            <template #body="{ data }">
                                <div class="shift-muted-cell">
                                    <span>
                                        {{ data.branch?.name || "-" }}
                                    </span>
                                    <span>
                                        {{ data.branch?.code || "-" }}
                                    </span>
                                </div>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.shift.timeRange')"
                            style="min-width: 12rem"
                        >
                            <template #body="{ data }">
                                <div class="shift-time-cell">
                                    <span>
                                        {{ data.startTime }} - {{ data.endTime }}
                                    </span>

                                    <span v-if="data.isOvernight">
                                        {{ t("organization.shift.overnight") }}
                                    </span>
                                </div>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.shift.breakTime')"
                            style="min-width: 12rem"
                        >
                            <template #body="{ data }">
                                <span
                                    v-if="
                                        data.breakStartTime && data.breakEndTime
                                    "
                                    class="shift-muted-text"
                                >
                                    {{ data.breakStartTime }} -
                                    {{ data.breakEndTime }}
                                </span>

                                <span v-else class="shift-muted-text">
                                    {{ t("organization.shift.noBreak") }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.shift.workingHours')"
                            style="min-width: 10rem"
                        >
                            <template #body="{ data }">
                                <Tag
                                    severity="info"
                                    :value="formatMinutes(data.workingMinutes)"
                                />
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.shift.graceMinutes')"
                            style="min-width: 11rem"
                        >
                            <template #body="{ data }">
                                <span class="shift-muted-text">
                                    {{ t("organization.shift.inOutGrace", {
                                        inValue: data.graceInMinutes,
                                        outValue: data.graceOutMinutes,
                                    }) }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            field="status"
                            :header="t('organization.shift.status')"
                            style="min-width: 9rem"
                        >
                            <template #body="{ data }">
                                <Tag
                                    :severity="getStatusSeverity(data.status)"
                                    :value="getStatusLabel(data.status)"
                                />
                            </template>
                        </Column>

                        <Column
                            field="updatedAt"
                            :header="t('organization.shift.updatedAt')"
                            style="min-width: 11rem"
                        >
                            <template #body="{ data }">
                                <span class="shift-date">
                                    {{ formatDateTime(data.updatedAt) }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            v-if="canShowRowActions"
                            :header="t('common.actions')"
                            align-frozen="right"
                            frozen
                            header-class="shift-action-column"
                            body-class="shift-action-column"
                            style="width: 5rem; min-width: 5rem"
                        >
                            <template #body="{ data }">
                                <AppTableActions
                                    :can-edit="
                                        canUpdateShift &&
                                        data.status !== 'ARCHIVED'
                                    "
                                    :can-archive="
                                        canArchiveShift &&
                                        data.status !== 'ARCHIVED'
                                    "
                                    :edit-label="t('common.edit')"
                                    :archive-label="t('common.archive')"
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
            class="shift-dialog"
            :header="dialogTitle"
            :draggable="false"
        >
            <div class="shift-form">
                <div class="shift-form__section">
                    <h3>{{ t("organization.shift.basicInfo") }}</h3>

                    <div class="shift-form__grid">
                        <label class="shift-field">
                            <span>{{ t("organization.shift.company") }}</span>

                            <Select
                                v-model="form.companyId"
                                :disabled="dialogMode === 'edit'"
                                :invalid="Boolean(getFieldError('companyId'))"
                                :options="companyOptions"
                                option-label="label"
                                option-value="value"
                                :placeholder="
                                    t('organization.shift.selectCompany')
                                "
                                :loading="companyLoading"
                                @change="onFormCompanyChange"
                            />

                            <small v-if="getFieldError('companyId')">
                                {{ getFieldError("companyId") }}
                            </small>
                        </label>

                        <label class="shift-field">
                            <span>{{ t("organization.shift.branch") }}</span>

                            <Select
                                v-model="form.branchId"
                                :disabled="
                                    dialogMode === 'edit' || !form.companyId
                                "
                                :invalid="Boolean(getFieldError('branchId'))"
                                :options="branchOptions"
                                option-label="label"
                                option-value="value"
                                :placeholder="
                                    t('organization.shift.selectBranch')
                                "
                                :loading="branchLoading"
                                @change="onFormBranchChange"
                            />

                            <small v-if="getFieldError('branchId')">
                                {{ getFieldError("branchId") }}
                            </small>
                        </label>

                        <label class="shift-field">
                            <span>{{ t("organization.shift.code") }}</span>

                            <InputText
                                v-model="form.code"
                                :invalid="Boolean(getFieldError('code'))"
                                autocomplete="off"
                                placeholder="DAY"
                                @input="normalizeCodeInput"
                            />

                            <small v-if="getFieldError('code')">
                                {{ getFieldError("code") }}
                            </small>
                        </label>

                        <label class="shift-field">
                            <span>{{ t("organization.shift.shiftName") }}</span>

                            <InputText
                                v-model="form.name"
                                :invalid="Boolean(getFieldError('name'))"
                                autocomplete="off"
                                placeholder="Day Shift"
                                @input="clearFieldError('name')"
                            />

                            <small v-if="getFieldError('name')">
                                {{ getFieldError("name") }}
                            </small>
                        </label>

                        <label class="shift-field">
                            <span>{{ t("organization.shift.shortName") }}</span>

                            <InputText
                                v-model="form.shortName"
                                autocomplete="off"
                                placeholder="Day"
                            />
                        </label>

                        <label class="shift-field">
                            <span>{{ t("organization.shift.status") }}</span>

                            <Select
                                v-model="form.status"
                                :options="editableStatusOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </label>
                    </div>
                </div>

                <div class="shift-form__section">
                    <h3>{{ t("organization.shift.timeInfo") }}</h3>

                    <div class="shift-form__grid">
                        <label class="shift-field">
                            <span>{{ t("organization.shift.startTime") }}</span>

                            <InputText
                                v-model="form.startTime"
                                :invalid="Boolean(getFieldError('startTime'))"
                                placeholder="07:00"
                                @input="normalizeTimeInput('startTime')"
                            />

                            <small v-if="getFieldError('startTime')">
                                {{ getFieldError("startTime") }}
                            </small>
                        </label>

                        <label class="shift-field">
                            <span>{{ t("organization.shift.endTime") }}</span>

                            <InputText
                                v-model="form.endTime"
                                :invalid="Boolean(getFieldError('endTime'))"
                                placeholder="16:00"
                                @input="normalizeTimeInput('endTime')"
                            />

                            <small v-if="getFieldError('endTime')">
                                {{ getFieldError("endTime") }}
                            </small>
                        </label>

                        <label class="shift-field">
                            <span>
                                {{ t("organization.shift.breakStartTime") }}
                            </span>

                            <InputText
                                v-model="form.breakStartTime"
                                :invalid="
                                    Boolean(getFieldError('breakStartTime'))
                                "
                                placeholder="12:00"
                                @input="normalizeTimeInput('breakStartTime')"
                            />

                            <small v-if="getFieldError('breakStartTime')">
                                {{ getFieldError("breakStartTime") }}
                            </small>
                        </label>

                        <label class="shift-field">
                            <span>
                                {{ t("organization.shift.breakEndTime") }}
                            </span>

                            <InputText
                                v-model="form.breakEndTime"
                                :invalid="
                                    Boolean(getFieldError('breakEndTime'))
                                "
                                placeholder="13:00"
                                @input="normalizeTimeInput('breakEndTime')"
                            />

                            <small v-if="getFieldError('breakEndTime')">
                                {{ getFieldError("breakEndTime") }}
                            </small>
                        </label>

                        <label class="shift-field">
                            <span>
                                {{ t("organization.shift.graceInMinutes") }}
                            </span>

                            <InputNumber
                                v-model="form.graceInMinutes"
                                :min="0"
                                :max="240"
                                :use-grouping="false"
                                suffix=" min"
                            />
                        </label>

                        <label class="shift-field">
                            <span>
                                {{ t("organization.shift.graceOutMinutes") }}
                            </span>

                            <InputNumber
                                v-model="form.graceOutMinutes"
                                :min="0"
                                :max="240"
                                :use-grouping="false"
                                suffix=" min"
                            />
                        </label>

                        <div class="shift-preview shift-field--wide">
                            <div>
                                <span>
                                    {{ t("organization.shift.totalHours") }}
                                </span>
                                <strong>
                                    {{
                                        formatMinutes(
                                            durationPreview.totalMinutes,
                                        )
                                    }}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    {{ t("organization.shift.breakMinutes") }}
                                </span>
                                <strong>
                                    {{
                                        formatMinutes(
                                            durationPreview.breakMinutes,
                                        )
                                    }}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    {{ t("organization.shift.workingHours") }}
                                </span>
                                <strong>
                                    {{
                                        formatMinutes(
                                            durationPreview.workingMinutes,
                                        )
                                    }}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    {{ t("organization.shift.overnight") }}
                                </span>
                                <strong>
                                    {{
                                        durationPreview.isOvernight
                                            ? t("common.yes")
                                            : t("common.no")
                                    }}
                                </strong>
                            </div>
                        </div>

                        <label class="shift-field shift-field--wide">
                            <span>
                                {{ t("organization.shift.descriptionLabel") }}
                            </span>

                            <Textarea
                                v-model="form.description"
                                rows="3"
                                auto-resize
                            />
                        </label>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button
                    severity="secondary"
                    outlined
                    :label="t('common.cancel')"
                    @click="closeDialog"
                />

                <Button
                    icon="pi pi-save"
                    :loading="shiftStore.saving"
                    :label="t('common.save')"
                    @click="saveShift"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="archiveDialogVisible"
            modal
            class="shift-archive-dialog"
            :header="t('organization.shift.archiveTitle')"
            :draggable="false"
        >
            <p class="shift-archive-text">
                {{
                    t("organization.shift.archiveMessage", {
                        name: archiveCandidate?.name || "-",
                    })
                }}
            </p>

            <template #footer>
                <Button
                    severity="secondary"
                    outlined
                    :label="t('common.cancel')"
                    @click="closeArchiveDialog"
                />

                <Button
                    severity="danger"
                    icon="pi pi-archive"
                    :loading="shiftStore.archiving"
                    :label="t('common.archive')"
                    @click="confirmArchiveShift"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importDialogVisible"
            modal
            class="shift-import-dialog"
            :header="t('organization.shift.importTitle')"
            :draggable="false"
            :closable="!shiftStore.importing"
        >
            <div class="shift-import">
                <p>
                    {{ t("organization.shift.importDescription") }}
                </p>

                <input
                    ref="fileInputRef"
                    type="file"
                    accept=".xlsx"
                    :disabled="shiftStore.importing"
                    @change="onImportFileChange"
                />

                <div v-if="selectedImportFile" class="shift-import__file">
                    <i class="pi pi-file-excel" />
                    <span>{{ selectedImportFile.name }}</span>
                </div>

                <div
                    v-if="shiftStore.importing"
                    class="shift-import__progress"
                >
                    <ProgressBar :value="shiftStore.importProgress" />

                    <span>
                        {{
                            t("organization.shift.importProgress", {
                                percent: shiftStore.importProgress,
                            })
                        }}
                    </span>
                </div>
            </div>

            <template #footer>
                <Button
                    severity="secondary"
                    outlined
                    :disabled="shiftStore.importing"
                    :label="t('common.cancel')"
                    @click="closeImportDialog"
                />

                <Button
                    icon="pi pi-upload"
                    :loading="shiftStore.importing"
                    :label="t('organization.shift.importExcel')"
                    @click="submitImport"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importResultDialogVisible"
            modal
            class="shift-import-result-dialog"
            :header="t('organization.shift.importResultTitle')"
            :draggable="false"
        >
            <div v-if="shiftStore.importSummary" class="shift-import-result">
                <div class="shift-import-result__grid">
                    <div>
                        <span>{{ t("organization.shift.totalRows") }}</span>
                        <strong>{{ shiftStore.importSummary.totalRows }}</strong>
                    </div>

                    <div>
                        <span>{{ t("organization.shift.createdRows") }}</span>
                        <strong>{{ shiftStore.importSummary.created }}</strong>
                    </div>

                    <div>
                        <span>{{ t("organization.shift.updatedRows") }}</span>
                        <strong>{{ shiftStore.importSummary.updated }}</strong>
                    </div>

                    <div>
                        <span>{{ t("organization.shift.skippedRows") }}</span>
                        <strong>{{ shiftStore.importSummary.skipped }}</strong>
                    </div>
                </div>

                <div
                    v-if="shiftStore.importSummary.errors?.length"
                    class="shift-import-result__errors"
                >
                    <h4>{{ t("organization.shift.validationErrors") }}</h4>

                    <DataTable
                        size="small"
                        :value="shiftStore.importSummary.errors"
                    >
                        <Column
                            field="rowNumber"
                            :header="t('organization.shift.rowNumber')"
                            style="width: 7rem"
                        />

                        <Column
                            field="field"
                            :header="t('organization.shift.field')"
                            style="width: 12rem"
                        />

                        <Column :header="t('organization.shift.issue')">
                            <template #body="{ data }">
                                {{ translateImportError(data) }}
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </div>

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
.shift-search {
    position: relative;
    display: block;
    width: min(100%, 15rem);
}

.shift-search i {
    position: absolute;
    z-index: 1;
    top: 50%;
    left: 0.65rem;
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
    transform: translateY(-50%);
    pointer-events: none;
}

.shift-search__input {
    width: 100%;
    padding-left: 1.9rem;
}

.shift-filter-select {
    width: 11.5rem;
}

.shift-status-field .shift-filter-select {
    width: 9.5rem;
}

.shift-code {
    color: var(--hrms-color-primary);
    font-size: 0.82rem;
    font-weight: 400;
}

/* Table font weight: bold header only, normal data cells */
:deep(.hrms-standard-table .p-datatable-thead > tr > th),
:deep(.hrms-standard-table .p-datatable-thead > tr > th *) {
    font-weight: 700 !important;
}

:deep(.hrms-standard-table .p-datatable-tbody > tr > td),
:deep(.hrms-standard-table .p-datatable-tbody > tr > td *) {
    font-weight: 400 !important;
}

.shift-name-cell,
.shift-muted-cell,
.shift-time-cell {
    display: grid;
    gap: 0.15rem;
    line-height: 1.25;
}

.shift-name-cell span,
.shift-muted-cell span,
.shift-time-cell span {
    font-size: 0.82rem;
}

.shift-name-cell span,
.shift-muted-cell span,
.shift-time-cell span,
.shift-muted-text,
.shift-date {
    color: var(--hrms-text-muted);
    font-size: 0.76rem;
}

.shift-actions {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    width: 100%;
}

.shift-archived-text {
    color: var(--hrms-text-muted);
    font-size: 0.76rem;
}

.shift-dialog {
    width: min(62rem, calc(100vw - 2rem));
}

.shift-form {
    display: grid;
    gap: 1rem;
}

.shift-form__section {
    border: 1px solid var(--hrms-border-color);
    border-radius: 1rem;
    padding: 1rem;
    background: var(--hrms-surface-ground);
}

.shift-form__section h3 {
    margin: 0 0 0.85rem;
    font-size: 0.95rem;
}

.shift-form__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.85rem;
}

.shift-field {
    display: grid;
    gap: 0.35rem;
}

.shift-field--wide {
    grid-column: 1 / -1;
}

.shift-field > span {
    color: var(--hrms-text-muted);
    font-size: 0.76rem;
    font-weight: 700;
}

.shift-field small {
    color: var(--hrms-color-danger);
    font-size: 0.72rem;
}

.shift-preview {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
}

.shift-preview div {
    display: grid;
    gap: 0.25rem;
    padding: 0.75rem;
    border: 1px solid var(--hrms-border-color);
    border-radius: 0.85rem;
    background: var(--hrms-surface-card);
}

.shift-preview span {
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
}

.shift-preview strong {
    font-size: 0.95rem;
}

.shift-archive-dialog,
.shift-import-dialog,
.shift-import-result-dialog {
    width: min(44rem, calc(100vw - 2rem));
}

.shift-archive-text {
    margin: 0;
    color: var(--hrms-text-muted);
}

.shift-import {
    display: grid;
    gap: 1rem;
}

.shift-import p {
    margin: 0;
    color: var(--hrms-text-muted);
}

.shift-import__file {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 0.75rem;
    border: 1px dashed var(--hrms-border-color);
    border-radius: 0.85rem;
    color: var(--hrms-text-muted);
}

.shift-import__progress {
    display: grid;
    gap: 0.45rem;
}

.shift-import__progress span {
    color: var(--hrms-text-muted);
    font-size: 0.78rem;
}

.shift-import-result {
    display: grid;
    gap: 1rem;
}

.shift-import-result__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
}

.shift-import-result__grid div {
    display: grid;
    gap: 0.25rem;
    padding: 0.85rem;
    border: 1px solid var(--hrms-border-color);
    border-radius: 0.85rem;
    background: var(--hrms-surface-ground);
}

.shift-import-result__grid span {
    color: var(--hrms-text-muted);
    font-size: 0.76rem;
}

.shift-import-result__grid strong {
    font-size: 1.35rem;
}

.shift-import-result__errors {
    display: grid;
    gap: 0.65rem;
}

.shift-import-result__errors h4 {
    margin: 0;
}

:deep(.p-datatable-thead > tr > th),
:deep(.p-datatable-tbody > tr > td) {
    text-align: center;
    vertical-align: middle;
    font-size: 0.78rem;
}

@media (max-width: 1100px) {
    .shift-page__header,
    .shift-toolbar {
        flex-direction: column;
    }

    .shift-page__header-actions,
    .shift-toolbar__actions {
        justify-content: flex-start;
    }

    .shift-filter,
    .shift-status-filter {
        width: min(100%, 14rem);
    }

    .shift-form__grid,
    .shift-preview {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 720px) {
    .shift-search,
    .shift-filter,
    .shift-status-filter {
        width: 100%;
        min-width: 0;
    }

    .shift-form__grid,
    .shift-preview,
    .shift-import-result__grid {
        grid-template-columns: 1fr;
    }

    .shift-table-wrap {
        height: 32rem;
    }
}


/* Department/Position enterprise setup-page standard */
.shift-card {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--hrms-border);
    box-shadow: var(--hrms-shadow-sm);
}

.shift-search {
    width: min(100%, 21rem);
    position: relative;
    display: block;
    min-height: 2.5rem;
    border: 1px solid var(--surface-border, #cbd5e1);
    border-radius: 6px;
    background: var(--surface-0, #ffffff);
    overflow: hidden;
    transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
}

.shift-search:hover {
    border-color: var(--primary-300, #93c5fd);
}

.shift-search:focus-within {
    border-color: var(--primary-color, #3b82f6);
    box-shadow: 0 0 0 1px var(--primary-color, #3b82f6);
}

.shift-search i {
    position: absolute;
    top: 50%;
    left: 0.75rem;
    transform: translateY(-50%);
    z-index: 1;
    color: var(--hrms-text-muted);
    font-size: 0.78rem;
}

.shift-search__input {
    width: 100%;
    min-height: 2.5rem;
    padding-left: 2.1rem;
    border: 0 !important;
    border-radius: 0;
    background: transparent;
    box-shadow: none !important;
}

.shift-search__input:enabled:focus {
    border: 0 !important;
    box-shadow: none !important;
}

.shift-filter-select {
    width: 14rem;
}

.shift-status-field .shift-filter-select {
    width: 11rem;
}

.shift-table-wrap {
    width: 100%;
    min-width: 0;
    overflow-x: auto;
}

.shift-table :deep(.p-datatable-thead > tr > th),
.shift-table :deep(.p-datatable-tbody > tr > td) {
    text-align: center;
    vertical-align: middle;
}

.shift-table :deep(.p-datatable-column-header-content) {
    justify-content: center;
}

.shift-table :deep(.p-datatable-tbody > tr > td) {
    padding-top: 0.58rem;
    padding-bottom: 0.58rem;
}

.shift-action-column {
    text-align: center !important;
}

@media (max-width: 900px) {
    .shift-filter-select,
    .shift-status-field .shift-filter-select {
        width: 100%;
    }
}


@media (max-width: 900px) {
    .shift-filter-select,
    .shift-status-field .shift-filter-select,
    .shift-search {
        width: 100%;
        max-width: none;
    }
}
</style>