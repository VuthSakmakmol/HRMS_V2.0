<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

const props = defineProps({
    data: {
        type: Object,
        default: () => ({}),
    },
    selectedLabel: {
        type: String,
        default: "",
    },
})

const { t } = useI18n()

const periods = computed(() => props.data.periods || [])
const rows = computed(() => props.data.rows || [])

function safeT(key, fallback) {
    const translated = t(key)

    return translated === key ? fallback : translated
}

function monthLabel(period) {
    return safeT(`hrDashboard.monthsShort.${period.month}`, period.label || period.month)
}

function formatPercent(value) {
    const number = Number(value) || 0

    return `${number.toFixed(2)}%`
}

function rowTitle() {
    const label = props.selectedLabel || safeT("hrDashboard.attendance.selectedScope", "Selected")

    return safeT("hrDashboard.attendance.topAbsentTitle", "Top absent by department").replace("{label}", label)
}
</script>

<template>
    <div class="attendance-top-absent-card">
        <div class="attendance-top-absent-card__title">
            {{ rowTitle() }}
        </div>

        <div class="attendance-top-absent-table-wrap">
            <table class="attendance-top-absent-table">
                <thead>
                    <tr>
                        <th class="attendance-top-absent-table__department">
                            {{ safeT("hrDashboard.attendance.department", "Department") }}
                        </th>

                        <th
                            v-for="period in periods"
                            :key="period.key"
                        >
                            {{ monthLabel(period) }}
                        </th>

                        <th class="attendance-top-absent-table__rate">
                            {{ safeT("hrDashboard.attendance.absentRate", "Absent rate (%)") }}
                        </th>

                        <th class="attendance-top-absent-table__rate is-workforce-rate">
                            {{ safeT("hrDashboard.attendance.absentRateWithoutAnnualMaternity", "Absent rate (%)-ANL&MA") }}
                        </th>
                    </tr>
                </thead>

                <tbody>
                    <tr v-if="!rows.length">
                        <td :colspan="periods.length + 3">
                            {{ safeT("common.noData", "No data") }}
                        </td>
                    </tr>

                    <tr
                        v-for="row in rows"
                        :key="row.departmentId"
                    >
                        <th class="attendance-top-absent-table__department">
                            {{ row.label }}
                        </th>

                        <td
                            v-for="month in row.months"
                            :key="`${row.departmentId}-${month.key}`"
                        >
                            {{ formatPercent(month.absentRateExcludingAnnualMaternity) }}
                        </td>

                        <td class="attendance-top-absent-table__rate">
                            {{ formatPercent(row.absentRate) }}
                        </td>

                        <td class="attendance-top-absent-table__rate is-workforce-rate">
                            {{ formatPercent(row.absentRateExcludingAnnualMaternity) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style scoped>
.attendance-top-absent-card {
    display: grid;
    gap: 0.45rem;
    padding: 0.55rem 0.8rem 0.8rem;
    border-right: 1px solid #1f1f1f;
    border-bottom: 1px solid #1f1f1f;
    border-left: 1px solid #1f1f1f;
    background: #ffffff;
}

.attendance-top-absent-card__title {
    color: #111111;
    font-size: 0.78rem;
    font-weight: 900;
}

.attendance-top-absent-table-wrap {
    width: 100%;
    overflow: hidden;
}

.attendance-top-absent-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    color: #000000;
    font-size: 0.56rem;
    font-weight: 800;
}

.attendance-top-absent-table th,
.attendance-top-absent-table td {
    height: 1.16rem;
    padding: 0.1rem 0.14rem;
    border: 1px solid #111111;
    text-align: center;
    vertical-align: middle;
    white-space: nowrap;
}

.attendance-top-absent-table thead th {
    background: #bfefff;
    font-weight: 900;
}

.attendance-top-absent-table__department {
    width: 12.5rem;
    text-align: left !important;
}

.attendance-top-absent-table tbody th {
    overflow: hidden;
    background: #ffffff;
    text-overflow: ellipsis;
}

.attendance-top-absent-table tbody td {
    background: #dff7ff;
    color: #002060;
}

.attendance-top-absent-table__rate {
    width: 5.2rem;
    background: #bfefff !important;
    color: #002060;
    font-weight: 900;
}

.attendance-top-absent-table__rate.is-workforce-rate {
    background: #fce4d6 !important;
    color: #000000;
}

@media (max-width: 760px) {
    .attendance-top-absent-card {
        padding: 0.5rem 0.45rem;
    }

    .attendance-top-absent-table {
        font-size: 0.47rem;
    }

    .attendance-top-absent-table__department {
        width: 8.5rem;
    }

    .attendance-top-absent-table__rate {
        width: 4.2rem;
    }
}
</style>
