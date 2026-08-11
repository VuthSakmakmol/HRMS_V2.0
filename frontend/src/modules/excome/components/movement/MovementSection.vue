<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import MovementChart from "./MovementChart.vue"

const props = defineProps({
    title: {
        type: String,
        required: true,
    },
    subtitle: {
        type: String,
        default: "",
    },
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

const employeeTypeLabel = computed(() => String(props.subtitle || "").trim())

const movementTitle = computed(() => {
    if (!employeeTypeLabel.value) return props.title

    return `${employeeTypeLabel.value} ${props.title}`
})

const inOutTitle = computed(() => {
    const inLabel = t("excome.movement.in")
    const outLabel = t("excome.movement.out")
    const title = `${inLabel} & ${outLabel}`

    if (!employeeTypeLabel.value) return title

    return `${employeeTypeLabel.value} ${title}`
})

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

function formatAverage(value) {
    const number = Number(value || 0)
    return Number.isInteger(number) ? String(number) : number.toFixed(1)
}
</script>

<template>
    <section class="dashboard-section">
        <div class="movement-titlebar">
            {{ movementTitle }}
        </div>

        <div class="movement-table-wrap">
            <table class="movement-table">
                <thead>
                    <tr>
                        <th>{{ t("excome.movement.item") }}</th>

                        <th
                            v-for="row in props.rows"
                            :key="row.key"
                            :class="{
                                'is-selected-period-key': row.key === selectedPeriodKey,
                            }"
                        >
                            {{ t(`excome.monthsShort.${row.month}`) }}
                        </th>

                        <th class="movement-average-column">AVG</th>
                    </tr>
                </thead>

                <tbody>
                    <tr class="movement-in">
                        <th>{{ t("excome.movement.in") }}</th>

                        <td
                            v-for="row in props.rows"
                            :key="`in-${row.key}`"
                            :class="{
                                'is-selected-period-key': row.key === selectedPeriodKey,
                            }"
                        >
                            {{ row.in }}
                        </td>

                        <td class="movement-average-column">
                            {{ formatAverage(averages.in) }}
                        </td>
                    </tr>

                    <tr class="movement-out">
                        <th>{{ t("excome.movement.out") }}</th>

                        <td
                            v-for="row in props.rows"
                            :key="`out-${row.key}`"
                            :class="{
                                'is-selected-period-key': row.key === selectedPeriodKey,
                            }"
                        >
                            {{ row.out }}
                        </td>

                        <td class="movement-average-column">
                            {{ formatAverage(averages.out) }}
                        </td>
                    </tr>

                    <tr class="movement-balance">
                        <th>{{ t("excome.movement.balance") }}</th>

                        <td
                            v-for="row in props.rows"
                            :key="`balance-${row.key}`"
                            :class="{
                                'is-selected-period-key': row.key === selectedPeriodKey,
                                'is-negative': row.balance < 0,
                                'is-positive': row.balance > 0,
                            }"
                        >
                            {{ row.balance }}
                        </td>

                        <td
                            class="movement-average-column"
                            :class="{
                                'is-negative': averages.balance < 0,
                                'is-positive': averages.balance > 0,
                            }"
                        >
                            {{ formatAverage(averages.balance) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="movement-titlebar movement-titlebar--chart">
            {{ inOutTitle }}
        </div>

        <MovementChart
            :rows="props.rows"
            :selected-period-key="selectedPeriodKey"
            :title="inOutTitle"
            :show-title="false"
        />
    </section>
</template>

<style scoped>
.dashboard-section {
    display: grid;
    gap: 0;
    min-width: 0;
}

.movement-titlebar {
    display: flex;
    min-height: 2.25rem;
    align-items: center;
    justify-content: center;
    padding: 0.42rem 0.75rem;
    background: #0b2d6b;
    color: #ffffff;
    font-size: 1.08rem;
    font-weight: 900;
    letter-spacing: 0.01em;
    text-align: center;
    text-transform: uppercase;
}

.movement-titlebar--chart {
    margin-top: 0.85rem;
}

.movement-table-wrap {
    overflow: hidden;
    border: 1px solid #7f8fa6;
    border-top: 0;
}

.movement-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    background: #ffffff;
}

.movement-table th,
.movement-table td {
    height: 1.85rem;
    padding: 0.28rem 0.35rem;
    border: 1px solid #a6a6a6;
    color: #111111;
    font-size: 0.66rem;
    font-weight: 700;
    text-align: center;
}

.movement-table thead th {
    background: #002060;
    color: #ffffff;
    font-weight: 800;
}

.movement-table thead th:first-child,
.movement-table tbody th {
    width: 8rem;
    text-align: left;
}

.movement-in th,
.movement-in td {
    background: #d9e2f3;
}

.movement-out th,
.movement-out td {
    background: #fce4d6;
}

.movement-balance th,
.movement-balance td {
    background: #e7e6e6;
}

.movement-table .movement-average-column {
    font-weight: 900;
    border-left: 2px solid #7f8fa6;
}

.movement-table thead .movement-average-column {
    background: #002060;
    color: #ffffff;
}

.movement-table .is-selected-period-key {
    border-right: 2px solid #ff0000;
    border-left: 2px solid #ff0000;
}

.movement-table thead .is-selected-period-key {
    border-top: 2px solid #ff0000;
}

.movement-table tbody tr:last-child .is-selected-period-key {
    border-bottom: 2px solid #ff0000;
}

.movement-table .is-negative {
    color: #ff0000;
}

.movement-table .is-positive {
    color: #548235;
}

@media (max-width: 760px) {
    .movement-titlebar {
        font-size: 0.92rem;
    }

    .movement-table thead th:first-child,
    .movement-table tbody th {
        width: 6rem;
    }

    .movement-table th,
    .movement-table td {
        font-size: 0.6rem;
        padding: 0.22rem 0.2rem;
    }
}
</style>
