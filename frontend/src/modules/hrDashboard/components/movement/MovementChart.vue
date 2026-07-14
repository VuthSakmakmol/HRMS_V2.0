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
const height = 240
const padding = { top: 22, right: 22, bottom: 40, left: 48 }
const chartWidth = width - padding.left - padding.right
const chartHeight = height - padding.top - padding.bottom
const groupWidth = computed(() => chartWidth / Math.max(1, props.rows.length || 12))
const barWidth = computed(() => Math.min(13, groupWidth.value / 5))

const maxValue = computed(() => {
    const values = props.rows.flatMap((row) => [
        Math.abs(Number(row.in) || 0),
        Math.abs(Number(row.out) || 0),
        Math.abs(Number(row.balance) || 0),
    ])

    return Math.max(5, ...values) * 1.15
})

const gridLines = computed(() =>
    Array.from({ length: 5 }, (_, index) => {
        const ratio = index / 4
        return {
            value: Math.round(maxValue.value * (1 - ratio)),
            y: padding.top + chartHeight * ratio,
        }
    }),
)

function barHeight(value) {
    return Math.abs(Number(value) || 0) / maxValue.value * chartHeight
}

function groupX(index) {
    return padding.left + index * groupWidth.value + groupWidth.value / 2
}
</script>

<template>
    <div class="movement-chart-wrap">
        <svg
            class="movement-chart"
            :viewBox="`0 0 ${width} ${height}`"
            role="img"
            :aria-label="t('hrDashboard.movement.chartAria')"
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
                    class="movement-chart__axis-label"
                >
                    {{ line.value }}
                </text>
            </g>

            <g
                v-for="(row, index) in rows"
                :key="row.key"
            >
                <rect
                    v-if="row.key === selectedPeriodKey"
                    :x="padding.left + index * groupWidth + 2"
                    :y="padding.top"
                    :width="groupWidth - 4"
                    :height="chartHeight"
                    fill="none"
                    :stroke="dashboardColors.red"
                    stroke-width="2"
                />

                <rect
                    :x="groupX(index) - barWidth * 1.5 - 3"
                    :y="padding.top + chartHeight - barHeight(row.in)"
                    :width="barWidth"
                    :height="barHeight(row.in)"
                    :fill="dashboardColors.primaryBlue"
                />

                <rect
                    :x="groupX(index) - barWidth / 2"
                    :y="padding.top + chartHeight - barHeight(row.out)"
                    :width="barWidth"
                    :height="barHeight(row.out)"
                    :fill="dashboardColors.orange"
                />

                <rect
                    :x="groupX(index) + barWidth / 2 + 3"
                    :y="padding.top + chartHeight - barHeight(row.balance)"
                    :width="barWidth"
                    :height="barHeight(row.balance)"
                    :fill="dashboardColors.gray"
                />

                <text
                    :x="groupX(index)"
                    :y="height - 18"
                    text-anchor="middle"
                    class="movement-chart__month"
                >
                    {{ t(`hrDashboard.monthsShort.${row.month}`) }}
                </text>
            </g>
        </svg>

        <div class="movement-chart__legend">
            <span><i :style="{ background: dashboardColors.primaryBlue }" />{{ t("hrDashboard.movement.in") }}</span>
            <span><i :style="{ background: dashboardColors.orange }" />{{ t("hrDashboard.movement.out") }}</span>
            <span><i :style="{ background: dashboardColors.gray }" />{{ t("hrDashboard.movement.balance") }}</span>
        </div>
    </div>
</template>

<style scoped>
.movement-chart-wrap {
    overflow: hidden;
    border: 1px solid #7f8fa6;
    border-top: 0;
    background: #ffffff;
}

.movement-chart {
    display: block;
    width: 100%;
    height: auto;
}

.movement-chart__axis-label,
.movement-chart__month {
    fill: #404040;
    font-size: 10px;
    font-weight: 600;
}

.movement-chart__legend {
    display: flex;
    justify-content: center;
    gap: 1.25rem;
    padding: 0 0.75rem 0.6rem;
    color: #333333;
    font-size: 0.7rem;
    font-weight: 700;
}

.movement-chart__legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
}

.movement-chart__legend i {
    display: inline-block;
    width: 0.85rem;
    height: 0.55rem;
}
</style>
