<script setup>
import { useI18n } from "vue-i18n"

import DashboardSectionHeader from "../shared/DashboardSectionHeader.vue"
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
</script>

<template>
    <section class="dashboard-section">
        <DashboardSectionHeader
            :title="title"
            :subtitle="subtitle"
        />

        <div class="movement-table-wrap">
            <table class="movement-table">
                <thead>
                    <tr>
                        <th>{{ t("hrDashboard.movement.item") }}</th>

                        <th
                            v-for="row in props.rows"
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
                    <tr class="movement-in">
                        <th>{{ t("hrDashboard.movement.in") }}</th>

                        <td
                            v-for="row in props.rows"
                            :key="`in-${row.key}`"
                            :class="{
                                'is-selected-period-key': row.key === selectedPeriodKey,
                            }"
                        >
                            {{ row.in }}
                        </td>
                    </tr>

                    <tr class="movement-out">
                        <th>{{ t("hrDashboard.movement.out") }}</th>

                        <td
                            v-for="row in props.rows"
                            :key="`out-${row.key}`"
                            :class="{
                                'is-selected-period-key': row.key === selectedPeriodKey,
                            }"
                        >
                            {{ row.out }}
                        </td>
                    </tr>

                    <tr class="movement-balance">
                        <th>{{ t("hrDashboard.movement.balance") }}</th>

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
                    </tr>
                </tbody>
            </table>
        </div>

        <MovementChart
            :rows="props.rows"
            :selected-period-key="selectedPeriodKey"
        />
    </section>
</template>

<style scoped>
.dashboard-section {
    display: grid;
    gap: 0;
    min-width: 0;
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
