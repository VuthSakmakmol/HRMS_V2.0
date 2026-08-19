<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseChart from "../shared/EnterpriseChart.vue"

const props = defineProps({
    mode: {
        type: String,
        default: "TOTAL",
        validator: (value) => ["TOTAL", "DETAIL"].includes(value),
    },
    rows: {
        type: Array,
        default: () => [],
    },
    detailRows: {
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
        default: 0,
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

const DETAIL_COLORS = [
    { background: "rgba(37, 99, 235, 0.78)", border: "#1D4ED8" },
    { background: "rgba(14, 165, 233, 0.78)", border: "#0284C7" },
    { background: "rgba(16, 185, 129, 0.78)", border: "#059669" },
    { background: "rgba(245, 158, 11, 0.78)", border: "#D97706" },
    { background: "rgba(139, 92, 246, 0.78)", border: "#7C3AED" },
    { background: "rgba(239, 68, 68, 0.78)", border: "#DC2626" },
    { background: "rgba(100, 116, 139, 0.78)", border: "#475569" },
    { background: "rgba(20, 184, 166, 0.78)", border: "#0F766E" },
]

function safeT(key, fallback) {
    const translated = t(key)

    return translated === key ? fallback : translated
}

function monthLabel(row = {}) {
    if (row.month === "AVG") return safeT("excom.attendance.avg", "AVG")

    return safeT(`excom.monthsShort.${row.month}`, row.label || row.month || "")
}

function detailLabel(row = {}) {
    return safeT(
        `excom.attendance.codes.${row.code}`,
        row.label || row.name || row.code || "Detail",
    )
}

const detailPeriods = computed(() => {
    const firstRow = props.detailRows.find((row) => Array.isArray(row.months) && row.months.length)
    const months = firstRow?.months || []

    return [
        ...months.map((month) => ({
            key: month.key,
            month: month.month,
            label: month.label,
        })),
        {
            key: "AVG",
            month: "AVG",
            label: "AVG",
        },
    ]
})

function detailValue(detailRow, period) {
    if (period.key === "AVG") return Number(detailRow.currentRate || 0)

    const month = (detailRow.months || []).find((item) => item.key === period.key)

    return Number(month?.currentRate || 0)
}

const totalChartData = computed(() => ({
    labels: props.rows.map(monthLabel),
    datasets: [
        {
            type: "bar",
            label: String(props.previousYear),
            data: props.rows.map((row) => Number(row.previousRate || 0)),
            backgroundColor: "rgba(148, 163, 184, 0.78)",
            borderColor: "#64748B",
            valueLabel: true,
            valueLabelSuffix: "%",
            valueLabelDecimals: 1,
            valueLabelShowZero: true,
        },
        {
            type: "bar",
            label: String(props.currentYear),
            data: props.rows.map((row) => Number(row.currentRate || 0)),
            backgroundColor: "rgba(37, 99, 235, 0.82)",
            borderColor: "#1D4ED8",
            valueLabel: true,
            valueLabelSuffix: "%",
            valueLabelDecimals: 1,
            valueLabelShowZero: true,
        },
        {
            type: "line",
            label: `Target < ${Number(props.targetRate || 0).toFixed(2)}%`,
            data: props.rows.map((row) => Number(row.targetRate ?? props.targetRate ?? 0)),
            borderColor: "#EF4444",
            backgroundColor: "#EF4444",
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 3,
            tension: 0.25,
        },
    ],
}))

const detailChartData = computed(() => ({
    labels: detailPeriods.value.map(monthLabel),
    datasets: props.detailRows.map((row, index) => {
        const color = DETAIL_COLORS[index % DETAIL_COLORS.length]

        return {
            type: "bar",
            label: detailLabel(row),
            data: detailPeriods.value.map((period) => detailValue(row, period)),
            backgroundColor: color.background,
            borderColor: color.border,
            borderWidth: 1,
            borderRadius: 3,
            maxBarThickness: 30,
        }
    }),
}))

const chartData = computed(() => (
    props.mode === "DETAIL" ? detailChartData.value : totalChartData.value
))

const selectedIndex = computed(() => {
    const periods = props.mode === "DETAIL" ? detailPeriods.value : props.rows

    return periods.findIndex((period) => period.key === props.selectedPeriodKey)
})

const chartHeight = computed(() => {
    if (props.mode !== "DETAIL") return 320

    return props.detailRows.length > 5 ? 390 : 340
})
</script>

<template>
    <EnterpriseChart
        :key="`${mode}-${currentYear}-${detailRows.length}`"
        :data="chartData"
        :title="title"
        percent
        :height="chartHeight"
        :selected-index="selectedIndex"
    />
</template>
