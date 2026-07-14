<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import { dashboardColors } from "../../config/dashboardColors.js"

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

const width = 960
const height = 245
const padding = {
    top: 18,
    right: 20,
    bottom: 36,
    left: 46,
}

const chartWidth = width - padding.left - padding.right
const chartHeight = height - padding.top - padding.bottom

const visibleRows = computed(() => props.rows || [])
const groupCount = computed(() => Math.max(1, visibleRows.value.length))
const groupWidth = computed(() => chartWidth / groupCount.value)
const barWidth = computed(() => Math.min(8, Math.max(4, groupWidth.value / 11)))

const series = computed(() => [
    {
        key: "budget",
        labelKey: "hrDashboard.manpower.budget",
        color: dashboardColors.darkBlue,
    },
    {
        key: "roadmap",
        labelKey: "hrDashboard.manpower.roadmap",
        color: dashboardColors.cyan,
    },
    {
        key: "actual",
        labelKey: "hrDashboard.manpower.actual",
        color: dashboardColors.gray,
    },
    {
        key: "targetGap",
        labelKey: "hrDashboard.manpower.overLessTarget",
        color: dashboardColors.orange,
    },
    {
        key: "roadmapGap",
        labelKey: "hrDashboard.manpower.overLessRoadmap",
        color: dashboardColors.green,
    },
])

const valueRange = computed(() => {
    const values = visibleRows.value.flatMap((row) =>
        series.value.map((metric) => Number(row[metric.key]) || 0),
    )

    const max = Math.max(10, ...values)
    const min = Math.min(0, ...values)
    const paddingValue = Math.max(1, (max - min) * 0.1)

    return {
        min: min - paddingValue,
        max: max + paddingValue,
    }
})

const zeroY = computed(() => yForValue(0))

const gridLines = computed(() => {
    return Array.from({ length: 5 }, (_, index) => {
        const ratio = index / 4
        const value = Math.round(
            valueRange.value.max -
                (valueRange.value.max - valueRange.value.min) * ratio,
        )

        return {
            value,
            y: yForValue(value),
        }
    })
})

function yForValue(value) {
    const range = valueRange.value.max - valueRange.value.min || 1
    const ratio = (Number(value) - valueRange.value.min) / range

    return padding.top + chartHeight - ratio * chartHeight
}

function groupX(index) {
    return padding.left + index * groupWidth.value + groupWidth.value / 2
}

function barX(index, seriesIndex) {
    const totalWidth = series.value.length * barWidth.value +
        (series.value.length - 1) * 2
    const start = groupX(index) - totalWidth / 2

    return start + seriesIndex * (barWidth.value + 2)
}

function barY(value) {
    const currentY = yForValue(value)

    return Math.min(currentY, zeroY.value)
}

function barHeight(value) {
    return Math.max(1, Math.abs(zeroY.value - yForValue(value)))
}
</script>

<template>
    <div class="manpower-chart-wrap">
        <svg
            class="manpower-chart"
            :viewBox="`0 0 ${width} ${height}`"
            role="img"
            :aria-label="t('hrDashboard.manpower.chartAria')"
        >
            <g
                v-for="line in gridLines"
                :key="line.value"
            >
                <line
                    :x1="padding.left"
                    :x2="width - padding.right"
                    :y1="line.y"
                    :y2="line.y"
                    stroke="#d9d9d9"
                    stroke-width="1"
                />

                <text
                    :x="padding.left - 8"
                    :y="line.y + 4"
                    text-anchor="end"
                    class="manpower-chart__axis-label"
                >
                    {{ line.value }}
                </text>
            </g>

            <line
                :x1="padding.left"
                :x2="width - padding.right"
                :y1="zeroY"
                :y2="zeroY"
                stroke="#7f8fa6"
                stroke-width="1.4"
            />

            <g
                v-for="(row, rowIndex) in visibleRows"
                :key="row.key"
            >
                <rect
                    v-if="row.key === selectedPeriodKey"
                    :x="padding.left + rowIndex * groupWidth + 2"
                    :y="padding.top"
                    :width="groupWidth - 4"
                    :height="chartHeight"
                    fill="none"
                    :stroke="dashboardColors.red"
                    stroke-width="2"
                />

                <rect
                    v-for="(metric, metricIndex) in series"
                    :key="`${row.key}-${metric.key}`"
                    :x="barX(rowIndex, metricIndex)"
                    :y="barY(Number(row[metric.key]) || 0)"
                    :width="barWidth"
                    :height="barHeight(Number(row[metric.key]) || 0)"
                    :fill="metric.color"
                    rx="1"
                />

                <text
                    :x="groupX(rowIndex)"
                    :y="height - 20"
                    text-anchor="middle"
                    class="manpower-chart__month"
                >
                    {{ t(`hrDashboard.monthsShort.${row.month}`) }}
                </text>
            </g>
        </svg>

        <div class="manpower-chart__legend">
            <span
                v-for="metric in series"
                :key="metric.key"
            >
                <i :style="{ background: metric.color }" />
                {{ t(metric.labelKey) }}
            </span>
        </div>
    </div>
</template>

<style scoped>
.manpower-chart-wrap {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #7f8fa6;
    border-top: 0;
    background: #ffffff;
}

.manpower-chart {
    display: block;
    width: 100%;
    min-width: 0;
    height: auto;
}

.manpower-chart__axis-label,
.manpower-chart__month {
    fill: #404040;
    font-size: 9px;
    font-weight: 600;
}

.manpower-chart__legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.55rem 0.9rem;
    padding: 0 0.6rem 0.45rem;
    color: #333333;
    font-size: 0.58rem;
    font-weight: 700;
}

.manpower-chart__legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
}

.manpower-chart__legend i {
    display: inline-block;
    width: 0.7rem;
    height: 0.45rem;
}
</style>
