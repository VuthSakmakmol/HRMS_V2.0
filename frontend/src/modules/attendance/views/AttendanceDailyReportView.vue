<script setup>
import Button from "primevue/button"
import Message from "primevue/message"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import { computed, onMounted, reactive, ref, watch } from "vue"
import { useToast } from "primevue/usetoast"

import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import { lookupDepartments } from "@/modules/organization/department/api/department.api.js"
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import EnterpriseListControls from "@/shared/components/enterprise/EnterpriseListControls.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"
import { ATTENDANCE_PERMISSIONS } from "../config/attendance.config.js"
import {
    downloadAttendanceDailyReportExport,
    exportAttendanceDailyReport,
    fetchAttendanceDailyReport,
    fetchAttendanceDailyReportJob,
} from "../services/attendance.api.js"

const toast = useToast()
const workspace = useWorkspaceStore()
const today = new Date()
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
const filters = reactive({ month: currentMonth, reportDate: `${currentMonth}-01`, departmentId: "" })
const report = ref(null)
const loading = ref(false)
const exporting = ref(false)
const error = ref("")
const departments = ref([])
const collapsedDepartments = ref(new Set())
const progress = reactive({ percent: 0, phase: "", processedRows: 0, totalRows: 0 })

const departmentOptions = computed(() => [
    { id: "", name: "All Departments" },
    ...departments.value,
])

function params() {
    return {
        month: filters.month,
        departmentId: filters.departmentId,
        companyId: workspace.companyId,
        branchId: workspace.branchId,
    }
}

function syncReportMonth(dateValue) {
    const match = String(dateValue || "").match(/^(\d{4})-(\d{2})-\d{2}$/)

    if (match) {
        filters.month = `${match[1]}-${match[2]}`
    }
}

function errorMessage(requestError) {
    return requestError?.response?.data?.error?.message || requestError?.message || "Unable to load the daily report."
}

async function load() {
    if (!workspace.ready || !filters.month) return
    loading.value = true
    Object.assign(progress, { percent: 0, phase: "QUEUED", processedRows: 0, totalRows: 0 })
    error.value = ""
    try {
        const queued = await fetchAttendanceDailyReport(params())
        const completed = await waitForReportJob(queued.jobId, false)
        report.value = completed.result.report
        collapsedDepartments.value = new Set()
    } catch (requestError) {
        error.value = errorMessage(requestError)
        toast.add({ severity: "error", summary: "Report failed", detail: error.value, life: 5000 })
    } finally {
        loading.value = false
    }
}

async function loadDepartments() {
    departments.value = workspace.ready
        ? await lookupDepartments({ companyId: workspace.companyId, branchId: workspace.branchId, status: "ACTIVE" })
        : []
}

async function exportReport() {
    exporting.value = true
    Object.assign(progress, { percent: 0, phase: "QUEUED", processedRows: 0, totalRows: 0 })
    try {
        const queued = await exportAttendanceDailyReport(params())
        const completed = await waitForReportJob(queued.jobId, true)
        await downloadAttendanceDailyReportExport(queued.jobId, completed.result.fileName)
    } catch (requestError) {
        toast.add({ severity: "error", summary: "Export failed", detail: errorMessage(requestError), life: 5000 })
    } finally {
        exporting.value = false
    }
}

function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

async function waitForReportJob(jobId, exportJob) {
    while (true) {
        const job = await fetchAttendanceDailyReportJob(jobId, exportJob)
        Object.assign(progress, {
            percent: job.percent || 0,
            phase: job.phase || "PREPARING",
            processedRows: job.processedRows || 0,
            totalRows: job.totalRows || 0,
        })
        if (job.status === "COMPLETED") return job
        if (job.status === "FAILED") throw new Error(job.error?.message || "Daily report failed.")
        await delay(450)
    }
}

const progressText = computed(() => {
    const labels = {
        QUEUED: "Waiting to start",
        PREPARING: "Preparing report",
        LOADING_DATA: "Loaded attendance and employee data",
        CALCULATING_SUMMARY: "Calculating daily totals",
        CALCULATING_DEPARTMENTS: "Calculating departments",
        BUILDING_EXCEL: "Building Excel file",
        COMPLETED: "Completed",
    }
    const count = progress.totalRows ? ` · ${progress.processedRows} / ${progress.totalRows}` : ""
    return `${labels[progress.phase] || progress.phase}${count}`
})

function percentageClass(value) {
    if (value === null || value === undefined) return "day-off"
    if (value < 4) return "rate-good"
    if (value < 6) return "rate-warning"
    return "rate-danger"
}

function number(value) {
    return Math.round(Number(value || 0)).toLocaleString()
}

function percent(value) {
    return `${Number(value || 0).toFixed(1)}%`
}

const summaryRows = computed(() => report.value ? [
    { label: "TOTAL EMPLOYEE", values: report.value.summary.totalEmployees, average: report.value.summary.averages.totalEmployees },
    { label: "FACE SCAN", values: report.value.summary.faceScans, average: report.value.summary.averages.faceScans },
    { label: "- MATERNITY LEAVE", values: report.value.summary.leaves.ML, average: report.value.summary.averages.leaves.ML },
    { label: "- ANNUAL LEAVE", values: report.value.summary.leaves.AL, average: report.value.summary.averages.leaves.AL },
    { label: "- UNPAID LEAVE", values: report.value.summary.leaves.UL, average: report.value.summary.averages.leaves.UL },
    { label: "- SICK LEAVE", values: report.value.summary.leaves.SL, average: report.value.summary.averages.leaves.SL },
] : [])

const sewerAbsentRows = computed(() => {
    const sewer = report.value?.sewerAbsentRate

    if (!sewer) return []

    return [
        { label: "TOTAL SEWER", values: sewer.totalSewer, average: sewer.averages.totalSewer, percent: false },
        { label: "- MATERNITY LEAVE", values: sewer.maternityLeaveRate, average: sewer.averages.maternityLeaveRate, percent: true },
        { label: "- ANNUAL LEAVE / UNPAID", values: sewer.annualUnpaidLeaveRate, average: sewer.averages.annualUnpaidLeaveRate, percent: true },
        { label: "- SICK LEAVE", values: sewer.sickLeaveRate, average: sewer.averages.sickLeaveRate, percent: true },
        { label: "- ABSENT WITHOUT INFORM", values: sewer.absentWithoutInformRate, average: sewer.averages.absentWithoutInformRate, percent: true },
        { label: "SEWER COME", values: sewer.sewerCome, average: sewer.averages.sewerCome, percent: false },
    ]
})

const visibleGroupRows = computed(() => {
    if (!report.value?.groupRows) return []

    let currentDepartmentKey = ""

    return report.value.groupRows.filter((row) => {
        if (row.level === 0) {
            currentDepartmentKey = row.key
            return true
        }

        return !collapsedDepartments.value.has(currentDepartmentKey)
    })
})

const departmentKeys = computed(() =>
    (report.value?.groupRows || [])
        .filter((row) => row.level === 0)
        .map((row) => row.key),
)

const expandableDepartmentKeys = computed(() => {
    const keys = new Set()
    let departmentKey = ""

    for (const row of report.value?.groupRows || []) {
        if (row.level === 0) departmentKey = row.key
        if (row.level === 1 && departmentKey) keys.add(departmentKey)
    }

    return keys
})

function isDepartmentExpandable(row) {
    return expandableDepartmentKeys.value.has(row.key)
}

function isDepartmentCollapsed(row) {
    return collapsedDepartments.value.has(row.key)
}

function toggleDepartment(row) {
    if (row.level !== 0 || !isDepartmentExpandable(row)) return

    const next = new Set(collapsedDepartments.value)

    if (next.has(row.key)) {
        next.delete(row.key)
    } else {
        next.add(row.key)
    }

    collapsedDepartments.value = next
}

function expandAllDepartments() {
    collapsedDepartments.value = new Set()
}

function collapseAllDepartments() {
    collapsedDepartments.value = new Set(expandableDepartmentKeys.value)
}

watch(() => filters.reportDate, syncReportMonth)

watch(() => workspace.revision, async () => {
    filters.departmentId = ""
    await Promise.all([loadDepartments(), load()])
})
onMounted(() => Promise.all([loadDepartments(), load()]))
</script>

<template>
    <section class="daily-report-page">
        <EnterpriseListControls filter-label="Filters" hide-filter-label="Hide Filters">
            <template #start>
                <Button label="Refresh" icon="pi pi-refresh" severity="secondary" text :loading="loading" @click="load" />
                <PermissionButton :permission="ATTENDANCE_PERMISSIONS.RECORD_EXPORT" label="Export Excel" icon="pi pi-file-excel" severity="secondary" text :loading="exporting" @click="exportReport" />
            </template>
            <template #filters>
                <EnterpriseFilterBar :loading="loading">
                    <EnterpriseFilterField label="Month">
                        <EnterpriseCalendarDatePicker
                            v-model="filters.reportDate"
                            :company-id="workspace.companyId"
                            :branch-id="workspace.branchId"
                            compact
                            :show-status="false"
                        />
                    </EnterpriseFilterField>
                    <EnterpriseFilterField label="Department">
                        <Select v-model="filters.departmentId" :options="departmentOptions" option-label="name" option-value="id" filter />
                    </EnterpriseFilterField>
                    <template #actions>
                        <Button label="Apply" icon="pi pi-check" :loading="loading" @click="load" />
                    </template>
                </EnterpriseFilterBar>
            </template>
        </EnterpriseListControls>

        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        <div v-if="loading || exporting" class="progress-state">
            <div><strong>{{ exporting ? "Exporting Excel" : "Loading daily report" }}</strong><span>{{ progressText }}</span></div>
            <ProgressBar :value="progress.percent" />
        </div>

        <div v-else-if="report" class="report-card">
            <div class="report-heading">
                <div><strong>Attendance Daily Report</strong><span>{{ report.month }}</span></div>
                <div class="report-heading-actions">
                    <div class="legend"><span class="rate-good">&lt; 4%</span><span class="rate-warning">4–5.9%</span><span class="rate-danger">≥ 6%</span></div>
                </div>
            </div>
            <div class="table-scroll">
                <table class="daily-table">
                    <thead><tr><th class="label-cell">Daily Summary</th><th v-for="day in report.days" :key="day.key" :class="{ 'day-off': !day.working }" :title="day.name || day.dayType">{{ day.day }}</th><th>Avg</th></tr></thead>
                    <tbody>
                        <tr v-for="row in summaryRows" :key="row.label"><th class="label-cell">{{ row.label }}</th><td v-for="(value,index) in row.values" :key="index" :class="{ 'day-off': !report.days[index].working }">{{ report.days[index].working ? number(value) : "" }}</td><td>{{ number(row.average) }}</td></tr>
                        <tr class="absent-total"><th class="label-cell">ABSENT RATE</th><td v-for="(value,index) in report.summary.absentRate" :key="index" :class="percentageClass(report.days[index].working ? value : null)">{{ report.days[index].working ? percent(value) : "" }}</td><td :class="percentageClass(report.summary.averages.absentRate)">{{ percent(report.summary.averages.absentRate) }}</td></tr>
                        <tr class="section-row"><th class="label-cell">FORGET FINGER SCAN</th><td :colspan="report.days.length + 1" /></tr>
                        <tr v-for="row in visibleGroupRows" :key="row.key" :class="{ 'department-row': row.level === 0, 'position-row': row.level === 1 }">
                            <th class="label-cell" :class="{ 'department-toggle-cell': row.level === 0 && isDepartmentExpandable(row) }" @click="toggleDepartment(row)">
                                <button v-if="row.level === 0 && isDepartmentExpandable(row)" class="department-toggle" type="button" :aria-expanded="!isDepartmentCollapsed(row)" :title="isDepartmentCollapsed(row) ? 'Open Sewing positions' : 'Close Sewing positions'">
                                    <i :class="isDepartmentCollapsed(row) ? 'pi pi-angle-right' : 'pi pi-angle-down'" />
                                    <span>{{ row.label }}</span>
                                </button>
                                <span v-else>{{ row.label }}</span>
                            </th>
                            <td v-for="(value,index) in row.values" :key="index" :class="percentageClass(value)">{{ value === null ? "" : percent(value) }}</td>
                            <td :class="percentageClass(row.average)">{{ percent(row.average) }}</td>
                        </tr>
                        <tr class="section-row sewer-section"><th class="label-cell">SEWER ABSENT RATE</th><td :colspan="report.days.length + 1" /></tr>
                        <tr v-for="row in sewerAbsentRows" :key="`sewer-${row.label}`">
                            <th class="label-cell">{{ row.label }}</th>
                            <td
                                v-for="(value, index) in row.values"
                                :key="index"
                                :class="row.percent ? percentageClass(value) : { 'day-off': !report.days[index].working }"
                            >
                                {{ value === null ? "" : row.percent ? percent(value) : number(value) }}
                            </td>
                            <td :class="row.percent ? percentageClass(row.average) : ''">
                                {{ row.percent ? percent(row.average) : number(row.average) }}
                            </td>
                        </tr>
                        <tr class="sewer-absent-total">
                            <th class="label-cell">TOTAL ABSENT RATE</th>
                            <td
                                v-for="(value, index) in report.sewerAbsentRate.totalAbsentRate"
                                :key="index"
                                :class="percentageClass(value)"
                            >
                                {{ value === null ? "" : percent(value) }}
                            </td>
                            <td :class="percentageClass(report.sewerAbsentRate.averages.totalAbsentRate)">
                                {{ percent(report.sewerAbsentRate.averages.totalAbsentRate) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>
</template>

<style scoped>
.daily-report-page {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    padding: 0.625rem;
}

.loading-state,
.progress-state,
.report-card {
    border: 1px solid var(--p-content-border-color);
    border-radius: 8px;
    background: var(--p-content-background);
}

.progress-state {
    padding: 0.55rem 0.75rem;
}

.progress-state > div:first-child {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.35rem;
    font-size: 0.75rem;
}

.progress-state span {
    color: var(--p-text-muted-color);
}

.loading-state {
    padding: 3rem;
    text-align: center;
    color: var(--p-text-muted-color);
}

.report-card {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
}

.report-heading {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-height: 2.65rem;
    padding: 0.45rem 0.75rem;
    border-bottom: 1px solid var(--p-content-border-color);
}

.report-heading div:first-child {
    display: flex;
    align-items: center;
    gap: 0.6rem;
}

.report-heading span {
    color: var(--p-text-muted-color);
    font-size: 0.75rem;
}

.legend {
    display: flex;
    gap: 0.3rem;
}

.report-heading-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.legend span {
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    color: #183047 !important;
}

.table-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
}

.daily-table {
    width: 100%;
    min-width: max-content;
    border-spacing: 0;
    border-collapse: separate;
    font-size: 0.63rem;
    line-height: 1.05;
}

.daily-table th,
.daily-table td {
    min-width: 2.35rem;
    height: 1.2rem;
    padding: 0.08rem 0.12rem;
    border-right: 1px solid #91a9c1;
    border-bottom: 1px solid #91a9c1;
    text-align: center;
    white-space: nowrap;
}

.daily-table thead th {
    position: sticky;
    z-index: 3;
    top: 0;
    background: #164f82;
    color: #fff;
}

.label-cell {
    position: sticky !important;
    z-index: 2 !important;
    left: 0;
    min-width: 11rem !important;
    max-width: 11rem;
    overflow: hidden;
    background: #234f7f !important;
    color: #fff !important;
    text-align: left !important;
    text-overflow: ellipsis;
}

.daily-table tbody > tr:first-child th,
.daily-table tbody > tr:first-child td {
    border-top: 1px solid #91a9c1;
}

.daily-table tr th:first-child {
    border-left: 1px solid #91a9c1;
}

.daily-table tbody td {
    background: #245483;
    color: #fff;
}

.day-off {
    background: #c6efd3 !important;
    color: #295c3a !important;
}

.rate-good {
    background: #c6efce !important;
    color: #006100 !important;
}

.rate-warning {
    background: #ffeb9c !important;
    color: #9c5700 !important;
}

.rate-danger {
    background: #ffc7ce !important;
    color: #9c0006 !important;
}

.absent-total .label-cell {
    background: #c00000 !important;
    font-weight: 800;
}

.section-row .label-cell,
.section-row td {
    background: #164f82 !important;
    color: #73ffe2 !important;
    font-weight: 800;
}

.sewer-section .label-cell,
.sewer-section td {
    color: #73ffe2 !important;
}

.sewer-absent-total .label-cell {
    background: #ffd966 !important;
    color: #7f6000 !important;
    font-weight: 800;
}

.department-row .label-cell {
    font-weight: 400;
}

.department-toggle-cell {
    padding: 0 !important;
    cursor: pointer;
}

.department-toggle {
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;
    padding: 0.12rem 0.3rem;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 400;
    text-align: left;
    cursor: pointer;
}

.department-toggle i {
    flex: 0 0 auto;
    width: 0.9rem;
    font-size: 0.65rem;
}

.department-toggle span {
    overflow: hidden;
    text-overflow: ellipsis;
}

.position-row .label-cell {
    padding-left: 0.75rem;
}

@media (max-width: 700px) {
    .daily-report-page {
        padding: 0.4rem;
    }

    .report-heading {
        align-items: flex-start;
        flex-direction: column;
    }

    .report-heading-actions {
        flex-wrap: wrap;
    }

    .label-cell {
        min-width: 10.5rem !important;
        max-width: 10.5rem;
    }
}
</style>
