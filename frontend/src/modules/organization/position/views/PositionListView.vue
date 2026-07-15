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
    lookupBranches,
    lookupCompanies,
    lookupDepartments,
    lookupPositions,
} from "../api/position.api.js"
import PositionArchiveDialog from "../components/PositionArchiveDialog.vue"
import PositionFormDialog from "../components/PositionFormDialog.vue"
import { usePositionForm } from "../composables/usePositionForm.js"
import { usePositionList } from "../composables/usePositionList.js"
import { createPositionColumns } from "../config/position.columns.js"
import { createPositionStatusOptions } from "../config/position.filters.js"
import { POSITION_PERMISSIONS } from "../config/position.permissions.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const uiStore = useUiStore()

const list = usePositionList()
const formState = usePositionForm()

const companies = ref([])
const branches = ref([])
const departments = ref([])
const reportsToPositions = ref([])
const formVisible = ref(false)
const archiveVisible = ref(false)
const archiveCandidate = ref(null)

const columns = computed(() => createPositionColumns(t))
const statusOptions = computed(() =>
    createPositionStatusOptions(t),
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

    if (list.query.departmentId) {
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
        displayName: t("organization.position.allCompanies"),
    },
    ...companies.value,
])

const branchOptions = computed(() => [
    {
        id: "",
        name: t("organization.position.allBranches"),
    },
    ...branches.value.filter(
        (branch) =>
            !list.query.companyId ||
            branch.companyId === list.query.companyId,
    ),
])

const departmentOptions = computed(() => [
    {
        id: "",
        name: t("organization.position.allDepartments"),
    },
    ...departments.value.filter(
        (department) =>
            (!list.query.companyId ||
                department.companyId === list.query.companyId) &&
            (!list.query.branchId ||
                department.branchId === list.query.branchId),
    ),
])

const formBranchOptions = computed(() =>
    branches.value.filter(
        (branch) =>
            !formState.form.companyId ||
            branch.companyId === formState.form.companyId,
    ),
)

const formDepartmentOptions = computed(() =>
    departments.value.filter(
        (department) =>
            (!formState.form.companyId ||
                department.companyId === formState.form.companyId) &&
            (!formState.form.branchId ||
                department.branchId === formState.form.branchId),
    ),
)

const canUpdate = computed(() =>
    authStore.hasPermission(POSITION_PERMISSIONS.UPDATE),
)

const canArchive = computed(() =>
    authStore.hasPermission(POSITION_PERMISSIONS.ARCHIVE),
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
    const [companyRows, branchRows, departmentRows] =
        await Promise.all([
            lookupCompanies(),
            lookupBranches(),
            lookupDepartments(),
        ])

    companies.value = companyRows
    branches.value = branchRows
    departments.value = departmentRows
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
            summary: t("organization.position.loadFailed"),
            detail: translatedError(error),
            life: 4500,
        })
    }
}

async function loadReportsToPositions() {
    if (!formState.form.departmentId) {
        reportsToPositions.value = []
        return
    }

    reportsToPositions.value = await lookupPositions({
        companyId: formState.form.companyId,
        branchId: formState.form.branchId,
        departmentId: formState.form.departmentId,
    })

    reportsToPositions.value = reportsToPositions.value.filter(
        (position) =>
            position.id !== formState.positionId.value,
    )
}

async function openCreate() {
    formState.openCreate()
    reportsToPositions.value = []
    formVisible.value = true
}

async function openEdit(row) {
    formState.openEdit(row)
    await loadReportsToPositions()
    formVisible.value = true
}

function onFormCompanyChange() {
    formState.form.branchId = ""
    formState.form.departmentId = ""
    formState.form.reportsToPositionId = ""
    reportsToPositions.value = []
}

function onFormBranchChange() {
    formState.form.departmentId = ""
    formState.form.reportsToPositionId = ""
    reportsToPositions.value = []
}

async function onFormDepartmentChange() {
    formState.form.reportsToPositionId = ""
    await loadReportsToPositions()
}

async function savePosition() {
    try {
        const editing = formState.isEdit.value

        await formState.save()
        formVisible.value = false

        toast.add({
            severity: "success",
            summary: editing
                ? t("organization.position.updated")
                : t("organization.position.created"),
            detail: editing
                ? t("organization.position.updatedDetail")
                : t("organization.position.createdDetail"),
            life: 3000,
        })

        await list.load()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.position.saveFailed"),
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
            summary: t("organization.position.archived"),
            detail: t("organization.position.archivedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.position.archiveFailed"),
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
            label: t("organization.position.archiveTitle"),
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
        return t("organization.position.statusActive")
    }

    if (status === "INACTIVE") {
        return t("organization.position.statusInactive")
    }

    if (status === "ARCHIVED") {
        return t("organization.position.statusArchived")
    }

    return status || "—"
}

function booleanLabel(value) {
    return value
        ? t("common.yes")
        : t("common.no")
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
    list.query.departmentId = ""
}

function onFilterBranchChange() {
    list.query.departmentId = ""
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
        :empty-title="t('organization.position.empty')"
        :empty-description="t('organization.position.description')"
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
                        :permission="POSITION_PERMISSIONS.CREATE"
                        icon="pi pi-plus"
                        :label="t('organization.position.newPosition')"
                        @click="openCreate"
                    />
                </template>

                <template #filters>
                    <EnterpriseFilterBar
                        :loading="list.loading.value"
                    >
                        <EnterpriseFilterField
                            class="position-filter-search"
                            :label="t('common.search')"
                            search
                        >
                            <span class="enterprise-search-input">
                                <i class="pi pi-search" />

                                <InputText
                                    v-model="list.query.search"
                                    :placeholder="
                                        t(
                                            'organization.position.searchPlaceholder',
                                        )
                                    "
                                    @keyup.enter="list.applyFilters"
                                />
                            </span>
                        </EnterpriseFilterField>

                        <EnterpriseFilterField
                            :label="t('organization.position.company')"
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
                            :label="t('organization.position.branch')"
                        >
                            <Select
                                v-model="list.query.branchId"
                                :options="branchOptions"
                                option-label="name"
                                option-value="id"
                                filter
                                :disabled="!list.query.companyId"
                                @change="onFilterBranchChange"
                            />
                        </EnterpriseFilterField>

                        <EnterpriseFilterField
                            :label="t('organization.position.department')"
                        >
                            <Select
                                v-model="list.query.departmentId"
                                :options="departmentOptions"
                                option-label="name"
                                option-value="id"
                                filter
                                :disabled="!list.query.branchId"
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
                :permission="POSITION_PERMISSIONS.CREATE"
                icon="pi pi-plus"
                :label="t('organization.position.newPosition')"
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

        <template #cell-title="{ row }">
            <span
                class="enterprise-table__text"
                :title="row.title || '—'"
            >
                {{ row.title || "—" }}
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

        <template #cell-department="{ row }">
            <span
                class="enterprise-table__text"
                :title="row.department?.name || '—'"
            >
                {{ row.department?.name || "—" }}
            </span>
        </template>

        <template #cell-reportsToPosition="{ row }">
            <span
                class="enterprise-table__text"
                :title="row.reportsToPosition?.title || '—'"
            >
                {{ row.reportsToPosition?.title || "—" }}
            </span>
        </template>

        <template #cell-level="{ row }">
            <span class="enterprise-table__text">
                {{ row.level ?? 0 }}
            </span>
        </template>

        <template #cell-isManager="{ row }">
            <Tag
                :value="booleanLabel(row.isManager)"
                :severity="row.isManager ? 'info' : 'secondary'"
            />
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

    <PositionFormDialog
        v-model:visible="formVisible"
        :mode="formState.mode.value"
        :form="formState.form"
        :errors="formState.errors.value"
        :companies="companies"
        :branches="formBranchOptions"
        :departments="formDepartmentOptions"
        :reports-to-positions="reportsToPositions"
        :saving="formState.saving.value"
        @save="savePosition"
        @clear-error="formState.clearError"
        @normalize-code="formState.normalizeCode"
        @company-change="onFormCompanyChange"
        @branch-change="onFormBranchChange"
        @department-change="onFormDepartmentChange"
    />

    <PositionArchiveDialog
        v-model:visible="archiveVisible"
        :position="archiveCandidate"
        :busy="list.archiving.value"
        @confirm="confirmArchive"
        @cancel="archiveCandidate = null"
    />
</template>

<style scoped>
.position-filter-search {
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
