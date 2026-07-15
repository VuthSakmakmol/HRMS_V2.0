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
    downloadDepartmentTemplate,
    exportDepartments,
    lookupBranches,
    lookupCompanies,
    lookupDepartments,
} from "../api/department.api.js"
import DepartmentArchiveDialog from "../components/DepartmentArchiveDialog.vue"
import DepartmentFormDialog from "../components/DepartmentFormDialog.vue"
import DepartmentImportDialog from "../components/DepartmentImportDialog.vue"
import { useDepartmentForm } from "../composables/useDepartmentForm.js"
import { useDepartmentImport } from "../composables/useDepartmentImport.js"
import { useDepartmentList } from "../composables/useDepartmentList.js"
import { createDepartmentColumns } from "../config/department.columns.js"
import { createDepartmentStatusOptions } from "../config/department.filters.js"
import { DEPARTMENT_PERMISSIONS } from "../config/department.permissions.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const uiStore = useUiStore()

const list = useDepartmentList()
const formState = useDepartmentForm()
const importState = useDepartmentImport()

const companies = ref([])
const branches = ref([])
const parentDepartments = ref([])
const formVisible = ref(false)
const archiveVisible = ref(false)
const importVisible = ref(false)
const archiveCandidate = ref(null)
const downloadingTemplate = ref(false)
const exporting = ref(false)

const columns = computed(() => createDepartmentColumns(t))
const statusOptions = computed(() =>
    createDepartmentStatusOptions(t),
)

const activeFilterCount = computed(() => {
    let count = 0

    if (list.query.search?.trim()) {
        count += 1
    }

    if (list.query.companyId) {
        count += 1
    }

    if (list.query.branchId) {
        count += 1
    }

    if (list.query.status !== "ALL") {
        count += 1
    }

    return count
})

const companyOptions = computed(() => [
    {
        id: "",
        displayName: t("organization.department.allCompanies"),
    },
    ...companies.value,
])

const branchOptions = computed(() => [
    {
        id: "",
        name: t("organization.department.allBranches"),
    },
    ...branches.value.filter(
        (branch) =>
            !list.query.companyId ||
            branch.companyId === list.query.companyId,
    ),
])

const formBranchOptions = computed(() =>
    branches.value.filter(
        (branch) =>
            !formState.form.companyId ||
            branch.companyId === formState.form.companyId,
    ),
)

const canUpdate = computed(() =>
    authStore.hasPermission(DEPARTMENT_PERMISSIONS.UPDATE),
)

const canArchive = computed(() =>
    authStore.hasPermission(DEPARTMENT_PERMISSIONS.ARCHIVE),
)

function translatedError(error) {
    const key = error?.response?.data?.error?.messageKey

    if (!key) {
        return t("errors.internal")
    }

    const translated = t(key)

    return translated === key
        ? t("errors.internal")
        : translated
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
            summary: t("organization.department.loadFailed"),
            detail: translatedError(error),
            life: 4500,
        })
    }
}

async function loadParentDepartments() {
    if (!formState.form.branchId) {
        parentDepartments.value = []
        return
    }

    parentDepartments.value = await lookupDepartments({
        companyId: formState.form.companyId,
        branchId: formState.form.branchId,
    })

    parentDepartments.value = parentDepartments.value.filter(
        (department) =>
            department.id !== formState.departmentId.value,
    )
}

async function openCreate() {
    formState.openCreate()
    parentDepartments.value = []
    formVisible.value = true
}

async function openEdit(row) {
    formState.openEdit(row)
    await loadParentDepartments()
    formVisible.value = true
}

function openImport() {
    importState.reset()
    importVisible.value = true
}

function onFormCompanyChange() {
    formState.form.branchId = ""
    formState.form.parentDepartmentId = ""
    parentDepartments.value = []
}

async function onFormBranchChange() {
    formState.form.parentDepartmentId = ""
    await loadParentDepartments()
}

async function saveDepartment() {
    try {
        const editing = formState.isEdit.value

        await formState.save()
        formVisible.value = false

        toast.add({
            severity: "success",
            summary: editing
                ? t("organization.department.updated")
                : t("organization.department.created"),
            detail: editing
                ? t("organization.department.updatedDetail")
                : t("organization.department.createdDetail"),
            life: 3000,
        })

        await list.load()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.department.saveFailed"),
            detail: translatedError(error),
            life: 5000,
        })
    }
}

async function downloadTemplate() {
    if (downloadingTemplate.value) {
        return
    }

    downloadingTemplate.value = true

    try {
        await downloadDepartmentTemplate()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.department.templateDownloadFailed"),
            detail: translatedError(error),
            life: 5000,
        })
    } finally {
        downloadingTemplate.value = false
    }
}

async function exportCurrentDepartments() {
    if (exporting.value) {
        return
    }

    exporting.value = true

    try {
        await exportDepartments({
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
            summary: t("organization.department.exportFailed"),
            detail: translatedError(error),
            life: 5000,
        })
    } finally {
        exporting.value = false
    }
}

async function importDepartmentFile() {
    try {
        const result = await importState.submit()

        if (!result) {
            return
        }

        toast.add({
            severity:
                Number(result.failed ?? result.errors?.length ?? 0) > 0
                    ? "warn"
                    : "success",
            summary: t("organization.department.importSuccess"),
            detail: t("organization.department.importSuccessDetail"),
            life: 4000,
        })

        await Promise.all([
            list.load({
                page: 1,
            }),
            loadLookups(),
        ])
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.department.importFailed"),
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
    const id =
        archiveCandidate.value?.id ??
        archiveCandidate.value?._id

    if (!id) {
        return
    }

    try {
        await list.archive(id)
        archiveVisible.value = false
        archiveCandidate.value = null

        toast.add({
            severity: "success",
            summary: t("organization.department.archived"),
            detail: t("organization.department.archivedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.department.archiveFailed"),
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
            visible:
                canUpdate.value &&
                row.status !== "ARCHIVED",
            command: () => openEdit(row),
        },
        {
            label: t("organization.department.archiveTitle"),
            icon: "pi pi-archive",
            visible:
                canArchive.value &&
                row.status !== "ARCHIVED",
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
    if (status === "ACTIVE") {
        return t("organization.department.statusActive")
    }

    if (status === "INACTIVE") {
        return t("organization.department.statusInactive")
    }

    if (status === "ARCHIVED") {
        return t("organization.department.statusArchived")
    }

    return status || "—"
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

function onFilterCompanyChange() {
    list.query.branchId = ""
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
        :empty-title="t('organization.department.empty')"
        :empty-description="t('organization.department.emptyDescription')"
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

                    <PermissionButton
                        :permission="DEPARTMENT_PERMISSIONS.EXPORT"
                        severity="secondary"
                        text
                        icon="pi pi-download"
                        :label="t('organization.department.downloadTemplate')"
                        :loading="downloadingTemplate"
                        @click="downloadTemplate"
                    />

                    <PermissionButton
                        :permission="DEPARTMENT_PERMISSIONS.IMPORT"
                        severity="secondary"
                        text
                        icon="pi pi-upload"
                        :label="t('organization.department.import')"
                        @click="openImport"
                    />

                    <PermissionButton
                        :permission="DEPARTMENT_PERMISSIONS.EXPORT"
                        severity="secondary"
                        text
                        icon="pi pi-file-export"
                        :label="t('organization.department.export')"
                        :loading="exporting"
                        @click="exportCurrentDepartments"
                    />
                </template>

                <template #actions>
                    <PermissionButton
                        :permission="DEPARTMENT_PERMISSIONS.CREATE"
                        icon="pi pi-plus"
                        :label="t('organization.department.newDepartment')"
                        @click="openCreate"
                    />
                </template>

                <template #filters>
                    <EnterpriseFilterBar
                        :loading="list.loading.value"
                    >
                        <EnterpriseFilterField
                            class="department-filter-search"
                            :label="t('common.search')"
                            search
                        >
                            <span class="enterprise-search-input">
                                <i class="pi pi-search" />

                                <InputText
                                    v-model="list.query.search"
                                    :placeholder="
                                        t(
                                            'organization.department.searchPlaceholder',
                                        )
                                    "
                                    @keyup.enter="list.applyFilters"
                                />
                            </span>
                        </EnterpriseFilterField>

                        <EnterpriseFilterField
                            :label="t('organization.department.company')"
                        >
                            <Select
                                v-model="list.query.companyId"
                                :options="companyOptions"
                                option-label="displayName"
                                option-value="id"
                                filter
                                @change="onFilterCompanyChange"
                            />
                        </EnterpriseFilterField>

                        <EnterpriseFilterField
                            :label="t('organization.department.branch')"
                        >
                            <Select
                                v-model="list.query.branchId"
                                :options="branchOptions"
                                option-label="name"
                                option-value="id"
                                filter
                                :disabled="!list.query.companyId"
                            />
                        </EnterpriseFilterField>

                        <EnterpriseFilterField
                            :label="t('common.status')"
                        >
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
                                :disabled="
                                    list.loading.value ||
                                    !list.hasActiveFilters.value
                                "
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
                :permission="DEPARTMENT_PERMISSIONS.CREATE"
                icon="pi pi-plus"
                :label="t('organization.department.newDepartment')"
                @click="openCreate"
            />
        </template>

        <template #cell-code="{ row }">
            <span
                class="enterprise-table__text enterprise-table__code"
                :title="row.code || '—'"
            >
                {{ row.code || "—" }}
            </span>
        </template>

        <template #cell-name="{ row }">
            <span
                class="enterprise-table__text"
                :title="row.name || '—'"
            >
                {{ row.name || "—" }}
            </span>
        </template>

        <template #cell-company="{ row }">
            <span
                class="enterprise-table__text"
                :title="row.company?.displayName || '—'"
            >
                {{ row.company?.displayName || "—" }}
            </span>
        </template>

        <template #cell-branch="{ row }">
            <span
                class="enterprise-table__text"
                :title="row.branch?.name || '—'"
            >
                {{ row.branch?.name || "—" }}
            </span>
        </template>

        <template #cell-parentDepartment="{ row }">
            <span
                class="enterprise-table__text"
                :title="row.parentDepartment?.name || '—'"
            >
                {{ row.parentDepartment?.name || "—" }}
            </span>
        </template>

        <template #cell-status="{ row }">
            <Tag
                :value="statusLabel(row.status)"
                :severity="statusSeverity(row.status)"
            />
        </template>

        <template #cell-updatedAt="{ row }">
            <span
                class="enterprise-table__text"
                :title="formatDateTime(row.updatedAt)"
            >
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

    <DepartmentFormDialog
        v-model:visible="formVisible"
        :mode="formState.mode.value"
        :form="formState.form"
        :errors="formState.errors.value"
        :companies="companies"
        :branches="formBranchOptions"
        :parent-departments="parentDepartments"
        :saving="formState.saving.value"
        @save="saveDepartment"
        @clear-error="formState.clearError"
        @normalize-code="formState.normalizeCode"
        @company-change="onFormCompanyChange"
        @branch-change="onFormBranchChange"
    />

    <DepartmentImportDialog
        v-model:visible="importVisible"
        :importing="importState.importing.value"
        :progress="importState.progress.value"
        :result="importState.result.value"
        :error-message="
            importState.error.value
                ? translatedError(importState.error.value)
                : ''
        "
        @file-change="importState.setFile"
        @download-template="downloadTemplate"
        @import="importDepartmentFile"
        @close="importState.reset"
    />

    <DepartmentArchiveDialog
        v-model:visible="archiveVisible"
        :department="archiveCandidate"
        :busy="list.archiving.value"
        @confirm="confirmArchive"
        @cancel="archiveCandidate = null"
    />
</template>

<style scoped>
.department-filter-search {
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
