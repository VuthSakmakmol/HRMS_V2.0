<script setup>
import ExitReasonTable from "./ExitReasonTable.vue"
import PeriodOfServiceChart from "./PeriodOfServiceChart.vue"

defineProps({
    data: {
        type: Object,
        default: () => ({}),
    },
})
</script>

<template>
    <section class="dashboard-section exit-analysis-section">
        <div class="exit-analysis-grid">
            <ExitReasonTable :data="data.exitReasons || {}" />

            <PeriodOfServiceChart
                :data="data.servicePeriods || {}"
                :employee-type-label="data.selectedLabel || ''"
            />
        </div>
    </section>
</template>

<style scoped>
.exit-analysis-section {
    min-width: 0;
}

.exit-analysis-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    padding: 0;
}
</style>
