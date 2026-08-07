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

const rows = computed(() =>
    (props.data.rows || []).filter((row) => Number(row.count || 0) > 0),
)

const hasData = computed(() => rows.value.length > 0)

const chartData = computed(() => ({
    labels: rows.value.map((row) => row.label),
    datasets: [
        {
            label: t("excome.exitAnalysis.exitReasons"),
            data: rows.value.map((row) => Number(row.count || 0)),
            backgroundColor: "#3b82f6",
            borderColor: "#2563eb",
            borderWidth: 1,
            borderRadius: 5,
        },
    ],
}))
</script>

<template>
    <div class="exit-chart-card">
        <EnterpriseChart
            v-if="hasData"
            :data="chartData"
            :title="data.title || t('excome.exitAnalysis.exitReasons')"
            horizontal
            :height="300"
        />

        <div v-else class="empty-state">
            <strong>{{ data.title || t("excome.exitAnalysis.exitReasons") }}</strong>
            <span>No exited employees matched the selected year and filters.</span>
        </div>
    </div>
</template>

<style scoped>
.exit-chart-card {
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
</style>
