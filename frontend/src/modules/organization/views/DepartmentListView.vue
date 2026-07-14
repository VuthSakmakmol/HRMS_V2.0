<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputText from "primevue/inputtext"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { useUiStore } from "@/app/stores/ui.store.js"
import { useModulePermissions } from "@/shared/auth/useModulePermissions.js"
import AppFilterBar from "@/shared/components/filter/AppFilterBar.vue"
import AppTableActions from "@/shared/components/table/AppTableActions.vue"
import { fetchBranches } from "../services/branch.api.js"
import { fetchCompanies } from "../services/company.api.js"
import { fetchDepartments } from "../services/department.api.js"
import { useDepartmentStore } from "../stores/department.store.js"

const { t, te } = useI18n()
const toast = useToast()

const uiStore = useUiStore()
const departmentStore = useDepartmentStore()

function tr(key, fallback) {
    return te(key) ? t(key) : fallback
}

const DEPARTMENT_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.DEPARTMENT.VIEW",
    CREATE: "ORGANIZATION.DEPARTMENT.CREATE",
    UPDATE: "ORGANIZATION.DEPARTMENT.UPDATE",
    ARCHIVE: "ORGANIZATION.DEPARTMENT.ARCHIVE",
    IMPORT: "ORGANIZATION.DEPARTMENT.IMPORT",
    EXPORT: "ORGANIZATION.DEPARTMENT.EXPORT",
})

const companies = ref([])
const branches = ref([])
const parentDepartments = ref([])

const companyLoading = ref(false)
const branchLoading = ref(false)
const parentDepartmentLoading = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedDepartmentId = ref(null)

const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)

const importDialogVisible = ref(false)
const importResultDialogVisible = ref(false)
const selectedImportFile = ref(null)
const importFileInput = ref(null)
const importSummary = ref(null)
const importProgress = ref(0)
const importProgressVisible = ref(false)

let importProgressTimer = null

const formErrors = ref({})

const filters = reactive({
    search: "",
    status: "ALL",
    companyId: "",
    branchId: "",
})

const form = reactive(createEmptyForm())

const permissions = useModulePermissions({
    view: DEPARTMENT_PERMISSIONS.VIEW,
    create: DEPARTMENT_PERMISSIONS.CREATE,
    update: DEPARTMENT_PERMISSIONS.UPDATE,
    archive: DEPARTMENT_PERMISSIONS.ARCHIVE,
    import: DEPARTMENT_PERMISSIONS.IMPORT,
    export: DEPARTMENT_PERMISSIONS.EXPORT,
})

const canShowRowActions = computed(
    () => permissions.canUpdate.value || permissions.canArchive.value,
)

const dialogTitle = computed(() => {
    return dialogMode.value === "create"
        ? t("organization.department.createTitle")
        : t("organization.department.editTitle")
})

const companyOptions = computed(() =>
    companies.value.map((company) => ({
        label: `${company.code} - ${company.displayName}`,
        value: company.id,
    })),
)

const companyFilterOptions = computed(() => [
    {
        label: tr("organization.department.allCompanies", "All companies"),
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
        label: tr("organization.department.allBranches", "All branches"),
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

const parentDepartmentOptions = computed(() => [
    {
        label: t("organization.department.noParent"),
        value: "",
    },
    ...parentDepartments.value
        .filter((department) => department.id !== selectedDepartmentId.value)
        .map((department) => ({
            label: `${department.code} - ${department.name}`,
            value: department.id,
        })),
])

const statusOptions = computed(() => [
    {
        label: tr("organization.department.statusAll", "All statuses"),
        value: "ALL",
    },
    {
        label: t("organization.department.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.department.statusInactive"),
        value: "INACTIVE",
    },
    {
        label: t("organization.department.statusArchived"),
        value: "ARCHIVED",
    },
])

const editableStatusOptions = computed(() => [
    {
        label: t("organization.department.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.department.statusInactive"),
        value: "INACTIVE",
    },
])

function createEmptyForm() {
    return {
        companyId: "",
        branchId: "",
        parentDepartmentId: "",
        code: "",
        name: "",
        shortName: "",
        description: "",
        status: "ACTIVE",
    }
}

function assignForm(source) {
    const nextForm = source || createEmptyForm()

    form.companyId = nextForm.companyId || ""
    form.branchId = nextForm.branchId || ""
    form.parentDepartmentId = nextForm.parentDepartmentId || ""
    form.code = nextForm.code || ""
    form.name = nextForm.name || ""
    form.shortName = nextForm.shortName || ""
    form.description = nextForm.description || ""
    form.status = nextForm.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"
}

function buildCreatePayload() {
    return {
        companyId: form.companyId,
        branchId: form.branchId,
        parentDepartmentId: form.parentDepartmentId || null,
        code: form.code,
        name: form.name,
        shortName: form.shortName,
        description: form.description,
        status: form.status,
    }
}

function buildUpdatePayload() {
    return {
        parentDepartmentId: form.parentDepartmentId || null,
        code: form.code,
        name: form.name,
        shortName: form.shortName,
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

function getImportErrorText(messageKey) {
    if (!messageKey) {
        return "-"
    }

    const translated = t(messageKey)

    return translated === messageKey ? messageKey : translated
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
        return t("organization.department.statusActive")
    }

    if (status === "INACTIVE") {
        return t("organization.department.statusInactive")
    }

    if (status === "ARCHIVED") {
        return t("organization.department.statusArchived")
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
        const result = await fetchCompanies({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            search: "",
        })

        companies.value = result.items || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.department.companyLoadFailed"),
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
        const result = await fetchBranches({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            companyId: companyId || undefined,
            search: "",
        })

        branches.value = result.items || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.department.branchLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        branchLoading.value = false
    }
}

async function loadParentDepartments() {
    if (!form.companyId || !form.branchId) {
        parentDepartments.value = []
        return
    }

    parentDepartmentLoading.value = true

    try {
        const result = await fetchDepartments({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            companyId: form.companyId,
            branchId: form.branchId,
            search: "",
        })

        parentDepartments.value = result.items || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.department.parentLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        parentDepartmentLoading.value = false
    }
}

async function loadDepartments(params = {}) {
    try {
        await departmentStore.loadDepartments(params)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.department.loadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function getCleanFilterPayload() {
    return {
        page: 1,
        limit: departmentStore.filters.limit,
        search: filters.search,
        status: filters.status,
        companyId: filters.companyId || undefined,
        branchId: filters.branchId || undefined,
    }
}

function applyFilters() {
    loadDepartments(getCleanFilterPayload())
}

function clearFilters() {
    filters.search = ""
    filters.status = "ALL"
    filters.companyId = ""
    filters.branchId = ""

    loadDepartments({
        page: 1,
        search: "",
        status: "ALL",
        companyId: undefined,
        branchId: undefined,
    })
}

function onPage(event) {
    loadDepartments({
        page: event.page + 1,
        limit: event.rows,
    })
}

async function onFilterCompanyChange() {
    filters.branchId = ""

    await loadBranches(filters.companyId)
    applyFilters()
}

async function onFormCompanyChange() {
    form.branchId = ""
    form.parentDepartmentId = ""

    clearFieldError("companyId")
    await loadBranches(form.companyId)
    await loadParentDepartments()
}

async function onFormBranchChange() {
    form.parentDepartmentId = ""

    clearFieldError("branchId")
    await loadParentDepartments()
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

    dialogMode.value = "create"
    selectedDepartmentId.value = null
    formErrors.value = {}

    assignForm(createEmptyForm())

    if (companies.value.length === 1) {
        form.companyId = companies.value[0].id
        await loadBranches(form.companyId)
    }

    if (branchOptions.value.length === 1) {
        form.branchId = branchOptions.value[0].value
        await loadParentDepartments()
    }

    dialogVisible.value = true
}

async function openEditDialog(department) {
    if (!permissions.assert("update")) {
        return
    }

    dialogMode.value = "edit"
    selectedDepartmentId.value = department.id
    formErrors.value = {}

    assignForm(department)

    await loadBranches(form.companyId)
    await loadParentDepartments()

    dialogVisible.value = true
}

function closeDialog() {
    dialogVisible.value = false
    selectedDepartmentId.value = null
    formErrors.value = {}
}

async function saveDepartment() {
    const requiredAction = dialogMode.value === "create" ? "create" : "update"

    if (!permissions.assert(requiredAction)) {
        return
    }

    formErrors.value = {}

    try {
        if (dialogMode.value === "create") {
            await departmentStore.createDepartment(buildCreatePayload())

            toast.add({
                severity: "success",
                summary: t("organization.department.created"),
                detail: t("organization.department.createdDetail"),
                life: 3000,
            })
        } else {
            await departmentStore.updateDepartment(
                selectedDepartmentId.value,
                buildUpdatePayload(),
            )

            toast.add({
                severity: "success",
                summary: t("organization.department.updated"),
                detail: t("organization.department.updatedDetail"),
                life: 3000,
            })
        }

        closeDialog()
        await loadDepartments()
    } catch (error) {
        applyBackendFieldErrors(error)

        toast.add({
            severity: "error",
            summary: t("organization.department.saveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function openArchiveDialog(department) {
    if (!permissions.assert("archive")) {
        return
    }

    archiveCandidate.value = department
    archiveDialogVisible.value = true
}

function closeArchiveDialog() {
    archiveDialogVisible.value = false
    archiveCandidate.value = null
}

async function confirmArchiveDepartment() {
    if (!permissions.assert("archive")) {
        return
    }

    if (!archiveCandidate.value?.id) {
        return
    }

    try {
        await departmentStore.archiveDepartment(archiveCandidate.value.id)

        toast.add({
            severity: "success",
            summary: t("organization.department.archived"),
            detail: t("organization.department.archivedDetail"),
            life: 3000,
        })

        closeArchiveDialog()
        await loadDepartments()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.department.archiveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

async function downloadTemplate() {
    if (!permissions.assert("import")) {
        return
    }

    try {
        await departmentStore.downloadImportTemplate()

        toast.add({
            severity: "success",
            summary: t("organization.department.templateDownloaded"),
            detail: t("organization.department.templateDownloadedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.department.templateDownloadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

async function exportDepartmentExcel() {
    if (!permissions.assert("export")) {
        return
    }

    try {
        await departmentStore.exportDepartments({
            search: filters.search,
            status: filters.status,
            companyId: filters.companyId || undefined,
            branchId: filters.branchId || undefined,
        })

        toast.add({
            severity: "success",
            summary: t("organization.department.exportStarted"),
            detail: t("organization.department.exportStartedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.department.exportFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function openImportDialog() {
    if (!permissions.assert("import")) {
        return
    }

    selectedImportFile.value = null
    importSummary.value = null

    if (importFileInput.value) {
        importFileInput.value.value = ""
    }

    importDialogVisible.value = true
}

function closeImportDialog() {
    importDialogVisible.value = false
    selectedImportFile.value = null
}

function onImportFileChange(event) {
    const file = event.target.files?.[0]
    selectedImportFile.value = file || null
}

function stopImportProgressTimer() {
    if (importProgressTimer) {
        window.clearInterval(importProgressTimer)
        importProgressTimer = null
    }
}

function startImportProgress() {
    stopImportProgressTimer()

    importProgress.value = 1
    importProgressVisible.value = true

    importProgressTimer = window.setInterval(() => {
        if (importProgress.value < 35) {
            importProgress.value += 2
            return
        }

        if (importProgress.value < 90) {
            importProgress.value += 1
            return
        }

        if (importProgress.value < 95) {
            importProgress.value += 1
        }
    }, 700)
}

function updateImportUploadProgress(uploadPercent) {
    const stagedPercent = Math.max(1, Math.min(35, Math.round(uploadPercent * 0.35)))

    if (stagedPercent > importProgress.value) {
        importProgress.value = stagedPercent
    }
}

function finishImportProgress() {
    stopImportProgressTimer()
    importProgress.value = 100

    window.setTimeout(() => {
        importProgressVisible.value = false
        importProgress.value = 0
    }, 700)
}

function failImportProgress() {
    stopImportProgressTimer()

    window.setTimeout(() => {
        importProgressVisible.value = false
        importProgress.value = 0
    }, 700)
}

async function submitImport() {
    if (!permissions.assert("import")) {
        return
    }

    if (!selectedImportFile.value) {
        toast.add({
            severity: "warn",
            summary: t("organization.department.importFileMissing"),
            detail: t("errors.organization.departmentImport.fileRequired"),
            life: 3500,
        })

        return
    }

    try {
        startImportProgress()

        const summary = await departmentStore.importDepartments(
            selectedImportFile.value,
            {
                onUploadProgress: updateImportUploadProgress,
            },
        )

        finishImportProgress()
        importSummary.value = summary
        closeImportDialog()
        importResultDialogVisible.value = true

        if (summary.errors?.length > 0) {
            toast.add({
                severity: "warn",
                summary: t("organization.department.importHasErrors"),
                detail: t("errors.organization.departmentImport.hasErrors"),
                life: 5000,
            })
        } else {
            toast.add({
                severity: "success",
                summary: t("organization.department.importCompleted"),
                detail: t("organization.department.importCompletedDetail"),
                life: 3500,
            })
        }

        await Promise.all([loadDepartments(), loadParentDepartments()])
    } catch (error) {
        failImportProgress()

        const summary = error?.response?.data?.data?.summary

        if (summary) {
            importSummary.value = summary
            closeImportDialog()
            importResultDialogVisible.value = true
        }

        toast.add({
            severity: "error",
            summary: t("organization.department.importFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
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
    await Promise.all([loadCompanies(), loadBranches(), loadDepartments()])
})
</script>

<template>
    <section class="department-page hrms-list-page">
        <AppFilterBar :loading="departmentStore.loading">
            <span class="app-filter-field app-filter-field--search department-search">
                <i class="pi pi-search" />

                <InputText
                    v-model="filters.search"
                    :placeholder="t('organization.department.searchPlaceholder')"
                    @keyup.enter="applyFilters"
                />
            </span>

            <div class="app-filter-field">
                <Select
                    v-model="filters.companyId"
                    class="department-filter-select"
                    :placeholder="tr('organization.department.allCompanies', 'All companies')"
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
                    class="department-filter-select"
                    :placeholder="tr('organization.department.allBranches', 'All branches')"
                    :options="branchFilterOptions"
                    option-label="label"
                    option-value="value"
                    :loading="branchLoading"
                    @change="applyFilters"
                />
            </div>

            <div class="app-filter-field department-status-field">
                <Select
                    v-model="filters.status"
                    class="department-filter-select"
                    :placeholder="tr('organization.department.statusAll', 'All statuses')"
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
                    :loading="departmentStore.loading"
                    @click="loadDepartments"
                />

                <Button
                    v-if="permissions.canImport"
                    severity="secondary"
                    outlined
                    icon="pi pi-download"
                    :loading="departmentStore.downloadingTemplate"
                    :aria-label="t('organization.department.downloadSample')"
                    v-tooltip.top="t('organization.department.downloadSample')"
                    @click="downloadTemplate"
                />

                <Button
                    v-if="permissions.canImport"
                    severity="secondary"
                    outlined
                    icon="pi pi-upload"
                    :aria-label="t('organization.department.importExcel')"
                    v-tooltip.top="t('organization.department.importExcel')"
                    @click="openImportDialog"
                />

                <Button
                    v-if="permissions.canExport"
                    severity="secondary"
                    outlined
                    icon="pi pi-file-export"
                    :loading="departmentStore.exporting"
                    :aria-label="t('organization.department.exportExcel')"
                    v-tooltip.top="t('organization.department.exportExcel')"
                    @click="exportDepartmentExcel"
                />

                <Button
                    v-if="permissions.canCreate"
                    icon="pi pi-plus"
                    :label="t('organization.department.newDepartment')"
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
                        :value="departmentStore.items"
                        :loading="departmentStore.loading"
                        :rows="departmentStore.pagination.limit"
                        :first="
                            (departmentStore.pagination.page - 1) *
                            departmentStore.pagination.limit
                        "
                        :total-records="departmentStore.pagination.total"
                        :rows-per-page-options="[10, 20, 50, 100]"
                        :empty-message="
                            t('organization.department.empty')
                        "
                        @page="onPage"
                    >
                        <Column
                            field="code"
                            :header="t('organization.department.code')"
                            frozen
                            style="min-width: 8rem"
                        >
                            <template #body="{ data }">
                                <span class="department-code">
                                    {{ data.code }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            :header="
                                t('organization.department.departmentName')
                            "
                            style="min-width: 14rem"
                        >
                            <template #body="{ data }">
                                <span>
                                    {{ data.name || "-" }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.department.company')"
                            style="min-width: 13rem"
                        >
                            <template #body="{ data }">
                                <span>
                                    {{ data.company?.displayName || "-" }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.department.branch')"
                            style="min-width: 13rem"
                        >
                            <template #body="{ data }">
                                <span>
                                    {{ data.branch?.name || "-" }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.department.parent')"
                            style="min-width: 13rem"
                        >
                            <template #body="{ data }">
                                <span v-if="data.parentDepartment">
                                    {{ data.parentDepartment.name }}
                                </span>

                                <span v-else class="hrms-cell-muted">
                                    {{ t("organization.department.noParent") }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            field="status"
                            :header="t('organization.department.status')"
                            style="min-width: 9rem"
                        >
                            <template #body="{ data }">
                                <Tag
                                    :severity="
                                        getStatusSeverity(data.status)
                                    "
                                    :value="getStatusLabel(data.status)"
                                />
                            </template>
                        </Column>

                        <Column
                            field="updatedAt"
                            :header="
                                t('organization.department.updatedAt')
                            "
                            style="min-width: 11rem"
                        >
                            <template #body="{ data }">
                                <span class="hrms-cell-muted">
                                    {{ formatDateTime(data.updatedAt) }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            v-if="canShowRowActions"
                            :header="t('common.actions')"
                            align-frozen="right"
                            frozen
                            header-class="department-action-column"
                            body-class="department-action-column"
                            style="width: 5rem; min-width: 5rem"
                        >
                            <template #body="{ data }">
                                <AppTableActions
                                    :can-edit="
                                        permissions.canUpdate &&
                                        data.status !== 'ARCHIVED'
                                    "
                                    :can-archive="
                                        permissions.canArchive &&
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
            class="hrms-standard-dialog"
            :header="dialogTitle"
            :draggable="false"
        >
            <div class="hrms-dialog-form">
                <div class="hrms-form-section">
                    <h3>{{ t("organization.department.basicInfo") }}</h3>

                    <div class="hrms-form-grid">
                        <label class="hrms-form-field">
                            <span>
                                {{ t("organization.department.company") }}
                            </span>

                            <Select
                                v-model="form.companyId"
                                :disabled="dialogMode === 'edit'"
                                :invalid="
                                    Boolean(getFieldError('companyId'))
                                "
                                :options="companyOptions"
                                option-label="label"
                                option-value="value"
                                :placeholder="
                                    t(
                                        'organization.department.selectCompany',
                                    )
                                "
                                :loading="companyLoading"
                                @change="onFormCompanyChange"
                            />

                            <small v-if="getFieldError('companyId')">
                                {{ getFieldError("companyId") }}
                            </small>
                        </label>

                        <label class="hrms-form-field">
                            <span>
                                {{ t("organization.department.branch") }}
                            </span>

                            <Select
                                v-model="form.branchId"
                                :disabled="
                                    dialogMode === 'edit' || !form.companyId
                                "
                                :invalid="
                                    Boolean(getFieldError('branchId'))
                                "
                                :options="branchOptions"
                                option-label="label"
                                option-value="value"
                                :placeholder="
                                    t(
                                        'organization.department.selectBranch',
                                    )
                                "
                                :loading="branchLoading"
                                @change="onFormBranchChange"
                            />

                            <small v-if="getFieldError('branchId')">
                                {{ getFieldError("branchId") }}
                            </small>
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("organization.department.code") }}</span>

                            <InputText
                                v-model="form.code"
                                :invalid="Boolean(getFieldError('code'))"
                                autocomplete="off"
                                placeholder="HR"
                                @input="normalizeCodeInput"
                            />

                            <small v-if="getFieldError('code')">
                                {{ getFieldError("code") }}
                            </small>
                        </label>

                        <label class="hrms-form-field">
                            <span>
                                {{ t("organization.department.shortName") }}
                            </span>

                            <InputText
                                v-model="form.shortName"
                                autocomplete="off"
                                placeholder="HR"
                            />
                        </label>

                        <label class="hrms-form-field hrms-form-field--wide">
                            <span>{{ t("organization.department.name") }}</span>

                            <InputText
                                v-model="form.name"
                                :invalid="Boolean(getFieldError('name'))"
                                autocomplete="off"
                                placeholder="Human Resources"
                                @input="clearFieldError('name')"
                            />

                            <small v-if="getFieldError('name')">
                                {{ getFieldError("name") }}
                            </small>
                        </label>

                        <label class="hrms-form-field">
                            <span>
                                {{ t("organization.department.parent") }}
                            </span>

                            <Select
                                v-model="form.parentDepartmentId"
                                :disabled="!form.companyId || !form.branchId"
                                :options="parentDepartmentOptions"
                                option-label="label"
                                option-value="value"
                                :loading="parentDepartmentLoading"
                                @change="
                                    clearFieldError('parentDepartmentId')
                                "
                            />

                            <small
                                v-if="getFieldError('parentDepartmentId')"
                            >
                                {{ getFieldError("parentDepartmentId") }}
                            </small>
                        </label>

                        <label class="hrms-form-field">
                            <span>
                                {{ t("organization.department.status") }}
                            </span>

                            <Select
                                v-model="form.status"
                                :options="editableStatusOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </label>

                        <label class="hrms-form-field hrms-form-field--wide">
                            <span>
                                {{
                                    t(
                                        "organization.department.descriptionLabel",
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
                    :loading="departmentStore.saving"
                    :label="t('common.save')"
                    @click="saveDepartment"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="archiveDialogVisible"
            modal
            class="hrms-standard-dialog--small"
            :header="t('organization.department.archiveTitle')"
            :draggable="false"
        >
            <p class="department-archive-text">
                {{
                    t("organization.department.archiveMessage", {
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
                    :loading="departmentStore.archiving"
                    :label="t('common.archive')"
                    @click="confirmArchiveDepartment"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importDialogVisible"
            modal
            class="hrms-standard-dialog--small"
            :header="t('organization.department.importTitle')"
            :draggable="false"
        >
            <div class="department-import-box">
                <p>
                    {{ t("organization.department.importDescription") }}
                </p>

                <input
                    ref="importFileInput"
                    type="file"
                    accept=".xlsx,.xls"
                    class="department-file-input"
                    :disabled="departmentStore.importing"
                    @change="onImportFileChange"
                />

                <div
                    v-if="selectedImportFile"
                    class="department-selected-file"
                >
                    <i class="pi pi-file-excel" />
                    <span>{{ selectedImportFile.name }}</span>
                </div>

                <div
                    v-if="importProgressVisible"
                    class="department-import-progress"
                >
                    <div class="department-import-progress__label">
                        <span>{{ t("organization.department.importExcel") }}</span>
                        <strong>{{ importProgress }}%</strong>
                    </div>

                    <ProgressBar :value="importProgress" />
                </div>
            </div>

            <template #footer>
                <Button
                    severity="secondary"
                    outlined
                    :disabled="departmentStore.importing"
                    :label="t('common.cancel')"
                    @click="closeImportDialog"
                />

                <Button
                    icon="pi pi-upload"
                    :loading="departmentStore.importing"
                    :label="t('organization.department.importExcel')"
                    @click="submitImport"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importResultDialogVisible"
            modal
            class="department-import-result-dialog"
            :header="t('organization.department.importResultTitle')"
            :draggable="false"
        >
            <div v-if="importSummary" class="department-import-result">
                <div class="department-import-summary-grid">
                    <div>
                        <span>{{ t("organization.department.totalRows") }}</span>
                        <strong>{{ importSummary.totalRows }}</strong>
                    </div>

                    <div>
                        <span>{{ t("organization.department.createdRows") }}</span>
                        <strong>{{ importSummary.created }}</strong>
                    </div>

                    <div>
                        <span>{{ t("organization.department.updatedRows") }}</span>
                        <strong>{{ importSummary.updated }}</strong>
                    </div>

                    <div>
                        <span>{{ t("organization.department.skippedRows") }}</span>
                        <strong>{{ importSummary.skipped }}</strong>
                    </div>
                </div>

                <DataTable
                    v-if="importSummary.errors?.length"
                    size="small"
                    :value="importSummary.errors"
                    class="department-import-error-table"
                >
                    <Column
                        field="rowNumber"
                        :header="t('organization.department.rowNumber')"
                        style="width: 7rem"
                    />

                    <Column
                        field="field"
                        :header="t('organization.department.errorField')"
                        style="width: 12rem"
                    />

                    <Column :header="t('organization.department.errorMessage')">
                        <template #body="{ data }">
                            {{ getImportErrorText(data.messageKey) }}
                        </template>
                    </Column>
                </DataTable>

                <p v-else class="department-import-clean">
                    {{ t("organization.department.importClean") }}
                </p>
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
.department-search {
    position: relative;
    flex: 1 1 14rem;
    min-width: 11rem;
    max-width: 22rem;
}

.department-search > i {
    position: absolute;
    top: 50%;
    left: 0.7rem;
    z-index: 1;
    transform: translateY(-50%);
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
    pointer-events: none;
}

.department-search :deep(.p-inputtext) {
    width: 100%;
    padding-left: 2rem;
    border: 1px solid var(--hrms-border);
}

.department-code {
    color: var(--hrms-color-primary);
    font-weight: 400 !important;
}

.department-page :deep(.p-datatable-thead > tr > th) {
    font-weight: 700 !important;
}

.department-page :deep(.p-datatable-tbody > tr > td),
.department-page :deep(.p-datatable-tbody > tr > td *) {
    font-weight: 400 !important;
}

.department-page :deep(.p-tag),
.department-page :deep(.p-button) {
    font-weight: 600 !important;
}

.department-filter-select {
    width: 12rem;
}

.department-status-field .department-filter-select {
    width: 10rem;
}

.department-import-result-dialog {
    width: min(52rem, calc(100vw - 2rem));
}

.department-archive-text {
    margin: 0;
    color: var(--hrms-text);
    font-size: var(--hrms-font-size-md);
    line-height: 1.6;
}

.department-import-box,
.department-import-result {
    display: grid;
    gap: 0.75rem;
}

.department-file-input {
    width: 100%;
    color: var(--hrms-text);
    font-size: var(--hrms-font-size-md);
}

.department-selected-file,
.department-import-progress {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem;
    color: var(--hrms-text);
    background: var(--hrms-surface-muted);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
}

.department-selected-file {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
}

.department-import-progress__label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    color: var(--hrms-text-muted);
    font-size: var(--hrms-font-size-sm);
    font-weight: 800;
}

.department-import-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.65rem;
}

.department-import-summary-grid > div {
    display: grid;
    gap: 0.2rem;
    padding: 0.75rem;
    text-align: center;
    background: var(--hrms-surface-muted);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
}

.department-import-errors {
    min-width: 0;
}

@media (max-width: 1100px) {
    .department-search {
        width: 100%;
    }

    .department-filter-select,
    .department-status-field .department-filter-select {
        width: 100%;
    }
}

@media (max-width: 640px) {
    .department-import-summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .department-import-result-dialog {
        width: calc(100vw - 1rem);
    }
}
</style>
