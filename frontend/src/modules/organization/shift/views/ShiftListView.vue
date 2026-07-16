<script setup>
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import {
    computed,
    onMounted,
    ref,
} from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useUiStore } from "@/app/stores/ui.store.js"
import EnterpriseActionMenu from "@/shared/components/enterprise/EnterpriseActionMenu.vue"
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterpriseListControls from "@/shared/components/enterprise/EnterpriseListControls.vue"
import EnterpriseListPage from "@/shared/components/enterprise/EnterpriseListPage.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"

import {
    downloadShiftTemplate,
    exportShifts,
    lookupBranches,
    lookupCompanies,
} from "../api/shift.api.js"
import ShiftArchiveDialog from "../components/ShiftArchiveDialog.vue"
import ShiftFormDialog from "../components/ShiftFormDialog.vue"
import ShiftImportDialog from "../components/ShiftImportDialog.vue"
import { useShiftForm } from "../composables/useShiftForm.js"
import { useShiftImport } from "../composables/useShiftImport.js"
import { useShiftList } from "../composables/useShiftList.js"
import { createShiftColumns } from "../config/shift.columns.js"
import { SHIFT_PERMISSIONS } from "../config/shift.permissions.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const uiStore = useUiStore()

const list = useShiftList()
const formState = useShiftForm()
const importState = useShiftImport()

// Expose composable refs as top-level bindings so Vue templates unwrap them.
// Passing nested refs such as list.rows directly forwards Ref objects to child
// components, which causes PrimeVue DataTable to call Array methods on a Ref.
const {
    rows,
    loading,
    archiving,
    error: listError,
} = list
const query = list.query
const pagination = list.pagination
const hasActiveFilters = list.hasActiveFilters

const {
    visible: formVisible,
    mode: formMode,
    saving: formSaving,
    errors: formErrors,
} = formState
const shiftForm = formState.form

const {
    importing,
    progress: importProgress,
    phaseMessageKey: importPhaseMessageKey,
    processedRows: importProcessedRows,
    totalRows: importTotalRows,
    result: importResult,
    error: importError,
} = importState

const companies = ref([])
const branches = ref([])
const archiveVisible = ref(false)
const archiveCandidate = ref(null)
const importVisible = ref(false)
const exporting = ref(false)
const downloadingTemplate = ref(false)

const columns = computed(() => createShiftColumns(t))
const statusOptions = computed(() => [
    { label: t("organization.shift.allStatuses"), value: "ALL" },
    { label: t("common.active"), value: "ACTIVE" },
    { label: t("common.inactive"), value: "INACTIVE" },
    { label: t("common.archived"), value: "ARCHIVED" },
])

const activeFilterCount = computed(() => {
    let count = 0

    if (list.query.search?.trim()) count += 1
    if (list.query.companyId) count += 1
    if (list.query.branchId) count += 1
    if (list.query.status !== "ALL") count += 1

    return count
})

const companyOptions = computed(() => [
    {
        id: "",
        displayName: t("organization.shift.allCompanies"),
    },
    ...companies.value,
])

const branchOptions = computed(() => [
    {
        id: "",
        name: t("organization.shift.allBranches"),
    },
    ...branches.value.filter(
        (branch) =>
            !list.query.companyId ||
            branch.companyId === list.query.companyId ||
            branch.company?.id === list.query.companyId,
    ),
])

const formBranchOptions = computed(() =>
    branches.value.filter(
        (branch) =>
            !formState.form.companyId ||
            branch.companyId === formState.form.companyId ||
            branch.company?.id === formState.form.companyId,
    ),
)

const canUpdate = computed(() =>
    authStore.hasPermission(SHIFT_PERMISSIONS.UPDATE),
)

const canArchive = computed(() =>
    authStore.hasPermission(SHIFT_PERMISSIONS.ARCHIVE),
)

function translatedError(error) {
    const key =
        error?.response?.data?.error?.messageKey ??
        error?.messageKey

    if (!key) return t("errors.internal")

    const translated = t(key)
    return translated === key ? t("errors.internal") : translated
}

async function loadLookups() {
    const [companyRows, branchRows] = await Promise.all([
        lookupCompanies(),
        lookupBranches(),
    ])

    companies.value = companyRows
    branches.value = branchRows
}

async function load() {
    try {
        await Promise.all([
            list.load(),
            loadLookups(),
        ])
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.shift.loadFailed"),
            detail: translatedError(error),
            life: 4500,
        })
    }
}

function openCreate() {
    formState.openCreate()
}

function openEdit(row) {
    formState.openEdit(row)
}

function onFormCompanyChange() {
    formState.form.branchId = ""
}

async function saveShift() {
    try {
        const editing = formState.isEdit.value

        await formState.submit()
        formState.visible.value = false

        toast.add({
            severity: "success",
            summary: editing
                ? t("organization.shift.updated")
                : t("organization.shift.created"),
            detail: editing
                ? t("organization.shift.updatedDetail")
                : t("organization.shift.createdDetail"),
            life: 3000,
        })

        await list.load()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.shift.saveFailed"),
            detail: translatedError(error),
            life: 5000,
        })
    }
}

function askArchive(row) {
    archiveCandidate.value = row
    archiveVisible.value = true
}

async function confirmArchive() {
    const id = archiveCandidate.value?.id ?? archiveCandidate.value?._id
    if (!id) return

    try {
        await list.archive(id)
        archiveVisible.value = false
        archiveCandidate.value = null

        toast.add({
            severity: "success",
            summary: t("organization.shift.archived"),
            detail: t("organization.shift.archivedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.shift.archiveFailed"),
            detail: translatedError(error),
            life: 5000,
        })
    }
}

function rowActions(row) {
    return [
        {
            label: t("common.edit"),
            icon: "pi pi-pencil",
            visible: canUpdate.value && row.status !== "ARCHIVED",
            command: () => openEdit(row),
        },
        {
            label: t("organization.shift.archiveTitle"),
            icon: "pi pi-archive",
            visible: canArchive.value && row.status !== "ARCHIVED",
            command: () => askArchive(row),
        },
    ]
}

function statusSeverity(status) {
    if (status === "ACTIVE") return "success"
    if (status === "INACTIVE") return "warn"
    if (status === "ARCHIVED") return "danger"
    return "secondary"
}

function statusLabel(status) {
    if (status === "ACTIVE") return t("common.active")
    if (status === "INACTIVE") return t("common.inactive")
    if (status === "ARCHIVED") return t("common.archived")
    return status || "—"
}

function formatDateTime(value) {
    if (!value) return "—"

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"

    return new Intl.DateTimeFormat(uiStore.locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date)
}

function minutesToHours(value) {
    const minutes = Number(value ?? 0)
    const hours = Math.floor(minutes / 60)
    const remainder = minutes % 60

    if (!remainder) return `${hours}h`
    return `${hours}h ${remainder}m`
}

function breakLabel(row) {
    if (!row.breakStartTime || !row.breakEndTime) return "—"
    return `${row.breakStartTime} – ${row.breakEndTime}`
}

function graceLabel(row) {
    return `${Number(row.graceInMinutes ?? 0)} / ${Number(row.graceOutMinutes ?? 0)} min`
}

async function downloadTemplate() {
    downloadingTemplate.value = true

    try {
        await downloadShiftTemplate()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.shift.templateDownloadFailed"),
            detail: translatedError(error),
            life: 5000,
        })
    } finally {
        downloadingTemplate.value = false
    }
}

async function exportRows() {
    exporting.value = true

    try {
        await exportShifts({
            search: list.query.search || undefined,
            companyId: list.query.companyId || undefined,
            branchId: list.query.branchId || undefined,
            status: list.query.status,
            sortBy: list.query.sortBy,
            sortOrder: list.query.sortOrder,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.shift.exportFailed"),
            detail: translatedError(error),
            life: 5000,
        })
    } finally {
        exporting.value = false
    }
}

async function submitImport() {
    try {
        const response = await importState.submit()
        const summary = response?.summary
        const errorCount = summary?.errors?.length ?? 0
        const storedCount =
            Number(summary?.created ?? 0) +
            Number(summary?.updated ?? 0)

        if (!response?.success || errorCount > 0) {
            toast.add({
                severity: "warn",
                summary: t("organization.shift.importCompletedWithErrors"),
                detail: t("organization.shift.importCompletedWithErrorsDetail", {
                    created: summary?.created ?? 0,
                    updated: summary?.updated ?? 0,
                    skipped: summary?.skipped ?? 0,
                    failed: errorCount,
                }),
                life: 7000,
            })
            return
        }

        if (storedCount === 0) {
            toast.add({
                severity: "warn",
                summary: t("organization.shift.importNoChanges"),
                detail: t("organization.shift.importNoChangesDetail"),
                life: 5000,
            })
            return
        }

        toast.add({
            severity: "success",
            summary: t("organization.shift.importSuccess"),
            detail: t("organization.shift.importSuccessDetail", {
                created: summary?.created ?? 0,
                updated: summary?.updated ?? 0,
            }),
            life: 4500,
        })

        importVisible.value = false
        importState.reset()
        await list.load({ page: 1 })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.shift.importFailed"),
            detail: translatedError(error),
            life: 5000,
        })
    }
}

function onFilterCompanyChange() {
    list.query.branchId = ""
}

onMounted(load)
</script>

<template>
    <EnterpriseListPage
        :rows="rows"
        :columns="columns"
        :loading="loading"
        :error="listError"
        :pagination="pagination"
        :actions-header="t('common.actions')"
        row-key="id"
        :empty-title="t('organization.shift.empty')"
        :empty-description="t('organization.shift.emptyDescription')"
        @retry="list.load"
        @page-change="list.changePage"
        @sort-change="list.changeSort"
    >
        <template #controls>
            <EnterpriseListControls
                :filter-label="t('common.filters')"
                :hide-filter-label="t('common.hideFilters')"
                :active-filter-count="activeFilterCount"
            >
                <template #start>
                    <Button
                        severity="secondary"
                        text
                        icon="pi pi-refresh"
                        :label="t('common.refresh')"
                        :loading="loading"
                        @click="list.load"
                    />

                    <PermissionButton
                        :permission="SHIFT_PERMISSIONS.EXPORT"
                        severity="secondary"
                        text
                        icon="pi pi-download"
                        :label="t('organization.shift.downloadTemplate')"
                        :loading="downloadingTemplate"
                        @click="downloadTemplate"
                    />

                    <PermissionButton
                        :permission="SHIFT_PERMISSIONS.IMPORT"
                        severity="secondary"
                        text
                        icon="pi pi-upload"
                        :label="t('organization.shift.import')"
                        @click="importVisible = true"
                    />

                    <PermissionButton
                        :permission="SHIFT_PERMISSIONS.EXPORT"
                        severity="secondary"
                        text
                        icon="pi pi-file-export"
                        :label="t('organization.shift.export')"
                        :loading="exporting"
                        @click="exportRows"
                    />
                </template>

                <template #actions>
                    <PermissionButton
                        :permission="SHIFT_PERMISSIONS.CREATE"
                        icon="pi pi-plus"
                        :label="t('organization.shift.newShift')"
                        @click="openCreate"
                    />
                </template>

                <template #filters>
                    <EnterpriseFilterBar :loading="loading">
                        <EnterpriseFilterField
                            class="shift-filter-search"
                            :label="t('common.search')"
                            search
                        >
                            <span class="enterprise-search-input">
                                <i class="pi pi-search" />
                                <InputText
                                    v-model="query.search"
                                    :placeholder="t('organization.shift.searchPlaceholder')"
                                    @keyup.enter="list.applyFilters"
                                />
                            </span>
                        </EnterpriseFilterField>

                        <EnterpriseFilterField :label="t('organization.shift.company')">
                            <Select
                                v-model="query.companyId"
                                :options="companyOptions"
                                option-label="displayName"
                                option-value="id"
                                filter
                                @change="onFilterCompanyChange"
                            />
                        </EnterpriseFilterField>

                        <EnterpriseFilterField :label="t('organization.shift.branch')">
                            <Select
                                v-model="query.branchId"
                                :options="branchOptions"
                                option-label="name"
                                option-value="id"
                                filter
                                :disabled="!query.companyId"
                            />
                        </EnterpriseFilterField>

                        <EnterpriseFilterField :label="t('common.status')">
                            <Select
                                v-model="query.status"
                                :options="statusOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </EnterpriseFilterField>

                        <template #actions>
                            <Button
                                severity="secondary"
                                outlined
                                icon="pi pi-times"
                                :label="t('common.clear')"
                                :disabled="loading || !hasActiveFilters"
                                @click="list.clearFilters"
                            />

                            <Button
                                icon="pi pi-check"
                                :label="t('common.apply')"
                                :loading="loading"
                                @click="list.applyFilters"
                            />
                        </template>
                    </EnterpriseFilterBar>
                </template>
            </EnterpriseListControls>
        </template>

        <template #empty-action>
            <PermissionButton
                :permission="SHIFT_PERMISSIONS.CREATE"
                icon="pi pi-plus"
                :label="t('organization.shift.newShift')"
                @click="openCreate"
            />
        </template>

        <template #cell-code="{ row }">
            <span class="enterprise-table__text enterprise-table__code" :title="row.code || '—'">
                {{ row.code || "—" }}
            </span>
        </template>

        <template #cell-name="{ row }">
            <span class="enterprise-table__text" :title="row.name || '—'">
                {{ row.name || "—" }}
            </span>
        </template>

        <template #cell-company="{ row }">
            <span class="enterprise-table__text" :title="row.company?.displayName || '—'">
                {{ row.company?.displayName || "—" }}
            </span>
        </template>

        <template #cell-branch="{ row }">
            <span class="enterprise-table__text" :title="row.branch?.name || '—'">
                {{ row.branch?.name || "—" }}
            </span>
        </template>

        <template #cell-startTime="{ row }">
            <span class="enterprise-table__text">{{ row.startTime || "—" }}</span>
        </template>

        <template #cell-endTime="{ row }">
            <span class="enterprise-table__text">{{ row.endTime || "—" }}</span>
        </template>

        <template #cell-break="{ row }">
            <span class="enterprise-table__text" :title="breakLabel(row)">
                {{ breakLabel(row) }}
            </span>
        </template>

        <template #cell-workingMinutes="{ row }">
            <span class="enterprise-table__text">
                {{ minutesToHours(row.workingMinutes) }}
            </span>
        </template>

        <template #cell-grace="{ row }">
            <span class="enterprise-table__text" :title="graceLabel(row)">
                {{ graceLabel(row) }}
            </span>
        </template>

        <template #cell-status="{ row }">
            <Tag :value="statusLabel(row.status)" :severity="statusSeverity(row.status)" />
        </template>

        <template #cell-updatedAt="{ row }">
            <span class="enterprise-table__text" :title="formatDateTime(row.updatedAt)">
                {{ formatDateTime(row.updatedAt) }}
            </span>
        </template>

        <template #actions="{ row }">
            <EnterpriseActionMenu
                :items="rowActions(row)"
                :aria-label="t('common.actions')"
            />
        </template>
    </EnterpriseListPage>

    <ShiftFormDialog
        v-model:visible="formVisible"
        :mode="formMode"
        :form="shiftForm"
        :errors="formErrors"
        :companies="companies"
        :branches="formBranchOptions"
        :saving="formSaving"
        @submit="saveShift"
        @close="formState.close"
        @clear-error="formState.clearErrors"
        @company-change="onFormCompanyChange"
    />

    <ShiftImportDialog
        v-model:visible="importVisible"
        :importing="importing"
        :progress="importProgress"
        :phase-message-key="importPhaseMessageKey"
        :processed-rows="importProcessedRows"
        :total-rows="importTotalRows"
        :result="importResult"
        :error-message="importError ? translatedError(importError) : ''"
        @file-change="importState.setFile"
        @download-template="downloadTemplate"
        @import="submitImport"
        @close="importState.reset"
    />

    <ShiftArchiveDialog
        v-model:visible="archiveVisible"
        :shift="archiveCandidate"
        :busy="archiving"
        @confirm="confirmArchive"
        @cancel="archiveCandidate = null"
    />
</template>

<style scoped>
.shift-filter-search {
    min-width: min(18rem, 100%);
    flex: 1 1 18rem;
}

.enterprise-search-input {
    position: relative;
    display: block;
}

.enterprise-search-input > i {
    position: absolute;
    z-index: 1;
    top: 50%;
    left: 0.7rem;
    transform: translateY(-50%);
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.75rem;
}

.enterprise-search-input :deep(.p-inputtext) {
    width: 100%;
    padding-left: 2rem;
}
</style>
