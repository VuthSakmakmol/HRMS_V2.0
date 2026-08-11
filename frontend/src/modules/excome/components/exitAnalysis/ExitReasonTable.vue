<script setup>
import { computed } from "vue"
import EnterpriseChart from "../shared/EnterpriseChart.vue"

const props = defineProps({
    data: {
        type: Object,
        default: () => ({}),
    },
})

const rows = computed(() =>
    (Array.isArray(props.data.rows) ? props.data.rows : [])
        .filter((row) => Number(row.count || 0) > 0)
        .sort((a, b) =>
            Number(b.rate || 0) - Number(a.rate || 0) ||
            String(a.label || "").localeCompare(String(b.label || "")),
        ),
)

const hasData = computed(() => rows.value.length > 0)

const chartHeight = computed(() =>
    Math.max(300, Math.min(620, 120 + rows.value.length * 34)),
)

const sectionTitle = computed(() =>
    String(
        props.data.title ||
        `${props.data.selectedLabel || "All Employee Types"} EXIT REASON`,
    )
        .replace(/\s+/g, " ")
        .trim(),
)

const chartData = computed(() => ({
    labels: rows.value.map((row) => row.label),
    datasets: [
        {
            label: "Exit Reason",
            data: rows.value.map((row) => Number(row.rate || 0)),
            backgroundColor: "#0eaee4",
            borderColor: "#0284c7",
            borderWidth: 1,
            borderRadius: 3,
            maxBarThickness: 24,
            valueLabel: true,
            valueLabelShowZero: false,
            valueLabelDecimals: 2,
            valueLabelSuffix: "%",
            valueLabelColor: "#0f172a",
        },
    ],
}))
</script>

<template>
    <div class="exit-reason-chart-card">
        <div class="exit-reason-titlebar">
            {{ sectionTitle }}
        </div>

        <EnterpriseChart
            v-if="hasData"
            :data="chartData"
            title=""
            horizontal
            percent
            :height="chartHeight"
        />

        <div v-else class="empty-state">
            No exit-reason data matched the selected filters.
        </div>
    </div>
</template>

<style scoped>
.exit-reason-chart-card {
    display: grid;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--hrms-border, #dbe3ec);
    border-radius: 0.55rem;
    background: var(--hrms-surface, #ffffff);
}

.exit-reason-titlebar {
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

.exit-reason-chart-card :deep(.enterprise-chart) {
    border: 0;
    border-radius: 0;
    padding-top: 0.8rem;
}

.empty-state {
    display: grid;
    min-height: 260px;
    padding: 1rem;
    place-content: center;
    background: var(--p-surface-50, #f8fafc);
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.82rem;
    text-align: center;
}

@media (max-width: 760px) {
    .exit-reason-titlebar {
        font-size: 0.92rem;
    }
}
</style>
