<script setup>
import Button from "primevue/button"
import Checkbox from "primevue/checkbox"
import Dialog from "primevue/dialog"
import Message from "primevue/message"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import ToggleSwitch from "primevue/toggleswitch"
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
    fetchAttendanceDailyEmailStatus,
    fetchAttendanceDailyEmailSchedule,
    saveAttendanceDailyEmailSchedule,
    sendAttendanceDailyEmail,
} from "../services/attendance.api.js"

const toast = useToast()
const workspace = useWorkspaceStore()
const today = new Date()
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
const filters = reactive({ month: currentMonth, reportDate: `${currentMonth}-01`, departmentId: "" })
const report = ref(null)
const loading = ref(false)
const exporting = ref(false)
const sendingEmail = ref(false)
const emailDialogVisible = ref(false)
const resendDialogVisible = ref(false)
const scheduleDialogVisible = ref(false)
const savingSchedule = ref(false)
const emailStatus = ref({ sent: false })
const emailSchedule = reactive({
    enabled: false,
    sendTime: "08:00",
    timeZone: "Asia/Phnom_Penh",
    allowedDayTypes: ["WORKING_DAY", "SPECIAL_WORKING_DAY"],
    dayTypeOptions: [],
    lastSentDate: null,
    lastSentAt: null,
    lastError: "",
    lastSkippedDate: null,
    lastSkippedDayType: "",
})
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

function emailParams() {
    return {
        date: filters.reportDate,
        companyId: workspace.companyId,
        branchId: workspace.branchId,
    }
}

async function refreshEmailStatus() {
    if (!workspace.ready || !filters.reportDate) return
    try {
        emailStatus.value = await fetchAttendanceDailyEmailStatus(emailParams())
    } catch {
        emailStatus.value = { sent: false }
    }
}

async function loadEmailSchedule() {
    if (!workspace.ready) return
    try {
        const schedule = await fetchAttendanceDailyEmailSchedule({
            companyId: workspace.companyId,
            branchId: workspace.branchId,
        })
        Object.assign(emailSchedule, schedule)
    } catch (requestError) {
        toast.add({ severity: "error", summary: "Schedule unavailable", detail: errorMessage(requestError), life: 5000 })
    }
}

async function openScheduleDialog() {
    await loadEmailSchedule()
    scheduleDialogVisible.value = true
}

async function saveEmailSchedule() {
    savingSchedule.value = true
    try {
        const schedule = await saveAttendanceDailyEmailSchedule({
            companyId: workspace.companyId,
            branchId: workspace.branchId,
            enabled: emailSchedule.enabled,
            sendTime: emailSchedule.sendTime,
            timeZone: emailSchedule.timeZone,
            allowedDayTypes: emailSchedule.allowedDayTypes,
        })
        Object.assign(emailSchedule, schedule)
        scheduleDialogVisible.value = false
        toast.add({
            severity: "success",
            summary: emailSchedule.enabled ? "Automatic email enabled" : "Automatic email disabled",
            detail: emailSchedule.enabled
                ? `The daily report will send at ${emailSchedule.sendTime} Cambodia time.`
                : "The automatic daily email schedule is turned off.",
            life: 4500,
        })
    } catch (requestError) {
        toast.add({ severity: "error", summary: "Schedule not saved", detail: errorMessage(requestError), life: 5000 })
    } finally {
        savingSchedule.value = false
    }
}

function openEmailReview() {
    emailDialogVisible.value = true
}

function requestEmailSend() {
    if (emailStatus.value.sent) {
        emailDialogVisible.value = false
        resendDialogVisible.value = true
        return
    }

    confirmSendEmail(false)
}

async function confirmSendEmail(force = false) {
    sendingEmail.value = true
    try {
        await sendAttendanceDailyEmail({ ...emailParams(), force })
        emailDialogVisible.value = false
        resendDialogVisible.value = false
        await refreshEmailStatus()
        toast.add({ severity: "success", summary: "Email sent", detail: "Daily attendance summary sent successfully.", life: 4000 })
    } catch (requestError) {
        if (requestError?.response?.status === 409 && !force) {
            emailDialogVisible.value = false
            resendDialogVisible.value = true
        } else {
            const code = requestError?.response?.data?.error?.code
            const detail = code === "ATTENDANCE_EMAIL_NOT_CONFIGURED"
                ? "Email is not configured. Add the SMTP settings to backend/.env and restart the backend."
                : errorMessage(requestError)
            toast.add({ severity: "error", summary: "Email failed", detail, life: 6000 })
        }
    } finally {
        sendingEmail.value = false
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
        await refreshEmailStatus()
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
    const target = report.value?.attendanceTarget?.rate
    if (target === null || target === undefined) return "rate-good"
    if (value < Math.max(target - 2, 0)) return "rate-good"
    if (value < target) return "rate-warning"
    return "rate-danger"
}

const attendanceTargetText = computed(() => {
    const target = report.value?.attendanceTarget
    if (!target) return "Attendance target is not configured"
    return `${Number(target.rate).toFixed(1)}% target${target.month === 0 ? " (year)" : " (month)"}`
})

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

watch(() => filters.reportDate, (value) => {
    syncReportMonth(value)
    refreshEmailStatus()
})

watch(() => workspace.revision, async () => {
    filters.departmentId = ""
    await Promise.all([loadDepartments(), load(), loadEmailSchedule()])
})
onMounted(() => Promise.all([loadDepartments(), load(), loadEmailSchedule()]))
</script>

<template>
    <section class="daily-report-page">
        <EnterpriseListControls filter-label="Filters" hide-filter-label="Hide Filters">
            <template #start>
                <Button label="Refresh" icon="pi pi-refresh" severity="secondary" text :loading="loading" @click="load" />
                <PermissionButton :permission="ATTENDANCE_PERMISSIONS.RECORD_EXPORT" label="Export Excel" icon="pi pi-file-excel" severity="secondary" text :loading="exporting" @click="exportReport" />
                <PermissionButton :permission="ATTENDANCE_PERMISSIONS.RECORD_EXPORT" label="Send Daily Attendance Email" icon="pi pi-envelope" severity="primary" :loading="sendingEmail" :disabled="!report || loading" @click="openEmailReview" />
                <PermissionButton
                    :permission="ATTENDANCE_PERMISSIONS.RECORD_EXPORT"
                    :label="emailSchedule.enabled ? `Auto Email ${emailSchedule.sendTime}` : 'Set Auto Email'"
                    icon="pi pi-clock"
                    :severity="emailSchedule.enabled ? 'success' : 'secondary'"
                    text
                    @click="openScheduleDialog"
                />
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
                    <div class="legend"><span>{{ attendanceTargetText }}</span></div>
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

        <Dialog v-model:visible="emailDialogVisible" modal header="Send Daily Attendance Email" :style="{ width: '34rem' }" :breakpoints="{ '640px': '94vw' }">
            <div class="email-review">
                <p>Review the selected attendance day before sending.</p>
                <dl>
                    <dt>Date</dt><dd>{{ filters.reportDate }}</dd>
                    <dt>To</dt><dd>sakamakmol.vut@traxapparel.com</dd>
                    <dt>CC</dt><dd>kakvey.ket@traxapparel.com</dd>
                    <dt>Content</dt><dd>Daily totals, scans, absent, leave, unmatched IDs, sender and completion time</dd>
                </dl>
                <Message v-if="emailStatus.sent" severity="warn" :closable="false">This date was already emailed by {{ emailStatus.sentByName || 'an HR user' }}.</Message>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" text :disabled="sendingEmail" @click="emailDialogVisible = false" />
                <Button
                    :label="emailStatus.sent ? 'Send Again' : 'Send Email'"
                    icon="pi pi-send"
                    :severity="emailStatus.sent ? 'warn' : 'primary'"
                    :loading="sendingEmail"
                    @click="requestEmailSend"
                />
            </template>
        </Dialog>

        <Dialog v-model:visible="resendDialogVisible" modal header="Email Already Sent" :style="{ width: '31rem' }" :breakpoints="{ '640px': '94vw' }">
            <Message severity="warn" :closable="false">A daily attendance email for this date has already been sent. Send it again only if the attendance was corrected.</Message>
            <template #footer>
                <Button label="Cancel" severity="secondary" text :disabled="sendingEmail" @click="resendDialogVisible = false" />
                <Button label="Send Again" icon="pi pi-send" severity="warn" :loading="sendingEmail" @click="confirmSendEmail(true)" />
            </template>
        </Dialog>

        <Dialog v-model:visible="scheduleDialogVisible" modal header="Automatic Attendance Email" :style="{ width: '34rem' }" :breakpoints="{ '640px': '94vw' }">
            <div class="schedule-form">
                <div class="schedule-switch-row">
                    <div>
                        <strong>Send automatically every day</strong>
                        <span>No Send button is required when this is enabled.</span>
                    </div>
                    <ToggleSwitch v-model="emailSchedule.enabled" />
                </div>

                <label class="schedule-field">
                    <span>Exact sending time</span>
                    <input v-model="emailSchedule.sendTime" type="time" step="60" :disabled="!emailSchedule.enabled" />
                    <small>Cambodia time (Asia/Phnom_Penh)</small>
                </label>

                <fieldset class="day-type-fieldset" :disabled="!emailSchedule.enabled">
                    <legend>Calendar day types allowed to send</legend>
                    <p>The list comes from the existing internal Calendar setup. Unchecked types are skipped automatically.</p>
                    <label v-for="option in emailSchedule.dayTypeOptions" :key="option.value" class="day-type-option">
                        <Checkbox
                            v-model="emailSchedule.allowedDayTypes"
                            :input-id="`email-day-type-${option.value}`"
                            :value="option.value"
                        />
                        <span>{{ option.label }}</span>
                    </label>
                    <Message v-if="emailSchedule.enabled && !emailSchedule.allowedDayTypes.length" severity="warn" :closable="false">
                        No day type is allowed, so automatic emails will not be sent.
                    </Message>
                </fieldset>

                <Message severity="info" :closable="false">
                    The system sends today's full Attendance Daily Report with the Excel attachment. If today's selected time has already passed when you save, the first automatic email starts tomorrow. After activation, a temporary backend outage will not permanently miss a report. It will not create a duplicate if today's report was already sent manually.
                </Message>

                <dl v-if="emailSchedule.lastSentDate || emailSchedule.lastSkippedDate || emailSchedule.lastError" class="schedule-status">
                    <template v-if="emailSchedule.lastSentDate">
                        <dt>Last automatic date</dt>
                        <dd>{{ emailSchedule.lastSentDate }}</dd>
                    </template>
                    <template v-if="emailSchedule.lastSkippedDate">
                        <dt>Last skipped date</dt>
                        <dd>{{ emailSchedule.lastSkippedDate }} ({{ emailSchedule.lastSkippedDayType }})</dd>
                    </template>
                    <template v-if="emailSchedule.lastError">
                        <dt>Last error</dt>
                        <dd class="schedule-error">{{ emailSchedule.lastError }}</dd>
                    </template>
                </dl>
            </div>
            <template #footer>
                <Button label="Cancel" severity="secondary" text :disabled="savingSchedule" @click="scheduleDialogVisible = false" />
                <Button label="Save Schedule" icon="pi pi-check" :loading="savingSchedule" @click="saveEmailSchedule" />
            </template>
        </Dialog>
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

.email-review p {
    margin-top: 0;
}

.email-review dl {
    display: grid;
    grid-template-columns: 5rem minmax(0, 1fr);
    gap: 0.55rem 0.75rem;
    margin: 0 0 1rem;
}

.email-review dt {
    color: var(--p-text-muted-color);
    font-weight: 600;
}

.email-review dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
}

.schedule-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.schedule-switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}

.schedule-switch-row > div,
.schedule-field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.schedule-switch-row span,
.schedule-field small {
    color: var(--p-text-muted-color);
    font-size: 0.78rem;
}

.schedule-field > span {
    font-weight: 600;
}

.schedule-field input[type="time"] {
    width: 100%;
    min-height: 2.5rem;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--p-form-field-border-color);
    border-radius: var(--p-form-field-border-radius);
    background: var(--p-form-field-background);
    color: var(--p-form-field-color);
    font: inherit;
}

.schedule-status {
    display: grid;
    grid-template-columns: 8.5rem minmax(0, 1fr);
    gap: 0.4rem 0.75rem;
    margin: 0;
    font-size: 0.82rem;
}

.schedule-status dt {
    color: var(--p-text-muted-color);
    font-weight: 600;
}

.schedule-status dd {
    margin: 0;
    overflow-wrap: anywhere;
}

.schedule-error {
    color: var(--p-red-600);
}

.day-type-fieldset {
    display: grid;
    gap: 0.65rem;
    margin: 0;
    padding: 0.85rem;
    border: 1px solid var(--p-content-border-color);
    border-radius: 8px;
}

.day-type-fieldset legend {
    padding: 0 0.35rem;
    font-weight: 600;
}

.day-type-fieldset p {
    margin: 0;
    color: var(--p-text-muted-color);
    font-size: 0.78rem;
}

.day-type-option {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    cursor: pointer;
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
