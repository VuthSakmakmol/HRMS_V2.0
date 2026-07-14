<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

const props = defineProps({
    rows: {
        type: Array,
        default: () => [],
    },
    previousYear: {
        type: [String, Number],
        default: "",
    },
    currentYear: {
        type: [String, Number],
        default: "",
    },
    targetRate: {
        type: Number,
        default: 4.88,
    },
    title: {
        type: String,
        default: "",
    },
    selectedPeriodKey: {
        type: String,
        default: null,
    },
})

const { t } = useI18n()

const width = 1080
const height = 330
const padding = {
    top: 48,
    right: 28,
    bottom: 54,
    left: 54,
}

const chartWidth = width - padding.left - padding.right
const chartHeight = height - padding.top - padding.bottom

const visibleRows = computed(() => props.rows || [])
const groupWidth = computed(() =>
    visibleRows.value.length > 0
        ? chartWidth / visibleRows.value.length
        : chartWidth / 13,
)
const barWidth = computed(() => Math.min(18, Math.max(8, groupWidth.value * 0.18)))

const maxValue = computed(() => {
    const values = visibleRows.value.flatMap((row) => [
        Number(row.previousRate) || 0,
        Number(row.currentRate) || 0,
    ])

    values.push(Number(props.targetRate) || 0)

    return Math.max(8, ...values) * 1.22
})

const gridLines = computed(() =>
    Array.from({ length: 5 }, (_, index) => {
        const ratio = index / 4
        const value = maxValue.value * (1 - ratio)
        const y = padding.top + chartHeight * ratio

        return {
            value,
            y,
        }
    }),
)

const targetY = computed(() =>
    padding.top + chartHeight -
        ((Number(props.targetRate) || 0) / maxValue.value) * chartHeight,
)

function safeT(key, fallback) {
    const translated = t(key)

    return translated === key ? fallback : translated
}

function xFor(index) {
    return padding.left + index * groupWidth.value + groupWidth.value / 2
}

function barHeight(value) {
    return ((Number(value) || 0) / maxValue.value) * chartHeight
}

function yFor(value) {
    return padding.top + chartHeight - barHeight(value)
}

function formatPercent(value) {
    const number = Number(value) || 0

    return `${number.toFixed(2)}%`
}

function rowLabel(row) {
    if (row.month === "AVG") return safeT("hrDashboard.attendance.avg", "AVG")

    return safeT(`hrDashboard.monthsShort.${row.month}`, row.label || row.month)
}
</script>

<template>
    <div class="attendance-absent-chart-wrap">
        <svg
            class="attendance-absent-chart"
            :viewBox="`0 0 ${width} ${height}`"
            role="img"
            :aria-label="title"
        >
            <text
                :x="width / 2"
                y="24"
                text-anchor="middle"
                class="attendance-absent-chart__title"
            >
                {{ title }}
            </text>

            <g
                v-for="line in gridLines"
                :key="line.y"
            >
                <line
                    :x1="padding.left"
                    :x2="width - padding.right"
                    :y1="line.y"
                    :y2="line.y"
                    stroke="#d9d9d9"
                    stroke-width="1"
                />
            </g>

            <line
                :x1="padding.left"
                :x2="width - padding.right"
                :y1="targetY"
                :y2="targetY"
                stroke="#ff0000"
                stroke-width="2"
                stroke-dasharray="4 4"
            />

            <rect
                :x="width - 190"
                :y="padding.top - 34"
                width="158"
                height="28"
                fill="#111111"
            />

            <text
                :x="width - 111"
                :y="padding.top - 15"
                text-anchor="middle"
                class="attendance-absent-chart__target"
            >
                {{ safeT("hrDashboard.attendance.targetLessThan", "Target <") }}{{ formatPercent(targetRate) }}
            </text>

            <g
                v-for="(row, index) in visibleRows"
                :key="row.key"
            >
                <rect
                    v-if="row.key === selectedPeriodKey || row.month === 'AVG'"
                    :x="padding.left + index * groupWidth + 3"
                    :y="padding.top + 28"
                    :width="groupWidth - 6"
                    :height="chartHeight - 28"
                    fill="none"
                    stroke="#ff0000"
                    stroke-width="2"
                />

                <rect
                    :x="xFor(index) - barWidth - 2"
                    :y="yFor(row.previousRate)"
                    :width="barWidth"
                    :height="barHeight(row.previousRate)"
                    fill="#a6a6a6"
                />

                <rect
                    :x="xFor(index) + 2"
                    :y="yFor(row.currentRate)"
                    :width="barWidth"
                    :height="barHeight(row.currentRate)"
                    fill="#00aeea"
                />

                <text
                    :x="xFor(index) - barWidth / 2 - 2"
                    :y="Math.max(44, yFor(row.previousRate) - 7)"
                    text-anchor="middle"
                    class="attendance-absent-chart__value attendance-absent-chart__value--previous"
                >
                    {{ formatPercent(row.previousRate) }}
                </text>

                <text
                    :x="xFor(index) + barWidth / 2 + 2"
                    :y="Math.max(44, yFor(row.currentRate) - 7)"
                    text-anchor="middle"
                    class="attendance-absent-chart__value attendance-absent-chart__value--current"
                    :class="{
                        'is-over-target': Number(row.currentRate) > Number(targetRate),
                    }"
                >
                    {{ formatPercent(row.currentRate) }}
                </text>

                <text
                    :x="xFor(index)"
                    :y="height - 25"
                    text-anchor="middle"
                    class="attendance-absent-chart__month"
                >
                    {{ rowLabel(row) }}
                </text>
            </g>
        </svg>

        <div class="attendance-absent-chart__legend">
            <span>
                <i class="legend-previous" />
                Y{{ previousYear }}
            </span>

            <span>
                <i class="legend-current" />
                Y{{ currentYear }}
            </span>
        </div>
    </div>
</template>

<style scoped>
.attendance-absent-chart-wrap {
    overflow: hidden;
    border: 1px solid #1f1f1f;
    border-top: 0;
    background: #ffffff;
}

.attendance-absent-chart {
    display: block;
    width: 100%;
    min-width: 0;
}

.attendance-absent-chart__title {
    fill: #5c5c5c;
    font-size: 1.08rem;
    font-weight: 800;
}

.attendance-absent-chart__target {
    fill: #ffffff;
    font-size: 0.72rem;
    font-weight: 900;
}

.attendance-absent-chart__value {
    font-size: 0.59rem;
    font-weight: 900;
}

.attendance-absent-chart__value--previous,
.attendance-absent-chart__value--current {
    fill: #0000ff;
}

.attendance-absent-chart__value.is-over-target {
    fill: #ff0000;
}

.attendance-absent-chart__month {
    fill: #333333;
    font-size: 0.69rem;
    font-weight: 800;
}

.attendance-absent-chart__legend {
    display: flex;
    justify-content: center;
    gap: 1.1rem;
    padding: 0 0.75rem 0.45rem;
    font-size: 0.66rem;
    font-weight: 800;
}

.attendance-absent-chart__legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
}

.attendance-absent-chart__legend i {
    display: inline-block;
    width: 0.8rem;
    height: 0.5rem;
}

.legend-previous {
    background: #a6a6a6;
}

.legend-current {
    background: #00aeea;
}

@media (max-width: 760px) {
    .attendance-absent-chart__title {
        font-size: 0.9rem;
    }

    .attendance-absent-chart__value {
        font-size: 0.48rem;
    }

    .attendance-absent-chart__month {
        font-size: 0.52rem;
    }
}
</style>
