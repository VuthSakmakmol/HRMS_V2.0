<script setup>
import { computed, onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"

import Message from "primevue/message"
import ProgressSpinner from "primevue/progressspinner"

import AttendanceDashboardSection from "../components/attendance/AttendanceDashboardSection.vue"
import AttendanceAbsenceDataSection from "../components/attendance/AttendanceAbsenceDataSection.vue"
import DashboardFilterBar from "../components/shared/DashboardFilterBar.vue"
import GeneralDataSection from "../components/general/GeneralDataSection.vue"
import ManpowerSection from "../components/manpower/ManpowerSection.vue"
import MovementSection from "../components/movement/MovementSection.vue"
import RecruitmentChannelSection from "../components/recruitment/RecruitmentChannelSection.vue"
import TurnoverDashboardSection from "../components/turnover/TurnoverDashboardSection.vue"
import ExitAnalysisSection from "../components/exitAnalysis/ExitAnalysisSection.vue"
import { useHrDashboardStore } from "../stores/hrDashboard.store.js"

const { t } = useI18n()
const dashboardStore = useHrDashboardStore()

const filters = ref(normalizeFilters(dashboardStore.filters))

const dashboard = computed(() => dashboardStore.dashboard || {})
const selectedPeriodKey = computed(() =>
    dashboard.value.filters?.selectedPeriodKey || null,
)
const employeeTypeLabel = computed(() =>
    dashboard.value.filters?.employeeTypeLabel ||
    safeT("hrDashboard.filters.allEmployeeTypes", "All employee types"),
)
const hasDashboardData = computed(() => {
    const data = dashboard.value

    if (!data || !data.general) return false

    const generalHasData = [
        data.general.totalEmployees,
        data.general.workingEmployees,
        data.general.inactiveEmployees,
        data.general.leftEmployees,
    ].some((value) => Number(value) > 0)

    const manpowerHasData = (data.manpower || []).some((row) =>
        [row.budget, row.roadmap, row.actual].some((value) => Number(value) > 0),
    )

    const attendanceMonthlyHasData = (data.attendance?.monthly || []).some((row) =>
        [
            row.processed,
            row.present,
            row.absent,
            row.late,
            row.earlyLeave,
            row.missingPunch,
            row.needsReview,
            row.holiday,
            row.restDay,
        ].some((value) => Number(value) > 0),
    )

    const absenceChartHasData = (data.attendance?.absenceComparison?.rows || []).some((row) =>
        [
            row.previousRate,
            row.currentRate,
            row.previousCount,
            row.currentCount,
        ].some((value) => Number(value) !== 0),
    )

    const absenceTableHasData =
        Boolean((data.attendance?.absenceOverall?.rows || []).length) ||
        Boolean((data.attendance?.topAbsentDepartments?.rows || []).length)

    const attendanceHasData = attendanceMonthlyHasData || absenceChartHasData || absenceTableHasData

    const recruitmentHasData = (data.recruitment?.rows || []).some((row) =>
        [row.previousTotal, row.currentTotal, row.targetPerMonth].some(
            (value) => Number(value) > 0,
        ),
    )

    const exitAnalysisHasData =
        (data.exitAnalysis?.exitReasons?.rows || []).some((row) => Number(row.count || 0) > 0) ||
        (data.exitAnalysis?.servicePeriods?.rows || []).some((row) => Number(row.count || 0) > 0)

    const turnoverHasData = (data.turnover?.rows || []).some((row) =>
        [row.previousCount, row.currentCount, row.previousRate, row.currentRate].some(
            (value) => Number(value) !== 0,
        ),
    )

    const movementHasData = (data.movement || []).some((row) =>
        [row.in, row.out, row.balance].some((value) => Number(value) !== 0),
    )

    return generalHasData || manpowerHasData || attendanceHasData || recruitmentHasData || exitAnalysisHasData || turnoverHasData || movementHasData
})
const showNoDataMessage = computed(() =>
    Boolean(dashboardStore.dashboard) &&
    !dashboardStore.loading &&
    !dashboardStore.error &&
    !hasDashboardData.value,
)

function safeT(key, fallback) {
    const translated = t(key)

    return translated === key ? fallback : translated
}

function toDateString(value) {
    if (!value) return ""
    if (typeof value === "string") return value.slice(0, 10)
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return ""

    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")

    return `${year}-${month}-${day}`
}

function normalizeFilters(value = {}) {
    return {
        ...value,
        startDate: toDateString(value.startDate),
        endDate: toDateString(value.endDate),
    }
}

function createDefaultFilters() {
    const year = new Date().getFullYear()

    return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        companyId: undefined,
        branchId: undefined,
        employeeTypeFilterKey: undefined,
        departmentId: undefined,
        positionId: undefined,
        lineId: undefined,
    }
}

async function loadDashboard() {
    await dashboardStore.loadDashboard(filters.value)
}

async function loadLookups(scopeFilters = filters.value) {
    await dashboardStore.loadLookups(scopeFilters)
}

async function handleScopeChange(nextFilters) {
    filters.value = normalizeFilters(nextFilters)
    await loadLookups(filters.value)
}

async function resetFilters() {
    filters.value = createDefaultFilters()

    await Promise.all([
        loadLookups(filters.value),
        dashboardStore.loadDashboard(filters.value),
    ])
}

onMounted(async () => {
    filters.value = normalizeFilters({
        ...createDefaultFilters(),
        ...dashboardStore.filters,
    })

    await Promise.all([
        loadLookups(filters.value),
        loadDashboard(),
    ])
})
</script>

<template>
    <section class="hr-dashboard-page hrms-compact">
        <div class="hr-dashboard-page__sticky-tools">
            <DashboardFilterBar
                v-model="filters"
                :lookups="dashboardStore.lookups"
                :loading="dashboardStore.loading"
                :lookup-loading="dashboardStore.lookupLoading"
                @apply="loadDashboard"
                @reset="resetFilters"
                @refresh="loadDashboard"
                @scope-change="handleScopeChange"
            />
        </div>

        <div class="hr-dashboard-page__body">
            <Message
                v-if="dashboardStore.error"
                severity="error"
                :closable="false"
            >
                {{ safeT("hrDashboard.loadFailed", "Unable to load the HR dashboard.") }}
            </Message>

            <Message
                v-else-if="showNoDataMessage"
                severity="info"
                :closable="false"
            >
                {{ safeT("hrDashboard.noData", "No dashboard data matched this filter.") }}
            </Message>

            <div
                v-if="dashboardStore.loading && !dashboardStore.dashboard"
                class="hr-dashboard-page__loading"
            >
                <ProgressSpinner />
            </div>

            <main
                v-else
                class="hr-dashboard-page__content"
            >
                <GeneralDataSection
                    :data="dashboard.general"
                    :employee-type-label="employeeTypeLabel"
                />

                <ManpowerSection
                    :title="safeT('hrDashboard.sections.manpower', 'Manpower')"
                    :subtitle="employeeTypeLabel"
                    :rows="dashboard.manpower || []"
                    :selected-period-key="selectedPeriodKey"
                />

                <RecruitmentChannelSection
                    :title="safeT('hrDashboard.sections.recruitmentChannels', 'Recruitment Channels')"
                    :data="dashboard.recruitment || {}"
                    :selected-period-key="selectedPeriodKey"
                />

                <AttendanceDashboardSection
                    :title="safeT('hrDashboard.sections.attendanceDashboard', 'Attendance Dashboard')"
                    :data="dashboard.attendance || {}"
                    :selected-period-key="selectedPeriodKey"
                />

                <AttendanceAbsenceDataSection
                    :title="safeT('hrDashboard.attendance.absentData', 'Absent Data')"
                    :data="dashboard.attendance || {}"
                />

                <ExitAnalysisSection
                    :title="safeT('hrDashboard.sections.exitAnalysis', 'Exit Analysis')"
                    :data="dashboard.exitAnalysis || {}"
                />

                <TurnoverDashboardSection
                    :title="safeT('hrDashboard.sections.turnover', 'Turnover')"
                    :data="dashboard.turnover || {}"
                    :selected-period-key="selectedPeriodKey"
                />

                <MovementSection
                    :title="safeT('hrDashboard.sections.movement', 'Movement')"
                    :subtitle="employeeTypeLabel"
                    :rows="dashboard.movement || []"
                    :selected-period-key="selectedPeriodKey"
                />
            </main>
        </div>
    </section>
</template>

<style scoped>
.hr-dashboard-page {
    display: grid;
    min-width: 0;
    min-height: 100%;
    overflow: visible;
    isolation: isolate;
}

.hr-dashboard-page__sticky-tools {
    position: sticky;
    top: 0;
    z-index: 11000;
    width: 100%;
    min-width: 0;
    margin: 0;
    background: var(--hrms-surface);
    border-bottom: 1px solid var(--hrms-border);
    box-shadow: 0 0.3rem 0.9rem rgb(15 23 42 / 0.08);
    transform: translateZ(0);
    pointer-events: auto;
}

.hr-dashboard-page__body {
    display: grid;
    gap: 0.65rem;
    min-width: 0;
    padding: 0.65rem 0.875rem 0.875rem;
}

.hr-dashboard-page__content {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.7rem;
    min-width: 0;
}

.hr-dashboard-page__loading {
    display: grid;
    min-height: 16rem;
    place-items: center;
}

.hr-dashboard-page :deep(.dashboard-card),
.hr-dashboard-page :deep(.dashboard-section),
.hr-dashboard-page :deep(.p-datatable),
.hr-dashboard-page :deep(.p-chart) {
    max-width: 100%;
}

@media (max-width: 600px) {
    .hr-dashboard-page__body {
        padding: 0.5rem 0.625rem 0.625rem;
    }
}
</style>
