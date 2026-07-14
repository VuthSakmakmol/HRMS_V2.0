<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useUiStore } from "@/app/stores/ui.store.js"
import AppFilterBar from "@/shared/components/filter/AppFilterBar.vue"
import AppTableActions from "@/shared/components/table/AppTableActions.vue"
import { useCompanyStore } from "../stores/company.store.js"

const { t } = useI18n()
const toast = useToast()

const authStore = useAuthStore()
const uiStore = useUiStore()
const companyStore = useCompanyStore()

const COMPANY_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.COMPANY.VIEW",
    CREATE: "ORGANIZATION.COMPANY.CREATE",
    UPDATE: "ORGANIZATION.COMPANY.UPDATE",
    ARCHIVE: "ORGANIZATION.COMPANY.ARCHIVE",
})

const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedCompanyId = ref(null)

const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)

const formErrors = ref({})

const filters = reactive({
    search: "",
    status: "ALL",
})

const form = reactive(createEmptyForm())

const canCreate = computed(() =>
    authStore.hasPermission(COMPANY_PERMISSIONS.CREATE),
)

const canUpdate = computed(() =>
    authStore.hasPermission(COMPANY_PERMISSIONS.UPDATE),
)

const canArchive = computed(() =>
    authStore.hasPermission(COMPANY_PERMISSIONS.ARCHIVE),
)

const dialogTitle = computed(() => {
    return dialogMode.value === "create"
        ? t("organization.company.createTitle")
        : t("organization.company.editTitle")
})

const statusOptions = computed(() => [
    {
        label: t("organization.company.statusAll"),
        value: "ALL",
    },
    {
        label: t("organization.company.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.company.statusSuspended"),
        value: "SUSPENDED",
    },
    {
        label: t("organization.company.statusArchived"),
        value: "ARCHIVED",
    },
])

const editableStatusOptions = computed(() => [
    {
        label: t("organization.company.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.company.statusSuspended"),
        value: "SUSPENDED",
    },
])

const localeOptions = computed(() => [
    {
        label: "English",
        value: "en-US",
    },
    {
        label: "ខ្មែរ",
        value: "km-KH",
    },
])

const weekStartOptions = computed(() => [
    {
        label: t("organization.company.sunday"),
        value: 0,
    },
    {
        label: t("organization.company.monday"),
        value: 1,
    },
    {
        label: t("organization.company.saturday"),
        value: 6,
    },
])

function createEmptyForm() {
    return {
        code: "",
        legalName: "",
        displayName: "",
        registrationNumber: "",
        taxNumber: "",
        status: "ACTIVE",

        settings: {
            defaultLocale: "en-US",
            timezone: "Asia/Phnom_Penh",
            currencyCode: "USD",
            weekStartsOn: 1,
        },

        contact: {
            email: "",
            phone: "",
            website: "",
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

    form.code = nextForm.code || ""
    form.legalName = nextForm.legalName || ""
    form.displayName = nextForm.displayName || ""
    form.registrationNumber = nextForm.registrationNumber || ""
    form.taxNumber = nextForm.taxNumber || ""
    form.status = nextForm.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE"

    form.settings.defaultLocale =
        nextForm.settings?.defaultLocale || "en-US"
    form.settings.timezone =
        nextForm.settings?.timezone || "Asia/Phnom_Penh"
    form.settings.currencyCode =
        nextForm.settings?.currencyCode || "USD"
    form.settings.weekStartsOn =
        Number(nextForm.settings?.weekStartsOn ?? 1)

    form.contact.email = nextForm.contact?.email || ""
    form.contact.phone = nextForm.contact?.phone || ""
    form.contact.website = nextForm.contact?.website || ""

    form.address.addressLine1 = nextForm.address?.addressLine1 || ""
    form.address.addressLine2 = nextForm.address?.addressLine2 || ""
    form.address.city = nextForm.address?.city || ""
    form.address.stateProvince = nextForm.address?.stateProvince || ""
    form.address.postalCode = nextForm.address?.postalCode || ""
    form.address.countryCode = nextForm.address?.countryCode || "KH"
}

function buildPayload() {
    return {
        code: form.code,
        legalName: form.legalName,
        displayName: form.displayName,
        registrationNumber: form.registrationNumber,
        taxNumber: form.taxNumber,
        status: form.status,

        settings: {
            defaultLocale: form.settings.defaultLocale,
            timezone: form.settings.timezone,
            currencyCode: form.settings.currencyCode,
            weekStartsOn: form.settings.weekStartsOn,
        },

        contact: {
            email: form.contact.email,
            phone: form.contact.phone,
            website: form.contact.website,
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

        return translated === messageKey
            ? t("errors.internal")
            : translated
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

function normalizeCurrencyCodeInput() {
    form.settings.currencyCode = form.settings.currencyCode
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 3)
}

function getStatusSeverity(status) {
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

function getStatusLabel(status) {
    if (status === "ACTIVE") {
        return t("organization.company.statusActive")
    }

    if (status === "SUSPENDED") {
        return t("organization.company.statusSuspended")
    }

    if (status === "ARCHIVED") {
        return t("organization.company.statusArchived")
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

async function loadCompanies(params = {}) {
    try {
        await companyStore.loadCompanies(params)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.company.loadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function applyFilters() {
    loadCompanies({
        page: 1,
        limit: companyStore.filters.limit,
        search: filters.search,
        status: filters.status,
    })
}

function clearFilters() {
    filters.search = ""
    filters.status = "ALL"

    loadCompanies({
        page: 1,
        search: "",
        status: "ALL",
    })
}

function onPage(event) {
    loadCompanies({
        page: event.page + 1,
        limit: event.rows,
    })
}

function openCreateDialog() {
    dialogMode.value = "create"
    selectedCompanyId.value = null
    formErrors.value = {}
    assignForm(createEmptyForm())
    dialogVisible.value = true
}

function openEditDialog(company) {
    dialogMode.value = "edit"
    selectedCompanyId.value = company.id
    formErrors.value = {}
    assignForm(company)
    dialogVisible.value = true
}

function closeDialog() {
    dialogVisible.value = false
    selectedCompanyId.value = null
    formErrors.value = {}
}

async function saveCompany() {
    formErrors.value = {}

    try {
        if (dialogMode.value === "create") {
            await companyStore.createCompany(buildPayload())

            toast.add({
                severity: "success",
                summary: t("organization.company.created"),
                detail: t("organization.company.createdDetail"),
                life: 3000,
            })
        } else {
            await companyStore.updateCompany(
                selectedCompanyId.value,
                buildPayload(),
            )

            toast.add({
                severity: "success",
                summary: t("organization.company.updated"),
                detail: t("organization.company.updatedDetail"),
                life: 3000,
            })
        }

        closeDialog()
        await loadCompanies()
    } catch (error) {
        applyBackendFieldErrors(error)

        toast.add({
            severity: "error",
            summary: t("organization.company.saveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function openArchiveDialog(company) {
    archiveCandidate.value = company
    archiveDialogVisible.value = true
}

function closeArchiveDialog() {
    archiveDialogVisible.value = false
    archiveCandidate.value = null
}

async function confirmArchiveCompany() {
    if (!archiveCandidate.value?.id) {
        return
    }

    try {
        await companyStore.archiveCompany(archiveCandidate.value.id)

        toast.add({
            severity: "success",
            summary: t("organization.company.archived"),
            detail: t("organization.company.archivedDetail"),
            life: 3000,
        })

        closeArchiveDialog()
        await loadCompanies()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.company.archiveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

onMounted(() => {
    loadCompanies()
})
</script>

<template>
    <section class="company-page hrms-list-page">
        <AppFilterBar :loading="companyStore.loading">
            <span class="app-filter-field app-filter-field--search company-search">
                <i class="pi pi-search" />

                <InputText
                    v-model="filters.search"
                    :placeholder="t('organization.company.searchPlaceholder')"
                    @keyup.enter="applyFilters"
                />
            </span>

            <Select
                v-model="filters.status"
                class="app-filter-field company-status-filter"
                :options="statusOptions"
                option-label="label"
                option-value="value"
                @change="applyFilters"
            />

            <template #actions>
                <Button
                    icon="pi pi-filter"
                    :label="t('common.apply')"
                    :loading="companyStore.loading"
                    @click="applyFilters"
                />

                <Button
                    severity="secondary"
                    outlined
                    icon="pi pi-times"
                    :label="t('common.clear')"
                    :disabled="companyStore.loading"
                    @click="clearFilters"
                />

                <Button
                    severity="secondary"
                    outlined
                    icon="pi pi-refresh"
                    :aria-label="t('common.refresh')"
                    :loading="companyStore.loading"
                    @click="loadCompanies"
                />

                <Button
                    v-if="canCreate"
                    icon="pi pi-plus"
                    :label="t('organization.company.newCompany')"
                    :disabled="companyStore.loading"
                    @click="openCreateDialog"
                />
            </template>
        </AppFilterBar>

        <div class="company-table-shell hrms-list-card">
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
                :value="companyStore.items"
                :loading="companyStore.loading"
                :rows="companyStore.pagination.limit"
                :first="
                    (companyStore.pagination.page - 1) *
                    companyStore.pagination.limit
                "
                :total-records="companyStore.pagination.total"
                :rows-per-page-options="[10, 20, 50, 100]"
                :empty-message="t('organization.company.empty')"
                @page="onPage"
            >
                <Column
                    field="code"
                    :header="t('organization.company.code')"
                    frozen
                    style="min-width: 7rem"
                >
                    <template #body="{ data }">
                        <span class="company-code">
                            {{ data.code }}
                        </span>
                    </template>
                </Column>

                <Column
                    field="displayName"
                    :header="t('organization.company.displayName')"
                    style="min-width: 13rem"
                >
                    <template #body="{ data }">
                        <span class="hrms-cell-primary">
                            {{ data.displayName || "-" }}
                        </span>
                    </template>
                </Column>

                <Column
                    field="status"
                    :header="t('organization.company.status')"
                    style="min-width: 8rem"
                >
                    <template #body="{ data }">
                        <Tag
                            class="company-status-tag"
                            :severity="getStatusSeverity(data.status)"
                            :value="getStatusLabel(data.status)"
                        />
                    </template>
                </Column>

                <Column
                    :header="t('organization.company.contact')"
                    style="min-width: 13rem"
                >
                    <template #body="{ data }">
                        <div class="company-stacked-cell company-stacked-cell--muted">
                            <span>{{ data.contact?.email || "-" }}</span>
                            <span>{{ data.contact?.phone || "-" }}</span>
                        </div>
                    </template>
                </Column>

                <Column
                    :header="t('organization.company.location')"
                    style="min-width: 10rem"
                >
                    <template #body="{ data }">
                        <div class="company-stacked-cell company-stacked-cell--muted">
                            <span>{{ data.address?.city || "-" }}</span>
                            <span>{{ data.address?.countryCode || "-" }}</span>
                        </div>
                    </template>
                </Column>

                <Column
                    field="updatedAt"
                    :header="t('organization.company.updatedAt')"
                    style="min-width: 11rem"
                >
                    <template #body="{ data }">
                        <span class="company-date">
                            {{ formatDateTime(data.updatedAt) }}
                        </span>
                    </template>
                </Column>

                <Column
                    v-if="canUpdate || canArchive"
                    :header="t('common.actions')"
                    align-frozen="right"
                    frozen
                    style="min-width: 6.5rem"
                >
                    <template #body="{ data }">
                        <AppTableActions
                            :can-edit="canUpdate && data.status !== 'ARCHIVED'"
                            :can-archive="
                                canArchive && data.status !== 'ARCHIVED'
                            "
                            :edit-label="t('common.edit')"
                            :archive-label="t('common.archive')"
                            :disabled="
                                companyStore.saving || companyStore.archiving
                            "
                            @edit="openEditDialog(data)"
                            @archive="openArchiveDialog(data)"
                        >
                            <template
                                v-if="data.status === 'ARCHIVED'"
                                #after
                            >
                                <span class="company-read-only">
                                    {{ t("organization.company.readOnly") }}
                                </span>
                            </template>
                        </AppTableActions>
                    </template>
                </Column>
            </DataTable>
            </div>
        </div>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            class="company-dialog hrms-standard-dialog"
            :header="dialogTitle"
            :draggable="false"
        >
            <div class="company-form">
                <div class="company-form__section">
                    <h3>{{ t("organization.company.basicInfo") }}</h3>

                    <div class="company-form__grid">
                        <label class="company-field">
                            <span>{{ t("organization.company.code") }}</span>

                            <InputText
                                v-model="form.code"
                                :invalid="Boolean(getFieldError('code'))"
                                autocomplete="off"
                                placeholder="TRAX"
                                @input="normalizeCodeInput"
                            />

                            <small v-if="getFieldError('code')">
                                {{ getFieldError("code") }}
                            </small>
                        </label>

                        <label class="company-field">
                            <span>
                                {{ t("organization.company.displayName") }}
                            </span>

                            <InputText
                                v-model="form.displayName"
                                :invalid="
                                    Boolean(getFieldError('displayName'))
                                "
                                autocomplete="off"
                                placeholder="Trax"
                                @input="clearFieldError('displayName')"
                            />

                            <small v-if="getFieldError('displayName')">
                                {{ getFieldError("displayName") }}
                            </small>
                        </label>

                        <label class="company-field company-field--wide">
                            <span>{{ t("organization.company.legalName") }}</span>

                            <InputText
                                v-model="form.legalName"
                                :invalid="Boolean(getFieldError('legalName'))"
                                autocomplete="off"
                                placeholder="Trax Apparel Cambodia Co., Ltd."
                                @input="clearFieldError('legalName')"
                            />

                            <small v-if="getFieldError('legalName')">
                                {{ getFieldError("legalName") }}
                            </small>
                        </label>

                        <label class="company-field">
                            <span>
                                {{
                                    t(
                                        "organization.company.registrationNumber",
                                    )
                                }}
                            </span>

                            <InputText
                                v-model="form.registrationNumber"
                                autocomplete="off"
                            />
                        </label>

                        <label class="company-field">
                            <span>{{ t("organization.company.taxNumber") }}</span>

                            <InputText
                                v-model="form.taxNumber"
                                autocomplete="off"
                            />
                        </label>

                        <label class="company-field">
                            <span>{{ t("organization.company.status") }}</span>

                            <Select
                                v-model="form.status"
                                :options="editableStatusOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </label>
                    </div>
                </div>

                <div class="company-form__section">
                    <h3>{{ t("organization.company.settings") }}</h3>

                    <div class="company-form__grid">
                        <label class="company-field">
                            <span>
                                {{ t("organization.company.defaultLocale") }}
                            </span>

                            <Select
                                v-model="form.settings.defaultLocale"
                                :options="localeOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </label>

                        <label class="company-field">
                            <span>{{ t("organization.company.timezone") }}</span>

                            <InputText
                                v-model="form.settings.timezone"
                                autocomplete="off"
                            />
                        </label>

                        <label class="company-field">
                            <span>
                                {{ t("organization.company.currencyCode") }}
                            </span>

                            <InputText
                                v-model="form.settings.currencyCode"
                                autocomplete="off"
                                maxlength="3"
                                @input="normalizeCurrencyCodeInput"
                            />
                        </label>

                        <label class="company-field">
                            <span>
                                {{ t("organization.company.weekStartsOn") }}
                            </span>

                            <Select
                                v-model="form.settings.weekStartsOn"
                                :options="weekStartOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </label>
                    </div>
                </div>

                <div class="company-form__section">
                    <h3>{{ t("organization.company.contactAddress") }}</h3>

                    <div class="company-form__grid">
                        <label class="company-field">
                            <span>{{ t("organization.company.email") }}</span>

                            <InputText
                                v-model="form.contact.email"
                                :invalid="
                                    Boolean(getFieldError('contact.email'))
                                "
                                autocomplete="off"
                                placeholder="hr@trax.local"
                                @input="clearFieldError('contact.email')"
                            />

                            <small v-if="getFieldError('contact.email')">
                                {{ getFieldError("contact.email") }}
                            </small>
                        </label>

                        <label class="company-field">
                            <span>{{ t("organization.company.phone") }}</span>

                            <InputText
                                v-model="form.contact.phone"
                                autocomplete="off"
                            />
                        </label>

                        <label class="company-field company-field--wide">
                            <span>{{ t("organization.company.website") }}</span>

                            <InputText
                                v-model="form.contact.website"
                                autocomplete="off"
                            />
                        </label>

                        <label class="company-field company-field--wide">
                            <span>
                                {{ t("organization.company.addressLine1") }}
                            </span>

                            <Textarea
                                v-model="form.address.addressLine1"
                                rows="2"
                                auto-resize
                            />
                        </label>

                        <label class="company-field">
                            <span>{{ t("organization.company.city") }}</span>

                            <InputText
                                v-model="form.address.city"
                                autocomplete="off"
                            />
                        </label>

                        <label class="company-field">
                            <span>
                                {{ t("organization.company.stateProvince") }}
                            </span>

                            <InputText
                                v-model="form.address.stateProvince"
                                autocomplete="off"
                            />
                        </label>

                        <label class="company-field">
                            <span>
                                {{ t("organization.company.postalCode") }}
                            </span>

                            <InputText
                                v-model="form.address.postalCode"
                                autocomplete="off"
                            />
                        </label>

                        <label class="company-field">
                            <span>
                                {{ t("organization.company.countryCode") }}
                            </span>

                            <InputText
                                v-model="form.address.countryCode"
                                maxlength="2"
                                autocomplete="off"
                                @input="normalizeCountryCodeInput"
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
                    :loading="companyStore.saving"
                    :label="t('common.save')"
                    @click="saveCompany"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="archiveDialogVisible"
            modal
            class="company-archive-dialog hrms-standard-dialog--small"
            :header="t('organization.company.archiveTitle')"
            :draggable="false"
        >
            <p class="company-archive-text">
                {{
                    t("organization.company.archiveMessage", {
                        name: archiveCandidate?.displayName || "-",
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
                    :loading="companyStore.archiving"
                    :label="t('common.archive')"
                    @click="confirmArchiveCompany"
                />
            </template>
        </Dialog>
    </section>
</template>

<style scoped>
.company-page {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--hrms-page-gap);
    width: 100%;
    min-width: 0;
    min-height: 0;
}

.company-search {
    position: relative;
    flex: 1 1 14rem;
    min-width: 11rem;
    max-width: 22rem;
}

.company-search > i {
    position: absolute;
    top: 50%;
    left: 0.7rem;
    z-index: 1;
    transform: translateY(-50%);
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
    pointer-events: none;
}

.company-search :deep(.p-inputtext) {
    width: 100%;
    padding-left: 2rem;
    border: 1px solid var(--hrms-border);
}

.company-status-filter {
    flex: 0 1 10rem;
    min-width: 8.5rem;
    max-width: 11rem;
}

.company-table-shell {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--hrms-surface);
}

.company-code {
    color: var(--hrms-primary);
    font-size: 0.74rem;
    font-weight: 400;
}

.company-stacked-cell {
    display: grid;
    justify-items: center;
    gap: 0.1rem;
    min-width: 0;
    line-height: 1.25;
}

.company-stacked-cell strong,
.company-stacked-cell span {
    display: block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.company-stacked-cell strong {
    color: var(--hrms-text);
    font-size: 0.74rem;
    font-weight: 700;
}

.company-stacked-cell span,
.company-date,
.company-read-only {
    color: var(--hrms-text-muted);
    font-size: 0.68rem;
}

.company-stacked-cell--muted span:first-child {
    color: var(--hrms-text);
}

.company-status-tag {
    min-width: 4.7rem;
    justify-content: center;
}

.company-read-only {
    white-space: nowrap;
}

.company-dialog {
    width: min(58rem, calc(100vw - 1.25rem));
}

.company-archive-dialog {
    width: min(29rem, calc(100vw - 1.25rem));
}

.company-form {
    display: grid;
    gap: 0.65rem;
}

.company-form__section {
    display: grid;
    gap: 0.55rem;
    padding: 0.7rem;
    background: var(--hrms-surface-muted);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
}

.company-form__section h3 {
    margin: 0;
    color: var(--hrms-text);
    font-size: 0.76rem;
    font-weight: 800;
}

.company-form__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.55rem;
}

.company-field {
    display: grid;
    align-content: start;
    gap: 0.25rem;
    min-width: 0;
}

.company-field--wide {
    grid-column: span 2;
}

.company-field > span {
    color: var(--hrms-text-muted);
    font-size: 0.68rem;
    font-weight: 700;
}

.company-field small {
    color: var(--hrms-danger);
    font-size: 0.65rem;
}

.company-field :deep(.p-component),
.company-field :deep(.p-inputtext),
.company-field :deep(.p-select),
.company-field :deep(.p-textarea) {
    width: 100%;
}

.company-archive-text {
    margin: 0;
    color: var(--hrms-text);
    font-size: 0.78rem;
    line-height: 1.55;
}

:deep(.p-datatable) {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    font-size: 0.72rem;
}

:deep(.p-datatable-table-container) {
    flex: 1 1 auto;
}

:deep(.p-datatable-thead > tr > th) {
    padding: 0.55rem 0.5rem;
    color: var(--hrms-text);
    background: var(--hrms-surface-muted);
    border-color: var(--hrms-border);
    font-size: 0.68rem;
    font-weight: 800;
    text-align: center;
    vertical-align: middle;
    white-space: nowrap;
}

:deep(.p-datatable-tbody > tr > td) {
    padding: 0.45rem 0.5rem;
    border-color: var(--hrms-border);
    font-weight: 400 !important;
    text-align: center;
    vertical-align: middle;
}

:deep(.p-datatable-tbody > tr > td strong),
:deep(.p-datatable-tbody > tr > td span),
:deep(.p-datatable-tbody > tr > td div) {
    font-weight: 400 !important;
}

:deep(.p-datatable-tbody > tr:hover) {
    background: var(--hrms-surface-hover);
}

:deep(.p-paginator) {
    min-height: 2.6rem;
    padding: 0.35rem 0.5rem;
    border-top: 1px solid var(--hrms-border);
    background: var(--hrms-surface);
}

:deep(.p-tag) {
    padding: 0.18rem 0.45rem;
    font-size: 0.64rem;
    font-weight: 800;
}

:deep(.p-dialog-header) {
    padding: 0.75rem 0.9rem;
    border-bottom: 1px solid var(--hrms-border);
}

:deep(.p-dialog-title) {
    font-size: 0.88rem;
    font-weight: 800;
}

:deep(.p-dialog-content) {
    max-height: min(72vh, 42rem);
    padding: 0.75rem 0.9rem;
    overflow-y: auto;
}

:deep(.p-dialog-footer) {
    position: sticky;
    bottom: 0;
    z-index: 2;
    padding: 0.65rem 0.9rem;
    background: var(--hrms-surface);
    border-top: 1px solid var(--hrms-border);
}

@media (max-width: 900px) {
    .company-form__grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .company-field--wide {
        grid-column: 1 / -1;
    }
}

@media (max-width: 520px) {
    .company-search,
    .company-status-filter {
        width: 100%;
        min-width: 0;
        max-width: none;
    }

    .company-form__grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .company-field--wide {
        grid-column: auto;
    }

    :deep(.p-dialog-footer) {
        display: flex;
    }

    :deep(.p-dialog-footer .p-button) {
        flex: 1 1 auto;
    }
}
</style>
