<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Checkbox from "primevue/checkbox"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import AppFilterBar from "@/shared/components/filter/AppFilterBar.vue"
import AppTableActions from "@/shared/components/table/AppTableActions.vue"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useUiStore } from "@/app/stores/ui.store.js"
import { fetchCompanies } from "../services/company.api.js"
import { useBranchStore } from "../stores/branch.store.js"

const { t } = useI18n()
const toast = useToast()

const authStore = useAuthStore()
const uiStore = useUiStore()
const branchStore = useBranchStore()

const BRANCH_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.BRANCH.VIEW",
    CREATE: "ORGANIZATION.BRANCH.CREATE",
    UPDATE: "ORGANIZATION.BRANCH.UPDATE",
    ARCHIVE: "ORGANIZATION.BRANCH.ARCHIVE",
})

const companies = ref([])
const companyLoading = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedBranchId = ref(null)

const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)

const formErrors = ref({})

const filters = reactive({
    search: "",
    status: "ALL",
    companyId: "",
})

const form = reactive(createEmptyForm())

const canCreate = computed(() =>
    authStore.hasPermission(BRANCH_PERMISSIONS.CREATE),
)

const canUpdate = computed(() =>
    authStore.hasPermission(BRANCH_PERMISSIONS.UPDATE),
)

const canArchive = computed(() =>
    authStore.hasPermission(BRANCH_PERMISSIONS.ARCHIVE),
)

const dialogTitle = computed(() => {
    return dialogMode.value === "create"
        ? t("organization.branch.createTitle")
        : t("organization.branch.editTitle")
})

const companyOptions = computed(() =>
    companies.value.map((company) => ({
        label: `${company.code} - ${company.displayName}`,
        value: company.id,
    })),
)

const companyFilterOptions = computed(() => [
    {
        label: t("organization.branch.allCompanies"),
        value: "",
    },
    ...companyOptions.value,
])

const statusOptions = computed(() => [
    {
        label: t("organization.branch.statusAll"),
        value: "ALL",
    },
    {
        label: t("organization.branch.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.branch.statusInactive"),
        value: "INACTIVE",
    },
    {
        label: t("organization.branch.statusArchived"),
        value: "ARCHIVED",
    },
])

const editableStatusOptions = computed(() => [
    {
        label: t("organization.branch.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.branch.statusInactive"),
        value: "INACTIVE",
    },
])

function createEmptyForm() {
    return {
        companyId: "",
        code: "",
        name: "",
        shortName: "",
        status: "ACTIVE",
        isHeadOffice: false,
        timezone: "Asia/Phnom_Penh",

        contact: {
            email: "",
            phone: "",
        },

        address: {
            addressLine1: "",
            addressLine2: "",
            city: "Phnom Penh",
            stateProvince: "",
            postalCode: "",
            countryCode: "KH",
        },
    }
}

function assignForm(source) {
    const nextForm = source || createEmptyForm()

    form.companyId = nextForm.companyId || ""
    form.code = nextForm.code || ""
    form.name = nextForm.name || ""
    form.shortName = nextForm.shortName || ""
    form.status = nextForm.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"
    form.isHeadOffice = Boolean(nextForm.isHeadOffice)
    form.timezone = nextForm.timezone || "Asia/Phnom_Penh"

    form.contact.email = nextForm.contact?.email || ""
    form.contact.phone = nextForm.contact?.phone || ""

    form.address.addressLine1 = nextForm.address?.addressLine1 || ""
    form.address.addressLine2 = nextForm.address?.addressLine2 || ""
    form.address.city = nextForm.address?.city || ""
    form.address.stateProvince = nextForm.address?.stateProvince || ""
    form.address.postalCode = nextForm.address?.postalCode || ""
    form.address.countryCode = nextForm.address?.countryCode || "KH"
}

function buildCreatePayload() {
    return {
        companyId: form.companyId,
        code: form.code,
        name: form.name,
        shortName: form.shortName,
        status: form.status,
        isHeadOffice: form.isHeadOffice,
        timezone: form.timezone,

        contact: {
            email: form.contact.email,
            phone: form.contact.phone,
        },

        address: {
            addressLine1: form.address.addressLine1,
            addressLine2: form.address.addressLine2,
            city: form.address.city,
            stateProvince: form.address.stateProvince,
            postalCode: form.address.postalCode,
            countryCode: form.address.countryCode,
        },
    }
}

function buildUpdatePayload() {
    return {
        code: form.code,
        name: form.name,
        shortName: form.shortName,
        status: form.status,
        isHeadOffice: form.isHeadOffice,
        timezone: form.timezone,

        contact: {
            email: form.contact.email,
            phone: form.contact.phone,
        },

        address: {
            addressLine1: form.address.addressLine1,
            addressLine2: form.address.addressLine2,
            city: form.address.city,
            stateProvince: form.address.stateProvince,
            postalCode: form.address.postalCode,
            countryCode: form.address.countryCode,
        },
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

function normalizeCountryCodeInput() {
    form.address.countryCode = form.address.countryCode
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 2)
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
        return t("organization.branch.statusActive")
    }

    if (status === "INACTIVE") {
        return t("organization.branch.statusInactive")
    }

    if (status === "ARCHIVED") {
        return t("organization.branch.statusArchived")
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
            summary: t("organization.branch.companyLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        companyLoading.value = false
    }
}

async function loadBranches(params = {}) {
    try {
        await branchStore.loadBranches(params)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.branch.loadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function applyFilters() {
    loadBranches({
        page: 1,
        limit: branchStore.filters.limit,
        search: filters.search,
        status: filters.status,
        companyId: filters.companyId || undefined,
    })
}

function clearFilters() {
    filters.search = ""
    filters.status = "ALL"
    filters.companyId = ""

    loadBranches({
        page: 1,
        search: "",
        status: "ALL",
        companyId: undefined,
    })
}

function onPage(event) {
    loadBranches({
        page: event.page + 1,
        limit: event.rows,
    })
}

async function openCreateDialog() {
    if (companies.value.length === 0) {
        await loadCompanies()
    }

    dialogMode.value = "create"
    selectedBranchId.value = null
    formErrors.value = {}
    assignForm(createEmptyForm())

    if (companies.value.length === 1) {
        form.companyId = companies.value[0].id
    }

    dialogVisible.value = true
}

function openEditDialog(branch) {
    dialogMode.value = "edit"
    selectedBranchId.value = branch.id
    formErrors.value = {}
    assignForm(branch)
    dialogVisible.value = true
}

function closeDialog() {
    dialogVisible.value = false
    selectedBranchId.value = null
    formErrors.value = {}
}

async function saveBranch() {
    formErrors.value = {}

    try {
        if (dialogMode.value === "create") {
            await branchStore.createBranch(buildCreatePayload())

            toast.add({
                severity: "success",
                summary: t("organization.branch.created"),
                detail: t("organization.branch.createdDetail"),
                life: 3000,
            })
        } else {
            await branchStore.updateBranch(
                selectedBranchId.value,
                buildUpdatePayload(),
            )

            toast.add({
                severity: "success",
                summary: t("organization.branch.updated"),
                detail: t("organization.branch.updatedDetail"),
                life: 3000,
            })
        }

        closeDialog()
        await loadBranches()
    } catch (error) {
        applyBackendFieldErrors(error)

        toast.add({
            severity: "error",
            summary: t("organization.branch.saveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function openArchiveDialog(branch) {
    archiveCandidate.value = branch
    archiveDialogVisible.value = true
}

function closeArchiveDialog() {
    archiveDialogVisible.value = false
    archiveCandidate.value = null
}

async function confirmArchiveBranch() {
    if (!archiveCandidate.value?.id) {
        return
    }

    try {
        await branchStore.archiveBranch(archiveCandidate.value.id)

        toast.add({
            severity: "success",
            summary: t("organization.branch.archived"),
            detail: t("organization.branch.archivedDetail"),
            life: 3000,
        })

        closeArchiveDialog()
        await loadBranches()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.branch.archiveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

onMounted(async () => {
    await Promise.all([loadCompanies(), loadBranches()])
})
</script>

<template>
    <section class="branch-page hrms-list-page">
        <AppFilterBar :loading="branchStore.loading">
            <span class="app-filter-field app-filter-field--search branch-search">
                <i class="pi pi-search" />

                <InputText
                    v-model="filters.search"
                    :placeholder="t('organization.branch.searchPlaceholder')"
                    @keyup.enter="applyFilters"
                />
            </span>

            <Select
                v-model="filters.companyId"
                class="app-filter-field branch-company-filter"
                :options="companyFilterOptions"
                option-label="label"
                option-value="value"
                :loading="companyLoading"
                @change="applyFilters"
            />

            <Select
                v-model="filters.status"
                class="app-filter-field branch-status-filter"
                :options="statusOptions"
                option-label="label"
                option-value="value"
                @change="applyFilters"
            />

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
                    class="hrms-icon-button"
                    severity="secondary"
                    outlined
                    icon="pi pi-refresh"
                    :aria-label="t('common.refresh')"
                    @click="loadBranches"
                />

                <Button
                    v-if="canCreate"
                    icon="pi pi-plus"
                    :label="t('organization.branch.newBranch')"
                    @click="openCreateDialog"
                />
            </template>
        </AppFilterBar>

        <div class="hrms-list-card">
            <div class="hrms-table-wrap branch-table-wrap">
                <DataTable
                    lazy
                    paginator
                    striped-rows
                    data-key="id"
                    size="small"
                    scrollable
                    scroll-height="flex"
                    class="hrms-standard-table hrms-standard-table--horizontal"
                    :value="branchStore.items"
                    :loading="branchStore.loading"
                    :rows="branchStore.pagination.limit"
                    :first="
                        (branchStore.pagination.page - 1) *
                        branchStore.pagination.limit
                    "
                    :total-records="branchStore.pagination.total"
                    :rows-per-page-options="[10, 20, 50, 100]"
                    :empty-message="t('organization.branch.empty')"
                    @page="onPage"
                >
                    <Column
                        field="code"
                        :header="t('organization.branch.code')"
                        frozen
                        style="width: 8rem; min-width: 8rem"
                    >
                        <template #body="{ data }">
                            <span class="branch-code">
                                {{ data.code }}
                            </span>
                        </template>
                    </Column>

                    <Column
                        :header="t('organization.branch.branchName')"
                        style="width: 14rem; min-width: 14rem"
                    >
                        <template #body="{ data }">
                            <span class="hrms-cell-primary">
                                {{ data.name || "-" }}
                            </span>
                        </template>
                    </Column>

                    <Column
                        :header="t('organization.branch.company')"
                        style="width: 14rem; min-width: 14rem"
                    >
                        <template #body="{ data }">
                            <span class="hrms-cell-primary">
                                {{ data.company?.displayName || "-" }}
                            </span>
                        </template>
                    </Column>

                    <Column
                        field="status"
                        :header="t('organization.branch.status')"
                        style="width: 9rem; min-width: 9rem"
                    >
                        <template #body="{ data }">
                            <Tag
                                class="hrms-status-tag"
                                :severity="getStatusSeverity(data.status)"
                                :value="getStatusLabel(data.status)"
                            />
                        </template>
                    </Column>

                    <Column
                        :header="t('organization.branch.type')"
                        style="width: 9rem; min-width: 9rem"
                    >
                        <template #body="{ data }">
                            <Tag
                                v-if="data.isHeadOffice"
                                class="hrms-status-tag"
                                severity="info"
                                :value="t('organization.branch.headOffice')"
                            />

                            <span v-else class="hrms-cell-muted">
                                {{ t("organization.branch.branch") }}
                            </span>
                        </template>
                    </Column>

                    <Column
                        :header="t('organization.branch.contact')"
                        style="width: 13rem; min-width: 13rem"
                    >
                        <template #body="{ data }">
                            <div class="hrms-cell-stack">
                                <span class="hrms-cell-secondary">
                                    {{ data.contact?.email || "-" }}
                                </span>
                                <span class="hrms-cell-secondary">
                                    {{ data.contact?.phone || "-" }}
                                </span>
                            </div>
                        </template>
                    </Column>

                    <Column
                        :header="t('organization.branch.location')"
                        style="width: 13rem; min-width: 13rem"
                    >
                        <template #body="{ data }">
                            <div class="hrms-cell-stack">
                                <span class="hrms-cell-secondary">
                                    {{ data.address?.city || "-" }}
                                </span>
                                <span class="hrms-cell-secondary">
                                    {{ data.address?.countryCode || "-" }}
                                </span>
                            </div>
                        </template>
                    </Column>

                    <Column
                        field="updatedAt"
                        :header="t('organization.branch.updatedAt')"
                        style="width: 11rem; min-width: 11rem"
                    >
                        <template #body="{ data }">
                            <span class="hrms-cell-muted">
                                {{ formatDateTime(data.updatedAt) }}
                            </span>
                        </template>
                    </Column>

                    <Column
                        v-if="canUpdate || canArchive"
                        :header="t('common.actions')"
                        align-frozen="right"
                        frozen
                        style="width: 8rem; min-width: 8rem"
                    >
                        <template #body="{ data }">
                            <AppTableActions
                                v-if="data.status !== 'ARCHIVED'"
                                :can-edit="canUpdate"
                                :can-archive="canArchive"
                                :edit-label="t('common.edit')"
                                :archive-label="t('common.archive')"
                                @edit="openEditDialog(data)"
                                @archive="openArchiveDialog(data)"
                            />

                            <span v-else class="hrms-cell-muted">
                                {{ t("organization.branch.readOnly") }}
                            </span>
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
                <section class="hrms-form-section">
                    <h3>{{ t("organization.branch.basicInfo") }}</h3>

                    <div class="hrms-form-grid">
                        <label class="hrms-form-field hrms-form-field--wide">
                            <span>{{ t("organization.branch.company") }}</span>
                            <Select
                                v-model="form.companyId"
                                :disabled="dialogMode === 'edit'"
                                :invalid="Boolean(getFieldError('companyId'))"
                                :options="companyOptions"
                                option-label="label"
                                option-value="value"
                                :placeholder="t('organization.branch.selectCompany')"
                                :loading="companyLoading"
                                @change="clearFieldError('companyId')"
                            />
                            <small v-if="getFieldError('companyId')">
                                {{ getFieldError("companyId") }}
                            </small>
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("organization.branch.code") }}</span>
                            <InputText
                                v-model="form.code"
                                :invalid="Boolean(getFieldError('code'))"
                                autocomplete="off"
                                placeholder="PP-HQ"
                                @input="normalizeCodeInput"
                            />
                            <small v-if="getFieldError('code')">
                                {{ getFieldError("code") }}
                            </small>
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("organization.branch.shortName") }}</span>
                            <InputText
                                v-model="form.shortName"
                                autocomplete="off"
                                placeholder="HQ"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("organization.branch.name") }}</span>
                            <InputText
                                v-model="form.name"
                                :invalid="Boolean(getFieldError('name'))"
                                autocomplete="off"
                                placeholder="Phnom Penh Head Office"
                                @input="clearFieldError('name')"
                            />
                            <small v-if="getFieldError('name')">
                                {{ getFieldError("name") }}
                            </small>
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("organization.branch.status") }}</span>
                            <Select
                                v-model="form.status"
                                :options="editableStatusOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("organization.branch.timezone") }}</span>
                            <InputText
                                v-model="form.timezone"
                                autocomplete="off"
                            />
                        </label>

                        <div class="hrms-form-field">
                            <span>{{ t("organization.branch.type") }}</span>
                            <div class="hrms-dialog-checkbox">
                                <Checkbox
                                    v-model="form.isHeadOffice"
                                    input-id="isHeadOffice"
                                    binary
                                    @change="clearFieldError('isHeadOffice')"
                                />
                                <label for="isHeadOffice">
                                    {{ t("organization.branch.markAsHeadOffice") }}
                                </label>
                            </div>
                            <small v-if="getFieldError('isHeadOffice')">
                                {{ getFieldError("isHeadOffice") }}
                            </small>
                        </div>
                    </div>
                </section>

                <section class="hrms-form-section">
                    <h3>{{ t("organization.branch.contactAddress") }}</h3>

                    <div class="hrms-form-grid">
                        <label class="hrms-form-field">
                            <span>{{ t("organization.branch.email") }}</span>
                            <InputText
                                v-model="form.contact.email"
                                :invalid="Boolean(getFieldError('contact.email'))"
                                autocomplete="off"
                                placeholder="branch@trax.local"
                                @input="clearFieldError('contact.email')"
                            />
                            <small v-if="getFieldError('contact.email')">
                                {{ getFieldError("contact.email") }}
                            </small>
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("organization.branch.phone") }}</span>
                            <InputText
                                v-model="form.contact.phone"
                                autocomplete="off"
                            />
                        </label>

                        <label class="hrms-form-field hrms-form-field--wide">
                            <span>{{ t("organization.branch.addressLine1") }}</span>
                            <Textarea
                                v-model="form.address.addressLine1"
                                rows="2"
                                auto-resize
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("organization.branch.city") }}</span>
                            <InputText
                                v-model="form.address.city"
                                autocomplete="off"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("organization.branch.stateProvince") }}</span>
                            <InputText
                                v-model="form.address.stateProvince"
                                autocomplete="off"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("organization.branch.postalCode") }}</span>
                            <InputText
                                v-model="form.address.postalCode"
                                autocomplete="off"
                            />
                        </label>

                        <label class="hrms-form-field">
                            <span>{{ t("organization.branch.countryCode") }}</span>
                            <InputText
                                v-model="form.address.countryCode"
                                maxlength="2"
                                autocomplete="off"
                                @input="normalizeCountryCodeInput"
                            />
                        </label>
                    </div>
                </section>
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
                    :loading="branchStore.saving"
                    :label="t('common.save')"
                    @click="saveBranch"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="archiveDialogVisible"
            modal
            class="hrms-standard-dialog--small"
            :header="t('organization.branch.archiveTitle')"
            :draggable="false"
        >
            <p class="branch-archive-text">
                {{
                    t("organization.branch.archiveMessage", {
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
                    :loading="branchStore.archiving"
                    :label="t('common.archive')"
                    @click="confirmArchiveBranch"
                />
            </template>
        </Dialog>
    </section>
</template>

<style scoped>
.branch-page {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--hrms-page-gap);
    width: 100%;
    min-width: 0;
    min-height: 0;
}

.branch-search {
    position: relative;
    flex: 1 1 14rem;
    min-width: 11rem;
    max-width: 22rem;
}

.branch-search > i {
    position: absolute;
    top: 50%;
    left: 0.7rem;
    z-index: 1;
    transform: translateY(-50%);
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
    pointer-events: none;
}

.branch-search :deep(.p-inputtext) {
    width: 100%;
    padding-left: 2rem;
    border: 1px solid var(--hrms-border);
}

.branch-company-filter {
    flex: 0 1 15rem;
    min-width: 11rem;
    max-width: 16rem;
}

.branch-status-filter {
    flex: 0 1 10rem;
    min-width: 8.5rem;
    max-width: 11rem;
}

.branch-table-wrap {
    height: calc(100vh - 13.5rem);
    min-height: 25rem;
}

.branch-code {
    color: var(--hrms-primary);
    font-size: 0.74rem;
    font-weight: 400;
}

.branch-page :deep(.p-datatable-thead > tr > th) {
    font-weight: 700;
}

.branch-page :deep(.p-datatable-tbody > tr > td),
.branch-page :deep(.p-datatable-tbody > tr > td *) {
    font-weight: 400;
}

.branch-page :deep(.p-datatable-tbody .p-tag) {
    font-weight: 400;
}

.branch-archive-text {
    margin: 0;
    color: var(--hrms-text);
    font-size: var(--hrms-font-size-md);
    line-height: 1.55;
}

@media (max-width: 760px) {
    .branch-search,
    .branch-company-filter,
    .branch-status-filter {
        flex: 1 1 100%;
        width: 100%;
        min-width: 0;
        max-width: none;
    }

    .branch-table-wrap {
        height: 32rem;
    }
}
</style>
