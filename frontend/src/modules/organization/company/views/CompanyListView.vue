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

import CompanyArchiveDialog from "../components/CompanyArchiveDialog.vue"
import CompanyFormDialog from "../components/CompanyFormDialog.vue"
import { useCompanyForm } from "../composables/useCompanyForm.js"
import { useCompanyList } from "../composables/useCompanyList.js"
import { createCompanyColumns } from "../config/company.columns.js"
import { createCompanyStatusOptions } from "../config/company.filters.js"
import { COMPANY_PERMISSIONS } from "../config/company.permissions.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const uiStore = useUiStore()

const list = useCompanyList()
const formState = useCompanyForm()

const formVisible = ref(false)
const archiveVisible = ref(false)
const archiveCandidate = ref(null)

const columns = computed(() => createCompanyColumns(t))
const statusOptions = computed(() => createCompanyStatusOptions(t))

const canUpdate = computed(() =>
    authStore.hasPermission(COMPANY_PERMISSIONS.UPDATE),
)

const canArchive = computed(() =>
    authStore.hasPermission(COMPANY_PERMISSIONS.ARCHIVE),
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

async function loadCompanies() {
    try {
        await list.load()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.company.loadFailed"),
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

async function saveCompany() {
    try {
        const editing = formState.isEdit.value

        await formState.save()

        formVisible.value = false

        toast.add({
            severity: "success",
            summary: editing
                ? t("organization.company.updated")
                : t("organization.company.created"),
            detail: editing
                ? t("organization.company.updatedDetail")
                : t("organization.company.createdDetail"),
            life: 3000,
        })

        await list.load()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.company.saveFailed"),
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
            summary: t("organization.company.archived"),
            detail: t("organization.company.archivedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.company.archiveFailed"),
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
            label: t("organization.company.archiveTitle"),
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

    if (status === "SUSPENDED") {
        return "warn"
    }

    if (status === "ARCHIVED") {
        return "danger"
    }

    return "secondary"
}

function statusLabel(status) {
    if (status === "ACTIVE") {
        return t("organization.company.statusActive")
    }

    if (status === "SUSPENDED") {
        return t("organization.company.statusSuspended")
    }

    if (status === "ARCHIVED") {
        return t("organization.company.statusArchived")
    }

    return status || "—"
}

function companyPhone(row) {
    return row.phone || row.contact?.phone || "—"
}

function companyEmail(row) {
    return row.email || row.contact?.email || "—"
}

function companyCity(row) {
    return row.city || row.address?.city || "—"
}

function companyCountryCode(row) {
    return row.countryCode || row.address?.countryCode || "—"
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

onMounted(loadCompanies)
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
        :empty-title="t('organization.company.empty')"
        :empty-description="t('organization.company.emptyDescription')"
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
                :permission="COMPANY_PERMISSIONS.CREATE"
                icon="pi pi-plus"
                :label="t('organization.company.newCompany')"
                @click="openCreate"
            />
        </template>

        <template #filters>
            <EnterpriseFilterField
                class="company-filter-search"
                :label="t('common.search')"
            >
                <span class="enterprise-search-input">
                    <i class="pi pi-search" />

                    <InputText
                        v-model="list.query.search"
                        :placeholder="t('organization.company.searchPlaceholder')"
                        @keyup.enter="list.applyFilters"
                    />
                </span>
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
                :permission="COMPANY_PERMISSIONS.CREATE"
                icon="pi pi-plus"
                :label="t('organization.company.newCompany')"
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

        <template #cell-displayName="{ row }">
            <span
                class="enterprise-table__text"
                :title="row.displayName || '—'"
            >
                {{ row.displayName || "—" }}
            </span>
        </template>

        <template #cell-legalName="{ row }">
            <span
                class="enterprise-table__text"
                :title="row.legalName || '—'"
            >
                {{ row.legalName || "—" }}
            </span>
        </template>

        <template #cell-phone="{ row }">
            <span
                class="enterprise-table__text"
                :title="companyPhone(row)"
            >
                {{ companyPhone(row) }}
            </span>
        </template>

        <template #cell-email="{ row }">
            <span
                class="enterprise-table__text"
                :title="companyEmail(row)"
            >
                {{ companyEmail(row) }}
            </span>
        </template>

        <template #cell-city="{ row }">
            <span
                class="enterprise-table__text"
                :title="companyCity(row)"
            >
                {{ companyCity(row) }}
            </span>
        </template>

        <template #cell-countryCode="{ row }">
            <span
                class="enterprise-table__text"
                :title="companyCountryCode(row)"
            >
                {{ companyCountryCode(row) }}
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

    <CompanyFormDialog
        v-model:visible="formVisible"
        :mode="formState.mode.value"
        :form="formState.form"
        :errors="formState.errors.value"
        :saving="formState.saving.value"
        @save="saveCompany"
        @clear-error="formState.clearError"
        @normalize-code="formState.normalizeCode"
        @normalize-country-code="formState.normalizeCountryCode"
        @normalize-currency-code="formState.normalizeCurrencyCode"
    />

    <CompanyArchiveDialog
        v-model:visible="archiveVisible"
        :company="archiveCandidate"
        :busy="list.archiving.value"
        @confirm="confirmArchive"
        @cancel="archiveCandidate = null"
    />
</template>

<style scoped>
.company-filter-search {
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
