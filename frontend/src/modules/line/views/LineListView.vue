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
import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import EnterpriseActionMenu from "@/shared/components/enterprise/EnterpriseActionMenu.vue"
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterpriseListControls from "@/shared/components/enterprise/EnterpriseListControls.vue"
import EnterpriseListPage from "@/shared/components/enterprise/EnterpriseListPage.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"

import {
    downloadLineTemplate,
    exportLines,
} from "../api/line.api.js"
import LineArchiveDialog from "../components/LineArchiveDialog.vue"
import LineFormDialog from "../components/LineFormDialog.vue"
import LineImportDialog from "../components/LineImportDialog.vue"
import { useLineForm } from "../composables/useLineForm.js"
import { useLineList } from "../composables/useLineList.js"
import { useLineImport } from "../composables/useLineImport.js"
import { createLineColumns } from "../config/line.columns.js"
import { createLineStatusOptions } from "../config/line.filters.js"
import { LINE_PERMISSIONS } from "../config/line.permissions.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const uiStore = useUiStore()
const workspaceStore = useWorkspaceStore()

const list = useLineList()
const formState = useLineForm()
const importState = useLineImport()

const formVisible = ref(false)
const archiveVisible = ref(false)
const importVisible = ref(false)
const archiveCandidate = ref(null)
const exporting = ref(false)
const downloadingTemplate = ref(false)

const columns = computed(() => createLineColumns(t))
const statusOptions = computed(() => createLineStatusOptions(t))

const activeFilterCount = computed(() => {
    let count = 0

    for (const field of ["search"]) {
        if (list.query[field]) {
            count += 1
        }
    }

    if (list.query.status !== "ALL") {
        count += 1
    }

    return count
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

const canUpdate = computed(() =>
    authStore.hasPermission(LINE_PERMISSIONS.UPDATE),
)

const canArchive = computed(() =>
    authStore.hasPermission(LINE_PERMISSIONS.ARCHIVE),
)

function translatedError(error) {
    const key = error?.response?.data?.error?.messageKey

    if (!key) {
        return t("errors.internal")
    }

    const translated = t(key)

    return translated === key ? t("errors.internal") : translated
}

async function load() {
    if (!workspaceStore.ready) {
        return
    }

    try {
        await list.load()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.line.loadFailed"),
            detail: translatedError(error),
            life: 4500,
        })
    }
}

function openCreate() {
    formState.openCreate({
        companyId: workspaceStore.companyId,
        branchId: workspaceStore.branchId,
    })
    formVisible.value = true
}

async function openEdit(row) {
    formState.openEdit(row)
    formVisible.value = true
}

async function saveLine() {
    try {
        const editing = formState.isEdit.value

        await formState.save()
        formVisible.value = false

        toast.add({
            severity: "success",
            summary: editing
                ? t("organization.line.updated")
                : t("organization.line.created"),
            detail: editing
                ? t("organization.line.updatedDetail")
                : t("organization.line.createdDetail"),
            life: 3000,
        })

        await list.load()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.line.saveFailed"),
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

    if (!id) {
        return
    }

    try {
        await list.archive(id)
        archiveVisible.value = false
        archiveCandidate.value = null

        toast.add({
            severity: "success",
            summary: t("organization.line.archived"),
            detail: t("organization.line.archivedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.line.archiveFailed"),
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
            label: t("organization.line.archiveTitle"),
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
    const key = {
        ACTIVE: "statusActive",
        INACTIVE: "statusInactive",
        ARCHIVED: "statusArchived",
    }[status]

    return key ? t(`organization.line.${key}`) : status || "—"
}

function formatDateTime(value) {
    if (!value) {
        return "—"
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return "—"
    }

    return new Intl.DateTimeFormat(uiStore.locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date)
}

function openImport() {
    importState.reset()
    importVisible.value = true
}

async function submitImport() {
    try {
        const result = await importState.submit()
        if (result?.success) {
            toast.add({ severity: "success", summary: t("organization.line.importCompleted"), life: 3500 })
            await list.load({ page: 1 })
        }
    } catch (error) {
        toast.add({ severity: "error", summary: t("organization.line.importFailed"), detail: translatedError(error), life: 5000 })
    }
}

async function downloadTemplate() {
    downloadingTemplate.value = true

    try {
        await downloadLineTemplate()
    } finally {
        downloadingTemplate.value = false
    }
}

async function exportData() {
    exporting.value = true

    try {
        await exportLines({
            search: list.query.search || undefined,
            status: list.query.status,
            sortBy: list.query.sortBy,
            sortOrder: list.query.sortOrder,
            page: 1,
            limit: 100,
        })
    } finally {
        exporting.value = false
    }
}

onMounted(load)
</script>

<template>
    <EnterpriseListPage
        :rows="list.rows.value"
        :columns="columns"
        :loading="list.loading.value"
        :error="list.error.value"
        :pagination="list.pagination"
        :actions-header="t('common.actions')"
        row-key="id"
        :empty-title="t('organization.line.empty')"
        :empty-description="t('organization.line.emptyDescription')"
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
                        :loading="list.loading.value"
                        @click="list.load"
                    />
                </template>

                <template #actions>
                    <PermissionButton
                        :permission="LINE_PERMISSIONS.IMPORT"
                        severity="secondary"
                        outlined
                        icon="pi pi-file-import"
                        :label="t('common.import')"
                        :disabled="!workspaceStore.ready"
                        @click="openImport"
                    />

                    <PermissionButton
                        :permission="LINE_PERMISSIONS.IMPORT"
                        severity="secondary"
                        outlined
                        icon="pi pi-download"
                        :label="t('organization.line.downloadTemplate')"
                        :loading="downloadingTemplate"
                        @click="downloadTemplate"
                    />

                    <PermissionButton
                        :permission="LINE_PERMISSIONS.EXPORT"
                        severity="secondary"
                        outlined
                        icon="pi pi-file-export"
                        :label="t('common.export')"
                        :loading="exporting"
                        :disabled="!workspaceStore.ready"
                        @click="exportData"
                    />

                    <PermissionButton
                        :permission="LINE_PERMISSIONS.CREATE"
                        icon="pi pi-plus"
                        :label="t('organization.line.newLine')"
                        :disabled="!workspaceStore.ready"
                        @click="openCreate"
                    />
                </template>

                <template #filters>
                    <EnterpriseFilterBar :loading="list.loading.value">
                        <EnterpriseFilterField
                            :label="t('common.search')"
                            search
                        >
                            <span class="enterprise-search-input">
                                <i class="pi pi-search" />
                                <InputText
                                    v-model="list.query.search"
                                    :placeholder="t('organization.line.searchPlaceholder')"
                                    @keyup.enter="list.applyFilters"
                                />
                            </span>
                        </EnterpriseFilterField>

                        <EnterpriseFilterField :label="t('common.status')">
                            <Select
                                v-model="list.query.status"
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
                                :disabled="list.loading.value || !list.hasActiveFilters.value"
                                @click="list.clearFilters"
                            />

                            <Button
                                icon="pi pi-check"
                                :label="t('common.apply')"
                                :loading="list.loading.value"
                                @click="list.applyFilters"
                            />
                        </template>
                    </EnterpriseFilterBar>
                </template>
            </EnterpriseListControls>
        </template>

        <template #empty-action>
            <PermissionButton
                :permission="LINE_PERMISSIONS.CREATE"
                icon="pi pi-plus"
                :label="t('organization.line.newLine')"
                :disabled="!workspaceStore.ready"
                @click="openCreate"
            />
        </template>

        <template #cell-code="{ row }">
            <span class="enterprise-table__text enterprise-table__code">
                {{ row.code || "—" }}
            </span>
        </template>

        <template #cell-name="{ row }">
            <span class="enterprise-table__text">{{ row.name || "—" }}</span>
        </template>

        <template #cell-company="{ row }">
            <span class="enterprise-table__text">{{ row.company?.displayName || "—" }}</span>
        </template>

        <template #cell-branch="{ row }">
            <span class="enterprise-table__text">{{ row.branch?.name || "—" }}</span>
        </template>

        <template #cell-status="{ row }">
            <Tag
                :value="statusLabel(row.status)"
                :severity="statusSeverity(row.status)"
            />
        </template>

        <template #cell-updatedAt="{ row }">
            <span class="enterprise-table__text">{{ formatDateTime(row.updatedAt) }}</span>
        </template>

        <template #actions="{ row }">
            <EnterpriseActionMenu :items="rowActions(row)" />
        </template>
    </EnterpriseListPage>

    <LineFormDialog
        v-model:visible="formVisible"
        :mode="formState.mode.value"
        :form="formState.form"
        :errors="formState.errors.value"
        :company-name="workspaceCompanyName"
        :branch-name="workspaceBranchName"
        :saving="formState.saving.value"
        @save="saveLine"
        @clear-error="formState.clearError"
        @normalize-code="formState.normalizeCode"
    />

    <LineImportDialog
        v-model:visible="importVisible"
        :file="importState.file.value"
        :importing="importState.importing.value"
        :progress="importState.progress.value"
        :phase="importState.phase.value"
        :phase-message-key="importState.phaseMessageKey.value"
        :processed-rows="importState.processedRows.value"
        :total-rows="importState.totalRows.value"
        :result="importState.result.value"
        :can-import="importState.canImport.value"
        @file-change="importState.setFile"
        @download-template="downloadTemplate"
        @import="submitImport"
        @close="importState.reset"
    />

    <LineArchiveDialog
        v-model:visible="archiveVisible"
        :line="archiveCandidate"
        :loading="list.archiving.value"
        @confirm="confirmArchive"
    />
</template>
