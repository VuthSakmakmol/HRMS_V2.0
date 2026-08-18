<script setup>
import Button from "primevue/button"
import Checkbox from "primevue/checkbox"
import Dialog from "primevue/dialog"
import Message from "primevue/message"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import ToggleSwitch from "primevue/toggleswitch"
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import { lookupDepartments } from "@/modules/organization/department/api/department.api.js"
import { lookupShifts } from "@/modules/organization/shift/api/shift.api.js"
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
    fetchAttendancePayrollSchedule,
    runAttendancePayrollBotNow,
    cancelAttendancePayrollBotRun,
    saveAttendanceDailyEmailSchedule,
    sendAttendanceDailyEmail,
} from "../services/attendance.api.js"

const toast = useToast()
const { t } = useI18n()
const workspace = useWorkspaceStore()
const today = new Date()
const currentDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
}).format(today)
const currentMonth = currentDate.slice(0, 7)
const ALL_SHIFTS = "ALL"
const filters = reactive({ month: currentMonth, reportDate: currentDate, departmentId: "", shiftId: ALL_SHIFTS })
const report = ref(null)
const loading = ref(false)
const exporting = ref(false)
const sendingEmail = ref(false)
const emailDialogVisible = ref(false)
const resendDialogVisible = ref(false)
const scheduleDialogVisible = ref(false)
const savingSchedule = ref(false)
const payrollScheduleDialogVisible = ref(false)
const requestingPayrollRun = ref(false)
const cancellingPayrollRun = ref(false)
const payrollCompletionVisible = ref(false)
const payrollImportDate = ref(currentDate)
let payrollStatusTimer = null
let payrollSuccessCloseTimer = null
let emailScheduleStatusTimer = null
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
    lastBlockedDate: null,
    lastBlockedAt: null,
    lastBlockedReason: "",
})
const payrollSchedule = reactive({
    status: "IDLE",
    requestedDate: null,
    lastRunAt: null,
    lastFinishedAt: null,
    lastSuccessAt: null,
    lastImportedFile: "",
    lastImportedDate: null,
    lastImportedRowCount: 0,
    lastError: "",
    runNowPending: false,
    cancelPending: false,
    canCancel: false,
    lastCancelledAt: null,
    progressPercent: 0,
    progressPhase: "",
    progressDetail: "",
    progressProcessedRows: 0,
    progressTotalRows: 0,
    progressUpdatedAt: null,
    agentOnline: false,
    agentLastSeenAt: null,
    agentMachineName: "",
    agentVersion: "",
})
const error = ref("")
const departments = ref([])
const shifts = ref([])
const collapsedDepartments = ref(new Set())
const showExactCounts = ref(false)
const progress = reactive({ percent: 0, phase: "", processedRows: 0, totalRows: 0 })
const payrollRunActive = computed(() =>
    payrollSchedule.runNowPending
    || payrollSchedule.canCancel
    || ["QUEUED", "RUNNING", "CANCEL_REQUESTED"].includes(payrollSchedule.status),
)
const payrollAgentReady = computed(() => payrollSchedule.agentOnline === true)
const payrollProcessedEmployees = computed(() => (
    payrollCompletionVisible.value
        ? Number(payrollSchedule.progressProcessedRows || payrollSchedule.lastImportedRowCount || 0)
        : Number(payrollSchedule.progressProcessedRows || 0)
))
const payrollTotalEmployees = computed(() => (
    payrollCompletionVisible.value
        ? Number(payrollSchedule.progressTotalRows || payrollSchedule.lastImportedRowCount || 0)
        : Number(payrollSchedule.progressTotalRows || 0)
))
const payrollEmployeeProgressText = computed(() => {
    if (!payrollTotalEmployees.value) return ""
    return `${payrollProcessedEmployees.value.toLocaleString()} / ${payrollTotalEmployees.value.toLocaleString()} employees`
})
const payrollCurrentStatus = computed(() => {
    if (payrollCompletionVisible.value) return "SUCCESS — 100%"
    if (payrollRunActive.value) {
        return payrollSchedule.runNowPending
            ? "Starting on Payroll computer"
            : payrollSchedule.status.replaceAll("_", " ")
    }
    return payrollAgentReady.value ? "Ready to start" : "Bot offline"
})

const departmentOptions = computed(() => [
    { id: "", name: "All Departments" },
    ...departments.value,
])

const shiftOptions = computed(() => [
    { id: ALL_SHIFTS, name: "All Shifts" },
    ...shifts.value.map((shift) => ({
        id: String(shift._id || shift.id),
        name: `${shift.code ? `${shift.code} — ` : ""}${shift.name}`,
    })),
])

const selectedShiftOption = computed({
    get() {
        return shiftOptions.value.find(
            (option) => String(option.id) === String(filters.shiftId || ALL_SHIFTS),
        ) || shiftOptions.value[0]
    },
    set(option) {
        filters.shiftId = option?.id ? String(option.id) : ALL_SHIFTS
    },
})

function params() {
    return {
        month: filters.month,
        reportDate: filters.reportDate,
        departmentId: filters.departmentId,
        shiftId: filters.shiftId === ALL_SHIFTS ? undefined : filters.shiftId,
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

async function loadEmailSchedule({ silent = false } = {}) {
    if (!workspace.ready) return
    try {
        const schedule = await fetchAttendanceDailyEmailSchedule({
            companyId: workspace.companyId,
            branchId: workspace.branchId,
        })
        Object.assign(emailSchedule, schedule)
    } catch (requestError) {
        if (!silent) {
            toast.add({ severity: "error", summary: "Schedule unavailable", detail: errorMessage(requestError), life: 5000 })
        }
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
                ? `At or after ${emailSchedule.sendTime} Cambodia time, the report sends only after the same date's Payroll import succeeds.`
                : "The automatic daily email schedule is turned off.",
            life: 4500,
        })
    } catch (requestError) {
        toast.add({ severity: "error", summary: "Schedule not saved", detail: errorMessage(requestError), life: 5000 })
    } finally {
        savingSchedule.value = false
    }
}

async function loadPayrollSchedule() {
    if (!workspace.ready) return
    try {
        const wasActive = payrollRunActive.value
        Object.assign(payrollSchedule, await fetchAttendancePayrollSchedule({
            companyId: workspace.companyId,
            branchId: workspace.branchId,
        }))
        if (wasActive && payrollSchedule.status === "SUCCESS") {
            payrollSchedule.progressPercent = 100
            payrollSchedule.progressPhase = "COMPLETED"
            payrollSchedule.progressDetail = payrollSchedule.lastImportedRowCount
                ? `${Number(payrollSchedule.lastImportedRowCount).toLocaleString()} employees imported successfully.`
                : "Attendance imported successfully."
            payrollCompletionVisible.value = true
            schedulePayrollSuccessClose()
        }
        if (wasActive && !payrollRunActive.value) {
            await Promise.all([loadEmailSchedule(), refreshEmailStatus()])
        }
    } catch (requestError) {
        payrollSchedule.agentOnline = false
        toast.add({ severity: "error", summary: "Payroll bot unavailable", detail: errorMessage(requestError), life: 5000 })
    }
}

async function openPayrollScheduleDialog() {
    await loadPayrollSchedule()
    payrollCompletionVisible.value = false
    clearPayrollSuccessClose()
    payrollImportDate.value = payrollRunActive.value && payrollSchedule.requestedDate
        ? payrollSchedule.requestedDate
        : currentDate
    payrollScheduleDialogVisible.value = true
}

async function runPayrollBotNow() {
    await loadPayrollSchedule()
    if (!payrollAgentReady.value) {
        toast.add({
            severity: "error",
            summary: "Payroll bot is offline",
            detail: "Run SETUP_THIS_COMPUTER once on the Payroll computer, then keep that computer signed in.",
            life: 6500,
        })
        return
    }

    requestingPayrollRun.value = true
    payrollCompletionVisible.value = false
    clearPayrollSuccessClose()
    try {
        Object.assign(payrollSchedule, await runAttendancePayrollBotNow({
            companyId: workspace.companyId,
            branchId: workspace.branchId,
            reportDate: payrollImportDate.value,
        }))
        toast.add({
            severity: "success",
            summary: "Payroll import started",
            detail: `The Payroll computer is starting ${payrollImportDate.value} now.`,
            life: 4500,
        })
    } catch (requestError) {
        toast.add({ severity: "error", summary: "Run request failed", detail: errorMessage(requestError), life: 5000 })
    } finally {
        requestingPayrollRun.value = false
    }
}

async function cancelPayrollBotRun() {
    cancellingPayrollRun.value = true
    try {
        Object.assign(payrollSchedule, await cancelAttendancePayrollBotRun({
            companyId: workspace.companyId,
            branchId: workspace.branchId,
        }))
        toast.add({
            severity: "warn",
            summary: "Cancellation requested",
            detail: payrollSchedule.cancelPending
                ? "The bot will stop safely at its next step."
                : "The pending run was cancelled.",
            life: 4500,
        })
    } catch (requestError) {
        toast.add({ severity: "error", summary: "Cancel failed", detail: errorMessage(requestError), life: 5000 })
    } finally {
        cancellingPayrollRun.value = false
    }
}

function stopPayrollStatusPolling() {
    if (payrollStatusTimer) window.clearInterval(payrollStatusTimer)
    payrollStatusTimer = null
}

function clearPayrollSuccessClose() {
    if (payrollSuccessCloseTimer) window.clearTimeout(payrollSuccessCloseTimer)
    payrollSuccessCloseTimer = null
}

function schedulePayrollSuccessClose() {
    clearPayrollSuccessClose()

    const importedDate = payrollSchedule.lastImportedDate
        || payrollSchedule.requestedDate
        || payrollImportDate.value

    payrollSuccessCloseTimer = window.setTimeout(async () => {
        payrollSuccessCloseTimer = null
        payrollScheduleDialogVisible.value = false
        payrollCompletionVisible.value = false

        if (importedDate) {
            payrollImportDate.value = importedDate
            filters.reportDate = importedDate
            syncReportMonth(importedDate)
        }

        await load()
    }, 1500)
}

function startPayrollStatusPolling() {
    stopPayrollStatusPolling()
    payrollStatusTimer = window.setInterval(() => {
        if (payrollScheduleDialogVisible.value) {
            loadPayrollSchedule()
        }
    }, 1000)
}

function stopEmailScheduleStatusPolling() {
    if (emailScheduleStatusTimer) window.clearInterval(emailScheduleStatusTimer)
    emailScheduleStatusTimer = null
}

function startEmailScheduleStatusPolling() {
    stopEmailScheduleStatusPolling()
    emailScheduleStatusTimer = window.setInterval(() => {
        if (emailSchedule.enabled) {
            loadEmailSchedule({ silent: true })
        }
    }, 30_000)
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
        Object.assign(progress, { percent: 25, phase: "LOADING_DATA", processedRows: 0, totalRows: 0 })
        report.value = await fetchAttendanceDailyReport(params())
        Object.assign(progress, { percent: 100, phase: "COMPLETED", processedRows: 1, totalRows: 1 })
        collapsedDepartments.value = new Set()
        void refreshEmailStatus()
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

async function loadShifts() {
    shifts.value = workspace.ready
        ? await lookupShifts({ companyId: workspace.companyId, branchId: workspace.branchId, status: "ACTIVE" })
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
        LOADING_DATA: "Loading employee and report data",
        AGGREGATING_ATTENDANCE: "Aggregating attendance",
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

function exactCount(value) {
    return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function rateOrCount(rate, count) {
    return showExactCounts.value ? exactCount(count) : percent(rate)
}

const summaryRows = computed(() => report.value ? [
    { label: "TOTAL EMPLOYEE", values: report.value.summary.totalEmployees, average: report.value.summary.averages.totalEmployees },
    { label: "FACE SCAN", values: report.value.summary.faceScans, average: report.value.summary.averages.faceScans },
    { label: "- MATERNITY LEAVE", values: report.value.summary.leaves.ML, average: report.value.summary.averages.leaves.ML },
    { label: "- ANNUAL LEAVE", values: report.value.summary.leaves.AL, average: report.value.summary.averages.leaves.AL },
    { label: "- SPECIAL PERMISSION", values: report.value.summary.leaves.SP, average: report.value.summary.averages.leaves.SP },
    { label: "- UNPAID LEAVE", values: report.value.summary.leaves.UL, average: report.value.summary.averages.leaves.UL },
    { label: "- SICK LEAVE", values: report.value.summary.leaves.SL, average: report.value.summary.averages.leaves.SL },
] : [])

const sewerAbsentRows = computed(() => {
    const sewer = report.value?.sewerAbsentRate

    if (!sewer) return []

    return [
        { label: "TOTAL SEWER", values: sewer.totalSewer, average: sewer.averages.totalSewer, percent: false },
        { label: "- MATERNITY LEAVE", values: sewer.maternityLeaveRate, counts: sewer.maternityLeaveCount, average: sewer.averages.maternityLeaveRate, averageCount: sewer.averages.maternityLeaveCount, percent: true },
        { label: "- ANNUAL LEAVE / UNPAID", values: sewer.annualUnpaidLeaveRate, counts: sewer.annualUnpaidLeaveCount, average: sewer.averages.annualUnpaidLeaveRate, averageCount: sewer.averages.annualUnpaidLeaveCount, percent: true },
        { label: "- SICK LEAVE", values: sewer.sickLeaveRate, counts: sewer.sickLeaveCount, average: sewer.averages.sickLeaveRate, averageCount: sewer.averages.sickLeaveCount, percent: true },
        { label: "- ABSENT WITHOUT INFORM", values: sewer.absentWithoutInformRate, counts: sewer.absentWithoutInformCount, average: sewer.averages.absentWithoutInformRate, averageCount: sewer.averages.absentWithoutInformCount, percent: true },
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
    filters.shiftId = ALL_SHIFTS
    await Promise.all([loadDepartments(), loadShifts(), load(), loadEmailSchedule(), loadPayrollSchedule()])
})
watch(payrollScheduleDialogVisible, (visible) => {
    if (visible) startPayrollStatusPolling()
    else {
        stopPayrollStatusPolling()
        clearPayrollSuccessClose()
        payrollCompletionVisible.value = false
    }
})
onMounted(() => {
    startEmailScheduleStatusPolling()
    return Promise.all([loadDepartments(), loadShifts(), load(), loadEmailSchedule(), loadPayrollSchedule()])
})
onBeforeUnmount(() => {
    stopPayrollStatusPolling()
    clearPayrollSuccessClose()
    stopEmailScheduleStatusPolling()
})
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
                <PermissionButton
                    :permission="ATTENDANCE_PERMISSIONS.RECORD_IMPORT"
                    label="Payroll Import"
                    icon="pi pi-play-circle"
                    severity="secondary"
                    text
                    @click="openPayrollScheduleDialog"
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
        <Message
            v-if="emailSchedule.enabled && emailSchedule.lastBlockedDate === currentDate"
            severity="warn"
            :closable="false"
        >
            {{ emailSchedule.lastBlockedReason || "Today's attendance email is waiting for a successful Payroll import." }}
        </Message>
        <div v-if="loading || exporting" class="progress-state">
            <div><strong>{{ exporting ? "Exporting Excel" : "Loading daily report" }}</strong><span>{{ progressText }}</span></div>
            <ProgressBar :value="progress.percent" />
        </div>

        <div v-else-if="report" class="report-stack">
            <div class="report-card">
            <div class="report-heading">
                <div class="report-title-group">
                    <div><strong>Attendance Daily Report</strong><span>{{ report.month }}</span></div>
                    <Select
                        v-model="selectedShiftOption"
                        class="compact-shift-select"
                        :options="shiftOptions"
                        option-label="name"
                        :filter="shiftOptions.length > 8"
                        aria-label="Shift"
                        @change="load"
                    >
                        <template #value="{ value, placeholder }">
                            <span v-if="value" class="shift-selected-label">{{ value.name }}</span>
                            <span v-else class="shift-selected-label">{{ placeholder || "All Shifts" }}</span>
                        </template>
                        <template #option="{ option }">
                            <span>{{ option.name }}</span>
                        </template>
                    </Select>
                </div>
                <div class="report-heading-actions">
                    <div class="metric-view-control" :title="t('attendance.dailyReport.displayModeHelp')">
                        <span :class="{ active: !showExactCounts }">{{ t("attendance.dailyReport.percentageView") }}</span>
                        <ToggleSwitch
                            v-model="showExactCounts"
                            :aria-label="t('attendance.dailyReport.displayMode')"
                        />
                        <span :class="{ active: showExactCounts }">{{ t("attendance.dailyReport.exactCountView") }}</span>
                    </div>
                    <div class="legend"><span>{{ attendanceTargetText }}</span></div>
                </div>
            </div>
            <div class="table-scroll">
                <table class="daily-table">
                    <thead><tr><th class="label-cell">Daily Summary</th><th v-for="day in report.days" :key="day.key" :class="{ 'day-off': !day.working }" :title="day.name || day.dayType">{{ day.day }}</th><th>Avg</th></tr></thead>
                    <tbody>
                        <tr v-for="row in summaryRows" :key="row.label"><th class="label-cell">{{ row.label }}</th><td v-for="(value,index) in row.values" :key="index" :class="{ 'day-off': !report.days[index].working }">{{ report.days[index].working ? number(value) : "" }}</td><td>{{ number(row.average) }}</td></tr>
                        <tr class="absent-total"><th class="label-cell">{{ showExactCounts ? "ABSENT" : "ABSENT RATE" }}</th><td v-for="(value,index) in report.summary.absentRate" :key="index" :class="percentageClass(report.days[index].working ? value : null)">{{ report.days[index].working ? rateOrCount(value, report.summary.absent[index]) : "" }}</td><td :class="percentageClass(report.summary.averages.absentRate)">{{ rateOrCount(report.summary.averages.absentRate, report.summary.averages.absent) }}</td></tr>
                        <tr class="section-row"><th class="label-cell">FORGET FINGER SCAN</th><td :colspan="report.days.length + 1" /></tr>
                        <tr v-for="row in visibleGroupRows" :key="row.key" :class="{ 'department-row': row.level === 0, 'position-row': row.level === 1 }">
                            <th class="label-cell" :class="{ 'department-toggle-cell': row.level === 0 && isDepartmentExpandable(row) }" @click="toggleDepartment(row)">
                                <button v-if="row.level === 0 && isDepartmentExpandable(row)" class="department-toggle" type="button" :aria-expanded="!isDepartmentCollapsed(row)" :title="isDepartmentCollapsed(row) ? 'Open Sewing positions' : 'Close Sewing positions'">
                                    <i :class="isDepartmentCollapsed(row) ? 'pi pi-angle-right' : 'pi pi-angle-down'" />
                                    <span>{{ row.label }}</span>
                                </button>
                                <span v-else>{{ row.label }}</span>
                            </th>
                            <td v-for="(value,index) in row.values" :key="index" :class="percentageClass(value)">{{ value === null ? "" : rateOrCount(value, row.counts[index]) }}</td>
                            <td :class="percentageClass(row.average)">{{ rateOrCount(row.average, row.averageCount) }}</td>
                        </tr>
                        <tr class="section-row sewer-section"><th class="label-cell">SEWER ABSENT RATE</th><td :colspan="report.days.length + 1" /></tr>
                        <tr v-for="row in sewerAbsentRows" :key="`sewer-${row.label}`">
                            <th class="label-cell">{{ row.label }}</th>
                            <td
                                v-for="(value, index) in row.values"
                                :key="index"
                                :class="row.percent ? percentageClass(value) : { 'day-off': !report.days[index].working }"
                            >
                                {{ value === null ? "" : row.percent ? rateOrCount(value, row.counts[index]) : number(value) }}
                            </td>
                            <td :class="row.percent ? percentageClass(row.average) : ''">
                                {{ row.percent ? rateOrCount(row.average, row.averageCount) : number(row.average) }}
                            </td>
                        </tr>
                        <tr class="sewer-absent-total">
                            <th class="label-cell">{{ showExactCounts ? "TOTAL ABSENT" : "TOTAL ABSENT RATE" }}</th>
                            <td
                                v-for="(value, index) in report.sewerAbsentRate.totalAbsentRate"
                                :key="index"
                                :class="percentageClass(value)"
                            >
                                {{ value === null ? "" : rateOrCount(value, report.sewerAbsentRate.totalAbsentCount[index]) }}
                            </td>
                            <td :class="percentageClass(report.sewerAbsentRate.averages.totalAbsentRate)">
                                {{ rateOrCount(report.sewerAbsentRate.averages.totalAbsentRate, report.sewerAbsentRate.averages.totalAbsentCount) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
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
                        <strong>Send only after a confirmed Payroll import</strong>
                        <span>The same attendance date must be imported successfully before the report can be sent.</span>
                    </div>
                    <ToggleSwitch v-model="emailSchedule.enabled" />
                </div>

                <label class="schedule-field">
                    <span>Scheduled sending time</span>
                    <input v-model="emailSchedule.sendTime" type="time" step="60" :disabled="!emailSchedule.enabled" />
                    <small>Cambodia time. The backend scheduler checks every 30 seconds.</small>
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
                    If the import finishes before this time, the report waits and sends at the scheduled time. If the time passes first, no old or empty report is sent; HRMS shows a warning and sends immediately after the correct import succeeds. Duplicate emails remain blocked.
                </Message>

                <Message v-if="emailSchedule.lastBlockedReason" severity="warn" :closable="false">
                    {{ emailSchedule.lastBlockedReason }}
                </Message>

                <dl v-if="emailSchedule.lastSentDate || emailSchedule.lastSkippedDate || emailSchedule.lastBlockedDate || emailSchedule.lastError" class="schedule-status">
                    <template v-if="emailSchedule.lastSentDate">
                        <dt>Last automatic date</dt>
                        <dd>{{ emailSchedule.lastSentDate }}</dd>
                    </template>
                    <template v-if="emailSchedule.lastSkippedDate">
                        <dt>Last skipped date</dt>
                        <dd>{{ emailSchedule.lastSkippedDate }} ({{ emailSchedule.lastSkippedDayType }})</dd>
                    </template>
                    <template v-if="emailSchedule.lastBlockedDate">
                        <dt>Waiting import</dt>
                        <dd>{{ emailSchedule.lastBlockedDate }}</dd>
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

        <Dialog v-model:visible="payrollScheduleDialogVisible" modal header="Payroll Attendance Import" :style="{ width: '34rem' }" :breakpoints="{ '640px': '94vw' }">
            <div class="schedule-form">
                <Message severity="info" :closable="false">
                    Select the attendance date and click Start Payroll Import. The bot begins immediately and must export this exact date.
                </Message>

                <Message
                    :severity="payrollAgentReady ? 'success' : 'warn'"
                    :closable="false"
                >
                    <template v-if="payrollAgentReady">
                        Bot ready on {{ payrollSchedule.agentMachineName || "Payroll computer" }}<template v-if="payrollSchedule.agentVersion"> · version {{ payrollSchedule.agentVersion }}</template>. No terminal is required.
                    </template>
                    <template v-else>
                        Bot offline. Run SETUP_THIS_COMPUTER once on the Payroll computer. After that, it starts automatically with Windows.
                    </template>
                </Message>

                <label class="schedule-field">
                    <span>Attendance date to import</span>
                    <EnterpriseCalendarDatePicker
                        v-model="payrollImportDate"
                        :company-id="workspace.companyId"
                        :branch-id="workspace.branchId"
                        :max-date="currentDate"
                        :disabled="payrollRunActive"
                        placeholder="Select attendance date"
                        compact
                    />
                    <small>Dates and day types come from the internal Calendar setup.</small>
                </label>

                <div
                    v-if="payrollRunActive || payrollCompletionVisible"
                    class="payroll-progress"
                >
                    <div>
                        <strong>{{ payrollCompletionVisible ? "COMPLETED" : (payrollSchedule.progressPhase ? payrollSchedule.progressPhase.replaceAll("_", " ") : "WAITING FOR PAYROLL COMPUTER") }}</strong>
                        <span>{{ payrollCompletionVisible ? 100 : (payrollSchedule.progressPercent || 0) }}%</span>
                    </div>
                    <ProgressBar :value="payrollCompletionVisible ? 100 : (payrollSchedule.progressPercent || 0)" />
                    <div v-if="payrollEmployeeProgressText" class="payroll-progress-count">
                        <span>Employees processed</span>
                        <strong>{{ payrollEmployeeProgressText }}</strong>
                    </div>
                    <small v-if="payrollSchedule.progressDetail">{{ payrollSchedule.progressDetail }}</small>
                </div>

                <dl class="schedule-status">
                    <dt>Current status</dt>
                    <dd>{{ payrollCurrentStatus }}</dd>
                    <template v-if="payrollSchedule.agentLastSeenAt">
                        <dt>Bot last seen</dt>
                        <dd>{{ new Date(payrollSchedule.agentLastSeenAt).toLocaleString() }}</dd>
                    </template>
                    <template v-if="payrollRunActive && payrollSchedule.requestedDate">
                        <dt>Requested date</dt>
                        <dd>{{ payrollSchedule.requestedDate }}</dd>
                    </template>
                    <template v-if="payrollRunActive && payrollSchedule.lastRunAt">
                        <dt>Run started</dt>
                        <dd>{{ new Date(payrollSchedule.lastRunAt).toLocaleString() }}</dd>
                    </template>
                </dl>

                <Message
                    v-if="!payrollRunActive && payrollSchedule.status === 'SUCCESS' && payrollSchedule.lastImportedDate === payrollImportDate"
                    severity="success"
                    :closable="false"
                >
                    Attendance for {{ payrollSchedule.lastImportedDate }} was imported successfully. Starting again will create a fresh run for the selected date.
                </Message>

                <dl v-if="payrollSchedule.lastSuccessAt || payrollSchedule.lastError || payrollSchedule.lastCancelledAt" class="schedule-status previous-run-status">
                    <template v-if="payrollSchedule.lastSuccessAt">
                        <dt>Previous success</dt>
                        <dd>{{ new Date(payrollSchedule.lastSuccessAt).toLocaleString() }}</dd>
                    </template>
                    <template v-if="payrollSchedule.lastImportedDate">
                        <dt>Imported date</dt>
                        <dd>{{ payrollSchedule.lastImportedDate }}</dd>
                    </template>
                    <template v-if="payrollSchedule.lastImportedFile">
                        <dt>Imported file</dt>
                        <dd>{{ payrollSchedule.lastImportedFile }}</dd>
                    </template>
                    <template v-if="payrollSchedule.lastSuccessAt">
                        <dt>Imported rows</dt>
                        <dd>{{ Number(payrollSchedule.lastImportedRowCount || 0).toLocaleString() }}</dd>
                    </template>
                    <template v-if="payrollSchedule.lastCancelledAt && payrollSchedule.status === 'CANCELLED'">
                        <dt>Previous cancelled</dt>
                        <dd>{{ new Date(payrollSchedule.lastCancelledAt).toLocaleString() }}</dd>
                    </template>
                    <template v-if="payrollSchedule.lastError && payrollSchedule.status === 'FAILED'">
                        <dt>Previous error</dt>
                        <dd class="schedule-error">{{ payrollSchedule.lastError }}</dd>
                    </template>
                </dl>
            </div>
            <template #footer>
                <Button label="Close" severity="secondary" text :disabled="requestingPayrollRun || cancellingPayrollRun" @click="payrollScheduleDialogVisible = false" />
                <PermissionButton
                    v-if="payrollSchedule.canCancel"
                    :permission="ATTENDANCE_PERMISSIONS.RECORD_IMPORT"
                    :label="payrollSchedule.cancelPending ? 'Stopping…' : 'Cancel Run'"
                    icon="pi pi-stop-circle"
                    severity="danger"
                    :loading="cancellingPayrollRun || payrollSchedule.cancelPending"
                    :disabled="cancellingPayrollRun || payrollSchedule.cancelPending"
                    @click="cancelPayrollBotRun"
                />
                <PermissionButton
                    :permission="ATTENDANCE_PERMISSIONS.RECORD_IMPORT"
                    label="Start Payroll Import"
                    icon="pi pi-play"
                    severity="primary"
                    :loading="requestingPayrollRun"
                    :disabled="!payrollAgentReady || !payrollImportDate || payrollRunActive || payrollCompletionVisible || cancellingPayrollRun"
                    @click="runPayrollBotNow"
                />
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

.payroll-progress {
    display: grid;
    gap: 0.45rem;
    padding: 0.75rem;
    border: 1px solid var(--p-surface-200);
    border-radius: 0.65rem;
    background: var(--p-surface-50);
}

.payroll-progress > div:first-child {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.82rem;
}

.payroll-progress small {
    color: var(--p-text-muted-color);
}

.payroll-progress-count {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: var(--p-text-muted-color);
    font-size: 0.82rem;
}

.payroll-progress-count strong {
    color: var(--p-text-color);
    font-variant-numeric: tabular-nums;
}

.schedule-status dt {
    color: var(--p-text-muted-color);
    font-weight: 600;
}

.schedule-status dd {
    margin: 0;
    overflow-wrap: anywhere;
}

.previous-run-status {
    padding-top: 0.75rem;
    border-top: 1px solid var(--p-content-border-color);
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
    gap: 0.55rem;
}

.metric-view-control {
    display: inline-flex !important;
    align-items: center;
    gap: 0.35rem !important;
    padding: 0.18rem 0.45rem;
    border: 1px solid var(--p-content-border-color);
    border-radius: 999px;
    background: var(--p-content-background);
    white-space: nowrap;
}

.metric-view-control span {
    color: var(--p-text-muted-color) !important;
    font-size: 0.68rem;
    font-weight: 600;
}

.metric-view-control span.active {
    color: var(--p-primary-color) !important;
}

.metric-view-control :deep(.p-toggleswitch) {
    width: 1.85rem;
    height: 1.05rem;
}

.metric-view-control :deep(.p-toggleswitch-handle) {
    width: 0.75rem;
    height: 0.75rem;
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


.report-stack {
    display: grid;
    gap: 0.75rem;
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
        width: 100%;
        flex-wrap: wrap;
    }

    .metric-view-control {
        margin-left: auto;
    }

    .label-cell {
        min-width: 10.5rem !important;
        max-width: 10.5rem;
    }
}

.report-title-group {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
}

.report-title-group > div:first-child {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    min-width: 0;
}

.compact-shift-select {
    width: 11.5rem;
    min-height: 2rem;
}

.compact-shift-select :deep(.p-select-label) {
    padding-block: 0.35rem;
    font-size: 0.78rem;
}

.shift-selected-label {
    display: block;
    overflow: hidden;
    color: var(--p-form-field-color) !important;
    font-size: 0.78rem;
    line-height: 1.25rem;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.compact-shift-select :deep(.p-select-dropdown) {
    width: 2rem;
}

@media (max-width: 760px) {
    .report-title-group {
        align-items: stretch;
        flex-direction: column;
        gap: 0.4rem;
    }

    .compact-shift-select {
        width: 100%;
    }
}
</style>
