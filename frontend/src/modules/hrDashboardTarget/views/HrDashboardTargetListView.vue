<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue"
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

import { useAuthStore } from "@/app/stores/auth.store.js"
import { fetchBranchesLookup } from "@/modules/organization/services/branch.api.js"
import { fetchCompaniesLookup } from "@/modules/organization/services/company.api.js"
import { fetchDepartmentsLookup } from "@/modules/organization/services/department.api.js"
import { fetchPositionsLookup } from "@/modules/organization/services/position.api.js"
import { fetchLines } from "@/modules/line/services/line.api.js"
import { fetchEmployeeTypes } from "@/modules/employeeType/services/employeeType.api.js"

import { useHrDashboardTargetStore } from "../stores/hrDashboardTarget.store.js"

const { t, te } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const targetStore = useHrDashboardTargetStore()

const PERMISSIONS = Object.freeze({
    CREATE: "REPORT.HR_DASHBOARD_TARGET.CREATE",
    UPDATE: "REPORT.HR_DASHBOARD_TARGET.UPDATE",
    ARCHIVE: "REPORT.HR_DASHBOARD_TARGET.ARCHIVE",
})

const companies = ref([])
const branches = ref([])
const departments = ref([])
const positions = ref([])
const lines = ref([])
const employeeTypes = ref([])
const loadingOptions = ref(false)
const dialogVisible = ref(false)
const archiveDialogVisible = ref(false)
const dialogMode = ref("create")
const selectedId = ref(null)
const archiveCandidate = ref(null)

const filters = reactive({
    search: "",
    status: "ACTIVE",
    metric: "",
    companyId: "",
    branchId: "",
    year: new Date().getFullYear(),
    month: "",
    employeeTypeId: "",
})

const form = reactive(createEmptyForm())

const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.CREATE))
const canUpdate = computed(() => authStore.hasPermission(PERMISSIONS.UPDATE))
const canArchive = computed(() => authStore.hasPermission(PERMISSIONS.ARCHIVE))

const metricOptions = computed(() => [
    {
        label: t("hrDashboardTarget.metrics.absenceRate"),
        value: "ABSENCE_RATE",
    },
    {
        label: t("hrDashboardTarget.metrics.turnoverRate"),
        value: "TURNOVER_RATE",
    },
])

const metricFilterOptions = computed(() => [
    {
        label: t("hrDashboardTarget.allMetrics"),
        value: "",
    },
    ...metricOptions.value,
])

const statusOptions = computed(() => [
    {
        label: t("common.all"),
        value: "ALL",
    },
    {
        label: t("common.active"),
        value: "ACTIVE",
    },
    {
        label: t("common.inactive"),
        value: "INACTIVE",
    },
    {
        label: t("common.archived"),
        value: "ARCHIVED",
    },
])

const editableStatusOptions = computed(() => [
    {
        label: t("common.active"),
        value: "ACTIVE",
    },
    {
        label: t("common.inactive"),
        value: "INACTIVE",
    },
])

const monthValueOptions = computed(() =>
    Array.from({ length: 12 }, (_, index) => ({
        label: t(`hrDashboard.monthsShort.${index + 1}`),
        value: index + 1,
    })),
)

const monthOptions = computed(() => [
    {
        label: t("hrDashboardTarget.allMonths"),
        value: "",
    },
    ...monthValueOptions.value,
])

const formMonthOptions = computed(() => [
    {
        label: t("hrDashboardTarget.wholeYear"),
        value: 0,
    },
    ...monthValueOptions.value,
])

const companyOptions = computed(() =>
    companies.value.map((item) => ({
        label: `${item.code} - ${item.displayName || item.name || item.legalName}`,
        value: getId(item),
    })),
)

const companyFilterOptions = computed(() => [
    {
        label: t("hrDashboard.filters.allCompanies"),
        value: "",
    },
    ...companyOptions.value,
])

const branchOptions = computed(() =>
    branches.value
        .filter((item) => !form.companyId || sameId(item.companyId, form.companyId))
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: getId(item),
        })),
)

const branchFilterOptions = computed(() => [
    {
        label: t("hrDashboard.filters.allBranches"),
        value: "",
    },
    ...branches.value
        .filter((item) => !filters.companyId || sameId(item.companyId, filters.companyId))
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: getId(item),
        })),
])

const departmentOptions = computed(() =>
    departments.value
        .filter((item) => !form.branchId || sameId(item.branchId, form.branchId))
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: getId(item),
        })),
)

const positionOptions = computed(() =>
    positions.value
        .filter((item) => !form.departmentId || sameId(item.departmentId, form.departmentId))
        .map((item) => ({
            label: `${item.code} - ${item.title || item.name}`,
            value: getId(item),
        })),
)

const lineOptions = computed(() =>
    lines.value
        .filter((item) => !form.departmentId || sameId(item.departmentId, form.departmentId))
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: getId(item),
        })),
)

const employeeTypeOptions = computed(() =>
    employeeTypes.value
        .filter((item) => !form.companyId || !item.companyId || sameId(item.companyId, form.companyId))
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: getId(item),
        })),
)

const employeeTypeFilterOptions = computed(() => [
    {
        label: t("hrDashboard.filters.allEmployeeTypes"),
        value: "",
    },
    ...employeeTypes.value
        .filter((item) => !filters.companyId || !item.companyId || sameId(item.companyId, filters.companyId))
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: getId(item),
        })),
])

const childOptions = computed(() => {
    const employeeType = employeeTypes.value.find((item) =>
        sameId(getId(item), form.employeeTypeId),
    )

    const children = (employeeType?.children || []).filter(
        (child) => child.status !== "ARCHIVED",
    )

    return [
        {
            label: t("hrDashboardTarget.noChild"),
            value: "",
        },
        ...children.map((child) => ({
            label: `${child.code} - ${child.name}`,
            value: getId(child),
        })),
    ]
})

const dialogTitle = computed(() =>
    dialogMode.value === "create"
        ? t("hrDashboardTarget.createTitle")
        : t("hrDashboardTarget.editTitle"),
)

function getId(item) {
    return item?.id || item?._id || item?.value || item || ""
}

function sameId(left, right) {
    const leftId = getId(left)
    const rightId = getId(right)

    return Boolean(leftId && rightId && String(leftId) === String(rightId))
}

function translateMaybe(keyOrMessage) {
    if (!keyOrMessage) return t("common.somethingWentWrong")
    if (typeof keyOrMessage === "string" && te(keyOrMessage)) return t(keyOrMessage)
    return keyOrMessage
}

function getErrorMessage(error) {
    const messageKey = error?.response?.data?.error?.messageKey
    const message = error?.response?.data?.message || error?.message

    return translateMaybe(messageKey || message)
}

function normalizeListResult(result) {
    if (Array.isArray(result)) return result
    return result?.items || result?.data?.items || result?.data || []
}

function createEmptyForm() {
    return {
        companyId: "",
        branchId: "",
        metric: "ABSENCE_RATE",
        year: new Date().getFullYear(),
        month: 0,
        departmentId: "",
        positionId: "",
        lineId: "",
        employeeTypeId: "",
        employeeTypeChildId: "",
        targetRate: 0,
        remark: "",
        status: "ACTIVE",
    }
}

function assignForm(source = createEmptyForm()) {
    Object.assign(form, createEmptyForm(), {
        ...source,
        companyId: source.companyId || "",
        branchId: source.branchId || "",
        departmentId: source.departmentId || "",
        positionId: source.positionId || "",
        lineId: source.lineId || "",
        employeeTypeId: source.employeeTypeId || "",
        employeeTypeChildId: source.employeeTypeChildId || "",
        targetRate: Number(source.targetRate || 0),
        month: Number(source.month || 0),
        status: source.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    })
}

function cleanNullable(value) {
    return value || null
}

function buildPayload() {
    return {
        companyId: form.companyId,
        branchId: form.branchId,
        metric: form.metric,
        year: Number(form.year),
        month: Number(form.month || 0),
        departmentId: cleanNullable(form.departmentId),
        positionId: cleanNullable(form.positionId),
        lineId: cleanNullable(form.lineId),
        employeeTypeId: cleanNullable(form.employeeTypeId),
        employeeTypeChildId: cleanNullable(form.employeeTypeChildId),
        targetRate: Number(form.targetRate || 0),
        remark: form.remark || "",
        status: form.status,
    }
}

function monthLabel(month) {
    if (Number(month) === 0) return t("hrDashboardTarget.wholeYear")
    return t(`hrDashboard.monthsShort.${month}`)
}

function metricLabel(metric) {
    return metricOptions.value.find((item) => item.value === metric)?.label || metric
}

function statusSeverity(status) {
    if (status === "ACTIVE") return "success"
    if (status === "INACTIVE") return "warning"
    return "danger"
}

function statusLabel(status) {
    return t(`common.${String(status || "").toLowerCase()}`)
}

async function loadOptions() {
    loadingOptions.value = true

    try {
        const [
            companyResult,
            branchResult,
            departmentResult,
            positionResult,
            lineResult,
            employeeTypeResult,
        ] = await Promise.all([
            fetchCompaniesLookup({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchBranchesLookup({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchDepartmentsLookup({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchPositionsLookup({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchLines({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchEmployeeTypes({ page: 1, limit: 100, status: "ACTIVE" }),
        ])

        companies.value = normalizeListResult(companyResult)
        branches.value = normalizeListResult(branchResult)
        departments.value = normalizeListResult(departmentResult)
        positions.value = normalizeListResult(positionResult)
        lines.value = normalizeListResult(lineResult)
        employeeTypes.value = normalizeListResult(employeeTypeResult)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("hrDashboardTarget.messages.loadOptionsFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        loadingOptions.value = false
    }
}

async function loadTargets(page = 1) {
    try {
        await targetStore.loadTargets({
            ...filters,
            page,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("hrDashboardTarget.messages.loadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function openCreateDialog() {
    dialogMode.value = "create"
    selectedId.value = null
    assignForm()
    dialogVisible.value = true
}

function openEditDialog(item) {
    dialogMode.value = "edit"
    selectedId.value = item.id
    assignForm(item)
    dialogVisible.value = true
}

async function submitForm() {
    try {
        if (dialogMode.value === "create") {
            await targetStore.createTarget(buildPayload())
            toast.add({
                severity: "success",
                summary: t("common.created"),
                detail: t("hrDashboardTarget.messages.created"),
                life: 2500,
            })
        } else {
            await targetStore.updateTarget(selectedId.value, buildPayload())
            toast.add({
                severity: "success",
                summary: t("common.updated"),
                detail: t("hrDashboardTarget.messages.updated"),
                life: 2500,
            })
        }

        dialogVisible.value = false
        await loadTargets(targetStore.pagination.page)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("hrDashboardTarget.messages.saveFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function confirmArchive(item) {
    archiveCandidate.value = item
    archiveDialogVisible.value = true
}

async function archiveSelectedTarget() {
    try {
        await targetStore.archiveTarget(archiveCandidate.value.id)
        toast.add({
            severity: "success",
            summary: t("common.archived"),
            detail: t("hrDashboardTarget.messages.archived"),
            life: 2500,
        })
        archiveDialogVisible.value = false
        archiveCandidate.value = null
        await loadTargets(targetStore.pagination.page)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("hrDashboardTarget.messages.archiveFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function applyFilters() {
    loadTargets(1)
}

function clearFilters() {
    Object.assign(filters, {
        search: "",
        status: "ACTIVE",
        metric: "",
        companyId: "",
        branchId: "",
        year: new Date().getFullYear(),
        month: "",
        employeeTypeId: "",
    })
    loadTargets(1)
}

watch(
    () => filters.companyId,
    () => {
        filters.branchId = ""
        filters.employeeTypeId = ""
    },
)

watch(
    () => form.companyId,
    () => {
        form.branchId = ""
        form.departmentId = ""
        form.positionId = ""
        form.lineId = ""
        form.employeeTypeId = ""
        form.employeeTypeChildId = ""
    },
)

watch(
    () => form.branchId,
    () => {
        form.departmentId = ""
        form.positionId = ""
        form.lineId = ""
    },
)

watch(
    () => form.departmentId,
    () => {
        form.positionId = ""
        form.lineId = ""
    },
)

watch(
    () => form.employeeTypeId,
    () => {
        form.employeeTypeChildId = ""
    },
)

onMounted(async () => {
    await loadOptions()
    await loadTargets(1)
})
</script>

<template>
    <section class="hr-target-page enterprise-list-page">
        <div class="hr-target-filter-card">
            <div class="hr-target-filter-grid">
                <InputText
                    v-model="filters.search"
                    class="hr-target-control hr-target-search"
                    :placeholder="t('common.search')"
                    @keyup.enter="applyFilters"
                />

                <Select
                    v-model="filters.status"
                    class="hr-target-control"
                    :options="statusOptions"
                    option-label="label"
                    option-value="value"
                />

                <Select
                    v-model="filters.metric"
                    class="hr-target-control"
                    :options="metricFilterOptions"
                    option-label="label"
                    option-value="value"
                />

                <Select
                    v-model="filters.companyId"
                    class="hr-target-control"
                    :options="companyFilterOptions"
                    option-label="label"
                    option-value="value"
                    filter
                />

                <Select
                    v-model="filters.branchId"
                    class="hr-target-control"
                    :options="branchFilterOptions"
                    option-label="label"
                    option-value="value"
                    filter
                />

                <InputNumber
                    v-model="filters.year"
                    class="hr-target-control hr-target-year"
                    :use-grouping="false"
                    :min="2000"
                    :max="2100"
                    input-class="hr-target-year-input"
                />

                <Select
                    v-model="filters.month"
                    class="hr-target-control"
                    :options="monthOptions"
                    option-label="label"
                    option-value="value"
                />

                <Select
                    v-model="filters.employeeTypeId"
                    class="hr-target-control"
                    :options="employeeTypeFilterOptions"
                    option-label="label"
                    option-value="value"
                    filter
                />
            </div>

            <div class="hr-target-actions">
                <Button
                    icon="pi pi-filter"
                    :label="t('common.apply')"
                    :loading="targetStore.loading"
                    @click="applyFilters"
                />

                <Button
                    icon="pi pi-times"
                    :label="t('common.clear')"
                    severity="secondary"
                    outlined
                    @click="clearFilters"
                />

                <Button
                    v-if="canCreate"
                    icon="pi pi-plus"
                    :label="t('common.create')"
                    @click="openCreateDialog"
                />
            </div>
        </div>

        <div class="hr-target-table-card">
            <DataTable
                :value="targetStore.items"
                :loading="targetStore.loading || loadingOptions"
                data-key="id"
                lazy
                paginator
                :rows="targetStore.pagination.limit"
                :first="(targetStore.pagination.page - 1) * targetStore.pagination.limit"
                :total-records="targetStore.pagination.total"
                responsive-layout="scroll"
                class="enterprise-table hr-target-table"
                @page="loadTargets($event.page + 1)"
            >
                <template #empty>
                    <div class="hr-target-empty">
                        {{ t('common.noRecords') }}
                    </div>
                </template>

                <Column
                    field="metric"
                    :header="t('hrDashboardTarget.metric')"
                    style="min-width: 11rem"
                >
                    <template #body="{ data }">
                        <strong>{{ metricLabel(data.metric) }}</strong>
                    </template>
                </Column>

                <Column
                    field="year"
                    :header="t('hrDashboardTarget.year')"
                    style="width: 6rem"
                    body-class="hr-target-center"
                    header-class="hr-target-center"
                />

                <Column
                    field="month"
                    :header="t('hrDashboardTarget.month')"
                    style="width: 8rem"
                    body-class="hr-target-center"
                    header-class="hr-target-center"
                >
                    <template #body="{ data }">
                        {{ monthLabel(data.month) }}
                    </template>
                </Column>

                <Column
                    field="targetRate"
                    :header="t('hrDashboardTarget.targetRate')"
                    style="width: 8rem"
                    body-class="hr-target-center"
                    header-class="hr-target-center"
                >
                    <template #body="{ data }">
                        <span class="hr-target-rate">
                            {{ Number(data.targetRate || 0).toFixed(2) }}%
                        </span>
                    </template>
                </Column>

                <Column
                    :header="t('hrDashboardTarget.scope')"
                    style="min-width: 23rem"
                >
                    <template #body="{ data }">
                        <div class="hr-target-scope">
                            <span>
                                {{ data.company?.code || '-' }} / {{ data.branch?.code || '-' }}
                            </span>
                            <small>
                                {{ data.employeeType?.name || t('hrDashboard.filters.allEmployeeTypes') }}
                                <template v-if="data.employeeTypeChildName">
                                    / {{ data.employeeTypeChildName }}
                                </template>
                                <template v-if="data.department?.name">
                                    · {{ data.department.name }}
                                </template>
                                <template v-if="data.position?.title">
                                    · {{ data.position.title }}
                                </template>
                                <template v-if="data.line?.name">
                                    · {{ data.line.name }}
                                </template>
                            </small>
                        </div>
                    </template>
                </Column>

                <Column
                    field="status"
                    :header="t('common.status')"
                    style="width: 7rem"
                    body-class="hr-target-center"
                    header-class="hr-target-center"
                >
                    <template #body="{ data }">
                        <Tag
                            :value="statusLabel(data.status)"
                            :severity="statusSeverity(data.status)"
                            rounded
                        />
                    </template>
                </Column>

                <Column
                    :header="t('common.actions')"
                    frozen
                    align-frozen="right"
                    style="width: 8rem"
                    body-class="hr-target-center"
                    header-class="hr-target-center"
                >
                    <template #body="{ data }">
                        <div class="enterprise-row-actions hr-target-row-actions">
                            <Button
                                v-if="canUpdate && data.status !== 'ARCHIVED'"
                                icon="pi pi-pencil"
                                severity="secondary"
                                text
                                rounded
                                @click="openEditDialog(data)"
                            />

                            <Button
                                v-if="canArchive && data.status !== 'ARCHIVED'"
                                icon="pi pi-trash"
                                severity="danger"
                                text
                                rounded
                                @click="confirmArchive(data)"
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
            class="hr-target-dialog"
        >
            <form
                class="hr-target-form"
                @submit.prevent="submitForm"
            >
                <div class="hr-target-form__section">
                    <span>{{ t('hrDashboardTarget.scope') }}</span>
                </div>

                <div class="hr-target-form__grid">
                    <label>
                        {{ t('hrDashboardTarget.company') }}
                        <Select
                            v-model="form.companyId"
                            :options="companyOptions"
                            option-label="label"
                            option-value="value"
                            filter
                            required
                        />
                    </label>

                    <label>
                        {{ t('hrDashboardTarget.branch') }}
                        <Select
                            v-model="form.branchId"
                            :options="branchOptions"
                            option-label="label"
                            option-value="value"
                            filter
                            required
                        />
                    </label>

                    <label>
                        {{ t('hrDashboardTarget.employeeType') }}
                        <Select
                            v-model="form.employeeTypeId"
                            :options="employeeTypeOptions"
                            option-label="label"
                            option-value="value"
                            filter
                            show-clear
                        />
                    </label>

                    <label>
                        {{ t('hrDashboardTarget.employeeTypeChild') }}
                        <Select
                            v-model="form.employeeTypeChildId"
                            :options="childOptions"
                            option-label="label"
                            option-value="value"
                            :disabled="!form.employeeTypeId"
                        />
                    </label>

                    <label>
                        {{ t('hrDashboardTarget.department') }}
                        <Select
                            v-model="form.departmentId"
                            :options="departmentOptions"
                            option-label="label"
                            option-value="value"
                            filter
                            show-clear
                        />
                    </label>

                    <label>
                        {{ t('hrDashboardTarget.position') }}
                        <Select
                            v-model="form.positionId"
                            :options="positionOptions"
                            option-label="label"
                            option-value="value"
                            filter
                            show-clear
                        />
                    </label>

                    <label>
                        {{ t('hrDashboardTarget.line') }}
                        <Select
                            v-model="form.lineId"
                            :options="lineOptions"
                            option-label="label"
                            option-value="value"
                            filter
                            show-clear
                        />
                    </label>
                </div>

                <div class="hr-target-form__section">
                    <span>{{ t('hrDashboardTarget.metric') }}</span>
                </div>

                <div class="hr-target-form__grid hr-target-form__grid--small">
                    <label>
                        {{ t('hrDashboardTarget.metric') }}
                        <Select
                            v-model="form.metric"
                            :options="metricOptions"
                            option-label="label"
                            option-value="value"
                            required
                        />
                    </label>

                    <label>
                        {{ t('hrDashboardTarget.year') }}
                        <InputNumber
                            v-model="form.year"
                            :use-grouping="false"
                            :min="2000"
                            :max="2100"
                            required
                        />
                    </label>

                    <label>
                        {{ t('hrDashboardTarget.month') }}
                        <Select
                            v-model="form.month"
                            :options="formMonthOptions"
                            option-label="label"
                            option-value="value"
                            required
                        />
                    </label>

                    <label>
                        {{ t('hrDashboardTarget.targetRate') }}
                        <InputNumber
                            v-model="form.targetRate"
                            suffix="%"
                            :min="0"
                            :max="100"
                            :min-fraction-digits="0"
                            :max-fraction-digits="2"
                            required
                        />
                    </label>

                    <label>
                        {{ t('common.status') }}
                        <Select
                            v-model="form.status"
                            :options="editableStatusOptions"
                            option-label="label"
                            option-value="value"
                        />
                    </label>
                </div>

                <label class="hr-target-form__remark">
                    {{ t('common.remark') }}
                    <Textarea
                        v-model="form.remark"
                        rows="3"
                    />
                </label>

                <div class="hr-target-form__actions">
                    <Button
                        type="button"
                        :label="t('common.cancel')"
                        severity="secondary"
                        outlined
                        @click="dialogVisible = false"
                    />

                    <Button
                        type="submit"
                        :label="t('common.save')"
                        :loading="targetStore.saving"
                    />
                </div>
            </form>
        </Dialog>

        <Dialog
            v-model:visible="archiveDialogVisible"
            modal
            :header="t('hrDashboardTarget.archiveTitle')"
            class="hr-target-archive-dialog"
        >
            <p>{{ t('hrDashboardTarget.archiveConfirm') }}</p>

            <div class="hr-target-form__actions">
                <Button
                    :label="t('common.cancel')"
                    severity="secondary"
                    outlined
                    @click="archiveDialogVisible = false"
                />

                <Button
                    :label="t('common.archive')"
                    severity="danger"
                    :loading="targetStore.archiving"
                    @click="archiveSelectedTarget"
                />
            </div>
        </Dialog>
    </section>
</template>

<style scoped>
.hr-target-page {
    display: grid;
    gap: 0.75rem;
    width: 100%;
}

.hr-target-filter-card {
    align-items: flex-start;
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--surface-border, #dbe4f0);
    border-radius: 14px;
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05);
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    padding: 0.72rem;
}

.hr-target-filter-grid {
    display: grid;
    flex: 1;
    gap: 0.55rem;
    grid-template-columns: repeat(4, minmax(11rem, 1fr));
}

.hr-target-control {
    width: 100%;
}

.hr-target-actions {
    display: flex;
    flex-shrink: 0;
    gap: 0.5rem;
}

.hr-target-table-card {
    background: var(--surface-card, #ffffff);
    border: 1px solid var(--surface-border, #dbe4f0);
    border-radius: 14px;
    overflow: hidden;
}

.hr-target-empty {
    color: var(--text-color-secondary, #64748b);
    font-weight: 700;
    padding: 1rem;
    text-align: center;
}

.hr-target-center {
    text-align: center !important;
}

.hr-target-rate {
    color: #002060;
    font-size: 0.86rem;
    font-weight: 800;
}

.hr-target-scope {
    display: grid;
    gap: 0.12rem;
    line-height: 1.25;
}

.hr-target-scope span {
    color: #0f172a;
    font-weight: 800;
}

.hr-target-scope small {
    color: var(--text-color-secondary, #64748b);
    font-size: 0.72rem;
    line-height: 1.3;
}

.hr-target-row-actions {
    justify-content: center;
}

.hr-target-dialog {
    width: min(920px, 96vw);
}

.hr-target-archive-dialog {
    width: min(420px, 92vw);
}

.hr-target-form {
    display: grid;
    gap: 0.85rem;
}

.hr-target-form__section {
    align-items: center;
    border-bottom: 1px solid var(--surface-border, #dbe4f0);
    color: #002060;
    display: flex;
    font-size: 0.82rem;
    font-weight: 900;
    letter-spacing: 0.02em;
    padding-bottom: 0.35rem;
    text-transform: uppercase;
}

.hr-target-form__grid {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.hr-target-form__grid--small {
    grid-template-columns: repeat(5, minmax(0, 1fr));
}

.hr-target-form label {
    display: grid;
    font-size: 0.76rem;
    font-weight: 800;
    gap: 0.32rem;
}

.hr-target-form__remark {
    display: grid;
    gap: 0.35rem;
}

.hr-target-form__actions {
    display: flex;
    gap: 0.6rem;
    justify-content: flex-end;
}

:deep(.p-inputtext),
:deep(.p-select-label) {
    font-size: 0.82rem;
}

:deep(.p-datatable-thead > tr > th) {
    color: #0f172a;
    font-size: 0.78rem;
    font-weight: 900;
    padding: 0.62rem 0.55rem;
}

:deep(.p-datatable-tbody > tr > td) {
    font-size: 0.76rem;
    padding: 0.46rem 0.55rem;
    vertical-align: middle;
}

@media (max-width: 1180px) {
    .hr-target-filter-card {
        display: grid;
    }

    .hr-target-filter-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .hr-target-actions {
        justify-content: flex-end;
    }

    .hr-target-form__grid,
    .hr-target-form__grid--small {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 720px) {
    .hr-target-filter-grid,
    .hr-target-form__grid,
    .hr-target-form__grid--small {
        grid-template-columns: 1fr;
    }

    .hr-target-actions {
        display: grid;
        grid-template-columns: 1fr;
    }
}
</style>
