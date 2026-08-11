<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseChart from "../shared/EnterpriseChart.vue"

const props = defineProps({
    data: {
        type: Object,
        default: () => ({}),
    },
    employeeTypeLabel: {
        type: String,
        default: "",
    },
})

const { t } = useI18n()

function safeT(key, fallback) {
    const translated = t(key)
    return translated === key ? fallback : translated
}

const rows = computed(() => props.data.rows || [])

const hasData = computed(() =>
    rows.value.some((row) => Number(row.count || 0) > 0),
)

const resolvedEmployeeTypeLabel = computed(() =>
    String(
        props.employeeTypeLabel ||
        safeT("excome.filters.allEmployeeTypes", "All Employee Types"),
    ).trim(),
)

const sectionTitle = computed(() =>
    `${resolvedEmployeeTypeLabel.value} ${safeT(
        "excome.exitAnalysis.periodOfService",
        "Period of Service",
    )}`
        .replace(/\s+/g, " ")
        .trim(),
)

const chartData = computed(() => ({
    labels: rows.value.map((row) => row.label),
    datasets: [
        {
            label: safeT(
                "excome.exitAnalysis.periodOfService",
                "Period of Service",
            ),
            data: rows.value.map((row) => Number(row.rate || 0)),
            backgroundColor: "#22c55e",
            borderColor: "#16a34a",
            borderWidth: 1,
            borderRadius: 5,
            valueLabel: true,
            valueLabelShowZero: false,
            valueLabelDecimals: 2,
            valueLabelSuffix: "%",
            valueLabelColor: "#15803d",
        },
    ],
}))
</script>

<template>
    <div class="service-chart-card">
        <div class="service-titlebar">
            {{ sectionTitle }}
        </div>

        <EnterpriseChart
            v-if="hasData"
            :data="chartData"
            title=""
            percent
            :height="310"
        />

        <div v-else class="empty-state">
            <span>No exited employees with valid join and exit dates matched the selected year.</span>
        </div>

        <small
            v-if="Number(data.missingJoinDate || 0) > 0"
            class="data-note"
        >
            {{ Number(data.missingJoinDate).toLocaleString() }} exited employee(s) could not be grouped because the join date is missing or invalid.
        </small>
    </div>
</template>

<style scoped>
.service-chart-card {
    display: grid;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    border: 1px solid var(--hrms-border, #dbe3ec);
    border-radius: 0.55rem;
    background: var(--hrms-surface, #ffffff);
}

.service-titlebar {
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

.service-chart-card :deep(.enterprise-chart) {
    border: 0;
    border-radius: 0;
}

.empty-state {
    display: grid;
    min-height: 300px;
    padding: 1rem;
    place-content: center;
    background: var(--p-surface-50, #f8fafc);
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.82rem;
    text-align: center;
}

.data-note {
    display: block;
    padding: 0 0.75rem 0.6rem;
    color: var(--p-orange-600, #ea580c);
    font-size: 0.76rem;
    text-align: center;
}

@media (max-width: 760px) {
    .service-titlebar {
        font-size: 0.92rem;
    }
}
</style>
