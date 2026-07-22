<script setup>
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import { computed, onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import EnterpriseActionMenu from "@/shared/components/enterprise/EnterpriseActionMenu.vue"
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterpriseListControls from "@/shared/components/enterprise/EnterpriseListControls.vue"
import EnterpriseListPage from "@/shared/components/enterprise/EnterpriseListPage.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"


import {
    downloadEmployeeTypeTemplate,
    exportEmployeeTypes,
    lookupPositions,
    lookupEmployeeTypePositionAssignments,
    lookupEmployeeTypeDashboardCategories,
} from "../api/employeeType.api.js"
import EmployeeTypeArchiveDialog from "../components/EmployeeTypeArchiveDialog.vue"
import EmployeeTypeFormDialog from "../components/EmployeeTypeFormDialog.vue"
import EmployeeTypeImportDialog from "../components/EmployeeTypeImportDialog.vue"
import EmployeeTypeReconciliationDialog from "../components/EmployeeTypeReconciliationDialog.vue"
import { useEmployeeTypeForm } from "../composables/useEmployeeTypeForm.js"
import { useEmployeeTypeImport } from "../composables/useEmployeeTypeImport.js"
import { useEmployeeTypeList } from "../composables/useEmployeeTypeList.js"
import { createEmployeeTypeColumns } from "../config/employeeType.columns.js"
import {
    createDashboardCategoryOptions,
    createEmployeeTypeStatusOptions,
} from "../config/employeeType.filters.js"
import { EMPLOYEE_TYPE_PERMISSIONS } from "../config/employeeType.permissions.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()

const list = useEmployeeTypeList()
const formState = useEmployeeTypeForm()
const importState = useEmployeeTypeImport()

// Expose refs/reactive objects as top-level template bindings. This prevents
// PrimeVue and reusable enterprise components from receiving Ref objects.
const {
    rows,
    loading,
    archiving,
    error,
    query,
    pagination,
} = list

const {
    form,
    errors: formErrors,
    mode: formMode,
    saving: formSaving,
    savingMessage: formSavingMessage,
    reconciliationDialogVisible,
    reconciliationSummary,
} = formState

const {
    importing,
    progress: importProgress,
    phaseMessageKey: importPhaseMessageKey,
    processedRows: importProcessedRows,
    totalRows: importTotalRows,
    result: importResult,
    error: importError,
} = importState

const positions = ref([])
const positionsLoading = ref(false)
const positionAssignments = ref([])
const dashboardCategories = ref([])
const formVisible = ref(false)
const archiveVisible = ref(false)
const archiveCandidate = ref(null)
const importVisible = ref(false)
const exporting = ref(false)
const downloadingTemplate = ref(false)

const columns = computed(() => createEmployeeTypeColumns(t))
const statusOptions = computed(() => createEmployeeTypeStatusOptions(t))
const categoryOptions = computed(() => createDashboardCategoryOptions(t, dashboardCategories.value, true))

const activeFilterCount = computed(() => {
    return [
        query.search?.trim(),
        query.dashboardCategory !== "ALL",
        query.status !== "ALL",
    ].filter(Boolean).length
})

const workspaceCompanyName = computed(() =>
    workspaceStore.selectedCompany?.displayName ||
    workspaceStore.selectedCompany?.legalName ||
    workspaceStore.selectedCompany?.code ||
    "—",
)

const workspaceBranchName = computed(() =>
    workspaceStore.selectedBranch?.name ||
    workspaceStore.selectedBranch?.code ||
    "—",
)

const canUpdate = computed(() => {
    return authStore.hasPermission(EMPLOYEE_TYPE_PERMISSIONS.UPDATE)
})

const canArchive = computed(() => {
    return authStore.hasPermission(EMPLOYEE_TYPE_PERMISSIONS.ARCHIVE)
})

const importErrorMessage = computed(() => {
    if (!importError.value) {
        return ""
    }

    const messageKey =
        importError.value?.messageKey ||
        importError.value?.response?.data?.error?.messageKey

    if (messageKey) {
        const translated = t(messageKey)
        if (translated !== messageKey) {
            return translated
        }
    }

    return importError.value?.message || t("errors.internal")
})

function translatedError(caught) {
    const key = caught?.response?.data?.error?.messageKey

    if (!key) {
        return t("errors.internal")
    }

    const value = t(key)
    return value === key ? t("errors.internal") : value
}

async function loadLookups() {
    const categoryRows = await lookupEmployeeTypeDashboardCategories()

    dashboardCategories.value = Array.isArray(categoryRows)
        ? categoryRows
        : []
}

async function loadPositions({
    companyId = form.companyId,
    branchId = form.branchId,
    search = "",
} = {}) {
    positions.value = []

    if (!companyId || !branchId) {
        return
    }

    positionsLoading.value = true

    try {
        const [positionRows, assignmentRows] = await Promise.all([
            lookupPositions({
                companyId,
                branchId,
                search: String(search || "").trim(),
                sortBy: "title",
                sortOrder: "asc",
            }),
            lookupEmployeeTypePositionAssignments({
                companyId,
                branchId,
                page: 1,
                limit: 10,
                status: "ALL",
            }),
        ])

        positionAssignments.value = assignmentRows
        const assignmentByPositionId = new Map(
            assignmentRows.map((assignment) => [
                String(assignment.positionId),
                assignment,
            ]),
        )
        const currentEmployeeTypeId = String(formState.employeeTypeId?.value || "")

        positions.value = Array.isArray(positionRows)
            ? positionRows.map((position) => {
                const assignment = assignmentByPositionId.get(String(position.id))
                const assignedElsewhere = Boolean(
                    assignment &&
                    String(assignment.employeeTypeId) !== currentEmployeeTypeId,
                )

                return {
                    ...position,
                    assignment,
                    assignedElsewhere,
                    displayTitle: assignedElsewhere
                        ? `${position.title} — ${assignment.employeeTypeName}`
                        : position.title,
                }
            })
            : []
    } catch (caught) {
        positions.value = []

        toast.add({
            severity: "error",
            summary: t(
                "organization.employeeType.positionLoadFailed",
            ),
            detail: translatedError(caught),
            life: 4500,
        })
    } finally {
        positionsLoading.value = false
    }
}

async function load() {
    if (!workspaceStore.ready) {
        return
    }

    try {
        await Promise.all([
            list.load(),
            loadLookups(),
        ])
    } catch (caught) {
        toast.add({
            severity: "error",
            summary: t("organization.employeeType.loadFailed"),
            detail: translatedError(caught),
            life: 4500,
        })
    }
}

async function openCreate() {
    positions.value = []
    formState.openCreate({
        companyId: workspaceStore.companyId,
        branchId: workspaceStore.branchId,
    })
    await loadPositions()
    formVisible.value = true
}

async function openEdit(row) {
    formState.openEdit(row)

    await loadPositions({
        companyId: form.companyId,
        branchId: form.branchId,
    })

    formVisible.value = true
}

async function saveEmployeeType() {
    try {
        const editing = formState.isEdit.value

        const result = await formState.save()

        if (result === null) {
            return
        }

        formVisible.value = false

        toast.add({
            severity: "success",
            summary: editing
                ? t("organization.employeeType.updated")
                : t("organization.employeeType.created"),
            detail: editing
                ? t("organization.employeeType.updatedDetail")
                : t("organization.employeeType.createdDetail"),
            life: 3000,
        })

        if (editing && result?.reconciliation?.totalAffected > 0) {
            toast.add({
                severity: result.reconciliation.reviewRequired > 0 ? "warn" : "info",
                summary: "Employee assignments updated",
                detail: `${result.reconciliation.reassigned} employee(s) reassigned; ${result.reconciliation.reviewRequired} marked for HR review.`,
                life: 6000,
            })
        }

        await list.load()
    } catch (caught) {
        toast.add({
            severity: "error",
            summary: t("organization.employeeType.saveFailed"),
            detail: translatedError(caught),
            life: 5000,
        })
    }
}

function askArchive(row) {
    archiveCandidate.value = row
    archiveVisible.value = true
}

async function confirmArchive() {
    const id = archiveCandidate.value?.id

    if (!id) {
        return
    }

    try {
        await list.archive(id)

        archiveVisible.value = false
        archiveCandidate.value = null

        toast.add({
            severity: "success",
            summary: t("organization.employeeType.archived"),
            detail: t("organization.employeeType.archivedDetail"),
            life: 3000,
        })
    } catch (caught) {
        toast.add({
            severity: "error",
            summary: t("organization.employeeType.archiveFailed"),
            detail: translatedError(caught),
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
            label: t("organization.employeeType.archiveTitle"),
            icon: "pi pi-archive",
            visible: canArchive.value && row.status !== "ARCHIVED",
            command: () => askArchive(row),
        },
    ]
}

function statusSeverity(status) {
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

function statusLabel(status) {
    const labels = {
        ACTIVE: "organization.employeeType.statusActive",
        INACTIVE: "organization.employeeType.statusInactive",
        ARCHIVED: "organization.employeeType.statusArchived",
    }

    return labels[status] ? t(labels[status]) : status || "—"
}

function categoryLabel(value) {
    const found = dashboardCategories.value.find((item) => item.value === value)
    return found?.label || String(value || "—").toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
}

function formatDate(value) {
    if (!value) {
        return "—"
    }

    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
    }).format(new Date(value))
}

async function downloadTemplate() {
    downloadingTemplate.value = true

    try {
        await downloadEmployeeTypeTemplate()
    } catch (caught) {
        toast.add({
            severity: "error",
            summary: t("organization.employeeType.downloadFailed"),
            detail: translatedError(caught),
            life: 4500,
        })
    } finally {
        downloadingTemplate.value = false
    }
}

async function exportRows() {
    exporting.value = true

    try {
        await exportEmployeeTypes({
            search: query.search || undefined,
            dashboardCategory: query.dashboardCategory,
            status: query.status,
        })
    } catch (caught) {
        toast.add({
            severity: "error",
            summary: t("organization.employeeType.exportFailed"),
            detail: translatedError(caught),
            life: 4500,
        })
    } finally {
        exporting.value = false
    }
}

async function startImport() {
    try {
        await importState.submit()
        await list.load({ page: 1 })

        toast.add({
            severity: "success",
            summary: t("organization.employeeType.importCompleted"),
            detail: t("organization.employeeType.importCompletedDetail"),
            life: 3500,
        })
    } catch (caught) {
        if (caught?.name === "AbortError") {
            return
        }

        toast.add({
            severity: "error",
            summary: t("organization.employeeType.importFailed"),
            detail: importErrorMessage.value || translatedError(caught),
            life: 5000,
        })
    }
}

function closeImportDialog() {
    importState.reset()
}

onMounted(load)
</script>

<template>
    <EnterpriseListPage
        :rows="rows"
        :columns="columns"
        :loading="loading"
        :error="error"
        :pagination="pagination"
        row-key="id"
        :empty-title="t('organization.employeeType.emptyTitle')"
        :empty-description="t('organization.employeeType.emptyDescription')"
        :actions-header="t('common.actions')"
        @page-change="list.changePage"
        @retry="load"
    >
        <template #controls>
            <EnterpriseListControls
                :filter-label="t('common.filters')"
                :hide-filter-label="t('common.hideFilters')"
                :active-filter-count="activeFilterCount"
            >
                <template #start>
                    <Button
                        icon="pi pi-refresh"
                        :label="t('common.refresh')"
                        text
                        size="small"
                        :loading="loading"
                        @click="load"
                    />
                </template>

                <template #actions>
                    <PermissionButton
                        :permission="EMPLOYEE_TYPE_PERMISSIONS.IMPORT"
                        icon="pi pi-file-import"
                        :label="t('common.import')"
                        severity="secondary"
                        outlined
                        size="small"
                        :disabled="!workspaceStore.ready"
                        @click="importVisible = true"
                    />

                    <PermissionButton
                        :permission="EMPLOYEE_TYPE_PERMISSIONS.VIEW"
                        icon="pi pi-download"
                        :label="t('organization.employeeType.downloadTemplate')"
                        severity="secondary"
                        outlined
                        size="small"
                        :loading="downloadingTemplate"
                        @click="downloadTemplate"
                    />

                    <PermissionButton
                        :permission="EMPLOYEE_TYPE_PERMISSIONS.EXPORT"
                        icon="pi pi-file-export"
                        :label="t('common.export')"
                        severity="secondary"
                        outlined
                        size="small"
                        :loading="exporting"
                        :disabled="!workspaceStore.ready"
                        @click="exportRows"
                    />

                    <PermissionButton
                        :permission="EMPLOYEE_TYPE_PERMISSIONS.CREATE"
                        icon="pi pi-plus"
                        :label="t('organization.employeeType.newEmployeeType')"
                        size="small"
                        :disabled="!workspaceStore.ready"
                        @click="openCreate"
                    />
                </template>

                <template #filters>
                    <EnterpriseFilterBar
                        :loading="loading"
                        @apply="list.applyFilters"
                        @clear="list.clearFilters"
                    >
                        <EnterpriseFilterField :label="t('common.search')">
                            <span class="p-input-icon-left">
                                <i class="pi pi-search" />
                                <InputText
                                    v-model="query.search"
                                    :placeholder="t('organization.employeeType.searchPlaceholder')"
                                    @keyup.enter="list.applyFilters"
                                />
                            </span>
                        </EnterpriseFilterField>

                        <EnterpriseFilterField
                            :label="t('organization.employeeType.dashboardCategory')"
                        >
                            <Select
                                v-model="query.dashboardCategory"
                                :options="categoryOptions"
                                option-label="label"
                                option-value="value"
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
                    </EnterpriseFilterBar>
                </template>
            </EnterpriseListControls>
        </template>

        <template #empty-action>
            <PermissionButton
                :permission="EMPLOYEE_TYPE_PERMISSIONS.CREATE"
                icon="pi pi-plus"
                :label="t('organization.employeeType.newEmployeeType')"
                :disabled="!workspaceStore.ready"
                @click="openCreate"
            />
        </template>

        <template #cell-code="{ row }">
            <strong>{{ row.code }}</strong>
        </template>

        <template #cell-name="{ row }">
            {{ row.name }}
        </template>

        <template #cell-company="{ row }">
            {{ row.company?.displayName || "—" }}
        </template>

        <template #cell-branch="{ row }">
            {{ row.branch?.name || "—" }}
        </template>

        <template #cell-dashboardCategory="{ row }">
            <Tag
                :value="categoryLabel(row.dashboardCategory)"
                severity="info"
            />
        </template>

        <template #cell-structure="{ row }">
            {{
                row.children?.length
                    ? t("organization.employeeType.childStructure")
                    : t("organization.employeeType.directStructure")
            }}
        </template>

        <template #cell-positionCount="{ row }">
            {{
                row.positionCount === "ALL"
                    ? t("organization.employeeType.allPositions")
                    : row.positionCount
            }}
        </template>

        <template #cell-status="{ row }">
            <Tag
                :value="statusLabel(row.status)"
                :severity="statusSeverity(row.status)"
            />
        </template>

        <template #cell-updatedAt="{ row }">
            {{ formatDate(row.updatedAt) }}
        </template>

        <template #actions="{ row }">
            <EnterpriseActionMenu :items="rowActions(row)" />
        </template>
    </EnterpriseListPage>

    <EmployeeTypeFormDialog
        :visible="formVisible"
        :mode="formMode"
        :form="form"
        :errors="formErrors"
        :company-name="workspaceCompanyName"
        :branch-name="workspaceBranchName"
        :positions="positions"
        :positions-loading="positionsLoading"
        :saving="formSaving"
        :saving-message="formSavingMessage"
        @update:visible="formVisible = $event"
        @save="saveEmployeeType"
        @clear-error="formState.clearError"
        @add-child="formState.addChild"
        @remove-child="formState.removeChild"
    />

    <EmployeeTypeArchiveDialog
        :visible="archiveVisible"
        :employee-type="archiveCandidate"
        :busy="archiving"
        @update:visible="archiveVisible = $event"
        @confirm="confirmArchive"
        @cancel="archiveVisible = false"
    />

    <EmployeeTypeReconciliationDialog
        :visible="reconciliationDialogVisible"
        :summary="reconciliationSummary"
        @confirm="formState.confirmReconciliation"
        @cancel="formState.cancelReconciliation"
    />

    <EmployeeTypeImportDialog
        :visible="importVisible"
        :importing="importing"
        :progress="importProgress"
        :phase-message-key="importPhaseMessageKey"
        :processed-rows="importProcessedRows"
        :total-rows="importTotalRows"
        :result="importResult"
        :error-message="importErrorMessage"
        @update:visible="importVisible = $event"
        @file-change="importState.setFile"
        @download-template="downloadTemplate"
        @import="startImport"
        @close="closeImportDialog"
    />
</template>
