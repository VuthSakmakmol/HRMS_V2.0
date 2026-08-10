<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { Bar } from "vue-chartjs"
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from "chart.js"

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
)

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

const selectedIndex = computed(() =>
    props.rows.findIndex((row) => row.key === props.selectedPeriodKey),
)

function toNumber(value) {
    const number = Number(value)
    return Number.isFinite(number) ? number : 0
}

function formatNumber(value) {
    return Math.round(toNumber(value)).toLocaleString()
}

const PERCENT_AXIS_MIN = 0
const PERCENT_AXIS_MAX = 110

function getFillRate(row) {
    // The backend already sends fillRate = 0 when Roadmap is 0.
    // Read that value first so a 0% month is a real point on the line,
    // not a null gap that breaks the line.
    const storedRate = Number(row?.fillRate)
    if (Number.isFinite(storedRate)) return storedRate

    const roadmap = toNumber(row?.roadmap)
    if (roadmap <= 0) return 0

    return (toNumber(row?.actual) / roadmap) * 100
}

function getDisplayedFillRate(row) {
    const rate = getFillRate(row)
    if (!Number.isFinite(rate)) return 0

    // Keep every point inside the visible percentage graph. Values above
    // 110% are pinned to the top of the line scale, while the permanent
    // label and tooltip continue to show the exact underlying percentage.
    return Math.min(PERCENT_AXIS_MAX, Math.max(PERCENT_AXIS_MIN, rate))
}

function formatFillRateLabel(value) {
    if (!Number.isFinite(value)) return "0.0%"
    return `${value.toFixed(1)}%`
}

/*
 * The manpower chart is intentionally focused on the comparison HR needs most:
 * Roadmap target vs Actual, the numerical gap, and the Fill Rate percentage.
 * Budget remains available in the manpower table directly above this chart.
 */
const chartData = computed(() => ({
    labels: props.rows.map((row) => t(`excome.monthsShort.${row.month}`)),
    datasets: [
        {
            type: "bar",
            label: `Target: ${t("excome.manpower.roadmap")}`,
            data: props.rows.map((row) => toNumber(row.roadmap)),
            backgroundColor: "#0EA5E9",
            borderColor: "#0284C7",
            borderWidth: 1,
            borderRadius: 1,
            borderSkipped: false,
            maxBarThickness: 20,
            order: 3,
            yAxisID: "y",
            valueLabel: true,
        },
        {
            type: "bar",
            label: t("excome.manpower.actual"),
            data: props.rows.map((row) => toNumber(row.actual)),
            backgroundColor: "#BDBDBD",
            borderColor: "#A3A3A3",
            borderWidth: 1,
            borderRadius: 1,
            borderSkipped: false,
            maxBarThickness: 20,
            order: 3,
            yAxisID: "y",
            valueLabel: true,
        },
        {
            type: "bar",
            label: `+/- ${t("excome.manpower.overLessRoadmap")}`,
            data: props.rows.map((row) => toNumber(row.roadmapGap)),
            backgroundColor: "rgba(248, 113, 113, 0.32)",
            borderColor: "rgba(248, 113, 113, 0.55)",
            borderWidth: 1,
            borderRadius: 1,
            borderSkipped: false,
            maxBarThickness: 16,
            order: 4,
            yAxisID: "y",
            valueLabel: false,
        },
        {
            type: "line",
            label: t("excome.manpower.fillRate"),
            data: props.rows.map(getDisplayedFillRate),
            actualValues: props.rows.map(getFillRate),
            borderColor: "#9F1D20",
            backgroundColor: "#9F1D20",
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: "#2563EB",
            pointBorderColor: "#9F1D20",
            pointBorderWidth: 1,
            tension: 0.16,
            // All months, including 0%, are valid points. spanGaps is kept
            // true as a defensive fallback so the management line never
            // appears broken if an unexpected null reaches the chart.
            spanGaps: true,
            fill: false,
            order: 1,
            yAxisID: "yPercent",
            valueLabel: true,
        },
    ],
}))

const selectedMonthPlugin = {
    id: "excomeManpowerSelectedMonth",
    afterDatasetsDraw(chart) {
        const index = Number(selectedIndex.value)
        if (!Number.isInteger(index) || index < 0) return

        const xScale = chart.scales?.x
        const chartArea = chart.chartArea
        if (!xScale || !chartArea) return

        const center = xScale.getPixelForValue(index)
        const previous = index > 0 ? xScale.getPixelForValue(index - 1) : null
        const next = index < (chart.data.labels?.length || 0) - 1
            ? xScale.getPixelForValue(index + 1)
            : null

        const halfWidth = previous !== null && next !== null
            ? Math.min(center - previous, next - center) * 0.46
            : previous !== null
                ? (center - previous) * 0.46
                : next !== null
                    ? (next - center) * 0.46
                    : 22

        const ctx = chart.ctx
        ctx.save()
        ctx.strokeStyle = "#FF0000"
        ctx.lineWidth = 2
        ctx.strokeRect(
            center - halfWidth,
            chartArea.top + 1,
            halfWidth * 2,
            Math.max(chartArea.bottom - chartArea.top - 2, 0),
        )
        ctx.restore()
    },
}

/*
 * Draw important values permanently on the chart instead of requiring users
 * to hover each month. This keeps Roadmap, Actual and Fill Rate comparable at
 * a glance, like the Excel manpower chart used by the business.
 */
const permanentValueLabelsPlugin = {
    id: "excomeManpowerPermanentValueLabels",
    afterDatasetsDraw(chart) {
        const { ctx, chartArea } = chart

        chart.data.datasets.forEach((dataset, datasetIndex) => {
            if (!dataset.valueLabel) return

            const meta = chart.getDatasetMeta(datasetIndex)
            if (meta.hidden) return

            meta.data.forEach((element, index) => {
                const rawValue = dataset.data?.[index]
                if (rawValue === null || rawValue === undefined || rawValue === "") return

                const value = Number(rawValue)
                if (!Number.isFinite(value)) return

                const isLine = dataset.type === "line"

                const position = element.tooltipPosition()
                let x = position.x
                let y = position.y
                let text = ""

                if (isLine) {
                    const actualRate = Number(dataset.actualValues?.[index])
                    if (!Number.isFinite(actualRate)) return

                    text = formatFillRateLabel(actualRate)

                    // Keep the percentage label inside the plotting area.
                    // At 0% it sits above the baseline; at/near 110% it sits
                    // below the point; normal values sit just above the line.
                    const topGuard = chartArea.top + 18
                    const bottomGuard = chartArea.bottom - 18
                    if (y <= chartArea.top + 22) {
                        y = topGuard + 10
                    } else if (y >= chartArea.bottom - 22) {
                        y = bottomGuard - 2
                    } else {
                        y = y - 15
                    }
                } else {
                    text = formatNumber(value)

                    // Preserve numeric labels even when a series value is 0.
                    // A zero bar label is placed just above the baseline.
                    if (value === 0) {
                        y = chartArea.bottom - 9
                    } else {
                        y = value >= 0
                            ? Math.max(y - 9, chartArea.top + 12)
                            : Math.min(y + 13, chartArea.bottom - 5)
                    }
                }

                ctx.save()
                ctx.font = "600 10px Arial, sans-serif"
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"

                if (isLine) {
                    // Give percentage labels a clean white pill so they remain
                    // readable even when the line crosses tall manpower bars.
                    const width = ctx.measureText(text).width + 8
                    const height = 14
                    ctx.fillStyle = "rgba(255, 255, 255, 0.94)"
                    ctx.strokeStyle = "rgba(159, 29, 32, 0.35)"
                    ctx.lineWidth = 1
                    ctx.fillRect(x - width / 2, y - height / 2, width, height)
                    ctx.strokeRect(x - width / 2, y - height / 2, width, height)
                    ctx.fillStyle = "#7F1D1D"
                } else {
                    ctx.fillStyle = "#404040"
                }

                ctx.fillText(text, x, y)
                ctx.restore()
            })
        })
    },
}

const chartOptions = computed(() => {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 240,
            easing: "easeOutQuart",
        },
        interaction: {
            mode: "index",
            intersect: false,
        },
        layout: {
            padding: {
                top: 36,
                right: 8,
                bottom: 0,
                left: 4,
            },
        },
        plugins: {
            legend: {
                position: "bottom",
                labels: {
                    usePointStyle: false,
                    boxWidth: 28,
                    boxHeight: 8,
                    padding: 16,
                    color: "#4B5563",
                    font: {
                        size: 11,
                        weight: "500",
                    },
                },
            },
            tooltip: {
                backgroundColor: "rgba(15, 23, 42, 0.94)",
                titleColor: "#FFFFFF",
                bodyColor: "#FFFFFF",
                borderColor: "rgba(148, 163, 184, 0.35)",
                borderWidth: 1,
                padding: 10,
                callbacks: {
                    label(context) {
                        const value = Number(context.raw ?? 0)
                        const label = context.dataset.label
                            ? `${context.dataset.label}: `
                            : ""

                        if (context.dataset.yAxisID === "yPercent") {
                            const actualRate = Number(
                                context.dataset.actualValues?.[context.dataIndex],
                            )
                            return `${label}${Number.isFinite(actualRate) ? actualRate.toFixed(1) : value.toFixed(1)}%`
                        }

                        const prefix = context.datasetIndex === 2 && value > 0 ? "+" : ""
                        return `${label}${prefix}${formatNumber(value)}`
                    },
                },
            },
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
                border: {
                    color: "#A3A3A3",
                },
                ticks: {
                    color: "#525252",
                    maxRotation: 0,
                    autoSkip: false,
                    font: {
                        size: 11,
                    },
                },
            },
            y: {
                position: "left",
                beginAtZero: true,
                grace: "12%",
                grid: {
                    color: "rgba(163, 163, 163, 0.30)",
                },
                border: {
                    display: false,
                },
                ticks: {
                    color: "#525252",
                    font: {
                        size: 10,
                    },
                    callback: (value) => Number(value).toLocaleString(),
                },
            },
            yPercent: {
                position: "right",
                min: PERCENT_AXIS_MIN,
                max: PERCENT_AXIS_MAX,
                grid: {
                    drawOnChartArea: false,
                },
                border: {
                    display: false,
                },
                ticks: {
                    color: "#525252",
                    stepSize: 10,
                    font: {
                        size: 10,
                    },
                    callback: (value) => `${value}%`,
                },
            },
        },
    }
})

const plugins = [permanentValueLabelsPlugin, selectedMonthPlugin]
</script>

<template>
    <div class="manpower-comparison-chart">
        <div class="manpower-comparison-chart__title">
            {{ t("excome.manpower.chartAria") }}
        </div>

        <div class="manpower-comparison-chart__canvas">
            <Bar
                :data="chartData"
                :options="chartOptions"
                :plugins="plugins"
            />
        </div>
    </div>
</template>

<style scoped>
.manpower-comparison-chart {
    min-width: 0;
    padding: 0.6rem 0.7rem 0.45rem;
    border: 1px solid #d7dee8;
    border-top: 0;
    background: #ffffff;
}

.manpower-comparison-chart__title {
    margin-bottom: 0.2rem;
    color: #475569;
    font-size: 0.94rem;
    font-weight: 700;
    line-height: 1.2;
    text-align: center;
}

.manpower-comparison-chart__canvas {
    position: relative;
    height: 330px;
    min-width: 0;
}

@media (max-width: 900px) {
    .manpower-comparison-chart__canvas {
        height: 280px;
    }
}
</style>
