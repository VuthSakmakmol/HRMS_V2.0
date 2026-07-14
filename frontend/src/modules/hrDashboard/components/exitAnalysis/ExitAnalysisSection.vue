<script setup>
import ExitReasonChart from "./ExitReasonChart.vue"
import PeriodOfServiceChart from "./PeriodOfServiceChart.vue"

defineProps({
    title: {
        type: String,
        default: "Exit Analysis",
    },
    data: {
        type: Object,
        default: () => ({}),
    },
})
</script>

<template>
    <section class="dashboard-section exit-analysis-section">
        <div class="dashboard-section__titlebar">
            <span>{{ title }}</span>
        </div>

        <div class="exit-analysis-grid">
            <ExitReasonChart :data="data.exitReasons || {}" />
            <PeriodOfServiceChart :data="data.servicePeriods || {}" />
        </div>
    </section>
</template>

<style scoped>
.exit-analysis-section {
    min-width: 0;
}

.dashboard-section__titlebar {
    display: flex;
    align-items: center;
    min-height: 2.15rem;
    padding: 0 0.85rem;
    background: #0eaee4;
    color: #ffffff;
    font-size: 0.78rem;
    font-weight: 900;
    text-transform: uppercase;
}

.exit-analysis-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    padding: 0.5rem 0;
}

@media (max-width: 980px) {
    .exit-analysis-grid {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
