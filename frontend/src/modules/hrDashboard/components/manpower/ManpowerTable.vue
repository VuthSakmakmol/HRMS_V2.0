<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

const props = defineProps({
    rows: {
        type: Array,
        default: () => [],
    },
    selectedPeriodKey: {
        type: String,
        default: null,
    },
})

const { t } = useI18n()

const metrics = computed(() => [
    {
        key: "budget",
        labelKey: "hrDashboard.manpower.budget",
        className: "metric-budget",
    },
    {
        key: "roadmap",
        labelKey: "hrDashboard.manpower.roadmap",
        className: "metric-roadmap",
    },
    {
        key: "actual",
        labelKey: "hrDashboard.manpower.actual",
        className: "metric-actual",
    },
    {
        key: "targetGap",
        labelKey: "hrDashboard.manpower.overLessTarget",
        className: "metric-target-gap",
        signed: true,
    },
    {
        key: "roadmapGap",
        labelKey: "hrDashboard.manpower.overLessRoadmap",
        className: "metric-roadmap-gap",
        signed: true,
    },
    {
        key: "fillRate",
        labelKey: "hrDashboard.manpower.fillRate",
        className: "metric-fill-rate",
        suffix: "%",
    },
])

function formatMetricValue(row, metric) {
    const value = Number(row?.[metric.key]) || 0

    if (metric.signed && value > 0) {
        return `+${value}`
    }

    return `${value}${metric.suffix || ""}`
}

function valueClass(row, metric) {
    const value = Number(row?.[metric.key]) || 0

    return {
        "is-selected-period-key": row.key === props.selectedPeriodKey,
        "is-negative": ["targetGap", "roadmapGap"].includes(metric.key) && value < 0,
        "is-positive": ["targetGap", "roadmapGap"].includes(metric.key) && value > 0,
    }
}
</script>

<template>
    <div class="manpower-table-wrap">
        <table class="manpower-table">
            <thead>
                <tr>
                    <th class="manpower-table__metric-header">
                        {{ t("hrDashboard.manpower.item") }}
                    </th>

                    <th
                        v-for="row in rows"
                        :key="row.key"
                        :class="{
                            'is-selected-period-key': row.key === selectedPeriodKey,
                        }"
                    >
                        {{ t(`hrDashboard.monthsShort.${row.month}`) }}
                    </th>
                </tr>
            </thead>

            <tbody>
                <tr
                    v-for="metric in metrics"
                    :key="metric.key"
                    :class="metric.className"
                >
                    <th>
                        {{ t(metric.labelKey) }}
                    </th>

                    <td
                        v-for="row in rows"
                        :key="`${metric.key}-${row.key}`"
                        :class="valueClass(row, metric)"
                    >
                        {{ formatMetricValue(row, metric) }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.manpower-table-wrap {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #7f8fa6;
    border-top: 0;
}

.manpower-table {
    width: 100%;
    min-width: 0;
    border-collapse: collapse;
    table-layout: fixed;
    background: #ffffff;
}

.manpower-table th,
.manpower-table td {
    height: 1.38rem;
    padding: 0.15rem 0.18rem;
    border: 1px solid #a6a6a6;
    color: #111111;
    font-size: clamp(0.47rem, 0.68vw, 0.62rem);
    font-weight: 700;
    line-height: 1.04;
    text-align: center;
    vertical-align: middle;
    word-break: break-word;
}

.manpower-table thead th {
    background: #002060;
    color: #ffffff;
    font-weight: 800;
}

.manpower-table__metric-header,
.manpower-table tbody th {
    width: 7.8rem;
    text-align: left;
}

.metric-budget th,
.metric-budget td {
    background: #d9e1f2;
}

.metric-roadmap th,
.metric-roadmap td {
    background: #00b0f0;
    color: #ffffff;
}

.metric-actual th,
.metric-actual td {
    background: #e7e6e6;
}

.metric-target-gap th,
.metric-target-gap td {
    background: #fce4d6;
}

.metric-roadmap-gap th,
.metric-roadmap-gap td {
    background: #e2f0d9;
}

.metric-fill-rate th,
.metric-fill-rate td {
    background: #ffd966;
}

.manpower-table .is-selected-period-key {
    border-right: 2px solid #ff0000;
    border-left: 2px solid #ff0000;
}

.manpower-table thead .is-selected-period-key {
    border-top: 2px solid #ff0000;
}

.manpower-table tbody tr:last-child .is-selected-period-key {
    border-bottom: 2px solid #ff0000;
}

.manpower-table .is-negative {
    color: #c00000;
    font-weight: 900;
}

.manpower-table .is-positive {
    color: #006100;
    font-weight: 900;
}

@media (max-width: 720px) {
    .manpower-table__metric-header,
    .manpower-table tbody th {
        width: 6.4rem;
    }

    .manpower-table th,
    .manpower-table td {
        height: 1.32rem;
        padding: 0.14rem 0.12rem;
    }
}
</style>
