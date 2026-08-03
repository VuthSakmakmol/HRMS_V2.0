<script setup>
import Button from "primevue/button"
import Checkbox from "primevue/checkbox"
import Dialog from "primevue/dialog"
import InputText from "primevue/inputtext"
import Message from "primevue/message"
import Select from "primevue/select"
import Textarea from "primevue/textarea"
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue"
import { useToast } from "primevue/usetoast"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterprisePaginator from "@/shared/components/enterprise/EnterprisePaginator.vue"

import AttendanceRecordDialog from "../components/AttendanceRecordDialog.vue"
import AttendanceUnmatchedDialog from "../components/AttendanceUnmatchedDialog.vue"
import AttendanceVerificationTable from "../components/AttendanceVerificationTable.vue"
import {
    acceptAttendanceVerificationRecord,
    exportAttendanceImportIssues,
    fetchAttendanceVerificationWorkspace,
    runAttendanceVerification,
    updateAttendanceRecord,
} from "../services/attendance.api.js"
import "../styles/attendance-enterprise.css"

const toast = useToast()
const auth = useAuthStore()
const workspace = useWorkspaceStore()

function localDateKey(date = new Date()) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

function localDateTime(value) {
    if (!value) return ""
    const date = new Date(value)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16)
}

function requestErrorMessage(error) {
    return error?.response?.data?.error?.message ||
        error?.message ||
        "The request could not be completed."
}

const today = localDateKey()
const loading = ref(false)
const running = ref(false)
const saving = ref(false)
const accepting = ref(false)
const exportingUnmatched = ref(false)
const error = ref("")
const items = ref([])
const summary = ref({
    readiness: "NO_DATA",
    employeeCount: 0,
    rawScanCount: 0,
    totalRecords: 0,
    verifiedCount: 0,
    correctedCount: 0,
    needsReviewCount: 0,
    unmatchedCount: 0,
    missingShiftCount: 0,
    latestUpdatedAt: null,
})
const pagination = reactive({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
})
const query = reactive({
    page: 1,
    limit: 10,
    search: "",
    dateFrom: today,
    dateTo: today,
    verificationStatus: "NEEDS_REVIEW",
})
const runOptions = reactive({
    overwriteCorrected: false,
})
const correctionForm = reactive({
    employeeCode: "",
    attendanceDate: today,
    firstInAt: "",
    lastOutAt: "",
    note: "",
})

const confirmVisible = ref(false)
const correctionVisible = ref(false)
const acceptVisible = ref(false)
const unmatchedVisible = ref(false)
const selectedRecord = ref(null)
const acceptReason = ref("")
const lastRunSummary = ref(null)
let searchTimer = null

const canRun = computed(() =>
    auth.hasPermission("ATTENDANCE.VERIFICATION.RUN"),
)
const canCorrect = computed(() =>
    auth.hasPermission("ATTENDANCE.RECORD.UPDATE"),
)
const canExport = computed(() =>
    auth.hasPermission("ATTENDANCE.RECORD.EXPORT"),
)

const verificationOptions = [
    { label: "Needs Review", value: "NEEDS_REVIEW" },
    { label: "Corrected / HR Reviewed", value: "CORRECTED" },
    { label: "Automatically Verified", value: "VERIFIED" },
    { label: "All Records", value: "ALL" },
]

const summaryCards = computed(() => [
    {
        label: "Employees in Scope",
        value: summary.value.employeeCount || 0,
        tone: "neutral",
    },
    {
        label: "Raw Scans",
        value: summary.value.rawScanCount || 0,
        tone: "neutral",
    },
    {
        label: "Attendance Records",
        value: summary.value.totalRecords || 0,
        tone: "neutral",
    },
    {
        label: "Automatically Verified",
        value: summary.value.verifiedCount || 0,
        tone: "success",
    },
    {
        label: "Corrected / Reviewed",
        value: summary.value.correctedCount || 0,
        tone: "info",
    },
    {
        label: "Needs Review",
        value: summary.value.needsReviewCount || 0,
        tone: summary.value.needsReviewCount ? "warning" : "success",
    },
    {
        label: "Unmatched IDs",
        value: summary.value.unmatchedCount || 0,
        tone: summary.value.unmatchedCount ? "danger" : "success",
    },
    {
        label: "Missing Shift",
        value: summary.value.missingShiftCount || 0,
        tone: summary.value.missingShiftCount ? "danger" : "success",
    },
])

const readiness = computed(() => {
    const value = summary.value.readiness
    if (value === "READY") {
        return {
            severity: "success",
            icon: "pi pi-check-circle",
            title: "Attendance is ready",
            description:
                "No unmatched IDs, missing shifts, or records needing review remain in this period.",
        }
    }
    if (value === "ACTION_REQUIRED") {
        return {
            severity: "warn",
            icon: "pi pi-exclamation-triangle",
            title: "HR action is required",
            description:
                "Resolve the review queue, unmatched employee IDs, and missing shift assignments before using this period for payroll or reporting.",
        }
    }
    if (value === "NOT_VERIFIED") {
        return {
            severity: "info",
            icon: "pi pi-play-circle",
            title: "Raw scans are waiting for verification",
            description:
                "Run verification to convert the imported scans into final employee-day attendance records.",
        }
    }
    return {
        severity: "secondary",
        icon: "pi pi-inbox",
        title: "No attendance data",
        description:
            "Import attendance for this period first, then run verification.",
    }
})

const invalidDateRange = computed(() =>
    !query.dateFrom ||
    !query.dateTo ||
    query.dateFrom > query.dateTo,
)

async function load(overrides = {}) {
    Object.assign(query, overrides)
    if (!workspace.ready || invalidDateRange.value) return

    loading.value = true
    error.value = ""
    try {
        const result = await fetchAttendanceVerificationWorkspace({
            ...query,
            companyId: workspace.companyId,
            branchId: workspace.branchId,
        })
        items.value = result.items || []
        summary.value = result.summary || summary.value
        Object.assign(pagination, result.pagination || {})
    } catch (requestError) {
        error.value = requestErrorMessage(requestError)
    } finally {
        loading.value = false
    }
}

function delayedSearch() {
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => load({ page: 1 }), 350)
}

function clearFilters() {
    Object.assign(query, {
        page: 1,
        search: "",
        dateFrom: today,
        dateTo: today,
        verificationStatus: "NEEDS_REVIEW",
    })
    load()
}

function openRunConfirmation() {
    if (!canRun.value || running.value || invalidDateRange.value) return
    confirmVisible.value = true
}

async function runVerification() {
    confirmVisible.value = false
    running.value = true
    error.value = ""
    try {
        lastRunSummary.value = await runAttendanceVerification({
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
            companyId: workspace.companyId,
            branchId: workspace.branchId,
            overwriteCorrected: runOptions.overwriteCorrected,
        })
        query.verificationStatus = "NEEDS_REVIEW"
        await load({ page: 1 })
        toast.add({
            severity: "success",
            summary: "Verification completed",
            detail: `${lastRunSummary.value.createdOrUpdatedCount || 0} attendance records were created or updated.`,
            life: 4000,
        })
    } catch (requestError) {
        error.value = requestErrorMessage(requestError)
        toast.add({
            severity: "error",
            summary: "Verification failed",
            detail: error.value,
            life: 5000,
        })
    } finally {
        running.value = false
    }
}

function openCorrection(row) {
    selectedRecord.value = row
    Object.assign(correctionForm, {
        employeeCode: row.employeeCode,
        attendanceDate: String(row.attendanceDate).slice(0, 10),
        firstInAt: localDateTime(row.firstInAt),
        lastOutAt: localDateTime(row.lastOutAt),
        note: "",
    })
    correctionVisible.value = true
}

async function saveCorrection() {
    if (!selectedRecord.value) return

    saving.value = true
    try {
        await updateAttendanceRecord(selectedRecord.value.id, {
            ...correctionForm,
            companyId: workspace.companyId,
            branchId: workspace.branchId,
            firstInAt: correctionForm.firstInAt || null,
            lastOutAt: correctionForm.lastOutAt || null,
        })
        correctionVisible.value = false
        toast.add({
            severity: "success",
            summary: "Attendance corrected",
            detail: "The corrected record is protected from normal verification reruns.",
            life: 3500,
        })
        await load()
    } catch (requestError) {
        toast.add({
            severity: "error",
            summary: "Correction failed",
            detail: requestErrorMessage(requestError),
            life: 5000,
        })
    } finally {
        saving.value = false
    }
}

function openAccept(row) {
    selectedRecord.value = row
    acceptReason.value = ""
    acceptVisible.value = true
}

async function acceptRecord() {
    if (
        !selectedRecord.value ||
        acceptReason.value.trim().length < 3
    ) {
        return
    }

    accepting.value = true
    try {
        await acceptAttendanceVerificationRecord(
            selectedRecord.value.id,
            acceptReason.value.trim(),
        )
        acceptVisible.value = false
        toast.add({
            severity: "success",
            summary: "Record accepted",
            detail: "The calculated result was accepted and protected as HR reviewed.",
            life: 3500,
        })
        await load()
    } catch (requestError) {
        toast.add({
            severity: "error",
            summary: "Unable to accept record",
            detail: requestErrorMessage(requestError),
            life: 5000,
        })
    } finally {
        accepting.value = false
    }
}

async function exportUnmatched() {
    if (!canExport.value || exportingUnmatched.value) return

    exportingUnmatched.value = true
    try {
        await exportAttendanceImportIssues({
            companyId: workspace.companyId,
            branchId: workspace.branchId,
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
            status: "NO_EMPLOYEE_MATCH",
        })
    } catch (requestError) {
        toast.add({
            severity: "error",
            summary: "Unmatched export failed",
            detail: requestErrorMessage(requestError),
            life: 5000,
        })
    } finally {
        exportingUnmatched.value = false
    }
}

watch(
    () => workspace.revision,
    () => {
        query.page = 1
        load()
    },
)

onMounted(() => load())
onBeforeUnmount(() => window.clearTimeout(searchTimer))
</script>

<template>
    <section class="attendance-enterprise-page attendance-verification-page">
        <section class="hrms-list-card verification-heading">
            <div>
                <span class="verification-eyebrow">Attendance control workspace</span>
                <h1>Attendance Verification</h1>
                <p>
                    Convert imported scans into final Attendance Records, then resolve every exception before payroll or reporting.
                </p>
            </div>

            <div class="verification-heading__actions">
                <Button
                    label="Unmatched List"
                    icon="pi pi-exclamation-triangle"
                    severity="warn"
                    outlined
                    :disabled="!workspace.ready"
                    @click="unmatchedVisible = true"
                />
                <Button
                    v-if="canExport"
                    label="Export Unmatched"
                    icon="pi pi-file-excel"
                    severity="success"
                    outlined
                    :loading="exportingUnmatched"
                    :disabled="!workspace.ready"
                    @click="exportUnmatched"
                />
                <Button
                    v-if="canRun"
                    label="Run Verification"
                    icon="pi pi-play"
                    :loading="running"
                    :disabled="!workspace.ready || invalidDateRange"
                    @click="openRunConfirmation"
                />
            </div>
        </section>

        <EnterpriseFilterBar :loading="loading || running">
            <EnterpriseFilterField label="Search" search>
                <span class="verification-search">
                    <i class="pi pi-search" />
                    <InputText
                        v-model="query.search"
                        placeholder="Employee ID or name"
                        @input="delayedSearch"
                        @keyup.enter="load({ page: 1 })"
                    />
                </span>
            </EnterpriseFilterField>

            <EnterpriseFilterField label="From">
                <EnterpriseCalendarDatePicker
                    v-model="query.dateFrom"
                    :company-id="workspace.companyId"
                    :branch-id="workspace.branchId"
                    compact
                    :show-status="false"
                />
            </EnterpriseFilterField>

            <EnterpriseFilterField label="To">
                <EnterpriseCalendarDatePicker
                    v-model="query.dateTo"
                    :company-id="workspace.companyId"
                    :branch-id="workspace.branchId"
                    compact
                    :show-status="false"
                />
            </EnterpriseFilterField>

            <EnterpriseFilterField label="Review Status">
                <Select
                    v-model="query.verificationStatus"
                    :options="verificationOptions"
                    option-label="label"
                    option-value="value"
                />
            </EnterpriseFilterField>

            <template #actions>
                <Button
                    label="Clear"
                    icon="pi pi-times"
                    severity="secondary"
                    outlined
                    @click="clearFilters"
                />
                <Button
                    label="Apply"
                    icon="pi pi-check"
                    :loading="loading"
                    :disabled="invalidDateRange"
                    @click="load({ page: 1 })"
                />
            </template>
        </EnterpriseFilterBar>

        <Message
            :severity="readiness.severity"
            :closable="false"
            class="verification-readiness"
        >
            <div class="verification-readiness__content">
                <i :class="readiness.icon" />
                <div>
                    <strong>{{ readiness.title }}</strong>
                    <span>{{ readiness.description }}</span>
                </div>
            </div>
        </Message>

        <section class="attendance-metric-grid verification-metrics">
            <article
                v-for="card in summaryCards"
                :key="card.label"
                class="attendance-metric-card"
                :class="`is-${card.tone}`"
            >
                <strong>{{ card.value.toLocaleString() }}</strong>
                <span>{{ card.label }}</span>
            </article>
        </section>

        <Message
            v-if="lastRunSummary"
            severity="success"
            :closable="true"
            @close="lastRunSummary = null"
        >
            Verification processed {{ lastRunSummary.processedCount || 0 }} employee-days:
            {{ lastRunSummary.presentCount || 0 }} present,
            {{ lastRunSummary.absentCount || 0 }} absent,
            {{ lastRunSummary.reviewCount || 0 }} requiring review,
            {{ lastRunSummary.protectedImportedCount || 0 }} protected imported records,
            and {{ lastRunSummary.protectedCorrectedCount || 0 }} protected HR corrections.
        </Message>

        <Message v-if="error" severity="error" :closable="false">
            <div class="verification-error">
                <span>{{ error }}</span>
                <Button
                    label="Try Again"
                    size="small"
                    @click="load()"
                />
            </div>
        </Message>

        <section class="hrms-list-card verification-queue">
            <div class="verification-queue__heading">
                <div>
                    <h2>Verification Queue</h2>
                    <p>
                        Correct wrong or missing times. If the calculated result is valid, accept it with a reason.
                    </p>
                </div>
                <Button
                    icon="pi pi-refresh"
                    label="Refresh"
                    severity="secondary"
                    text
                    :loading="loading"
                    @click="load()"
                />
            </div>

            <AttendanceVerificationTable
                :items="items"
                :loading="loading"
                :can-correct="canCorrect"
                :can-accept="canCorrect"
                @correct="openCorrection"
                @accept="openAccept"
            />

            <div v-if="!loading && !items.length" class="verification-empty">
                No records match this review status and period.
            </div>

            <EnterprisePaginator
                :page="pagination.page"
                :limit="pagination.limit"
                :total="pagination.total"
                :total-pages="pagination.totalPages"
                :disabled="loading"
                @change="load({ page: $event.page, limit: $event.limit })"
            />
        </section>

        <Dialog
            v-model:visible="confirmVisible"
            modal
            header="Run Attendance Verification"
            class="hrms-standard-dialog--small"
        >
            <div class="verification-confirmation">
                <p>
                    Generate final Attendance Records from
                    <strong>{{ query.dateFrom }}</strong> through
                    <strong>{{ query.dateTo }}</strong>.
                </p>
                <div class="attendance-checkbox-row">
                    <Checkbox
                        v-model="runOptions.overwriteCorrected"
                        binary
                        input-id="overwriteCorrected"
                    />
                    <label for="overwriteCorrected">
                        Recalculate records previously corrected by HR
                    </label>
                </div>
                <Message
                    v-if="runOptions.overwriteCorrected"
                    severity="warn"
                    :closable="false"
                >
                    This will replace protected HR corrections in the selected period.
                </Message>
                <Message v-else severity="info" :closable="false">
                    Existing HR-corrected records remain protected.
                </Message>
            </div>

            <template #footer>
                <Button
                    label="Cancel"
                    severity="secondary"
                    outlined
                    @click="confirmVisible = false"
                />
                <Button
                    label="Run Verification"
                    icon="pi pi-play"
                    @click="runVerification"
                />
            </template>
        </Dialog>

        <AttendanceRecordDialog
            v-model:visible="correctionVisible"
            :form="correctionForm"
            editing
            :saving="saving"
            :company-id="workspace.companyId"
            :branch-id="workspace.branchId"
            @save="saveCorrection"
        />

        <Dialog
            v-model:visible="acceptVisible"
            modal
            header="Accept Calculated Attendance"
            class="hrms-standard-dialog--small"
        >
            <div class="verification-accept">
                <p>
                    Accept the calculated result for
                    <strong>{{ selectedRecord?.employeeCode }}</strong>
                    on
                    <strong>{{ String(selectedRecord?.attendanceDate || "").slice(0, 10) }}</strong>
                    without changing its times.
                </p>
                <label>
                    <span>Review reason <b>*</b></span>
                    <Textarea
                        v-model="acceptReason"
                        rows="4"
                        maxlength="1000"
                        placeholder="Explain why the calculated result is accepted"
                        :disabled="accepting"
                    />
                </label>
            </div>

            <template #footer>
                <Button
                    label="Cancel"
                    severity="secondary"
                    outlined
                    :disabled="accepting"
                    @click="acceptVisible = false"
                />
                <Button
                    label="Accept as Reviewed"
                    icon="pi pi-check-circle"
                    :loading="accepting"
                    :disabled="acceptReason.trim().length < 3"
                    @click="acceptRecord"
                />
            </template>
        </Dialog>

        <AttendanceUnmatchedDialog
            v-model:visible="unmatchedVisible"
            :company-id="workspace.companyId"
            :branch-id="workspace.branchId"
            :date-from="query.dateFrom"
            :date-to="query.dateTo"
        />
    </section>
</template>

<style scoped>
.attendance-verification-page {
    display: grid;
    gap: 0.85rem;
}

.verification-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.1rem;
}

.verification-heading h1,
.verification-queue h2 {
    margin: 0;
    color: var(--hrms-text-strong);
}

.verification-heading h1 {
    margin-top: 0.15rem;
    font-size: 1.2rem;
}

.verification-heading p,
.verification-queue p,
.verification-confirmation p,
.verification-accept p {
    margin: 0.25rem 0 0;
    color: var(--hrms-text-muted);
    font-size: var(--hrms-font-size-sm);
}

.verification-eyebrow {
    color: var(--p-primary-color);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.verification-heading__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.45rem;
}

.verification-search {
    position: relative;
    display: block;
    min-width: min(18rem, 100%);
}

.verification-search > i {
    position: absolute;
    z-index: 1;
    top: 50%;
    left: 0.7rem;
    color: var(--hrms-text-muted);
    transform: translateY(-50%);
}

.verification-search :deep(.p-inputtext) {
    width: 100%;
    padding-left: 2rem;
}

.verification-readiness {
    margin: 0;
}

.verification-readiness__content {
    display: flex;
    align-items: center;
    gap: 0.7rem;
}

.verification-readiness__content > i {
    font-size: 1.25rem;
}

.verification-readiness__content > div {
    display: grid;
    gap: 0.12rem;
}

.verification-readiness__content span {
    font-size: var(--hrms-font-size-sm);
}

.verification-metrics {
    grid-template-columns: repeat(8, minmax(8rem, 1fr));
}

.attendance-metric-card.is-success {
    border-color: color-mix(in srgb, var(--p-green-500) 30%, transparent);
}

.attendance-metric-card.is-warning {
    border-color: color-mix(in srgb, var(--p-orange-500) 40%, transparent);
}

.attendance-metric-card.is-danger {
    border-color: color-mix(in srgb, var(--p-red-500) 40%, transparent);
}

.verification-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}

.verification-queue {
    overflow: hidden;
}

.verification-queue__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.8rem 0.9rem;
    border-bottom: 1px solid var(--hrms-border);
}

.verification-queue h2 {
    font-size: 0.95rem;
}

.verification-empty {
    padding: 2rem;
    color: var(--hrms-text-muted);
    text-align: center;
}

.verification-confirmation,
.verification-accept {
    display: grid;
    gap: 0.9rem;
}

.verification-accept label {
    display: grid;
    gap: 0.35rem;
    font-size: 0.76rem;
    font-weight: 600;
}

.verification-accept label b {
    color: var(--p-red-500);
}

@media (max-width: 1350px) {
    .verification-metrics {
        grid-template-columns: repeat(4, minmax(9rem, 1fr));
    }
}

@media (max-width: 850px) {
    .verification-heading {
        align-items: stretch;
        flex-direction: column;
    }

    .verification-heading__actions {
        justify-content: flex-start;
    }

    .verification-metrics {
        grid-template-columns: repeat(2, minmax(8rem, 1fr));
    }
}

@media (max-width: 520px) {
    .verification-heading__actions :deep(.p-button) {
        width: 100%;
    }

    .verification-metrics {
        grid-template-columns: 1fr;
    }
}
</style>
