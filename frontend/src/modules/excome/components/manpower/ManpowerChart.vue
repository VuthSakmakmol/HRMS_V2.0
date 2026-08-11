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
        if (!chartArea) return

        // Bar labels are placed first and become protected areas. Fill Rate
        // labels are never allowed to enter those areas.
        const placedBoxes = []

        function boxesOverlap(a, b, padding = 4) {
            return !(
                a.right + padding < b.left ||
                a.left - padding > b.right ||
                a.bottom + padding < b.top ||
                a.top - padding > b.bottom
            )
        }

        function makeBox(x, y, text, horizontalPadding = 5, height = 15) {
            ctx.save()
            ctx.font = "700 10px Arial, sans-serif"
            const width = ctx.measureText(text).width + (horizontalPadding * 2)
            ctx.restore()

            return {
                x,
                y,
                text,
                width,
                height,
                left: x - (width / 2),
                right: x + (width / 2),
                top: y - (height / 2),
                bottom: y + (height / 2),
            }
        }

        function isInsideChart(box, margin = 3) {
            return (
                box.left >= chartArea.left + margin &&
                box.right <= chartArea.right - margin &&
                box.top >= chartArea.top + margin &&
                box.bottom <= chartArea.bottom - margin
            )
        }

        function isFree(box, padding = 4) {
            return !placedBoxes.some((placed) => boxesOverlap(box, placed, padding))
        }

        function findBottomFreeBox(candidates, text, horizontalPadding = 5, height = 15) {
            for (const candidate of candidates) {
                const box = makeBox(
                    candidate.x,
                    candidate.y,
                    text,
                    horizontalPadding,
                    height,
                )

                if (!isInsideChart(box)) continue
                if (!isFree(box)) continue
                return box
            }

            // Zero labels are never promoted to a top lane. If their first
            // positions collide, search horizontally along the baseline only.
            const bottomY = chartArea.bottom - 12
            const originX = candidates[0]?.x ?? ((chartArea.left + chartArea.right) / 2)
            const maxOffset = Math.max(chartArea.right - chartArea.left, 120)

            for (let offset = 12; offset <= maxOffset; offset += 12) {
                for (const direction of [1, -1]) {
                    const box = makeBox(
                        originX + (offset * direction),
                        bottomY,
                        text,
                        horizontalPadding,
                        height,
                    )
                    if (!isInsideChart(box)) continue
                    if (!isFree(box)) continue
                    return box
                }
            }

            return null
        }

        function findFreeBox(candidates, text, horizontalPadding = 5, height = 15) {
            for (const candidate of candidates) {
                const box = makeBox(
                    candidate.x,
                    candidate.y,
                    text,
                    horizontalPadding,
                    height,
                )

                // Do not clamp a candidate back on top of another label.
                // An out-of-bounds position is skipped and the next nearby
                // position is tried instead.
                if (!isInsideChart(box)) continue
                if (!isFree(box)) continue

                return box
            }

            // Responsive fallback: search nearby lanes around the same point.
            // This gives small screens more options without ever covering a
            // Roadmap / Actual label.
            const origin = candidates[0] || {
                x: (chartArea.left + chartArea.right) / 2,
                y: chartArea.top + 12,
            }
            const xOffsets = [0, 22, -22, 40, -40, 58, -58, 76, -76, 96, -96, 118, -118]
            const yOffsets = [0, 18, 36, -18, 54, -36]

            for (const yOffset of yOffsets) {
                for (const xOffset of xOffsets) {
                    const box = makeBox(
                        origin.x + xOffset,
                        origin.y + yOffset,
                        text,
                        horizontalPadding,
                        height,
                    )

                    if (!isInsideChart(box)) continue
                    if (!isFree(box)) continue

                    return box
                }
            }

            // Extremely narrow last-resort search across the top lanes. This
            // still refuses to overlap any already reserved value label.
            for (const y of [
                chartArea.top + 11,
                chartArea.top + 29,
                chartArea.top + 47,
                chartArea.top + 65,
            ]) {
                for (let x = chartArea.left + 18; x <= chartArea.right - 18; x += 12) {
                    const box = makeBox(x, y, text, horizontalPadding, height)
                    if (!isInsideChart(box)) continue
                    if (!isFree(box)) continue
                    return box
                }
            }

            return null
        }

        function drawLabel(box, text, {
            color,
            borderColor = null,
            index = null,
            kind = "label",
        } = {}) {
            if (!box) return

            ctx.save()
            ctx.font = "700 10px Arial, sans-serif"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"

            // Opaque backing means both the Fill Rate line and selected-month
            // red border always remain visually behind the data labels.
            ctx.fillStyle = "rgba(255, 255, 255, 0.98)"
            ctx.fillRect(box.left, box.top, box.width, box.height)

            if (borderColor) {
                ctx.strokeStyle = borderColor
                ctx.lineWidth = 1
                ctx.strokeRect(box.left, box.top, box.width, box.height)
            }

            ctx.fillStyle = color || "#404040"
            ctx.fillText(text, box.x, box.y)
            ctx.restore()

            placedBoxes.push({
                ...box,
                index,
                kind,
            })
        }

        // 1) Roadmap / Actual labels have first priority and reserve their
        // exact drawing space before Fill Rate placement is considered.
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            if (!dataset.valueLabel || dataset.type === "line") return

            const meta = chart.getDatasetMeta(datasetIndex)
            if (meta.hidden) return

            meta.data.forEach((element, index) => {
                const rawValue = dataset.data?.[index]
                if (rawValue === null || rawValue === undefined || rawValue === "") return

                const value = Number(rawValue)
                if (!Number.isFinite(value)) return

                const text = formatNumber(value)
                const position = element.tooltipPosition()
                const isZero = value === 0
                const preferredY = isZero
                    ? chartArea.bottom - 12
                    : value > 0
                        ? Math.max(position.y - 11, chartArea.top + 13)
                        : Math.min(position.y + 13, chartArea.bottom - 13)

                const sideStep = 16
                const placementCandidates = isZero
                    ? [
                            // Zero values stay on the bottom baseline. If two
                            // zero labels are too close, move them left/right
                            // within the same bottom lane instead of stacking.
                            { x: position.x, y: preferredY },
                            { x: position.x - sideStep, y: preferredY },
                            { x: position.x + sideStep, y: preferredY },
                            { x: position.x - (sideStep * 2), y: preferredY },
                            { x: position.x + (sideStep * 2), y: preferredY },
                        ]
                        : [
                            { x: position.x, y: preferredY },
                            // When labels share the same top position, keep
                            // them on the same visual row and separate left / right.
                            { x: position.x - sideStep, y: preferredY },
                            { x: position.x + sideStep, y: preferredY },
                            { x: position.x - (sideStep * 2), y: preferredY },
                            { x: position.x + (sideStep * 2), y: preferredY },
                            { x: position.x, y: preferredY - 18 },
                            { x: position.x, y: preferredY + 18 },
                        ]

                const box = isZero
                    ? findBottomFreeBox(placementCandidates, text, 4, 14)
                    : findFreeBox(placementCandidates, text, 4, 14)

                drawLabel(box, text, {
                    color: "#404040",
                    index,
                    kind: "manpower",
                })
            })
        })

        // 2) Fill Rate stays close to its red point, but Roadmap / Actual
        // labels are hard protected. If the preferred top position is busy,
        // the percentage moves beside the manpower value instead of covering
        // or hiding it.
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            if (!dataset.valueLabel || dataset.type !== "line") return

            const meta = chart.getDatasetMeta(datasetIndex)
            if (meta.hidden) return

            meta.data.forEach((element, index) => {
                const actualRate = Number(dataset.actualValues?.[index])
                if (!Number.isFinite(actualRate)) return

                const text = formatFillRateLabel(actualRate)
                const position = element.tooltipPosition()
                const probe = makeBox(position.x, position.y, text, 5, 15)
                const fillHalfWidth = probe.width / 2

                const monthBoxes = placedBoxes.filter(
                    (placed) => placed.index === index && placed.kind === "manpower",
                )

                const monthLeft = monthBoxes.length
                    ? Math.min(...monthBoxes.map((box) => box.left))
                    : position.x
                const monthRight = monthBoxes.length
                    ? Math.max(...monthBoxes.map((box) => box.right))
                    : position.x
                const topLabelY = monthBoxes.length
                    ? Math.min(...monthBoxes.map((box) => box.y))
                    : chartArea.top + 11

                const isZero = actualRate === 0
                const pointAboveY = Math.max(position.y - 15, chartArea.top + 13)
                const topLane1 = chartArea.top + 13
                const topLane2 = chartArea.top + 31
                const topLane3 = chartArea.top + 49
                const bottomLane = chartArea.bottom - 12
                const safeGap = 8

                // Dynamic side positions use the real measured label widths.
                // This keeps long values such as 2622.2% beside, never on top
                // of, the Roadmap / Actual number for the same month.
                const rightOfMonth = monthRight + safeGap + fillHalfWidth
                const leftOfMonth = monthLeft - safeGap - fillHalfWidth

                const candidates = isZero
                    ? [
                        // 0% always belongs at the bottom. Keep it near its
                        // month point and separate left/right if another zero
                        // label already occupies that position.
                        { x: position.x, y: bottomLane },
                        { x: position.x + 24, y: bottomLane },
                        { x: position.x - 24, y: bottomLane },
                        { x: position.x + 42, y: bottomLane },
                        { x: position.x - 42, y: bottomLane },
                    ]
                    : [
                        // Preferred: directly above the Fill Rate point.
                        { x: position.x, y: pointAboveY },

                        // Collision response: same height, nearby left/right.
                        // This is preferred over stacking labels vertically.
                        { x: rightOfMonth, y: topLabelY },
                        { x: leftOfMonth, y: topLabelY },
                        { x: position.x + 32 + fillHalfWidth, y: pointAboveY },
                        { x: position.x - 32 - fillHalfWidth, y: pointAboveY },
                        { x: rightOfMonth, y: topLane1 },
                        { x: leftOfMonth, y: topLane1 },

                        // Only if the nearby row is full, use another top lane.
                        { x: position.x, y: topLane2 },
                        { x: rightOfMonth, y: topLane2 },
                        { x: leftOfMonth, y: topLane2 },
                        { x: position.x, y: topLane3 },
                        { x: rightOfMonth, y: topLane3 },
                        { x: leftOfMonth, y: topLane3 },
                    ]

                const box = isZero
                    ? findBottomFreeBox(candidates, text, 5, 15)
                    : findFreeBox(candidates, text, 5, 15)

                drawLabel(box, text, {
                    color: "#7F1D1D",
                    borderColor: "rgba(159, 29, 32, 0.38)",
                    index,
                    kind: "fillRate",
                })
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
                top: 54,
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

const plugins = [selectedMonthPlugin, permanentValueLabelsPlugin]
</script>

<template>
    <div class="manpower-comparison-chart">
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


.manpower-comparison-chart__canvas {
    position: relative;
    height: 350px;
    min-width: 0;
}

@media (max-width: 900px) {
    .manpower-comparison-chart__canvas {
        height: 300px;
    }
}
</style>
