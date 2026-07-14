<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Card from "primevue/card"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { apiClient } from "@/shared/services/apiClient.js"

import { useRecruitmentChannelStore } from "../stores/recruitmentChannel.store.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const recruitmentChannelStore = useRecruitmentChannelStore()

const PERMISSIONS = Object.freeze({
    CREATE: "ORGANIZATION.RECRUITMENT_CHANNEL.CREATE",
    UPDATE: "ORGANIZATION.RECRUITMENT_CHANNEL.UPDATE",
    ARCHIVE: "ORGANIZATION.RECRUITMENT_CHANNEL.ARCHIVE",
})

const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.CREATE))
const canUpdate = computed(() => authStore.hasPermission(PERMISSIONS.UPDATE))
const canArchive = computed(() => authStore.hasPermission(PERMISSIONS.ARCHIVE))

const companies = ref([])
const branches = ref([])
const lookupLoading = ref(false)
const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedRecruitmentChannelId = ref(null)
const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)
const formErrors = ref({})

const filters = reactive({
    search: "",
    status: "ALL",
    companyId: "",
    branchId: "",
})

const form = reactive(createEmptyForm())

const dialogTitle = computed(() =>
    dialogMode.value === "create"
        ? t("organization.recruitmentChannel.createTitle")
        : t("organization.recruitmentChannel.editTitle"),
)

const companyOptions = computed(() =>
    companies.value.map((company) => ({
        label: `${company.code} - ${company.displayName || company.name || company.legalName}`,
        value: company.id,
    })),
)

const branchOptions = computed(() =>
    branches.value
        .filter((branch) => {
            if (!form.companyId) return true
            return branch.companyId === form.companyId
        })
        .map((branch) => ({
            label: `${branch.code} - ${branch.name}`,
            value: branch.id,
        })),
)

const branchFilterOptions = computed(() =>
    branches.value
        .filter((branch) => {
            if (!filters.companyId) return true
            return branch.companyId === filters.companyId
        })
        .map((branch) => ({
            label: `${branch.code} - ${branch.name}`,
            value: branch.id,
        })),
)

const statusOptions = computed(() => [
    {
        label: t("organization.recruitmentChannel.statusAll"),
        value: "ALL",
    },
    {
        label: t("organization.recruitmentChannel.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.recruitmentChannel.statusInactive"),
        value: "INACTIVE",
    },
    {
        label: t("organization.recruitmentChannel.statusArchived"),
        value: "ARCHIVED",
    },
])

const editableStatusOptions = computed(() => [
    {
        label: t("organization.recruitmentChannel.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.recruitmentChannel.statusInactive"),
        value: "INACTIVE",
    },
])

function createEmptyForm() {
    return {
        companyId: "",
        branchId: "",
        code: "",
        name: "",
        shortName: "",
        targetMonthly: 0,
        sortOrder: 0,
        description: "",
        status: "ACTIVE",
    }
}

function assignForm(source = createEmptyForm()) {
    Object.assign(form, {
        ...createEmptyForm(),
        ...source,
        companyId: source.companyId || "",
        branchId: source.branchId || "",
        targetMonthly: Number(source.targetMonthly || 0),
        sortOrder: Number(source.sortOrder || 0),
        status: source.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    })
}

function cleanParams(params = {}) {
    const clean = {}

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") continue
        clean[key] = value
    }

    return clean
}

async function fetchAllPages(endpoint, params = {}) {
    const items = []
    let page = 1
    let totalPages = 1

    do {
        const response = await apiClient.get(endpoint, {
            params: cleanParams({
                page,
                limit: 100,
                status: "ACTIVE",
                ...params,
            }),
        })
        const data = response.data.data || {}
        const pageItems = data.items || []
        const pagination = data.pagination || {}

        items.push(...pageItems)
        totalPages = Number(pagination.totalPages || pagination.pages || 1)
        page += 1
    } while (page <= totalPages)

    return items
}

async function loadLookups() {
    lookupLoading.value = true

    try {
        const [companyItems, branchItems] = await Promise.all([
            fetchAllPages("/organization/companies"),
            fetchAllPages("/organization/branches"),
        ])

        companies.value = companyItems
        branches.value = branchItems
    } catch (error) {
        toast.add({
            severity: "warn",
            summary: t("organization.recruitmentChannel.lookupLoadFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    } finally {
        lookupLoading.value = false
    }
}

function normalizeCode() {
    form.code = form.code
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_-]/g, "")
    clearFieldError("code")
}

function getErrorMessage(error) {
    const messageKey = error?.response?.data?.error?.messageKey

    if (messageKey) {
        const translated = t(messageKey)
        return translated === messageKey ? messageKey : translated
    }

    return error?.message || t("errors.internal")
}

function applyBackendFieldErrors(error) {
    const fields = error?.response?.data?.error?.fields || {}
    const nextErrors = {}

    for (const [field, messages] of Object.entries(fields)) {
        nextErrors[field] = Array.isArray(messages)
            ? messages.map((messageKey) => {
                  const translated = t(messageKey)
                  return translated === messageKey ? messageKey : translated
              })
            : [t("errors.validationFailed")]
    }

    formErrors.value = nextErrors
}

function fieldError(fieldName) {
    const value = formErrors.value[fieldName]
    return Array.isArray(value) ? value[0] : ""
}

function clearFieldError(fieldName) {
    if (!formErrors.value[fieldName]) return

    formErrors.value = {
        ...formErrors.value,
        [fieldName]: undefined,
    }
}

function statusSeverity(status) {
    if (status === "ACTIVE") return "success"
    if (status === "INACTIVE") return "warn"
    if (status === "ARCHIVED") return "danger"
    return "secondary"
}

function scopeLabel(data) {
    if (data.branch) {
        return `${data.branch.code} - ${data.branch.name}`
    }

    if (data.company) {
        return `${data.company.code} - ${data.company.displayName || data.company.name}`
    }

    return t("organization.recruitmentChannel.global")
}

function buildPayload() {
    return {
        companyId: form.companyId || null,
        branchId: form.branchId || null,
        code: form.code,
        name: form.name,
        shortName: form.shortName,
        targetMonthly: Number(form.targetMonthly || 0),
        sortOrder: Number(form.sortOrder || 0),
        description: form.description,
        status: form.status,
    }
}

function applyFilters() {
    recruitmentChannelStore.loadRecruitmentChannels({
        page: 1,
        search: filters.search,
        status: filters.status,
        companyId: filters.companyId || undefined,
        branchId: filters.branchId || undefined,
    })
}

function clearFilters() {
    Object.assign(filters, {
        search: "",
        status: "ALL",
        companyId: "",
        branchId: "",
    })
    applyFilters()
}

function onCompanyFilterChange() {
    filters.branchId = ""
    applyFilters()
}

function onCompanyFormChange() {
    form.branchId = ""
    clearFieldError("companyId")
}

function openCreateDialog() {
    formErrors.value = {}
    dialogMode.value = "create"
    selectedRecruitmentChannelId.value = null
    assignForm(createEmptyForm())
    dialogVisible.value = true
}

function openEditDialog(item) {
    formErrors.value = {}
    dialogMode.value = "edit"
    selectedRecruitmentChannelId.value = item.id
    assignForm(item)
    dialogVisible.value = true
}

async function saveRecruitmentChannel() {
    formErrors.value = {}

    try {
        if (dialogMode.value === "create") {
            await recruitmentChannelStore.createRecruitmentChannel(buildPayload())
        } else {
            await recruitmentChannelStore.updateRecruitmentChannel(
                selectedRecruitmentChannelId.value,
                buildPayload(),
            )
        }

        toast.add({
            severity: "success",
            summary: t("organization.recruitmentChannel.saved"),
            life: 3000,
        })

        dialogVisible.value = false
        await recruitmentChannelStore.loadRecruitmentChannels()
    } catch (error) {
        applyBackendFieldErrors(error)
        toast.add({
            severity: "error",
            summary: t("organization.recruitmentChannel.saveFailed"),
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
    if (!archiveCandidate.value) return

    try {
        await recruitmentChannelStore.archiveRecruitmentChannel(archiveCandidate.value.id)
        archiveDialogVisible.value = false
        archiveCandidate.value = null

        toast.add({
            severity: "success",
            summary: t("organization.recruitmentChannel.archived"),
            life: 3000,
        })

        await recruitmentChannelStore.loadRecruitmentChannels()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.recruitmentChannel.archiveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function onPage(event) {
    recruitmentChannelStore.loadRecruitmentChannels({
        page: event.page + 1,
        limit: event.rows,
    })
}

onMounted(async () => {
    await Promise.all([
        loadLookups(),
        recruitmentChannelStore.loadRecruitmentChannels(),
    ])
})
</script>

<template>
    <section class="recruitment-channel-page enterprise-list-page">
        <div class="enterprise-list-toolbar recruitment-channel-toolbar">
            <span class="enterprise-search">
                <i class="pi pi-search" />
                <InputText
                    v-model="filters.search"
                    :placeholder="t('organization.recruitmentChannel.searchPlaceholder')"
                    @keyup.enter="applyFilters"
                />
            </span>

            <Select
                v-model="filters.companyId"
                :options="[
                    {
                        label: t('organization.recruitmentChannel.allCompanies'),
                        value: '',
                    },
                    ...companyOptions,
                ]"
                option-label="label"
                option-value="value"
                :placeholder="t('organization.recruitmentChannel.company')"
                @change="onCompanyFilterChange"
            />

            <Select
                v-model="filters.branchId"
                :options="[
                    {
                        label: t('organization.recruitmentChannel.allBranches'),
                        value: '',
                    },
                    ...branchFilterOptions,
                ]"
                option-label="label"
                option-value="value"
                :placeholder="t('organization.recruitmentChannel.branch')"
                @change="applyFilters"
            />

            <Select
                v-model="filters.status"
                :options="statusOptions"
                option-label="label"
                option-value="value"
                @change="applyFilters"
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
                class="enterprise-toolbar-primary"
                icon="pi pi-plus"
                :label="t('organization.recruitmentChannel.create')"
                @click="openCreateDialog"
            />
        </div>

        <Card class="enterprise-list-card">
            <template #content>
                <DataTable
                    lazy
                    paginator
                    striped-rows
                    size="small"
                    scrollable
                    scroll-height="flex"
                    data-key="id"
                    :value="recruitmentChannelStore.items"
                    :loading="recruitmentChannelStore.loading || lookupLoading"
                    :rows="recruitmentChannelStore.pagination.limit"
                    :first="(recruitmentChannelStore.pagination.page - 1) * recruitmentChannelStore.pagination.limit"
                    :total-records="recruitmentChannelStore.pagination.total"
                    :rows-per-page-options="[10, 20, 50, 100]"
                    @page="onPage"
                >
                    <Column
                        field="code"
                        :header="t('organization.recruitmentChannel.code')"
                        style="min-width: 9rem"
                    >
                        <template #body="{ data }">
                            <strong class="enterprise-code">{{ data.code }}</strong>
                        </template>
                    </Column>

                    <Column
                        :header="t('organization.recruitmentChannel.name')"
                        style="min-width: 18rem"
                    >
                        <template #body="{ data }">
                            <div class="enterprise-cell-stack">
                                <strong>{{ data.name }}</strong>
                                <span v-if="data.shortName">{{ data.shortName }}</span>
                            </div>
                        </template>
                    </Column>

                    <Column
                        :header="t('organization.recruitmentChannel.scope')"
                        style="min-width: 14rem"
                    >
                        <template #body="{ data }">
                            {{ scopeLabel(data) }}
                        </template>
                    </Column>

                    <Column
                        field="targetMonthly"
                        :header="t('organization.recruitmentChannel.targetMonthly')"
                        style="min-width: 8rem"
                    />

                    <Column
                        field="sortOrder"
                        :header="t('organization.recruitmentChannel.sortOrder')"
                        style="min-width: 7rem"
                    />

                    <Column
                        :header="t('organization.recruitmentChannel.status')"
                        style="min-width: 8rem"
                    >
                        <template #body="{ data }">
                            <Tag
                                :severity="statusSeverity(data.status)"
                                :value="t(`organization.recruitmentChannel.status${data.status.charAt(0)}${data.status.slice(1).toLowerCase()}`)"
                            />
                        </template>
                    </Column>

                    <Column
                        :header="t('common.actions')"
                        frozen
                        align-frozen="right"
                        style="min-width: 8rem"
                    >
                        <template #body="{ data }">
                            <div class="enterprise-actions">
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
            </template>
        </Card>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            :header="dialogTitle"
            :draggable="false"
            class="recruitment-channel-dialog"
        >
            <div class="recruitment-channel-form">
                <label>
                    <span>{{ t('organization.recruitmentChannel.company') }}</span>
                    <Select
                        v-model="form.companyId"
                        show-clear
                        :loading="lookupLoading"
                        :options="companyOptions"
                        option-label="label"
                        option-value="value"
                        :placeholder="t('organization.recruitmentChannel.globalCompany')"
                        @change="onCompanyFormChange"
                    />
                    <small>{{ fieldError('companyId') }}</small>
                </label>

                <label>
                    <span>{{ t('organization.recruitmentChannel.branch') }}</span>
                    <Select
                        v-model="form.branchId"
                        show-clear
                        :disabled="!form.companyId"
                        :options="branchOptions"
                        option-label="label"
                        option-value="value"
                        :placeholder="t('organization.recruitmentChannel.globalBranch')"
                    />
                    <small>{{ fieldError('branchId') }}</small>
                </label>

                <label>
                    <span>{{ t('organization.recruitmentChannel.code') }}</span>
                    <InputText
                        v-model="form.code"
                        @input="normalizeCode"
                    />
                    <small>{{ fieldError('code') }}</small>
                </label>

                <label>
                    <span>{{ t('organization.recruitmentChannel.name') }}</span>
                    <InputText v-model="form.name" />
                    <small>{{ fieldError('name') }}</small>
                </label>

                <label>
                    <span>{{ t('organization.recruitmentChannel.shortName') }}</span>
                    <InputText v-model="form.shortName" />
                    <small>{{ fieldError('shortName') }}</small>
                </label>

                <label>
                    <span>{{ t('organization.recruitmentChannel.targetMonthly') }}</span>
                    <InputNumber
                        v-model="form.targetMonthly"
                        :min="0"
                        :max="999999"
                    />
                    <small>{{ fieldError('targetMonthly') }}</small>
                </label>

                <label>
                    <span>{{ t('organization.recruitmentChannel.sortOrder') }}</span>
                    <InputNumber
                        v-model="form.sortOrder"
                        :min="0"
                        :max="999999"
                    />
                    <small>{{ fieldError('sortOrder') }}</small>
                </label>

                <label>
                    <span>{{ t('organization.recruitmentChannel.status') }}</span>
                    <Select
                        v-model="form.status"
                        :options="editableStatusOptions"
                        option-label="label"
                        option-value="value"
                    />
                    <small>{{ fieldError('status') }}</small>
                </label>

                <label class="wide">
                    <span>{{ t('organization.recruitmentChannel.description') }}</span>
                    <Textarea
                        v-model="form.description"
                        rows="2"
                        auto-resize
                    />
                    <small>{{ fieldError('description') }}</small>
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
                    :loading="recruitmentChannelStore.saving"
                    @click="saveRecruitmentChannel"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="archiveDialogVisible"
            modal
            :header="t('organization.recruitmentChannel.archiveTitle')"
            :draggable="false"
            class="small-dialog"
        >
            <p>
                {{ t('organization.recruitmentChannel.archiveConfirm') }}
                <strong>{{ archiveCandidate?.code }} - {{ archiveCandidate?.name }}</strong>?
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
                    :loading="recruitmentChannelStore.archiving"
                    @click="confirmArchive"
                />
            </template>
        </Dialog>
    </section>
</template>

<style scoped>
.recruitment-channel-page {
    display: grid;
    width: 100%;
    gap: 0.75rem;
}

.recruitment-channel-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.recruitment-channel-toolbar :deep(.p-select),
.recruitment-channel-toolbar :deep(.p-inputtext) {
    min-height: 2.25rem;
    font-size: 0.78rem;
}

.enterprise-search {
    display: inline-flex;
    align-items: center;
    flex: 1 1 18rem;
    gap: 0.5rem;
    min-width: 18rem;
    height: 2.25rem;
    padding: 0 0.7rem;
    background: var(--hrms-surface);
    border: 1px solid var(--hrms-border);
    border-radius: 0.5rem;
}

.enterprise-search :deep(.p-inputtext) {
    width: 100%;
    padding-right: 0;
    padding-left: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
}

.enterprise-toolbar-primary {
    margin-left: auto;
}

.enterprise-list-card {
    min-width: 0;
}

.enterprise-code {
    color: var(--hrms-primary);
    font-weight: 800;
}

.enterprise-cell-stack {
    display: grid;
    gap: 0.15rem;
}

.enterprise-cell-stack span {
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
}

.enterprise-actions {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
}

.recruitment-channel-dialog {
    width: min(46rem, calc(100vw - 2rem));
}

.recruitment-channel-form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}

.recruitment-channel-form label {
    display: grid;
    gap: 0.3rem;
}

.recruitment-channel-form label > span {
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
    font-weight: 700;
}

.recruitment-channel-form small {
    min-height: 0.8rem;
    color: var(--hrms-danger);
    font-size: 0.68rem;
}

.recruitment-channel-form .wide {
    grid-column: 1 / -1;
}

.small-dialog {
    width: min(26rem, calc(100vw - 2rem));
}

@media (max-width: 700px) {
    .recruitment-channel-toolbar {
        align-items: stretch;
    }

    .recruitment-channel-toolbar > *,
    .enterprise-search {
        width: 100%;
        min-width: 0;
    }

    .enterprise-toolbar-primary {
        margin-left: 0;
    }

    .recruitment-channel-form {
        grid-template-columns: 1fr;
    }
}
</style>
