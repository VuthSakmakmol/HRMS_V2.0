<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Checkbox from "primevue/checkbox"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { useUiStore } from "@/app/stores/ui.store.js"
import { useModulePermissions } from "@/shared/auth/useModulePermissions.js"
import AppFilterBar from "@/shared/components/filter/AppFilterBar.vue"
import AppTableActions from "@/shared/components/table/AppTableActions.vue"
import { fetchBranchesLookup } from "../services/branch.api.js"
import { fetchCompaniesLookup } from "../services/company.api.js"
import { fetchDepartmentsLookup } from "../services/department.api.js"
import { fetchPositionsLookup } from "../services/position.api.js"
import { usePositionStore } from "../stores/position.store.js"

const { t, te } = useI18n()
const toast = useToast()

const uiStore = useUiStore()
const positionStore = usePositionStore()

function tr(key, fallback) {
    return te(key) ? t(key) : fallback
}

const POSITION_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.POSITION.VIEW",
    CREATE: "ORGANIZATION.POSITION.CREATE",
    UPDATE: "ORGANIZATION.POSITION.UPDATE",
    ARCHIVE: "ORGANIZATION.POSITION.ARCHIVE",
    IMPORT: "ORGANIZATION.POSITION.IMPORT",
    EXPORT: "ORGANIZATION.POSITION.EXPORT",
})

const companies = ref([])
const branches = ref([])
const departments = ref([])
const reportsToPositions = ref([])

const companyLoading = ref(false)
const branchLoading = ref(false)
const departmentLoading = ref(false)
const reportsToLoading = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedPositionId = ref(null)

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
    departmentId: "",
})

const form = reactive(createEmptyForm())

const permissions = useModulePermissions({
    view: POSITION_PERMISSIONS.VIEW,
    create: POSITION_PERMISSIONS.CREATE,
    update: POSITION_PERMISSIONS.UPDATE,
    archive: POSITION_PERMISSIONS.ARCHIVE,
    import: POSITION_PERMISSIONS.IMPORT,
    export: POSITION_PERMISSIONS.EXPORT,
})

const canShowRowActions = computed(
    () => permissions.canUpdate.value || permissions.canArchive.value,
)

const dialogTitle = computed(() => {
    return dialogMode.value === "create"
        ? t("organization.position.createTitle")
        : t("organization.position.editTitle")
})

const companyOptions = computed(() =>
    companies.value.map((company) => ({
        label: `${company.code} - ${company.displayName}`,
        value: company.id,
    })),
)

const companyFilterOptions = computed(() => [
    {
        label: tr("organization.position.allCompanies", "All companies"),
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
        label: tr("organization.position.allBranches", "All branches"),
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

const departmentOptions = computed(() =>
    departments.value
        .filter((department) => {
            if (form.branchId && department.branchId !== form.branchId) {
                return false
            }

            if (form.companyId && department.companyId !== form.companyId) {
                return false
            }

            return true
        })
        .map((department) => ({
            label: `${department.code} - ${department.name}`,
            value: department.id,
        })),
)

const departmentFilterOptions = computed(() => [
    {
        label: tr("organization.position.allDepartments", "All departments"),
        value: "",
    },
    ...departments.value
        .filter((department) => {
            if (
                filters.branchId &&
                department.branchId !== filters.branchId
            ) {
                return false
            }

            if (
                filters.companyId &&
                department.companyId !== filters.companyId
            ) {
                return false
            }

            return true
        })
        .map((department) => ({
            label: `${department.code} - ${department.name}`,
            value: department.id,
        })),
])

const reportsToOptions = computed(() => [
    {
        label: t("organization.position.noReportsTo"),
        value: "",
    },
    ...reportsToPositions.value
        .filter((position) => position.id !== selectedPositionId.value)
        .map((position) => ({
            label: `${position.code} - ${position.title}`,
            value: position.id,
        })),
])

const statusOptions = computed(() => [
    {
        label: tr("organization.position.statusAll", "All statuses"),
        value: "ALL",
    },
    {
        label: t("organization.position.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.position.statusInactive"),
        value: "INACTIVE",
    },
    {
        label: t("organization.position.statusArchived"),
        value: "ARCHIVED",
    },
])

const editableStatusOptions = computed(() => [
    {
        label: t("organization.position.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.position.statusInactive"),
        value: "INACTIVE",
    },
])

function createEmptyForm() {
    return {
        companyId: "",
        branchId: "",
        departmentId: "",
        reportsToPositionId: "",
        code: "",
        title: "",
        shortName: "",
        level: 0,
        isManager: false,
        description: "",
        status: "ACTIVE",
    }
}

function assignForm(source) {
    const nextForm = source || createEmptyForm()

    form.companyId = nextForm.companyId || ""
    form.branchId = nextForm.branchId || ""
    form.departmentId = nextForm.departmentId || ""
    form.reportsToPositionId = nextForm.reportsToPositionId || ""
    form.code = nextForm.code || ""
    form.title = nextForm.title || ""
    form.shortName = nextForm.shortName || ""
    form.level = Number(nextForm.level || 0)
    form.isManager = Boolean(nextForm.isManager)
    form.description = nextForm.description || ""
    form.status = nextForm.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"
}

function buildCreatePayload() {
    return {
        companyId: form.companyId,
        branchId: form.branchId,
        departmentId: form.departmentId,
        reportsToPositionId: form.reportsToPositionId || null,
        code: form.code,
        title: form.title,
        shortName: form.shortName,
        level: form.level,
        isManager: form.isManager,
        description: form.description,
        status: form.status,
    }
}

function buildUpdatePayload() {
    return {
        reportsToPositionId: form.reportsToPositionId || null,
        code: form.code,
        title: form.title,
        shortName: form.shortName,
        level: form.level,
        isManager: form.isManager,
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
        return t("organization.position.statusActive")
    }

    if (status === "INACTIVE") {
        return t("organization.position.statusInactive")
    }

    if (status === "ARCHIVED") {
        return t("organization.position.statusArchived")
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

        companies.value = result || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.position.companyLoadFailed"),
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

        branches.value = result || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.position.branchLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        branchLoading.value = false
    }
}

async function loadDepartments(companyId = "", branchId = "") {
    departmentLoading.value = true

    try {
        const result = await fetchDepartmentsLookup({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            companyId: companyId || undefined,
            branchId: branchId || undefined,
            search: "",
        })

        departments.value = result || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.position.departmentLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        departmentLoading.value = false
    }
}

async function loadReportsToPositions() {
    if (!form.companyId || !form.branchId) {
        reportsToPositions.value = []
        return
    }

    reportsToLoading.value = true

    try {
        const result = await fetchPositionsLookup({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            companyId: form.companyId,
            branchId: form.branchId,
            search: "",
        })

        reportsToPositions.value = result || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.position.reportsToLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        reportsToLoading.value = false
    }
}

async function loadPositions(params = {}) {
    try {
        await positionStore.loadPositions(params)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.position.loadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function applyFilters() {
    loadPositions({
        page: 1,
        limit: positionStore.filters.limit,
        search: filters.search,
        status: filters.status,
        companyId: filters.companyId || undefined,
        branchId: filters.branchId || undefined,
        departmentId: filters.departmentId || undefined,
    })
}

function clearFilters() {
    filters.search = ""
    filters.status = "ALL"
    filters.companyId = ""
    filters.branchId = ""
    filters.departmentId = ""

    loadPositions({
        page: 1,
        search: "",
        status: "ALL",
        companyId: undefined,
        branchId: undefined,
        departmentId: undefined,
    })
}

function onPage(event) {
    loadPositions({
        page: event.page + 1,
        limit: event.rows,
    })
}

async function onFilterCompanyChange() {
    filters.branchId = ""
    filters.departmentId = ""

    await Promise.all([
        loadBranches(filters.companyId),
        loadDepartments(filters.companyId, ""),
    ])

    applyFilters()
}

async function onFilterBranchChange() {
    filters.departmentId = ""

    await loadDepartments(filters.companyId, filters.branchId)
    applyFilters()
}

async function onFormCompanyChange() {
    form.branchId = ""
    form.departmentId = ""
    form.reportsToPositionId = ""

    clearFieldError("companyId")

    await Promise.all([
        loadBranches(form.companyId),
        loadDepartments(form.companyId, ""),
    ])

    await loadReportsToPositions()
}

async function onFormBranchChange() {
    form.departmentId = ""
    form.reportsToPositionId = ""

    clearFieldError("branchId")

    await Promise.all([
        loadDepartments(form.companyId, form.branchId),
        loadReportsToPositions(),
    ])
}

async function onFormDepartmentChange() {
    clearFieldError("departmentId")
}

async function openCreateDialog() {
    if (!permissions.assert("create")) {
        return
    }

    if (companies.value.length === 0) {
        await loadCompanies()
    }

    if (branches.value.length === 0) {
        await loadBranches()
    }

    if (departments.value.length === 0) {
        await loadDepartments()
    }

    dialogMode.value = "create"
    selectedPositionId.value = null
    formErrors.value = {}

    assignForm(createEmptyForm())

    if (companies.value.length === 1) {
        form.companyId = companies.value[0].id
        await loadBranches(form.companyId)
        await loadDepartments(form.companyId, "")
    }

    if (branchOptions.value.length === 1) {
        form.branchId = branchOptions.value[0].value
        await loadDepartments(form.companyId, form.branchId)
    }

    if (departmentOptions.value.length === 1) {
        form.departmentId = departmentOptions.value[0].value
    }

    await loadReportsToPositions()

    dialogVisible.value = true
}

async function openEditDialog(position) {
    if (!permissions.assert("update")) {
        return
    }

    dialogMode.value = "edit"
    selectedPositionId.value = position.id
    formErrors.value = {}

    assignForm(position)

    await Promise.all([
        loadBranches(form.companyId),
        loadDepartments(form.companyId, form.branchId),
    ])

    await loadReportsToPositions()

    dialogVisible.value = true
}

function closeDialog() {
    dialogVisible.value = false
    selectedPositionId.value = null
    formErrors.value = {}
}

async function savePosition() {
    formErrors.value = {}

    try {
        if (dialogMode.value === "create") {
            await positionStore.createPosition(buildCreatePayload())

            toast.add({
                severity: "success",
                summary: t("organization.position.created"),
                detail: t("organization.position.createdDetail"),
                life: 3000,
            })
        } else {
            await positionStore.updatePosition(
                selectedPositionId.value,
                buildUpdatePayload(),
            )

            toast.add({
                severity: "success",
                summary: t("organization.position.updated"),
                detail: t("organization.position.updatedDetail"),
                life: 3000,
            })
        }

        closeDialog()
        await loadPositions()
    } catch (error) {
        applyBackendFieldErrors(error)

        toast.add({
            severity: "error",
            summary: t("organization.position.saveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function openArchiveDialog(position) {
    if (!permissions.assert("archive")) {
        return
    }

    archiveCandidate.value = position
    archiveDialogVisible.value = true
}

function closeArchiveDialog() {
    archiveDialogVisible.value = false
    archiveCandidate.value = null
}

async function confirmArchivePosition() {
    if (!archiveCandidate.value?.id) {
        return
    }

    try {
        await positionStore.archivePosition(archiveCandidate.value.id)

        toast.add({
            severity: "success",
            summary: t("organization.position.archived"),
            detail: t("organization.position.archivedDetail"),
            life: 3000,
        })

        closeArchiveDialog()
        await loadPositions()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.position.archiveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

async function downloadSample() {
    if (!permissions.assert("import")) {
        return
    }

    try {
        await positionStore.downloadImportTemplate()

        toast.add({
            severity: "success",
            summary: t("organization.position.sampleDownloaded"),
            detail: t("organization.position.sampleDownloadedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.position.sampleDownloadFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

async function exportExcel() {
    if (!permissions.assert("export")) {
        return
    }

    try {
        await positionStore.exportPositions()

        toast.add({
            severity: "success",
            summary: t("organization.position.exported"),
            detail: t("organization.position.exportedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.position.exportFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function openImportDialog() {
    if (!permissions.assert("import")) {
        return
    }

    selectedImportFile.value = null
    importDialogVisible.value = true
}

function closeImportDialog() {
    if (positionStore.importing) {
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
            summary: t("organization.position.importFileRequired"),
            detail: t("organization.position.importFileRequiredDetail"),
            life: 3500,
        })

        return
    }

    try {
        await positionStore.importPositions(selectedImportFile.value)

        importDialogVisible.value = false
        importResultDialogVisible.value = true

        await loadPositions()

        toast.add({
            severity:
                positionStore.importSummary?.errors?.length > 0
                    ? "warn"
                    : "success",
            summary: t("organization.position.importFinished"),
            detail:
                positionStore.importSummary?.errors?.length > 0
                    ? t("organization.position.importFinishedWithErrors")
                    : t("organization.position.importFinishedSuccess"),
            life: 4500,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.position.importFailed"),
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

        if (
            filters.departmentId &&
            !departmentFilterOptions.value.some(
                (option) => option.value === filters.departmentId,
            )
        ) {
            filters.departmentId = ""
        }
    },
)

watch(
    () => filters.branchId,
    () => {
        if (
            filters.departmentId &&
            !departmentFilterOptions.value.some(
                (option) => option.value === filters.departmentId,
            )
        ) {
            filters.departmentId = ""
        }
    },
)

onMounted(async () => {
    await Promise.all([
        loadCompanies(),
        loadBranches(),
        loadDepartments(),
        loadPositions(),
    ])
})
</script>

<template>
    <section class="position-page hrms-list-page">
        <AppFilterBar :loading="positionStore.loading">
            <span class="app-filter-field app-filter-field--search position-search">
                <i class="pi pi-search" />

                <InputText
                    v-model="filters.search"
                    class="position-search__input"
                    :placeholder="t('organization.position.searchPlaceholder')"
                    @keyup.enter="applyFilters"
                />
            </span>

            <div class="app-filter-field">
                <Select
                    v-model="filters.companyId"
                    class="position-filter-select"
                    :placeholder="tr('organization.position.allCompanies', 'All companies')"
                    :options="companyFilterOptions"
                    option-label="label"
                    option-value="value"
                    :loading="companyLoading"
                    @change="onFilterCompanyChange"
                />
            </div>

            <div class="app-filter-field">
                <Select
                    v-model="filters.branchId"
                    class="position-filter-select"
                    :placeholder="tr('organization.position.allBranches', 'All branches')"
                    :options="branchFilterOptions"
                    option-label="label"
                    option-value="value"
                    :loading="branchLoading"
                    @change="onFilterBranchChange"
                />
            </div>

            <div class="app-filter-field">
                <Select
                    v-model="filters.departmentId"
                    class="position-filter-select"
                    :placeholder="tr('organization.position.allDepartments', 'All departments')"
                    :options="departmentFilterOptions"
                    option-label="label"
                    option-value="value"
                    :loading="departmentLoading"
                    @change="applyFilters"
                />
            </div>

            <div class="app-filter-field position-status-field">
                <Select
                    v-model="filters.status"
                    class="position-filter-select"
                    :placeholder="tr('organization.position.statusAll', 'All statuses')"
                    :options="statusOptions"
                    option-label="label"
                    option-value="value"
                    @change="applyFilters"
                />
            </div>

            <template #actions>
                <Button icon="pi pi-filter" :label="t('common.apply')" @click="applyFilters" />

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
                    :loading="positionStore.loading"
                    @click="loadPositions"
                />

                <Button
                    v-if="permissions.canImport"
                    severity="secondary"
                    outlined
                    icon="pi pi-download"
                    :loading="positionStore.downloadingTemplate"
                    :aria-label="t('organization.position.downloadSample')"
                    v-tooltip.top="t('organization.position.downloadSample')"
                    @click="downloadSample"
                />

                <Button
                    v-if="permissions.canImport"
                    severity="secondary"
                    outlined
                    icon="pi pi-upload"
                    :aria-label="t('organization.position.importExcel')"
                    v-tooltip.top="t('organization.position.importExcel')"
                    @click="openImportDialog"
                />

                <Button
                    v-if="permissions.canExport"
                    severity="secondary"
                    outlined
                    icon="pi pi-file-export"
                    :loading="positionStore.exporting"
                    :aria-label="t('organization.position.exportExcel')"
                    v-tooltip.top="t('organization.position.exportExcel')"
                    @click="exportExcel"
                />

                <Button
                    v-if="permissions.canCreate"
                    icon="pi pi-plus"
                    :label="t('organization.position.newPosition')"
                    @click="openCreateDialog"
                />
            </template>
        </AppFilterBar>

        <div class="hrms-list-card">
                <div class="hrms-table-wrap">
                    <DataTable
                        lazy
                        class="hrms-standard-table hrms-standard-table--horizontal"
                        paginator
                        striped-rows
                        data-key="id"
                        size="small"
                        scrollable
                        scroll-height="flex"
                        :value="positionStore.items"
                        :loading="positionStore.loading"
                        :rows="positionStore.pagination.limit"
                        :first="
                            (positionStore.pagination.page - 1) *
                            positionStore.pagination.limit
                        "
                        :total-records="positionStore.pagination.total"
                        :rows-per-page-options="[10, 20, 50, 100]"
                        :empty-message="t('organization.position.empty')"
                        @page="onPage"
                    >
                        <Column
                            field="code"
                            :header="t('organization.position.code')"
                            frozen
                            style="min-width: 9rem"
                        >
                            <template #body="{ data }">
                                <span class="position-code">
                                    {{ data.code }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.position.positionTitle')"
                            style="min-width: 15rem"
                        >
                            <template #body="{ data }">
                                <span class="hrms-cell-primary hrms-cell-nowrap">
                                    {{ data.title || "-" }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.position.department')"
                            style="min-width: 13rem"
                        >
                            <template #body="{ data }">
                                <span class="hrms-cell-primary hrms-cell-nowrap">
                                    {{ data.department?.name || "-" }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.position.branch')"
                            style="min-width: 13rem"
                        >
                            <template #body="{ data }">
                                <span class="hrms-cell-primary hrms-cell-nowrap">
                                    {{ data.branch?.name || "-" }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.position.reportsTo')"
                            style="min-width: 14rem"
                        >
                            <template #body="{ data }">
                                <span
                                    v-if="data.reportsToPosition"
                                    class="hrms-cell-primary hrms-cell-nowrap"
                                >
                                    {{ data.reportsToPosition.title }}
                                </span>

                                <span v-else class="hrms-cell-muted hrms-cell-nowrap">
                                    {{ t("organization.position.noReportsTo") }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            field="level"
                            :header="t('organization.position.level')"
                            style="min-width: 7rem"
                        >
                            <template #body="{ data }">
                                <Tag
                                    severity="secondary"
                                    :value="String(data.level ?? 0)"
                                />
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.position.manager')"
                            style="min-width: 8rem"
                        >
                            <template #body="{ data }">
                                <Tag
                                    v-if="data.isManager"
                                    severity="info"
                                    :value="t('common.yes')"
                                />

                                <span v-else class="hrms-cell-muted">
                                    {{ t("common.no") }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            field="status"
                            :header="t('organization.position.status')"
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
                            :header="t('organization.position.updatedAt')"
                            style="min-width: 11rem"
                        >
                            <template #body="{ data }">
                                <span class="position-date">
                                    {{ formatDateTime(data.updatedAt) }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            v-if="canShowRowActions"
                            :header="t('common.actions')"
                            align-frozen="right"
                            frozen
                            style="min-width: 10rem"
                        >
                            <template #body="{ data }">
                                <AppTableActions
                                    v-if="data.status !== 'ARCHIVED'"
                                    :can-edit="permissions.canUpdate"
                                    :can-archive="permissions.canArchive"
                                    :edit-label="t('common.edit')"
                                    :archive-label="t('common.archive')"
                                    @edit="openEditDialog(data)"
                                    @archive="openArchiveDialog(data)"
                                />

                                <span
                                    v-else
                                    class="position-archived-text"
                                >
                                    {{ t("organization.position.readOnly") }}
                                </span>
                            </template>
                        </Column>
                    </DataTable>
                </div>
        </div>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            class="hrms-standard-dialog position-dialog"
            :header="dialogTitle"
            :draggable="false"
        >
            <div class="hrms-dialog-form position-form">
                <div class="hrms-form-section position-form__section">
                    <h3>{{ t("organization.position.basicInfo") }}</h3>

                    <div class="hrms-form-grid position-form__grid">
                        <label class="hrms-form-field position-field">
                            <span>{{ t("organization.position.company") }}</span>

                            <Select
                                v-model="form.companyId"
                                :disabled="dialogMode === 'edit'"
                                :invalid="Boolean(getFieldError('companyId'))"
                                :options="companyOptions"
                                option-label="label"
                                option-value="value"
                                :placeholder="
                                    t('organization.position.selectCompany')
                                "
                                :loading="companyLoading"
                                @change="onFormCompanyChange"
                            />

                            <small v-if="getFieldError('companyId')">
                                {{ getFieldError("companyId") }}
                            </small>
                        </label>

                        <label class="hrms-form-field position-field">
                            <span>{{ t("organization.position.branch") }}</span>

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
                                    t('organization.position.selectBranch')
                                "
                                :loading="branchLoading"
                                @change="onFormBranchChange"
                            />

                            <small v-if="getFieldError('branchId')">
                                {{ getFieldError("branchId") }}
                            </small>
                        </label>

                        <label class="hrms-form-field position-field">
                            <span>
                                {{ t("organization.position.department") }}
                            </span>

                            <Select
                                v-model="form.departmentId"
                                :disabled="
                                    dialogMode === 'edit' || !form.branchId
                                "
                                :invalid="
                                    Boolean(getFieldError('departmentId'))
                                "
                                :options="departmentOptions"
                                option-label="label"
                                option-value="value"
                                :placeholder="
                                    t('organization.position.selectDepartment')
                                "
                                :loading="departmentLoading"
                                @change="onFormDepartmentChange"
                            />

                            <small v-if="getFieldError('departmentId')">
                                {{ getFieldError("departmentId") }}
                            </small>
                        </label>

                        <label class="hrms-form-field position-field">
                            <span>{{ t("organization.position.reportsTo") }}</span>

                            <Select
                                v-model="form.reportsToPositionId"
                                :disabled="!form.companyId || !form.branchId"
                                :options="reportsToOptions"
                                option-label="label"
                                option-value="value"
                                :loading="reportsToLoading"
                                @change="
                                    clearFieldError('reportsToPositionId')
                                "
                            />

                            <small
                                v-if="getFieldError('reportsToPositionId')"
                            >
                                {{ getFieldError("reportsToPositionId") }}
                            </small>
                        </label>

                        <label class="hrms-form-field position-field">
                            <span>{{ t("organization.position.code") }}</span>

                            <InputText
                                v-model="form.code"
                                :invalid="Boolean(getFieldError('code'))"
                                autocomplete="off"
                                placeholder="HR_MANAGER"
                                @input="normalizeCodeInput"
                            />

                            <small v-if="getFieldError('code')">
                                {{ getFieldError("code") }}
                            </small>
                        </label>

                        <label class="hrms-form-field position-field">
                            <span>
                                {{ t("organization.position.shortName") }}
                            </span>

                            <InputText
                                v-model="form.shortName"
                                autocomplete="off"
                                placeholder="HR Manager"
                            />
                        </label>

                        <label class="hrms-form-field hrms-form-field--wide position-field position-field--wide">
                            <span>{{ t("organization.position.titleField") }}</span>

                            <InputText
                                v-model="form.title"
                                :invalid="Boolean(getFieldError('title'))"
                                autocomplete="off"
                                placeholder="HR Manager"
                                @input="clearFieldError('title')"
                            />

                            <small v-if="getFieldError('title')">
                                {{ getFieldError("title") }}
                            </small>
                        </label>

                        <label class="hrms-form-field position-field">
                            <span>{{ t("organization.position.level") }}</span>

                            <InputNumber
                                v-model="form.level"
                                :min="0"
                                :max="99"
                                :use-grouping="false"
                                input-class="position-input-number"
                            />
                        </label>

                        <label class="hrms-form-field position-field">
                            <span>{{ t("organization.position.status") }}</span>

                            <Select
                                v-model="form.status"
                                :options="editableStatusOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </label>

                        <div class="hrms-form-field hrms-form-field--wide position-field position-field--wide">
                            <div class="position-checkbox-row">
                                <Checkbox
                                    v-model="form.isManager"
                                    input-id="isManager"
                                    binary
                                />

                                <label for="isManager">
                                    {{
                                        t(
                                            "organization.position.markAsManager",
                                        )
                                    }}
                                </label>
                            </div>
                        </div>

                        <label class="hrms-form-field hrms-form-field--wide position-field position-field--wide">
                            <span>
                                {{
                                    t(
                                        "organization.position.descriptionLabel",
                                    )
                                }}
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
                    :loading="positionStore.saving"
                    :label="t('common.save')"
                    @click="savePosition"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="archiveDialogVisible"
            modal
            class="hrms-standard-dialog position-archive-dialog"
            :header="t('organization.position.archiveTitle')"
            :draggable="false"
        >
            <p class="position-archive-text">
                {{
                    t("organization.position.archiveMessage", {
                        name: archiveCandidate?.title || "-",
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
                    :loading="positionStore.archiving"
                    :label="t('common.archive')"
                    @click="confirmArchivePosition"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importDialogVisible"
            modal
            class="hrms-standard-dialog position-import-dialog"
            :header="t('organization.position.importTitle')"
            :draggable="false"
            :closable="!positionStore.importing"
        >
            <div class="position-import">
                <p>
                    {{ t("organization.position.importDescription") }}
                </p>

                <input
                    ref="fileInputRef"
                    type="file"
                    accept=".xlsx"
                    :disabled="positionStore.importing"
                    @change="onImportFileChange"
                />

                <div
                    v-if="selectedImportFile"
                    class="position-import__file"
                >
                    <i class="pi pi-file-excel" />
                    <span>{{ selectedImportFile.name }}</span>
                </div>

                <div
                    v-if="positionStore.importing"
                    class="position-import__progress"
                >
                    <ProgressBar :value="positionStore.importProgress" />

                    <span>
                        {{
                            t("organization.position.importProgress", {
                                percent: positionStore.importProgress,
                            })
                        }}
                    </span>
                </div>
            </div>

            <template #footer>
                <Button
                    severity="secondary"
                    outlined
                    :disabled="positionStore.importing"
                    :label="t('common.cancel')"
                    @click="closeImportDialog"
                />

                <Button
                    icon="pi pi-upload"
                    :loading="positionStore.importing"
                    :label="t('organization.position.importExcel')"
                    @click="submitImport"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importResultDialogVisible"
            modal
            class="hrms-standard-dialog position-import-result-dialog"
            :header="t('organization.position.importResultTitle')"
            :draggable="false"
        >
            <div
                v-if="positionStore.importSummary"
                class="position-import-result"
            >
                <div class="position-import-result__grid">
                    <div>
                        <span>{{ t("organization.position.totalRows") }}</span>
                        <strong>
                            {{ positionStore.importSummary.totalRows }}
                        </strong>
                    </div>

                    <div>
                        <span>{{ t("organization.position.createdRows") }}</span>
                        <strong>
                            {{ positionStore.importSummary.created }}
                        </strong>
                    </div>

                    <div>
                        <span>{{ t("organization.position.updatedRows") }}</span>
                        <strong>
                            {{ positionStore.importSummary.updated }}
                        </strong>
                    </div>

                    <div>
                        <span>{{ t("organization.position.skippedRows") }}</span>
                        <strong>
                            {{ positionStore.importSummary.skipped }}
                        </strong>
                    </div>
                </div>

                <div
                    v-if="positionStore.importSummary.errors?.length"
                    class="position-import-result__errors"
                >
                    <h4>
                        {{ t("organization.position.validationErrors") }}
                    </h4>

                    <DataTable
                        size="small"
                        :value="positionStore.importSummary.errors"
                    >
                        <Column
                            field="rowNumber"
                            :header="t('organization.position.rowNumber')"
                            style="width: 7rem"
                        />

                        <Column
                            field="field"
                            :header="t('organization.position.field')"
                            style="width: 12rem"
                        />

                        <Column :header="t('organization.position.issue')">
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
.position-page {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--hrms-page-gap);
    width: 100%;
    min-width: 0;
    min-height: 0;
}

.position-search {
    position: relative;
    flex: 1 1 14rem;
    min-width: 11rem;
    max-width: 22rem;
}

.position-search > i {
    position: absolute;
    top: 50%;
    left: 0.7rem;
    z-index: 1;
    transform: translateY(-50%);
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
    pointer-events: none;
}

.position-search :deep(.p-inputtext) {
    width: 100%;
    padding-left: 2rem;
    border: 1px solid var(--hrms-border);
}

.position-filter-select {
    width: 11.5rem;
}

.position-status-field .position-filter-select {
    width: 9.5rem;
}

.position-code {
    color: var(--hrms-primary);
    font-size: 0.74rem;
    font-weight: 400;
}

.position-checkbox-row {
    display: flex;
    align-items: center;
    min-height: 2.25rem;
    gap: 0.55rem;
}

.position-archive-text,
.position-import p {
    margin: 0;
    color: var(--hrms-text-secondary);
    line-height: 1.55;
}

.position-import {
    display: grid;
    gap: 0.85rem;
}

.position-import__file,
.position-import__progress {
    display: grid;
    gap: 0.45rem;
}

.position-import__file {
    grid-template-columns: auto 1fr;
    align-items: center;
    padding: 0.7rem;
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
}

.position-import-result {
    display: grid;
    gap: 1rem;
}

.position-import-result__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.65rem;
}

.position-import-result__grid > div {
    display: grid;
    gap: 0.25rem;
    padding: 0.75rem;
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
    background: var(--hrms-surface-soft);
    text-align: center;
}

.position-import-result__grid span {
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
}

.position-import-result__grid strong {
    font-size: 1rem;
}

.position-import-result__errors h4 {
    margin: 0 0 0.65rem;
}


:deep(.p-datatable-thead > tr > th) {
    font-weight: 800 !important;
    text-align: center;
    vertical-align: middle;
}

:deep(.p-datatable-tbody > tr > td) {
    font-weight: 400 !important;
    text-align: center;
    vertical-align: middle;
}

:deep(.p-datatable-tbody > tr > td strong),
:deep(.p-datatable-tbody > tr > td span),
:deep(.p-datatable-tbody > tr > td div) {
    font-weight: 400 !important;
}

@media (max-width: 900px) {
    .position-filter-select,
    .position-status-field .position-filter-select,
    .position-search {
        width: 100%;
        max-width: none;
    }

    .position-import-result__grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 520px) {
    .position-import-result__grid {
        grid-template-columns: 1fr;
    }
}

.hrms-cell-nowrap {
    display: inline-block;
    max-width: none;
    white-space: nowrap;
}
</style>
