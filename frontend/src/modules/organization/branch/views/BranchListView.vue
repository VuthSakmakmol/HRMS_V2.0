<script setup>
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import { computed, onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useUiStore } from "@/app/stores/ui.store.js"
import EnterpriseActionMenu from "@/shared/components/enterprise/EnterpriseActionMenu.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterpriseListPage from "@/shared/components/enterprise/EnterpriseListPage.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"

import { lookupCompanies } from "../api/branch.api.js"
import BranchArchiveDialog from "../components/BranchArchiveDialog.vue"
import BranchFormDialog from "../components/BranchFormDialog.vue"
import { useBranchForm } from "../composables/useBranchForm.js"
import { useBranchList } from "../composables/useBranchList.js"
import { createBranchColumns } from "../config/branch.columns.js"
import { createBranchStatusOptions } from "../config/branch.filters.js"
import { BRANCH_PERMISSIONS } from "../config/branch.permissions.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const uiStore = useUiStore()

const list = useBranchList()
const formState = useBranchForm()

const companies = ref([])
const formVisible = ref(false)
const archiveVisible = ref(false)
const archiveCandidate = ref(null)

const columns = computed(() => createBranchColumns(t))
const statusOptions = computed(() => createBranchStatusOptions(t))

const companyOptions = computed(() => [
    {
        id: "",
        displayName: t("organization.branch.allCompanies"),
    },
    ...companies.value,
])

const canUpdate = computed(() =>
    authStore.hasPermission(BRANCH_PERMISSIONS.UPDATE),
)

const canArchive = computed(() =>
    authStore.hasPermission(BRANCH_PERMISSIONS.ARCHIVE),
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

async function load() {
    try {
        const [, companyRows] = await Promise.all([
            list.load(),
            lookupCompanies({}, undefined),
        ])

        companies.value = companyRows
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.branch.loadFailed"),
            detail: translatedError(error),
            life: 4500,
        })
    }
}

function openCreate() {
    formState.openCreate()
    formVisible.value = true
}

function openEdit(row) {
    formState.openEdit(row)
    formVisible.value = true
}

async function saveBranch() {
    try {
        const editing = formState.isEdit.value

        await formState.save()

        formVisible.value = false

        toast.add({
            severity: "success",
            summary: editing
                ? t("organization.branch.updated")
                : t("organization.branch.created"),
            detail: editing
                ? t("organization.branch.updatedDetail")
                : t("organization.branch.createdDetail"),
            life: 3000,
        })

        await list.load()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.branch.saveFailed"),
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
            summary: t("organization.branch.archived"),
            detail: t("organization.branch.archivedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.branch.archiveFailed"),
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
            label: t("organization.branch.archiveTitle"),
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
        return t("organization.branch.statusActive")
    }

    if (status === "INACTIVE") {
        return t("organization.branch.statusInactive")
    }

    if (status === "ARCHIVED") {
        return t("organization.branch.statusArchived")
    }

    return status || "—"
}

function branchPhone(row) {
    return row.phone || row.contact?.phone || "—"
}

function branchEmail(row) {
    return row.email || row.contact?.email || "—"
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
        :empty-title="t('organization.branch.empty')"
        :empty-description="t('organization.branch.emptyDescription')"
        @retry="list.load"
        @page-change="list.changePage"
        @sort-change="list.changeSort"
    >
        <template #toolbar>
            <Button
                severity="secondary"
                outlined
                icon="pi pi-refresh"
                :aria-label="t('common.refresh')"
                :loading="list.loading.value"
                @click="list.load"
            />

            <PermissionButton
                :permission="BRANCH_PERMISSIONS.CREATE"
                icon="pi pi-plus"
                :label="t('organization.branch.newBranch')"
                @click="openCreate"
            />
        </template>

        <template #filters>
            <EnterpriseFilterField
                class="branch-filter-search"
                :label="t('common.search')"
            >
                <span class="enterprise-search-input">
                    <i class="pi pi-search" />

                    <InputText
                        v-model="list.query.search"
                        :placeholder="t('organization.branch.searchPlaceholder')"
                        @keyup.enter="list.applyFilters"
                    />
                </span>
            </EnterpriseFilterField>

            <EnterpriseFilterField
                :label="t('organization.branch.company')"
            >
                <Select
                    v-model="list.query.companyId"
                    :options="companyOptions"
                    option-label="displayName"
                    option-value="id"
                    filter
                    @change="list.applyFilters"
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
                    @change="list.applyFilters"
                />
            </EnterpriseFilterField>
        </template>

        <template #filter-actions>
            <Button
                icon="pi pi-filter"
                :label="t('common.apply')"
                :loading="list.loading.value"
                @click="list.applyFilters"
            />

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
        </template>

        <template #empty-action>
            <PermissionButton
                :permission="BRANCH_PERMISSIONS.CREATE"
                icon="pi pi-plus"
                :label="t('organization.branch.newBranch')"
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

        <template #cell-company="{ row }">
            <span
                class="enterprise-table__text"
                :title="row.company?.displayName || '—'"
            >
                {{ row.company?.displayName || "—" }}
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

        <template #cell-shortName="{ row }">
            <span
                class="enterprise-table__text"
                :title="row.shortName || '—'"
            >
                {{ row.shortName || "—" }}
            </span>
        </template>

        <template #cell-isHeadOffice="{ row }">
            <Tag
                v-if="row.isHeadOffice"
                :value="t('organization.branch.headOffice')"
                severity="info"
            />

            <span
                v-else
                class="enterprise-table__text"
            >
                —
            </span>
        </template>

        <template #cell-phone="{ row }">
            <span
                class="enterprise-table__text"
                :title="branchPhone(row)"
            >
                {{ branchPhone(row) }}
            </span>
        </template>

        <template #cell-email="{ row }">
            <span
                class="enterprise-table__text"
                :title="branchEmail(row)"
            >
                {{ branchEmail(row) }}
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

    <BranchFormDialog
        v-model:visible="formVisible"
        :mode="formState.mode.value"
        :form="formState.form"
        :errors="formState.errors.value"
        :companies="companies"
        :saving="formState.saving.value"
        @save="saveBranch"
        @clear-error="formState.clearError"
        @normalize-code="formState.normalizeCode"
        @normalize-country-code="formState.normalizeCountryCode"
    />

    <BranchArchiveDialog
        v-model:visible="archiveVisible"
        :branch="archiveCandidate"
        :busy="list.archiving.value"
        @confirm="confirmArchive"
        @cancel="archiveCandidate = null"
    />
</template>

<style scoped>
.branch-filter-search {
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
