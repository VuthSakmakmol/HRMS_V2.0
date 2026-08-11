<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import TurnoverComparisonChart from "./TurnoverComparisonChart.vue"

const props = defineProps({
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

const rows = computed(() => props.data.rows || [])

function safeT(key, fallback) {
    const translated = t(key)
    return translated === key ? fallback : translated
}

const employeeTypeLabel = computed(() =>
    String(
        props.data.selectedLabel ||
        safeT("excome.filters.allEmployeeTypes", "All Employee Types"),
    ).trim(),
)

const turnoverLabel = computed(() =>
    safeT("excome.turnover.turnover", "Turnover"),
)

const sectionTitle = computed(() =>
    `${employeeTypeLabel.value} ${turnoverLabel.value}`
        .replace(/\s+/g, " ")
        .trim(),
)
</script>

<template>
    <section class="dashboard-section turnover-dashboard-section">
        <!--
            Keep exactly one Turnover title, using the same standardized
            navy title bar as Movement / IN & OUT / Absent sections.
            The chart itself intentionally has no internal title.
        -->
        <div class="turnover-titlebar">
            {{ sectionTitle }}
        </div>

        <TurnoverComparisonChart
            :rows="rows"
            :previous-year="data.previousYear"
            :current-year="data.currentYear"
            :target-rate="data.targetRate"
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

.turnover-titlebar {
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

@media (max-width: 760px) {
    .turnover-titlebar {
        font-size: 0.92rem;
    }
}
</style>
