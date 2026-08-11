<script setup>
import { computed, onMounted, ref, watch } from "vue"
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
import { useExcomeStore } from "../stores/excome.store.js"
import { useWorkspaceStore } from "@/app/stores/workspace.store.js"


const { t } = useI18n()
const dashboardStore = useExcomeStore()
const workspaceStore = useWorkspaceStore()

const filters = ref(normalizeFilters(dashboardStore.filters))

const dashboard = computed(() => dashboardStore.dashboard || {})
const selectedPeriodKey = computed(() =>
    dashboard.value.filters?.selectedPeriodKey || null,
)
const employeeTypeLabel = computed(() =>
    dashboard.value.filters?.employeeTypeLabel ||
    safeT("excome.filters.allEmployeeTypes", "All employee types"),
)
const isWholeYearRange = computed(() => {
    const startDate = String(dashboard.value.filters?.startDate || "")
    const endDate = String(dashboard.value.filters?.endDate || "")

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return false
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return false

    return (
        startDate.slice(0, 4) === endDate.slice(0, 4) &&
        startDate.endsWith("-01-01") &&
        endDate.endsWith("-12-31")
    )
})
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
        companyId: workspaceStore.companyId || undefined,
        branchId: workspaceStore.branchId || undefined,
        employeeTypeFilterKey: undefined,
        exitReasonId: undefined,
        shiftId: undefined,
        departmentId: undefined,
        positionId: undefined,
        lineId: undefined,
    }
}

async function loadDashboard() {
    await dashboardStore.loadDashboard(filters.value)
}

function handleScopeChange(nextFilters) {
    // Company/branch lookups already contain every department/position/line
    // needed by the filter bar. Filtering them locally avoids a network call.
    filters.value = normalizeFilters(nextFilters)
}

async function resetFilters() {
    filters.value = createDefaultFilters()

    await dashboardStore.loadDashboard(filters.value)
}

watch(
    () => [workspaceStore.companyId, workspaceStore.branchId],
    async ([companyId, branchId], previousScope) => {
        if (!previousScope) return

        filters.value = {
            ...filters.value,
            companyId: companyId || undefined,
            branchId: branchId || undefined,
            employeeTypeFilterKey: undefined,
            exitReasonId: undefined,
            shiftId: undefined,
            departmentId: undefined,
            positionId: undefined,
            lineId: undefined,
        }

        await loadDashboard()
    },
)

onMounted(async () => {
    filters.value = normalizeFilters({
        ...createDefaultFilters(),
        ...dashboardStore.filters,
        companyId: workspaceStore.companyId || undefined,
        branchId: workspaceStore.branchId || undefined,
    })

    await loadDashboard()
})
</script>

<template>
    <section class="excome-page hrms-compact">
        <div class="excome-page__sticky-tools">
            <DashboardFilterBar
                v-model="filters"
                :lookups="dashboardStore.lookups"
                :loading="dashboardStore.loading"
                :lookup-loading="dashboardStore.lookupLoading"
                @apply="loadDashboard"
                @reset="resetFilters"
                @refresh="dashboardStore.refreshDashboard(filters)"
                @scope-change="handleScopeChange"
            />
        </div>

        <div class="excome-page__body">
            <Message
                v-if="dashboardStore.error"
                severity="error"
                :closable="false"
            >
                {{ safeT("excome.loadFailed", "Unable to load the HR dashboard.") }}
            </Message>

            <Message
                v-else-if="showNoDataMessage"
                severity="info"
                :closable="false"
            >
                {{ safeT("excome.noData", "No dashboard data matched this filter.") }}
            </Message>

            <div
                v-if="dashboardStore.loading && !dashboardStore.dashboard"
                class="excome-page__loading"
            >
                <ProgressSpinner />
            </div>

            <main
                v-else
                class="excome-page__content"
            >
                <article class="excome-module-card excome-module-card--general">
                    <GeneralDataSection
                        :data="dashboard.general"
                        :employee-type-label="employeeTypeLabel"
                    />
                </article>

                <article class="excome-module-card">
                    <ManpowerSection
                        :title="safeT('excome.sections.manpower', 'Manpower')"
                        :subtitle="employeeTypeLabel"
                        :rows="dashboard.manpower || []"
                        :selected-period-key="selectedPeriodKey"
                    />
                </article>

                <article class="excome-module-card">
                    <RecruitmentChannelSection
                        :title="safeT('excome.sections.recruitmentChannels', 'Recruitment Channels')"
                        :data="dashboard.recruitment || {}"
                        :selected-period-key="selectedPeriodKey"
                    />
                </article>

                <article class="excome-module-card">
                    <AttendanceDashboardSection
                        :title="safeT('excome.sections.attendanceDashboard', 'Attendance Dashboard')"
                        :data="dashboard.attendance || {}"
                        :selected-period-key="selectedPeriodKey"
                    />
                </article>

                <article class="excome-module-card">
                    <AttendanceAbsenceDataSection
                        :data="dashboard.attendance || {}"
                        :employee-type-label="employeeTypeLabel"
                        :selected-period-key="selectedPeriodKey"
                        :whole-year="isWholeYearRange"
                    />
                </article>

                <article class="excome-module-card">
                    <ExitAnalysisSection
                        :data="dashboard.exitAnalysis || {}"
                    />
                </article>

                <article class="excome-module-card">
                    <TurnoverDashboardSection
                        :title="safeT('excome.sections.turnover', 'Turnover')"
                        :data="dashboard.turnover || {}"
                        :selected-period-key="selectedPeriodKey"
                    />
                </article>

                <article class="excome-module-card">
                    <MovementSection
                        :title="safeT('excome.sections.movement', 'Movement')"
                        :subtitle="employeeTypeLabel"
                        :rows="dashboard.movement || []"
                        :selected-period-key="selectedPeriodKey"
                    />
                </article>
            </main>
        </div>
    </section>
</template>

<style scoped>
.excome-page {
    display: grid;
    min-width: 0;
    min-height: 100%;
    overflow: visible;
    isolation: isolate;
    background: var(--p-surface-50, #f7f9fc);
}

.excome-page__sticky-tools {
    position: sticky;
    top: 0;
    z-index: 11000;
    width: 100%;
    min-width: 0;
    margin: 0;
    border-bottom: 1px solid var(--hrms-border);
    background: var(--hrms-surface);
    box-shadow: 0 0.3rem 0.9rem rgb(15 23 42 / 0.08);
    transform: translateZ(0);
    pointer-events: auto;
}

.excome-page__body {
    display: grid;
    gap: 0.85rem;
    min-width: 0;
    padding: 0.9rem 1rem 1.1rem;
}

.excome-page__content {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    min-width: 0;
}

.excome-module-card {
    min-width: 0;
    padding: 0.7rem;
    overflow: hidden;
    border: 1px solid var(--p-content-border-color, #dbe3ec);
    border-radius: 0.8rem;
    background: var(--p-content-background, #fff);
    box-shadow:
        0 1px 2px rgb(15 23 42 / 0.04),
        0 5px 16px rgb(15 23 42 / 0.055);
}

.excome-module-card--general {
    padding: 0.8rem;
}

.excome-module-card:hover {
    border-color: color-mix(
        in srgb,
        var(--p-primary-color, #3b82f6) 24%,
        var(--p-content-border-color, #dbe3ec)
    );
    box-shadow:
        0 2px 4px rgb(15 23 42 / 0.04),
        0 8px 22px rgb(15 23 42 / 0.07);
}

.excome-page__loading {
    display: grid;
    min-height: 16rem;
    place-items: center;
}

.excome-page :deep(.dashboard-card),
.excome-page :deep(.dashboard-section),
.excome-page :deep(.p-datatable),
.excome-page :deep(.p-chart) {
    max-width: 100%;
}

/* The page card owns the outside edge. Child sections remain clean inside it. */
.excome-module-card :deep(> section),
.excome-module-card :deep(> div) {
    min-width: 0;
}

.excome-module-card :deep(.dashboard-section),
.excome-module-card :deep(.dashboard-card) {
    margin: 0;
    border-radius: 0.55rem;
}

@media (max-width: 900px) {
    .excome-page__body {
        padding: 0.75rem;
    }

    .excome-page__content {
        gap: 0.8rem;
    }

    .excome-module-card {
        padding: 0.55rem;
        border-radius: 0.7rem;
    }
}

@media (max-width: 600px) {
    .excome-page__body {
        gap: 0.65rem;
        padding: 0.55rem;
    }

    .excome-page__content {
        gap: 0.65rem;
    }

    .excome-module-card,
    .excome-module-card--general {
        padding: 0.4rem;
        border-radius: 0.6rem;
    }
}
</style>
