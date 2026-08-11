<script setup>
import { computed } from "vue"

import ManpowerChart from "./ManpowerChart.vue"
import ManpowerTable from "./ManpowerTable.vue"

const props = defineProps({
    title: {
        type: String,
        default: "",
    },
    subtitle: {
        type: String,
        default: "",
    },
    rows: {
        type: Array,
        default: () => [],
    },
    selectedPeriodKey: {
        type: String,
        default: null,
    },
})

const scopeLabel = computed(() => {
    const value = String(props.subtitle || "All Employee Types").trim()

    return (value || "All Employee Types").toUpperCase()
})

const sectionTitle = computed(() => `${scopeLabel.value} MANPOWER`)
</script>

<template>
    <section class="dashboard-section manpower-section">
        <div class="manpower-section__title">
            {{ sectionTitle }}
        </div>

        <ManpowerTable
            :rows="rows"
            :selected-period-key="selectedPeriodKey"
        />

        <ManpowerChart
            :rows="rows"
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

.manpower-section__title {
    display: flex;
    min-height: 2.25rem;
    align-items: center;
    justify-content: center;
    padding: 0.38rem 0.8rem;
    background: #0b2d6b;
    color: #ffffff;
    font-size: clamp(0.92rem, 1.2vw, 1.08rem);
    font-weight: 900;
    line-height: 1.1;
    text-align: center;
    text-transform: uppercase;
}

@media (max-width: 680px) {
    .manpower-section__title {
        min-height: 2.05rem;
        padding: 0.34rem 0.6rem;
        font-size: 0.88rem;
    }
}
</style>
