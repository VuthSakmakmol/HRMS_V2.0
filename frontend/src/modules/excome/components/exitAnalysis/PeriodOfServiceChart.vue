<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseChart from "../shared/EnterpriseChart.vue"

const props = defineProps({
    data: {
        type: Object,
        default: () => ({}),
    },
})

const { t } = useI18n()

const rows = computed(() => props.data.rows || [])
const hasData = computed(() => rows.value.some((row) => Number(row.count || 0) > 0))

const chartData = computed(() => ({
    labels: rows.value.map((row) => row.label),
    datasets: [
        {
            label: t("excome.exitAnalysis.periodOfService"),
            data: rows.value.map((row) => Number(row.rate || 0)),
            backgroundColor: "#22c55e",
            borderColor: "#16a34a",
            borderWidth: 1,
            borderRadius: 5,
        },
    ],
}))
</script>

<template>
    <div class="service-chart-card">
        <EnterpriseChart
            v-if="hasData"
            :data="chartData"
            :title="data.title || t('excome.exitAnalysis.periodOfService')"
            percent
            :height="300"
        />

        <div v-else class="empty-state">
            <strong>{{ data.title || t("excome.exitAnalysis.periodOfService") }}</strong>
            <span>No exited employees with valid join and exit dates matched the selected year.</span>
        </div>

        <small v-if="Number(data.missingJoinDate || 0) > 0" class="data-note">
            {{ Number(data.missingJoinDate).toLocaleString() }} exited employee(s) could not be grouped because the join date is missing or invalid.
        </small>
    </div>
</template>

<style scoped>
.service-chart-card {
    min-width: 0;
    height: 100%;
}

.empty-state {
    display: grid;
    place-content: center;
    min-height: 300px;
    padding: 1rem;
    border: 1px dashed var(--p-content-border-color);
    border-radius: 10px;
    background: var(--p-surface-50);
    text-align: center;
}

.empty-state strong {
    color: var(--p-text-color);
    font-size: 0.95rem;
}

.empty-state span {
    margin-top: 0.35rem;
    color: var(--p-text-muted-color);
    font-size: 0.78rem;
}

.data-note {
    display: block;
    margin-top: 0.45rem;
    color: var(--p-orange-600);
    font-size: 0.72rem;
    text-align: center;
}
</style>
