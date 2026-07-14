<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { apiClient } from "@/shared/services/apiClient.js"
import { useAuthStore } from "@/app/stores/auth.store.js"
import { useExitReasonStore } from "../stores/exitReason.store.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const exitReasonStore = useExitReasonStore()

const PERMISSIONS = Object.freeze({
    CREATE: "ORGANIZATION.EXIT_REASON.CREATE",
    UPDATE: "ORGANIZATION.EXIT_REASON.UPDATE",
    ARCHIVE: "ORGANIZATION.EXIT_REASON.ARCHIVE",
})

const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.CREATE))
const canUpdate = computed(() => authStore.hasPermission(PERMISSIONS.UPDATE))
const canArchive = computed(() => authStore.hasPermission(PERMISSIONS.ARCHIVE))

const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedId = ref(null)
const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)
const formErrors = ref({})
const lookupLoading = ref(false)

const lookups = reactive({
    companies: [],
    branches: [],
})

const filters = reactive({
    search: "",
    status: "ACTIVE",
    companyId: "",
    branchId: "",
})

const form = reactive(createEmptyForm())

const statusOptions = computed(() => [
    { label: t("common.active"), value: "ACTIVE" },
    { label: t("common.inactive"), value: "INACTIVE" },
    { label: t("common.archived"), value: "ARCHIVED" },
    { label: t("common.all"), value: "ALL" },
])

const statusEditOptions = computed(() => [
    { label: t("common.active"), value: "ACTIVE" },
    { label: t("common.inactive"), value: "INACTIVE" },
])

const companyOptions = computed(() => [
    { label: t("organization.exitReason.global"), value: "" },
    ...mapOptions(lookups.companies, "displayName"),
])

const branchOptions = computed(() => {
    const branches = lookups.branches.filter((branch) =>
        !form.companyId ? false : branch.companyId === form.companyId,
    )

    return [
        { label: t("organization.exitReason.allBranches"), value: "" },
        ...mapOptions(branches, "name"),
    ]
})

const filterBranchOptions = computed(() => {
    const branches = lookups.branches.filter((branch) =>
        !filters.companyId ? true : branch.companyId === filters.companyId,
    )

    return [
        { label: t("organization.exitReason.allBranches"), value: "" },
        ...mapOptions(branches, "name"),
    ]
})

const dialogTitle = computed(() =>
    dialogMode.value === "create"
        ? t("organization.exitReason.createTitle")
        : t("organization.exitReason.editTitle"),
)

function createEmptyForm() {
    return {
        companyId: "",
        branchId: "",
        code: "",
        name: "",
        shortName: "",
        description: "",
        sortOrder: 0,
        status: "ACTIVE",
    }
}

function assignForm(source = {}) {
    Object.assign(form, createEmptyForm(), {
        ...source,
        companyId: source.companyId || "",
        branchId: source.branchId || "",
    })
}

function optionLabel(item, primary = "name") {
    const code = item.code || ""
    const label = item[primary] || item.name || item.displayName || item.legalName || code

    return code ? `${code} - ${label}` : label
}

function mapOptions(items = [], primary = "name") {
    return items.map((item) => ({
        label: optionLabel(item, primary),
        value: item.id,
    }))
}

function normalizeCode() {
    form.code = String(form.code || "")
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_-]/g, "")
}

function cleanParams(params = {}) {
    const clean = {}

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") continue
        clean[key] = value
    }

    return clean
}

async function fetchList(endpoint, params = {}) {
    const response = await apiClient.get(endpoint, {
        params: cleanParams({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            ...params,
        }),
    })

    return response.data.data?.items || []
}

async function loadLookups() {
    lookupLoading.value = true

    try {
        const [companies, branches] = await Promise.all([
            fetchList("/organization/companies"),
            fetchList("/organization/branches"),
        ])

        lookups.companies = companies
        lookups.branches = branches
    } finally {
        lookupLoading.value = false
    }
}

async function loadExitReasons(params = {}) {
    try {
        await exitReasonStore.loadExitReasons({
            page: 1,
            limit: exitReasonStore.pagination.limit || 20,
            ...filters,
            ...params,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.exitReason.loadFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function applyFilters() {
    loadExitReasons({ page: 1 })
}

function clearFilters() {
    Object.assign(filters, {
        search: "",
        status: "ACTIVE",
        companyId: "",
        branchId: "",
    })

    applyFilters()
}

function onPage(event) {
    loadExitReasons({
        page: event.page + 1,
        limit: event.rows,
    })
}

function openCreateDialog() {
    formErrors.value = {}
    selectedId.value = null
    dialogMode.value = "create"
    assignForm()
    dialogVisible.value = true
}

function openEditDialog(item) {
    formErrors.value = {}
    selectedId.value = item.id
    dialogMode.value = "edit"
    assignForm(item)
    dialogVisible.value = true
}

function buildPayload() {
    return {
        companyId: form.companyId || null,
        branchId: form.branchId || null,
        code: form.code,
        name: form.name,
        shortName: form.shortName,
        description: form.description,
        sortOrder: Number(form.sortOrder || 0),
        status: form.status,
    }
}

async function saveExitReason() {
    formErrors.value = {}

    try {
        if (dialogMode.value === "create") {
            await exitReasonStore.createExitReason(buildPayload())
        } else {
            await exitReasonStore.updateExitReason(selectedId.value, buildPayload())
        }

        toast.add({
            severity: "success",
            summary: t("organization.exitReason.saved"),
            life: 3000,
        })

        dialogVisible.value = false
        await loadExitReasons()
    } catch (error) {
        applyBackendErrors(error)
        toast.add({
            severity: "error",
            summary: t("organization.exitReason.saveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function openArchiveDialog(item) {
    archiveCandidate.value = item
    archiveDialogVisible.value = true
}

async function confirmArchive() {
    try {
        await exitReasonStore.archiveExitReason(archiveCandidate.value.id)

        toast.add({
            severity: "success",
            summary: t("organization.exitReason.archived"),
            life: 3000,
        })

        archiveDialogVisible.value = false
        archiveCandidate.value = null
        await loadExitReasons()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.exitReason.archiveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function applyBackendErrors(error) {
    formErrors.value = error?.response?.data?.error?.fields || {}
}

function fieldError(field) {
    const value = formErrors.value[field]

    return Array.isArray(value) ? value[0] : ""
}

function getErrorMessage(error) {
    const key = error?.response?.data?.error?.messageKey

    if (key) {
        const translated = t(key)

        return translated === key ? key : translated
    }

    return error?.message || t("common.somethingWentWrong")
}

function statusSeverity(status) {
    if (status === "ACTIVE") return "success"
    if (status === "INACTIVE") return "warn"
    if (status === "ARCHIVED") return "danger"

    return "secondary"
}

function scopeLabel(item) {
    const company = item.company?.displayName || item.company?.name || item.company?.code
    const branch = item.branch?.name || item.branch?.code

    if (company && branch) return `${company} / ${branch}`
    if (company) return company

    return t("organization.exitReason.global")
}

onMounted(async () => {
    await Promise.all([
        loadLookups(),
        loadExitReasons(),
    ])
})
</script>

<template>
    <section class="exit-reason-page hrms-compact">
        <div class="exit-reason-toolbar">
            <InputText
                v-model="filters.search"
                class="exit-reason-toolbar__search"
                :placeholder="t('common.search')"
                @keyup.enter="applyFilters"
            />

            <Select
                v-model="filters.status"
                :options="statusOptions"
                option-label="label"
                option-value="value"
            />

            <Select
                v-model="filters.companyId"
                :options="companyOptions"
                option-label="label"
                option-value="value"
                :loading="lookupLoading"
                @change="filters.branchId = ''"
            />

            <Select
                v-model="filters.branchId"
                :options="filterBranchOptions"
                option-label="label"
                option-value="value"
                :disabled="!filters.companyId"
                :loading="lookupLoading"
            />

            <Button
                icon="pi pi-filter"
                :label="t('common.apply')"
                @click="applyFilters"
            />

            <Button
                outlined
                severity="secondary"
                icon="pi pi-times"
                :label="t('common.clear')"
                @click="clearFilters"
            />

            <Button
                v-if="canCreate"
                icon="pi pi-plus"
                :label="t('common.create')"
                @click="openCreateDialog"
            />
        </div>

        <div class="exit-reason-table-card">
            <DataTable
                lazy
                paginator
                striped-rows
                size="small"
                data-key="id"
                :value="exitReasonStore.items"
                :loading="exitReasonStore.loading"
                :rows="exitReasonStore.pagination.limit"
                :first="(exitReasonStore.pagination.page - 1) * exitReasonStore.pagination.limit"
                :total-records="exitReasonStore.pagination.total"
                @page="onPage"
            >
                <Column
                    field="code"
                    :header="t('common.code')"
                    style="width: 9rem"
                />

                <Column
                    field="name"
                    :header="t('common.name')"
                    style="min-width: 18rem"
                />

                <Column
                    :header="t('organization.exitReason.scope')"
                    style="min-width: 16rem"
                >
                    <template #body="{ data }">
                        {{ scopeLabel(data) }}
                    </template>
                </Column>

                <Column
                    field="sortOrder"
                    :header="t('organization.exitReason.sortOrder')"
                    style="width: 7rem"
                />

                <Column
                    :header="t('common.status')"
                    style="width: 8rem"
                >
                    <template #body="{ data }">
                        <Tag
                            :severity="statusSeverity(data.status)"
                            :value="t(`common.${String(data.status || '').toLowerCase()}`)"
                        />
                    </template>
                </Column>

                <Column
                    :header="t('common.actions')"
                    style="width: 11rem"
                >
                    <template #body="{ data }">
                        <div class="exit-reason-actions">
                            <Button
                                v-if="canUpdate && data.status !== 'ARCHIVED'"
                                text
                                rounded
                                icon="pi pi-pencil"
                                @click="openEditDialog(data)"
                            />

                            <Button
                                v-if="canArchive && data.status !== 'ARCHIVED'"
                                text
                                rounded
                                severity="danger"
                                icon="pi pi-archive"
                                @click="openArchiveDialog(data)"
                            />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            :header="dialogTitle"
            :draggable="false"
            class="exit-reason-dialog"
        >
            <div class="exit-reason-form">
                <label>
                    <span>{{ t('common.code') }}</span>
                    <InputText
                        v-model="form.code"
                        :disabled="dialogMode === 'edit'"
                        @input="normalizeCode"
                    />
                    <small v-if="fieldError('code')">{{ fieldError('code') }}</small>
                </label>

                <label>
                    <span>{{ t('common.name') }}</span>
                    <InputText v-model="form.name" />
                    <small v-if="fieldError('name')">{{ fieldError('name') }}</small>
                </label>

                <label>
                    <span>{{ t('organization.exitReason.shortName') }}</span>
                    <InputText v-model="form.shortName" />
                </label>

                <label>
                    <span>{{ t('organization.exitReason.sortOrder') }}</span>
                    <InputNumber
                        v-model="form.sortOrder"
                        :min="0"
                        :max="9999"
                    />
                </label>

                <label>
                    <span>{{ t('organization.exitReason.companyScope') }}</span>
                    <Select
                        v-model="form.companyId"
                        :options="companyOptions"
                        option-label="label"
                        option-value="value"
                        :loading="lookupLoading"
                        @change="form.branchId = ''"
                    />
                </label>

                <label>
                    <span>{{ t('organization.exitReason.branchScope') }}</span>
                    <Select
                        v-model="form.branchId"
                        :options="branchOptions"
                        option-label="label"
                        option-value="value"
                        :disabled="!form.companyId"
                        :loading="lookupLoading"
                    />
                </label>

                <label>
                    <span>{{ t('common.status') }}</span>
                    <Select
                        v-model="form.status"
                        :options="statusEditOptions"
                        option-label="label"
                        option-value="value"
                    />
                </label>

                <label class="exit-reason-form__wide">
                    <span>{{ t('common.description') }}</span>
                    <Textarea
                        v-model="form.description"
                        rows="3"
                        auto-resize
                    />
                </label>
            </div>

            <template #footer>
                <Button
                    outlined
                    severity="secondary"
                    :label="t('common.cancel')"
                    @click="dialogVisible = false"
                />

                <Button
                    icon="pi pi-save"
                    :label="t('common.save')"
                    :loading="exitReasonStore.saving"
                    @click="saveExitReason"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="archiveDialogVisible"
            modal
            :header="t('organization.exitReason.archiveTitle')"
            :draggable="false"
            class="exit-reason-archive-dialog"
        >
            <p>
                {{ t('organization.exitReason.archiveMessage', { name: archiveCandidate?.name || '-' }) }}
            </p>

            <template #footer>
                <Button
                    outlined
                    severity="secondary"
                    :label="t('common.cancel')"
                    @click="archiveDialogVisible = false"
                />

                <Button
                    severity="danger"
                    icon="pi pi-archive"
                    :label="t('common.archive')"
                    :loading="exitReasonStore.archiving"
                    @click="confirmArchive"
                />
            </template>
        </Dialog>
    </section>
</template>

<style scoped>
.exit-reason-page {
    display: grid;
    gap: 0.75rem;
    width: 100%;
}

.exit-reason-toolbar {
    display: grid;
    grid-template-columns: minmax(14rem, 1.2fr) repeat(3, minmax(11rem, 1fr)) auto auto auto;
    gap: 0.5rem;
    align-items: center;
    padding: 0.75rem;
    border: 1px solid var(--hrms-border-color, #dbe3ef);
    border-radius: 0.85rem;
    background: var(--hrms-surface-card, #ffffff);
}

.exit-reason-toolbar__search {
    width: 100%;
}

.exit-reason-table-card {
    overflow: hidden;
    border: 1px solid var(--hrms-border-color, #dbe3ef);
    border-radius: 0.85rem;
    background: var(--hrms-surface-card, #ffffff);
}

.exit-reason-actions {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    width: 100%;
}

.exit-reason-dialog {
    width: min(46rem, calc(100vw - 2rem));
}

.exit-reason-form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}

.exit-reason-form label {
    display: grid;
    gap: 0.35rem;
}

.exit-reason-form span {
    color: var(--hrms-text-muted, #64748b);
    font-size: 0.72rem;
    font-weight: 800;
}

.exit-reason-form small {
    color: var(--hrms-color-danger, #ef4444);
    font-size: 0.68rem;
}

.exit-reason-form__wide {
    grid-column: 1 / -1;
}

.exit-reason-archive-dialog {
    width: min(30rem, calc(100vw - 2rem));
}

@media (max-width: 980px) {
    .exit-reason-toolbar {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 640px) {
    .exit-reason-toolbar,
    .exit-reason-form {
        grid-template-columns: 1fr;
    }
}
</style>
