<script setup>
import Button from "primevue/button"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import EnterpriseActionMenu from "@/shared/components/enterprise/EnterpriseActionMenu.vue"
import EnterpriseConfirmDialog from "@/shared/components/enterprise/EnterpriseConfirmDialog.vue"
import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import EnterpriseListControls from "@/shared/components/enterprise/EnterpriseListControls.vue"
import EnterpriseListPage from "@/shared/components/enterprise/EnterpriseListPage.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"

import HrDashboardTargetImportDialog from "../components/HrDashboardTargetImportDialog.vue"
import {
    fetchHrDashboardTargetLookups,
} from "../services/hrDashboardTarget.api.js"
import { useHrDashboardTargetStore } from "../stores/hrDashboardTarget.store.js"

const PERMISSIONS = Object.freeze({
    VIEW: "REPORT.HR_DASHBOARD_TARGET.VIEW",
    CREATE: "REPORT.HR_DASHBOARD_TARGET.CREATE",
    UPDATE: "REPORT.HR_DASHBOARD_TARGET.UPDATE",
    ARCHIVE: "REPORT.HR_DASHBOARD_TARGET.ARCHIVE",
    IMPORT: "REPORT.HR_DASHBOARD_TARGET.IMPORT",
    EXPORT: "REPORT.HR_DASHBOARD_TARGET.EXPORT",
})

const { t, te } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const workspace = useWorkspaceStore()
const store = useHrDashboardTargetStore()

const currentYear = new Date().getFullYear()
const dialogVisible = ref(false)
const confirmVisible = ref(false)
const selectedId = ref("")
const archiveCandidate = ref(null)
const importVisible = ref(false)
const importFile = ref(null)
const loadingLookups = ref(false)
const hydratingForm = ref(false)
const employeeTypes = ref([])
let lookupController = null

const filters = reactive({
    page: 1,
    limit: 10,
    search: "",
    employeeTypeId: "",
    metric: "",
    year: currentYear,
    month: "",
    status: "ACTIVE",
})

const form = reactive(emptyForm())

const metricOptions = computed(() => [
    { label: t("hrDashboardTarget.metrics.absenceRate"), value: "ABSENCE_RATE" },
    { label: t("hrDashboardTarget.metrics.turnoverRate"), value: "TURNOVER_RATE" },
])

const metricFilterOptions = computed(() => [
    { label: t("hrDashboardTarget.allMetrics"), value: "" },
    ...metricOptions.value,
])

const statusOptions = computed(() => [
    { label: t("common.all"), value: "ALL" },
    { label: t("common.active"), value: "ACTIVE" },
    { label: t("common.inactive"), value: "INACTIVE" },
    { label: t("common.archived"), value: "ARCHIVED" },
])

const editableStatusOptions = computed(() => [
    { label: t("common.active"), value: "ACTIVE" },
    { label: t("common.inactive"), value: "INACTIVE" },
])

const monthItems = computed(() =>
    Array.from({ length: 12 }, (_, index) => ({
        label: t(`hrDashboard.monthsShort.${index + 1}`),
        value: index + 1,
    })),
)

const monthFilterOptions = computed(() => [
    { label: t("hrDashboardTarget.allMonths"), value: "" },
    ...monthItems.value,
])

const formMonthOptions = computed(() => [
    { label: t("hrDashboardTarget.wholeYear"), value: 0 },
    ...monthItems.value,
])

const employeeTypeOptions = computed(() =>
    employeeTypes.value.map((item) => ({
        label: `${item.code} - ${item.name}`,
        value: item.id,
    })),
)

const employeeTypeFilterOptions = computed(() => [
    { label: t("hrDashboard.filters.allEmployeeTypes"), value: "" },
    ...employeeTypeOptions.value,
])

const columns = computed(() => [
    { field: "metric", header: t("hrDashboardTarget.metric"), frozen: true, width: "11rem", minWidth: "11rem" },
    { field: "year", header: t("hrDashboardTarget.year"), width: "6rem", minWidth: "6rem" },
    { field: "month", header: t("hrDashboardTarget.month"), width: "8rem", minWidth: "8rem" },
    { field: "employeeType", header: t("hrDashboardTarget.employeeType"), width: "12rem", minWidth: "12rem" },
    { field: "targetRate", header: t("hrDashboardTarget.targetRate"), width: "8rem", minWidth: "8rem" },
    { field: "remark", header: t("common.remark"), width: "16rem", minWidth: "16rem" },
    { field: "status", header: t("common.status"), width: "8rem", minWidth: "8rem" },
])

const rows = computed(() => store.items)

const activeFilterCount = computed(() => [
    filters.search,
    filters.employeeTypeId,
    filters.metric,
    filters.year !== currentYear,
    filters.month !== "",
    filters.status !== "ACTIVE",
].filter(Boolean).length)

const dialogTitle = computed(() =>
    selectedId.value
        ? t("hrDashboardTarget.editTitle")
        : t("hrDashboardTarget.createTitle"),
)

const formValid = computed(() =>
    workspace.ready &&
    Boolean(form.metric) &&
    Boolean(form.employeeTypeId) &&
    Number.isInteger(Number(form.year)) &&
    Number(form.year) >= 2000 &&
    Number(form.year) <= 2100 &&
    Number(form.targetRate) >= 0 &&
    Number(form.targetRate) <= 100,
)

function emptyForm() {
    return {
        metric: "ABSENCE_RATE",
        year: currentYear,
        month: 0,
        employeeTypeId: "",
        targetRate: 0,
        remark: "",
        status: "ACTIVE",
    }
}

function errorMessage(error) {
    const key = error?.response?.data?.error?.messageKey
    if (key && te(key)) return t(key)
    return error?.response?.data?.error?.message ||
        error?.message ||
        t("common.somethingWentWrong")
}

function metricLabel(value) {
    return metricOptions.value.find((item) => item.value === value)?.label || value
}

function monthLabel(value) {
    return Number(value) === 0
        ? t("hrDashboardTarget.wholeYear")
        : t(`hrDashboard.monthsShort.${value}`)
}

function statusSeverity(value) {
    if (value === "ACTIVE") return "success"
    if (value === "INACTIVE") return "warn"
    return "danger"
}

function statusLabel(value) {
    const key = `common.${String(value || "").toLowerCase()}`
    return te(key) ? t(key) : value
}

async function loadLookups() {
    if (!workspace.ready) {
        employeeTypes.value = []
        return
    }

    lookupController?.abort()
    lookupController = new AbortController()
    loadingLookups.value = true

    try {
        const result = await fetchHrDashboardTargetLookups({
            companyId: workspace.companyId,
            branchId: workspace.branchId,
        })

        employeeTypes.value = result.employeeTypes || []
    } catch (error) {
        if (error?.name !== "CanceledError") {
            toast.add({
                severity: "error",
                summary: t("hrDashboardTarget.messages.loadOptionsFailed"),
                detail: errorMessage(error),
                life: 4500,
            })
        }
    } finally {
        loadingLookups.value = false
    }
}

async function load(overrides = {}) {
    if (!workspace.ready) return
    Object.assign(filters, overrides)

    try {
        await store.loadTargets({
            ...filters,
            companyId: workspace.companyId,
            branchId: workspace.branchId,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("hrDashboardTarget.messages.loadFailed"),
            detail: errorMessage(error),
            life: 4500,
        })
    }
}

function clearFilters() {
    Object.assign(filters, {
        page: 1,
        limit: 10,
        search: "",
        employeeTypeId: "",
        metric: "",
        year: currentYear,
        month: "",
        status: "ACTIVE",
    })
    load()
}

async function openCreate() {
    selectedId.value = ""
    hydratingForm.value = true
    Object.assign(form, emptyForm())
    await loadLookups()
    hydratingForm.value = false
    dialogVisible.value = true
}

async function openEdit(row) {
    selectedId.value = row.id
    hydratingForm.value = true
    Object.assign(form, emptyForm(), {
        metric: row.metric,
        year: Number(row.year),
        month: Number(row.month || 0),
        employeeTypeId: row.employeeTypeId || "",
        targetRate: Number(row.targetRate || 0),
        remark: row.remark || "",
        status: row.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    })
    await loadLookups()
    hydratingForm.value = false
    dialogVisible.value = true
}

function payload() {
    return {
        companyId: workspace.companyId,
        branchId: workspace.branchId,
        metric: form.metric,
        year: Number(form.year),
        month: Number(form.month || 0),
        employeeTypeId: form.employeeTypeId,
        targetRate: Number(form.targetRate || 0),
        remark: form.remark.trim(),
        status: form.status,
    }
}

async function save() {
    if (!formValid.value) return

    try {
        if (selectedId.value) {
            await store.updateTarget(selectedId.value, payload())
        } else {
            await store.createTarget(payload())
        }

        dialogVisible.value = false
        toast.add({
            severity: "success",
            summary: selectedId.value ? t("common.updated") : t("common.created"),
            detail: selectedId.value
                ? t("hrDashboardTarget.messages.updated")
                : t("hrDashboardTarget.messages.created"),
            life: 2500,
        })
        await load({ page: store.pagination.page })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("hrDashboardTarget.messages.saveFailed"),
            detail: errorMessage(error),
            life: 4500,
        })
    }
}

function requestArchive(row) {
    archiveCandidate.value = row
    confirmVisible.value = true
}

async function archiveTarget() {
    try {
        await store.archiveTarget(archiveCandidate.value.id)
        confirmVisible.value = false
        archiveCandidate.value = null
        toast.add({
            severity: "success",
            summary: t("common.archived"),
            detail: t("hrDashboardTarget.messages.archived"),
            life: 2500,
        })
        await load({ page: store.pagination.page })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("hrDashboardTarget.messages.archiveFailed"),
            detail: errorMessage(error),
            life: 4500,
        })
    }
}

async function runImport() {
    if (!importFile.value) return

    try {
        await store.importFile(importFile.value)
        importVisible.value = false
        toast.add({
            severity: "success",
            summary: t("hrDashboardTarget.importCompleted"),
            detail: `Created ${store.importSummary?.created || 0}, updated ${store.importSummary?.updated || 0}.`,
            life: 3500,
        })
        await Promise.all([loadLookups(), load({ page: 1 })])
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("hrDashboardTarget.importRejected"),
            detail: errorMessage(error),
            life: 5000,
        })
    }
}

function actions(row) {
    return [
        {
            label: t("common.edit"),
            icon: "pi pi-pencil",
            visible: row.status !== "ARCHIVED" && auth.hasPermission(PERMISSIONS.UPDATE),
            command: () => openEdit(row),
        },
        {
            label: t("common.archive"),
            icon: "pi pi-box",
            visible: row.status !== "ARCHIVED" && auth.hasPermission(PERMISSIONS.ARCHIVE),
            command: () => requestArchive(row),
        },
    ]
}


watch(
    () => workspace.revision,
    async () => {
        filters.page = 1
        dialogVisible.value = false
        await Promise.all([loadLookups(), load()])
    },
)

onMounted(() => Promise.all([loadLookups(), load()]))
onBeforeUnmount(() => lookupController?.abort())
</script>

<template>
    <EnterpriseListPage
        :rows="rows"
        :columns="columns"
        :loading="store.loading"
        :error="store.error"
        :pagination="store.pagination"
        row-key="id"
        empty-title="No dashboard targets"
        empty-description="Create a target for the selected company and branch."
        @retry="store.clearListCache(); load()"
        @page-change="load({ page: $event.page, limit: $event.limit })"
    >
        <template #controls>
            <EnterpriseListControls
                :filter-label="t('common.filters')"
                :hide-filter-label="t('common.hideFilters')"
                :active-filter-count="activeFilterCount"
            >
                <template #start>
                    <Button
                        :label="t('common.refresh')"
                        icon="pi pi-refresh"
                        severity="secondary"
                        text
                        :loading="store.loading"
                        @click="store.clearListCache(); load()"
                    />
                    <PermissionButton
                        :permission="PERMISSIONS.IMPORT"
                        :label="t('hrDashboardTarget.sample')"
                        icon="pi pi-download"
                        severity="secondary"
                        text
                        @click="store.downloadTemplate()"
                    />
                    <PermissionButton
                        :permission="PERMISSIONS.IMPORT"
                        :label="t('hrDashboardTarget.import')"
                        icon="pi pi-upload"
                        severity="secondary"
                        text
                        @click="importVisible = true"
                    />
                    <PermissionButton
                        :permission="PERMISSIONS.EXPORT"
                        :label="t('hrDashboardTarget.export')"
                        icon="pi pi-file-export"
                        severity="secondary"
                        text
                        :loading="store.exporting"
                        @click="store.exportFile({ ...filters, companyId: workspace.companyId, branchId: workspace.branchId })"
                    />
                </template>

                <template #actions>
                    <PermissionButton
                        :permission="PERMISSIONS.CREATE"
                        :label="t('common.create')"
                        icon="pi pi-plus"
                        :disabled="!workspace.ready"
                        @click="openCreate"
                    />
                </template>

                <template #filters>
                    <EnterpriseFilterBar :loading="store.loading">
                        <EnterpriseFilterField
                            :label="t('common.search')"
                            search
                            wide
                        >
                            <span class="target-search">
                                <i class="pi pi-search" />
                                <InputText
                                    v-model="filters.search"
                                    :placeholder="t('common.search')"
                                    @keyup.enter="load({ page: 1 })"
                                />
                            </span>
                        </EnterpriseFilterField>

                        <EnterpriseFilterField :label="t('hrDashboardTarget.employeeType')">
                            <Select
                                v-model="filters.employeeTypeId"
                                :options="employeeTypeFilterOptions"
                                option-label="label"
                                option-value="value"
                                filter
                            />
                        </EnterpriseFilterField>

                        <EnterpriseFilterField :label="t('hrDashboardTarget.metric')">
                            <Select
                                v-model="filters.metric"
                                :options="metricFilterOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </EnterpriseFilterField>

                        <EnterpriseFilterField :label="t('hrDashboardTarget.year')">
                            <InputNumber
                                v-model="filters.year"
                                :use-grouping="false"
                                :min="2000"
                                :max="2100"
                            />
                        </EnterpriseFilterField>

                        <EnterpriseFilterField :label="t('hrDashboardTarget.month')">
                            <Select
                                v-model="filters.month"
                                :options="monthFilterOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </EnterpriseFilterField>

                        <EnterpriseFilterField :label="t('common.status')">
                            <Select
                                v-model="filters.status"
                                :options="statusOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </EnterpriseFilterField>

                        <template #actions>
                            <Button
                                :label="t('common.clear')"
                                icon="pi pi-times"
                                severity="secondary"
                                outlined
                                :disabled="!activeFilterCount"
                                @click="clearFilters"
                            />
                            <Button
                                :label="t('common.apply')"
                                icon="pi pi-check"
                                :loading="store.loading"
                                @click="load({ page: 1 })"
                            />
                        </template>
                    </EnterpriseFilterBar>
                </template>
            </EnterpriseListControls>
        </template>

        <template #cell-metric="{ row }">
            <strong>{{ metricLabel(row.metric) }}</strong>
        </template>
        <template #cell-month="{ row }">{{ monthLabel(row.month) }}</template>
        <template #cell-employeeType="{ row }">{{ row.employeeType?.name || '—' }}</template>
        <template #cell-targetRate="{ row }">
            <strong class="target-rate">{{ Number(row.targetRate || 0).toFixed(2) }}%</strong>
        </template>
        <template #cell-status="{ row }">
            <Tag :value="statusLabel(row.status)" :severity="statusSeverity(row.status)" />
        </template>
        <template #actions="{ row }">
            <EnterpriseActionMenu :items="actions(row)" />
        </template>
    </EnterpriseListPage>

    <EnterpriseDialog
        :visible="dialogVisible"
        :title="dialogTitle"
        width="58rem"
        :busy="store.saving"
        @update:visible="dialogVisible = $event"
    >
        <div class="target-form">
            <div class="workspace-scope">
                <div>
                    <small>{{ t('hrDashboardTarget.company') }}</small>
                    <strong>{{ workspace.selectedCompany?.displayName || workspace.selectedCompany?.name || '—' }}</strong>
                </div>
                <div>
                    <small>{{ t('hrDashboardTarget.branch') }}</small>
                    <strong>{{ workspace.selectedBranch?.name || '—' }}</strong>
                </div>
            </div>

            <label>
                <span>{{ t('hrDashboardTarget.metric') }} *</span>
                <Select v-model="form.metric" :options="metricOptions" option-label="label" option-value="value" />
            </label>
            <label>
                <span>{{ t('hrDashboardTarget.year') }} *</span>
                <InputNumber v-model="form.year" :use-grouping="false" :min="2000" :max="2100" />
            </label>
            <label>
                <span>{{ t('hrDashboardTarget.month') }} *</span>
                <Select v-model="form.month" :options="formMonthOptions" option-label="label" option-value="value" />
            </label>

            <label>
                <span>{{ t('hrDashboardTarget.employeeType') }} *</span>
                <Select v-model="form.employeeTypeId" :options="employeeTypeOptions" option-label="label" option-value="value" filter :loading="loadingLookups" />
            </label>
            <label>
                <span>{{ t('hrDashboardTarget.targetRate') }} *</span>
                <InputNumber v-model="form.targetRate" suffix="%" :min="0" :max="100" :max-fraction-digits="2" />
            </label>

            <label>
                <span>{{ t('common.status') }}</span>
                <Select v-model="form.status" :options="editableStatusOptions" option-label="label" option-value="value" />
            </label>
            <label class="remark-field">
                <span>{{ t('common.remark') }}</span>
                <Textarea v-model="form.remark" rows="2" maxlength="500" />
            </label>
        </div>

        <template #footer>
            <EnterpriseFormFooter
                :saving="store.saving"
                :disabled="!formValid"
                @cancel="dialogVisible = false"
                @save="save"
            />
        </template>
    </EnterpriseDialog>

    <EnterpriseConfirmDialog
        v-model:visible="confirmVisible"
        :title="t('hrDashboardTarget.archiveTitle')"
        :message="t('hrDashboardTarget.archiveConfirm')"
        :confirm-label="t('common.archive')"
        :busy="store.archiving"
        @confirm="archiveTarget"
    />

    <HrDashboardTargetImportDialog
        v-model:visible="importVisible"
        :importing="store.importing"
        :progress="store.importProgress"
        :result="store.importSummary"
        @file-change="importFile = $event"
        @template="store.downloadTemplate()"
        @import="runImport"
    />
</template>

<style scoped>
.target-search { position: relative; display: block; width: 100%; }
.target-search > i { position: absolute; z-index: 1; left: .7rem; top: 50%; transform: translateY(-50%); color: var(--p-text-muted-color); font-size: .75rem; }
.target-search :deep(.p-inputtext) { width: 100%; padding-left: 2rem; }
.target-rate { color: var(--p-primary-color); }
.target-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem 1rem; }
.target-form > label { display: grid; gap: .3rem; min-width: 0; font-size: .75rem; font-weight: 600; }
.target-form :deep(.p-inputtext), .target-form :deep(.p-select), .target-form :deep(.p-inputnumber), .target-form :deep(.p-textarea) { width: 100%; }
.workspace-scope { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; padding: .65rem .75rem; border: 1px solid var(--p-content-border-color); border-radius: .5rem; background: var(--p-surface-50); }
.workspace-scope div { display: grid; gap: .1rem; }
.workspace-scope small { color: var(--p-text-muted-color); }
.remark-field { grid-column: span 2; }
@media (max-width: 780px) { .target-form { grid-template-columns: repeat(2, minmax(0, 1fr)); } .remark-field { grid-column: 1 / -1; } }
@media (max-width: 540px) { .target-form, .workspace-scope { grid-template-columns: 1fr; } .remark-field { grid-column: auto; } }
</style>
