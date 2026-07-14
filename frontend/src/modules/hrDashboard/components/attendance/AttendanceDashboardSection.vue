<script setup>
import { computed, ref, watch } from "vue"
import { useI18n } from "vue-i18n"

import Button from "primevue/button"
import Select from "primevue/select"

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
const selectedCode = ref("TOTAL")

const comparison = computed(() => props.data.absenceComparison || {})
const options = computed(() => comparison.value.options || [])
const detailRows = computed(() => comparison.value.detailRows || [])

const selectOptions = computed(() =>
    options.value.map((item) => ({
        label: optionLabel(item),
        value: item.code,
    })),
)

const selectedRows = computed(() => {
    if (selectedCode.value === "TOTAL") return comparison.value.rows || []

    const detail = detailRows.value.find((row) => row.code === selectedCode.value)

    if (!detail) return comparison.value.rows || []

    const averageRow = {
        key: "AVG",
        month: "AVG",
        label: "AVG",
        previousRate: detail.previousRate,
        currentRate: detail.currentRate,
        previousCount: detail.previousTotal,
        currentCount: detail.currentTotal,
        previousExpected: detail.previousExpected,
        currentExpected: detail.currentExpected,
    }

    return [
        ...(detail.months || []),
        averageRow,
    ]
})

const selectedOption = computed(() =>
    options.value.find((item) => item.code === selectedCode.value) || options.value[0] || {},
)

const chartTitle = computed(() => {
    const metric = selectedCode.value === "TOTAL"
        ? safeT("hrDashboard.attendance.totalAbsentPercent", "Total Absent")
        : optionLabel(selectedOption.value)
    const label = comparison.value.selectedLabel || ""

    return `% ${label} ${metric}`.replace(/\s+/g, " ").trim()
})

watch(
    () => options.value.map((item) => item.code).join("|"),
    () => {
        if (!options.value.some((item) => item.code === selectedCode.value)) {
            selectedCode.value = "TOTAL"
        }
    },
)

function safeT(key, fallback) {
    const translated = t(key)

    return translated === key ? fallback : translated
}

function optionLabel(option = {}) {
    if (!option.code) return ""

    return safeT(`hrDashboard.attendance.codes.${option.code}`, option.label || option.name || option.code)
}

function setViewMode(mode) {
    viewMode.value = mode

    if (mode === "TOTAL") {
        selectedCode.value = "TOTAL"
    }
}
</script>

<template>
    <section class="dashboard-section attendance-dashboard-section">
        <DashboardSectionHeader :title="title" />

        <div class="attendance-section-filter">
            <div class="attendance-section-filter__mode">
                <Button
                    :label="safeT('hrDashboard.attendance.totalView', 'Total')"
                    size="small"
                    :severity="viewMode === 'TOTAL' ? 'primary' : 'secondary'"
                    :outlined="viewMode !== 'TOTAL'"
                    @click="setViewMode('TOTAL')"
                />

                <Button
                    :label="safeT('hrDashboard.attendance.detailView', 'Detail')"
                    size="small"
                    :severity="viewMode === 'DETAIL' ? 'primary' : 'secondary'"
                    :outlined="viewMode !== 'DETAIL'"
                    @click="setViewMode('DETAIL')"
                />
            </div>

            <Select
                v-if="viewMode === 'DETAIL'"
                v-model="selectedCode"
                class="attendance-section-filter__select"
                :options="selectOptions.filter((option) => option.value !== 'TOTAL')"
                option-label="label"
                option-value="value"
                size="small"
                :placeholder="safeT('hrDashboard.attendance.selectDetail', 'Select detail')"
            />
        </div>

        <AttendanceAbsenceComparisonChart
            :rows="selectedRows"
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
    gap: 0.55rem;
    min-width: 0;
    padding: 0.35rem 0.55rem;
    border-right: 1px solid #1f1f1f;
    border-left: 1px solid #1f1f1f;
    background: #f8fafc;
}

.attendance-section-filter__mode {
    display: flex;
    align-items: center;
    gap: 0.35rem;
}

.attendance-section-filter__select {
    width: min(15rem, 100%);
}

@media (max-width: 680px) {
    .attendance-section-filter {
        align-items: stretch;
        flex-direction: column;
    }

    .attendance-section-filter__mode,
    .attendance-section-filter__select {
        width: 100%;
    }
}
</style>
