<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseChart from "../shared/EnterpriseChart.vue"

const props = defineProps({
    rows: {
        type: Array,
        default: () => [],
    },
    selectedPeriodKey: {
        type: String,
        default: null,
    },
    title: {
        type: String,
        default: "",
    },
    showTitle: {
        type: Boolean,
        default: true,
    },
})

const { t } = useI18n()

const selectedIndex = computed(() =>
    props.rows.findIndex((row) => row.key === props.selectedPeriodKey),
)

function roundAverage(value) {
    return Math.round((Number(value) || 0) * 10) / 10
}

const averageSourceRows = computed(() => {
    if (!props.rows.length) return []

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const rowYear = Number(props.rows[0]?.year || 0)

    const selectedRow = props.rows.find((row) => row.key === props.selectedPeriodKey)
    let cutoffMonth = Number(selectedRow?.month || 12)

    // For the current year, never average future months that have not happened yet.
    if (rowYear === currentYear) {
        cutoffMonth = Math.min(cutoffMonth, currentMonth)
    }

    return props.rows.filter((row) => Number(row.month) <= cutoffMonth)
})

const averages = computed(() => {
    const rows = averageSourceRows.value

    if (!rows.length) {
        return { in: 0, out: 0, balance: 0 }
    }

    const totals = rows.reduce(
        (result, row) => {
            result.in += Number(row.in || 0)
            result.out += Number(row.out || 0)
            result.balance += Number(row.balance || 0)
            return result
        },
        { in: 0, out: 0, balance: 0 },
    )

    return {
        in: roundAverage(totals.in / rows.length),
        out: roundAverage(totals.out / rows.length),
        balance: roundAverage(totals.balance / rows.length),
    }
})

const chartData = computed(() => ({
    labels: [
        ...props.rows.map((row) => t(`excom.monthsShort.${row.month}`)),
        "AVG",
    ],
    datasets: [
        {
            label: t("excom.movement.in"),
            data: [
                ...props.rows.map((row) => Number(row.in || 0)),
                averages.value.in,
            ],
            valueLabel: true,
            valueLabelShowZero: false,
            valueLabelDecimals: 0,
            valueLabelColor: "#1D4ED8",
        },
        {
            label: t("excom.movement.out"),
            data: [
                ...props.rows.map((row) => Number(row.out || 0)),
                averages.value.out,
            ],
            valueLabel: true,
            valueLabelShowZero: false,
            valueLabelDecimals: 0,
            valueLabelColor: "#0284C7",
        },
        {
            label: t("excom.movement.balance"),
            data: [
                ...props.rows.map((row) => Number(row.balance || 0)),
                averages.value.balance,
            ],
            valueLabel: true,
            valueLabelShowZero: false,
            valueLabelDecimals: 0,
            valueLabelColor: "#059669",
        },
    ],
}))

const chartTitle = computed(() =>
    props.title || t("excom.movement.chartAria"),
)
</script>

<template>
    <EnterpriseChart
        :data="chartData"
        :title="props.showTitle ? chartTitle : ''"
        :height="270"
        :selected-index="selectedIndex"
    />
</template>
