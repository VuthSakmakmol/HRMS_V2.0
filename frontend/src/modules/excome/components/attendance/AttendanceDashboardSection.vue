<script setup>
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"

import Button from "primevue/button"

import AttendanceAbsenceComparisonChart from "./AttendanceAbsenceComparisonChart.vue"
import AttendanceAbsenceDetailTable from "./AttendanceAbsenceDetailTable.vue"

const props = defineProps({
    // Kept for compatibility with ExcomeDashboardView. Attendance now builds
    // its visible title from the selected Employee Type / Child code.
    title: {
        type: String,
        default: "",
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

function safeT(key, fallback) {
    const translated = t(key)
    return translated === key ? fallback : translated
}

/*
 * selectedLabel is supplied by Excome's common scope resolver.
 * It is already code-based:
 *   DL
 *   DL + SEWER
 *   IDL + OFFICE
 *   All Employee Types
 *
 * Do not reconstruct or guess Employee Type from position/department names.
 */
const selectedScopeLabel = computed(() =>
    String(
        comparison.value.selectedLabel ||
        safeT("excome.filters.allEmployeeTypes", "All Employee Types"),
    )
        .replace(/\s+/g, " ")
        .trim(),
)

const sectionTitle = computed(() =>
    `${selectedScopeLabel.value} ${safeT("excome.attendance.absent", "Absent")}`
        .replace(/\s+/g, " ")
        .trim(),
)

function setViewMode(mode) {
    viewMode.value = mode
}
</script>

<template>
    <section class="dashboard-section attendance-dashboard-section">
        <!--
            Same standardized title bar used by Movement, Turnover and
            Period of Service. Keep only ONE visible title for this chart.
        -->
        <div class="attendance-titlebar">
            {{ sectionTitle }}
        </div>

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
        </div>

        <!--
            No internal chart title. The navy standardized header above is
            the single source of visible chart title text.
        -->
        <AttendanceAbsenceComparisonChart
            :mode="viewMode"
            :rows="totalRows"
            :detail-rows="detailRows"
            :previous-year="comparison.previousYear"
            :current-year="comparison.currentYear"
            :target-rate="comparison.targetRate"
            title=""
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
    min-width: 0;
}

/*
 * Excome standard chart title.
 * Must remain identical to Movement / Turnover / Period of Service.
 */
.attendance-titlebar {
    display: flex;
    min-height: 2.25rem;
    align-items: center;
    justify-content: center;
    padding: 0.42rem 0.75rem;
    background: #0b2d6b;
    color: #ffffff;
    font-size: 1.08rem;
    font-weight: 900;
    letter-spacing: 0.01em;
    text-align: center;
    text-transform: uppercase;
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

/* Remove the chart's own top border radius so it visually joins the section. */
.attendance-dashboard-section :deep(.enterprise-chart) {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
}

@media (max-width: 760px) {
    .attendance-titlebar {
        font-size: 0.92rem;
    }
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
