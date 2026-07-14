<script setup>
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

function safeT(key, fallback) {
    const translated = t(key)

    return translated === key ? fallback : translated
}

function monthLabel(month) {
    if (month === "AVG") return safeT("hrDashboard.attendance.avg", "AVG")

    return safeT(`hrDashboard.monthsShort.${month}`, month)
}

function formatPercent(value) {
    const number = Number(value) || 0

    return `${number.toFixed(2)}%`
}

function rowLabel(row) {
    return safeT(`hrDashboard.attendance.codes.${row.code}`, row.label || row.code)
}
</script>

<template>
    <div class="attendance-detail-table-wrap">
        <table class="attendance-detail-table">
            <thead>
                <tr>
                    <th class="attendance-detail-table__item">
                        {{ safeT("hrDashboard.attendance.detailType", "Detail") }}
                    </th>

                    <th
                        v-for="month in rows[0]?.months || []"
                        :key="month.key"
                        :class="{
                            'is-selected': month.key === selectedPeriodKey,
                        }"
                    >
                        {{ monthLabel(month.month) }}
                    </th>

                    <th>
                        {{ safeT("hrDashboard.attendance.avg", "AVG") }}
                    </th>
                </tr>
            </thead>

            <tbody>
                <tr
                    v-for="row in rows"
                    :key="row.code"
                >
                    <th class="attendance-detail-table__item">
                        {{ rowLabel(row) }}
                    </th>

                    <td
                        v-for="month in row.months"
                        :key="`${row.code}-${month.key}`"
                        :class="{
                            'is-selected': month.key === selectedPeriodKey,
                            'is-danger': Number(month.currentRate) > 0,
                        }"
                    >
                        {{ formatPercent(month.currentRate) }}
                    </td>

                    <td :class="{ 'is-danger': Number(row.currentRate) > 0 }">
                        {{ formatPercent(row.currentRate) }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.attendance-detail-table-wrap {
    overflow: hidden;
    border: 1px solid #1f1f1f;
    border-top: 0;
    background: #ffffff;
}

.attendance-detail-table {
    width: 100%;
    min-width: 0;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 0.63rem;
    font-weight: 800;
}

.attendance-detail-table th,
.attendance-detail-table td {
    height: 1.65rem;
    padding: 0.22rem 0.24rem;
    border: 1px solid #8e8e8e;
    text-align: center;
    vertical-align: middle;
}

.attendance-detail-table thead th {
    background: #002060;
    color: #ffffff;
}

.attendance-detail-table__item {
    width: 9rem;
    text-align: left !important;
}

.attendance-detail-table tbody th {
    background: #eaf7ff;
    color: #002060;
}

.attendance-detail-table tbody td {
    background: #ffffff;
    color: #111111;
}

.attendance-detail-table .is-danger {
    color: #d70000;
    font-weight: 900;
}

.attendance-detail-table .is-selected {
    border-left: 2px solid #ff0000 !important;
    border-right: 2px solid #ff0000 !important;
}

@media (max-width: 760px) {
    .attendance-detail-table {
        font-size: 0.52rem;
    }

    .attendance-detail-table__item {
        width: 6.5rem;
    }
}
</style>
