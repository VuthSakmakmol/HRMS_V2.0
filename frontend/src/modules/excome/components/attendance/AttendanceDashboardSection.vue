<script setup>
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"

import Button from "primevue/button"

import DashboardSectionHeader from "../shared/DashboardSectionHeader.vue"
import AttendanceAbsenceComparisonChart from "./AttendanceAbsenceComparisonChart.vue"
import AttendanceAbsenceDetailTable from "./AttendanceAbsenceDetailTable.vue"

const props = defineProps({
    title: {
        type: String,
        required: true,
    },
    data: {
        type: Object,
        default: () => ({}),
    },
    selectedPeriodKey: {
        type: String,
        default: null,
    },
})

const { t } = useI18n()
const viewMode = ref("TOTAL")

const comparison = computed(() => props.data.absenceComparison || {})
const totalRows = computed(() => comparison.value.rows || [])
const detailRows = computed(() => comparison.value.detailRows || [])

const chartTitle = computed(() => {
    const selectedLabel = comparison.value.selectedLabel || ""
    const metric = viewMode.value === "DETAIL"
        ? safeT("excome.attendance.absentDetail", "Absent Detail")
        : safeT("excome.attendance.totalAbsentPercent", "Total Absent")

    return `% ${selectedLabel} ${metric}`.replace(/\s+/g, " ").trim()
})

function safeT(key, fallback) {
    const translated = t(key)

    return translated === key ? fallback : translated
}

function setViewMode(mode) {
    viewMode.value = mode
}
</script>

<template>
    <section class="dashboard-section attendance-dashboard-section">
        <DashboardSectionHeader :title="title" />

        <div class="attendance-section-filter">
            <div class="attendance-section-filter__mode">
                <Button
                    :label="safeT('excome.attendance.totalView', 'Total')"
                    size="small"
                    :severity="viewMode === 'TOTAL' ? 'primary' : 'secondary'"
                    :outlined="viewMode !== 'TOTAL'"
                    @click="setViewMode('TOTAL')"
                />

                <Button
                    :label="safeT('excome.attendance.detailView', 'Detail')"
                    size="small"
                    :severity="viewMode === 'DETAIL' ? 'primary' : 'secondary'"
                    :outlined="viewMode !== 'DETAIL'"
                    @click="setViewMode('DETAIL')"
                />
            </div>

            <span
                v-if="viewMode === 'DETAIL'"
                class="attendance-section-filter__hint"
            >
                {{ safeT('excome.attendance.detailChartHint', 'All available absent types are shown in the chart.') }}
            </span>
        </div>

        <AttendanceAbsenceComparisonChart
            :mode="viewMode"
            :rows="totalRows"
            :detail-rows="detailRows"
            :previous-year="comparison.previousYear"
            :current-year="comparison.currentYear"
            :target-rate="comparison.targetRate"
            :title="chartTitle"
            :selected-period-key="selectedPeriodKey"
        />

        <AttendanceAbsenceDetailTable
            v-if="viewMode === 'DETAIL'"
            :rows="detailRows"
            :selected-period-key="selectedPeriodKey"
        />
    </section>
</template>

<style scoped>
.dashboard-section {
    display: grid;
    gap: 0;
}

.attendance-section-filter {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-width: 0;
    padding: 0.45rem 0.65rem;
    border-right: 1px solid var(--p-content-border-color, #dbe3ec);
    border-left: 1px solid var(--p-content-border-color, #dbe3ec);
    background: var(--p-surface-50, #f8fafc);
}

.attendance-section-filter__mode {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.35rem;
}

.attendance-section-filter__hint {
    min-width: 0;
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.72rem;
    font-weight: 600;
    text-align: right;
}

@media (max-width: 680px) {
    .attendance-section-filter {
        align-items: stretch;
        flex-direction: column;
    }

    .attendance-section-filter__mode {
        width: 100%;
    }

    .attendance-section-filter__hint {
        text-align: left;
    }
}
</style>
