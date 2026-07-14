<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import DashboardSectionHeader from "../shared/DashboardSectionHeader.vue"
import TurnoverComparisonChart from "./TurnoverComparisonChart.vue"

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

const rows = computed(() => props.data.rows || [])
const chartTitle = computed(() => {
    const label = props.data.selectedLabel || safeT("hrDashboard.filters.allEmployeeTypes", "Total")

    return `% ${label} ${safeT("hrDashboard.turnover.turnover", "Turnover")}`
        .replace(/\s+/g, " ")
        .trim()
})

function safeT(key, fallback) {
    const translated = t(key)

    return translated === key ? fallback : translated
}
</script>

<template>
    <section class="dashboard-section turnover-dashboard-section">
        <DashboardSectionHeader :title="title" />

        <TurnoverComparisonChart
            :rows="rows"
            :previous-year="data.previousYear"
            :current-year="data.currentYear"
            :target-rate="data.targetRate"
            :title="chartTitle"
            :selected-period-key="selectedPeriodKey"
        />
    </section>
</template>

<style scoped>
.dashboard-section {
    display: grid;
    gap: 0;
}
</style>
