<script setup>
import Button from "primevue/button"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import { computed, onMounted, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useUiStore } from "@/app/stores/ui.store.js"
import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import EnterpriseActionMenu from "@/shared/components/enterprise/EnterpriseActionMenu.vue"
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterpriseListControls from "@/shared/components/enterprise/EnterpriseListControls.vue"
import EnterpriseListPage from "@/shared/components/enterprise/EnterpriseListPage.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"

import {
    downloadManpowerPlanTemplate,
    exportManpowerPlans,
} from "../api/manpowerPlan.api.js"
import ManpowerPlanArchiveDialog from "../components/ManpowerPlanArchiveDialog.vue"
import ManpowerPlanBatchDialog from "../components/ManpowerPlanBatchDialog.vue"
import ManpowerPlanFormDialog from "../components/ManpowerPlanFormDialog.vue"
import ManpowerPlanImportDialog from "../components/ManpowerPlanImportDialog.vue"
import { useManpowerPlanForm } from "../composables/useManpowerPlanForm.js"
import { useManpowerPlanImport } from "../composables/useManpowerPlanImport.js"
import { useManpowerPlanList } from "../composables/useManpowerPlanList.js"
import { useManpowerPlanLookups } from "../composables/useManpowerPlanLookups.js"
import { createManpowerPlanColumns } from "../config/manpowerPlan.columns.js"
import {
    createManpowerPlanStatusOptions,
    createMonthOptions,
} from "../config/manpowerPlan.filters.js"
import { MANPOWER_PLAN_PERMISSIONS } from "../config/manpowerPlan.permissions.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const uiStore = useUiStore()
const workspaceStore = useWorkspaceStore()

const list = useManpowerPlanList()
const formState = useManpowerPlanForm()
const importState = useManpowerPlanImport()
const lookups = useManpowerPlanLookups()

const batchVisible = ref(false)
const formVisible = ref(false)
const archiveVisible = ref(false)
const importVisible = ref(false)
const archiveCandidate = ref(null)
const exporting = ref(false)
const downloadingTemplate = ref(false)

const columns = computed(() => createManpowerPlanColumns(t))
const statusOptions = computed(() =>
    createManpowerPlanStatusOptions(t),
)
const monthOptions = computed(() =>
    createMonthOptions(t, uiStore.locale, true),
)
const departmentOptions = computed(() => [
    { id: "", name: t("manpowerPlan.allDepartments") },
    ...lookups.departments.value,
])
const positionOptions = computed(() => [
    { id: "", title: t("manpowerPlan.allPositions") },
    ...lookups.filterPositions.value,
])
const lineOptions = computed(() => [
    { id: "", name: t("manpowerPlan.allLines") },
    ...lookups.filterLines.value,
])
const shiftOptions = computed(() => [
    { id: "", name: t("manpowerPlan.allShifts") },
    ...lookups.shifts.value,
])
const employeeTypeOptions = computed(() => [
    { id: "", name: t("manpowerPlan.allEmployeeTypes") },
    ...lookups.employeeTypes.value,
])
const childOptions = computed(() => {
    const type = lookups.employeeTypes.value.find(
        (item) => item.id === list.query.employeeTypeId,
    )

    return [
        { id: "", name: t("manpowerPlan.allChildGroups") },
        ...(type?.children || []),
    ]
})
const activeFilterCount = computed(() => {
    let count = 0
    if (list.query.search?.trim()) count += 1
    if (list.query.month) count += 1
    if (list.query.employeeTypeId) count += 1
    if (list.query.employeeTypeChildId) count += 1
    if (list.query.departmentId) count += 1
    if (list.query.positionId) count += 1
    if (list.query.lineId) count += 1
    if (list.query.shiftId) count += 1
    if (list.query.status !== "ALL") count += 1
    return count
})
const companyName = computed(() =>
    workspaceStore.selectedCompany?.displayName ||
    workspaceStore.selectedCompany?.legalName ||
    workspaceStore.selectedCompany?.code ||
    "—",
)
const branchName = computed(() =>
    workspaceStore.selectedBranch?.name ||
    workspaceStore.selectedBranch?.code ||
    "—",
)
const canUpdate = computed(() =>
    authStore.hasPermission(MANPOWER_PLAN_PERMISSIONS.UPDATE),
)
const canArchive = computed(() =>
    authStore.hasPermission(MANPOWER_PLAN_PERMISSIONS.ARCHIVE),
)

function errorText(error) {
    const key =
        error?.response?.data?.error?.messageKey ||
        error?.messageKey
    if (!key) return t("errors.internal")
    const translated = t(key)
    return translated === key ? t("errors.internal") : translated
}

async function load() {
    if (!workspaceStore.ready) return

    try {
        await Promise.all([
            list.load(),
            lookups.loadBase(),
        ])
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("manpowerPlan.loadFailed"),
            detail: errorText(error),
            life: 4500,
        })
    }
}

async function openEdit(row) {
    formState.openEdit(row, {
        companyId: workspaceStore.companyId,
        branchId: workspaceStore.branchId,
    })
    await lookups.loadFormChildren(formState.form.departmentId)
    formVisible.value = true
}

async function onFormDepartmentChange() {
    formState.form.positionId = ""
    formState.form.lineId = ""
    await lookups.loadFormChildren(formState.form.departmentId)
}

function onFormEmployeeTypeChange() {
    formState.form.employeeTypeChildId = ""
}

async function savePlan() {
    try {
        await formState.save()
        formVisible.value = false
        toast.add({
            severity: "success",
            summary: t("manpowerPlan.updated"),
            life: 3000,
        })
        await list.load()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("manpowerPlan.saveFailed"),
            detail: errorText(error),
            life: 5000,
        })
    }
}

function askArchive(row) {
    archiveCandidate.value = row
    archiveVisible.value = true
}

async function confirmArchive() {
    if (!archiveCandidate.value?.id) return

    try {
        await list.archive(archiveCandidate.value.id)
        archiveVisible.value = false
        archiveCandidate.value = null
        toast.add({
            severity: "success",
            summary: t("manpowerPlan.archivedMessage"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("manpowerPlan.archiveFailed"),
            detail: errorText(error),
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
            label: t("common.archive"),
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
    return statusOptions.value.find(
        (item) => item.value === status,
    )?.label || status
}

function employeeTypeLabel(row) {
    if (!row.employeeType?.name) return "—"
    return row.employeeTypeChildName
        ? `${row.employeeType.name} / ${row.employeeTypeChildName}`
        : row.employeeType.name
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

async function downloadTemplate() {
    downloadingTemplate.value = true

    try {
        await downloadManpowerPlanTemplate()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("manpowerPlan.templateFailed"),
            detail: errorText(error),
            life: 5000,
        })
    } finally {
        downloadingTemplate.value = false
    }
}

async function exportRows() {
    exporting.value = true

    try {
        await exportManpowerPlans({
            search: list.query.search || undefined,
            year: list.query.year || undefined,
            month: list.query.month || undefined,
            employeeTypeId: list.query.employeeTypeId || undefined,
            employeeTypeChildId:
                list.query.employeeTypeChildId || undefined,
            departmentId: list.query.departmentId || undefined,
            positionId: list.query.positionId || undefined,
            lineId: list.query.lineId || undefined,
            shiftId: list.query.shiftId || undefined,
            status: list.query.status,
            sortBy: list.query.sortBy,
            sortOrder: list.query.sortOrder,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("manpowerPlan.exportFailed"),
            detail: errorText(error),
            life: 5000,
        })
    } finally {
        exporting.value = false
    }
}

async function submitImport() {
    try {
        const result = await importState.submit()
        const errorCount = result?.errors?.length || 0

        if (errorCount) {
            toast.add({
                severity: "warn",
                summary: t("manpowerPlan.importCompletedWithErrors"),
                detail: t("manpowerPlan.importResultSummary", {
                    created: result?.created || 0,
                    updated: result?.updated || 0,
                    skipped: result?.skipped || 0,
                    failed: errorCount,
                }),
                life: 7000,
            })
            return
        }

        toast.add({
            severity: "success",
            summary: t("manpowerPlan.importSuccess"),
            life: 3500,
        })
        importVisible.value = false
        importState.reset()
        await list.load({ page: 1 })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("manpowerPlan.importFailed"),
            detail: errorText(error),
            life: 5000,
        })
    }
}

watch(
    () => list.query.departmentId,
    async (departmentId) => {
        list.query.positionId = ""
        list.query.lineId = ""
        await lookups.loadFilterChildren(departmentId)
    },
)
watch(
    () => list.query.employeeTypeId,
    () => {
        list.query.employeeTypeChildId = ""
    },
)
watch(
    () => workspaceStore.revision,
    async () => {
        batchVisible.value = false
        formVisible.value = false
        importVisible.value = false
        lookups.clear()

        if (!workspaceStore.ready) {
            list.rows.value = []
            return
        }

        await list.clearFilters()
        await lookups.loadBase()
    },
)

onMounted(load)
</script>

<template>
    <EnterpriseListPage
        :rows="list.rows.value"
        :columns="columns"
        :loading="list.loading.value || lookups.loading.value"
        :error="list.error.value"
        :pagination="list.pagination"
        row-key="id"
        :actions-header="t('common.actions')"
        :empty-title="t('manpowerPlan.empty')"
        :empty-description="t('manpowerPlan.emptyDescription')"
        @retry="load"
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
                    <Button severity="secondary" text icon="pi pi-refresh" :label="t('common.refresh')" :loading="list.loading.value" :disabled="!workspaceStore.ready" @click="list.load" />
                    <PermissionButton :permission="MANPOWER_PLAN_PERMISSIONS.IMPORT" severity="secondary" text icon="pi pi-download" :label="t('manpowerPlan.downloadTemplate')" :loading="downloadingTemplate" :disabled="!workspaceStore.ready" @click="downloadTemplate" />
                    <PermissionButton :permission="MANPOWER_PLAN_PERMISSIONS.IMPORT" severity="secondary" text icon="pi pi-upload" :label="t('manpowerPlan.import')" :disabled="!workspaceStore.ready" @click="importVisible = true" />
                    <PermissionButton :permission="MANPOWER_PLAN_PERMISSIONS.EXPORT" severity="secondary" text icon="pi pi-file-export" :label="t('manpowerPlan.export')" :loading="exporting" :disabled="!workspaceStore.ready" @click="exportRows" />
                </template>
                <template #actions>
                    <PermissionButton :permission="MANPOWER_PLAN_PERMISSIONS.CREATE" icon="pi pi-table" :label="t('manpowerPlan.planManpower')" :disabled="!workspaceStore.ready" @click="batchVisible = true" />
                </template>
                <template #filters>
                    <EnterpriseFilterBar :loading="list.loading.value">
                        <EnterpriseFilterField class="manpower-filter-search" :label="t('common.search')" search>
                            <span class="enterprise-search-input">
                                <i class="pi pi-search" />
                                <InputText v-model="list.query.search" :placeholder="t('manpowerPlan.searchPlaceholder')" @keyup.enter="list.applyFilters" />
                            </span>
                        </EnterpriseFilterField>
                        <EnterpriseFilterField :label="t('manpowerPlan.year')">
                            <InputNumber v-model="list.query.year" :min="2000" :max="2100" :use-grouping="false" />
                        </EnterpriseFilterField>
                        <EnterpriseFilterField :label="t('manpowerPlan.month')">
                            <Select v-model="list.query.month" :options="monthOptions" option-label="label" option-value="value" />
                        </EnterpriseFilterField>
                        <EnterpriseFilterField :label="t('manpowerPlan.employeeType')">
                            <Select v-model="list.query.employeeTypeId" :options="employeeTypeOptions" option-label="name" option-value="id" filter />
                        </EnterpriseFilterField>
                        <EnterpriseFilterField :label="t('manpowerPlan.childGroup')">
                            <Select v-model="list.query.employeeTypeChildId" :options="childOptions" option-label="name" option-value="id" filter :disabled="!list.query.employeeTypeId" />
                        </EnterpriseFilterField>
                        <EnterpriseFilterField :label="t('manpowerPlan.department')">
                            <Select v-model="list.query.departmentId" :options="departmentOptions" option-label="name" option-value="id" filter />
                        </EnterpriseFilterField>
                        <EnterpriseFilterField :label="t('manpowerPlan.position')">
                            <Select v-model="list.query.positionId" :options="positionOptions" option-label="title" option-value="id" filter :disabled="!list.query.departmentId" />
                        </EnterpriseFilterField>
                        <EnterpriseFilterField :label="t('manpowerPlan.line')">
                            <Select v-model="list.query.lineId" :options="lineOptions" option-label="name" option-value="id" filter :disabled="!list.query.departmentId" />
                        </EnterpriseFilterField>
                        <EnterpriseFilterField :label="t('manpowerPlan.shift')">
                            <Select v-model="list.query.shiftId" :options="shiftOptions" option-label="name" option-value="id" filter />
                        </EnterpriseFilterField>
                        <EnterpriseFilterField :label="t('common.status')">
                            <Select v-model="list.query.status" :options="statusOptions" option-label="label" option-value="value" />
                        </EnterpriseFilterField>
                        <template #actions>
                            <Button severity="secondary" outlined icon="pi pi-times" :label="t('common.clear')" :disabled="list.loading.value || !list.hasActiveFilters.value" @click="list.clearFilters" />
                            <Button icon="pi pi-check" :label="t('common.apply')" :loading="list.loading.value" @click="list.applyFilters" />
                        </template>
                    </EnterpriseFilterBar>
                </template>
            </EnterpriseListControls>
        </template>

        <template #empty-action>
            <PermissionButton :permission="MANPOWER_PLAN_PERMISSIONS.CREATE" icon="pi pi-table" :label="t('manpowerPlan.planManpower')" :disabled="!workspaceStore.ready" @click="batchVisible = true" />
        </template>
        <template #cell-year="{ row }"><span class="enterprise-table__text enterprise-table__code">{{ row.year }} / {{ row.month }}</span></template>
        <template #cell-department="{ row }"><span class="enterprise-table__text" :title="row.department?.name || '—'">{{ row.department?.name || "—" }}</span></template>
        <template #cell-position="{ row }"><span class="enterprise-table__text" :title="row.position?.title || row.position?.name || '—'">{{ row.position?.title || row.position?.name || "—" }}</span></template>
        <template #cell-line="{ row }"><span class="enterprise-table__text" :title="row.line?.name || '—'">{{ row.line?.name || "—" }}</span></template>
        <template #cell-shift="{ row }"><span class="enterprise-table__text" :title="row.shift?.name || '—'">{{ row.shift?.name || "—" }}</span></template>
        <template #cell-employeeType="{ row }"><span class="enterprise-table__text" :title="employeeTypeLabel(row)">{{ employeeTypeLabel(row) }}</span></template>
        <template #cell-status="{ row }"><Tag :value="statusLabel(row.status)" :severity="statusSeverity(row.status)" rounded /></template>
        <template #cell-updatedAt="{ row }"><span class="enterprise-table__text">{{ formatDateTime(row.updatedAt) }}</span></template>
        <template #actions="{ row }"><EnterpriseActionMenu :items="rowActions(row)" :disabled="list.archiving.value" /></template>
    </EnterpriseListPage>

    <ManpowerPlanBatchDialog v-model:visible="batchVisible" :employee-types="lookups.employeeTypes.value" :can-save="authStore.hasPermission(MANPOWER_PLAN_PERMISSIONS.CREATE)" @saved="list.load({ page: 1 })" />
    <ManpowerPlanFormDialog v-model:visible="formVisible" :form="formState.form" :errors="formState.errors.value" :company-name="companyName" :branch-name="branchName" :departments="lookups.departments.value" :positions="lookups.formPositions.value" :lines="lookups.formLines.value" :shifts="lookups.shifts.value" :employee-types="lookups.employeeTypes.value" :saving="formState.saving.value" @save="savePlan" @clear-error="formState.clearError" @department-change="onFormDepartmentChange" @employee-type-change="onFormEmployeeTypeChange" />
    <ManpowerPlanArchiveDialog v-model:visible="archiveVisible" :plan="archiveCandidate" :busy="list.archiving.value" @confirm="confirmArchive" @cancel="archiveVisible = false" />
    <ManpowerPlanImportDialog v-model:visible="importVisible" :importing="importState.importing.value" :progress="importState.progress.value" :result="importState.result.value" :error-message="importState.error.value ? errorText(importState.error.value) : ''" @file-change="importState.setFile" @download-template="downloadTemplate" @import="submitImport" @close="importState.reset" />
</template>

<style scoped>
.manpower-filter-search {
    min-width: min(18rem, 100%);
}

@media (max-width: 760px) {
    .manpower-filter-search {
        min-width: 0;
    }
}
</style>
