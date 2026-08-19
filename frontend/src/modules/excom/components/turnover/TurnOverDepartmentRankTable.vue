<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

const props = defineProps({
    data: {
        type: Object,
        default: () => ({}),
    },
    direction: {
        type: String,
        default: "DESC",
        validator: (value) => ["ASC", "DESC"].includes(value),
    },
    selectedPeriodKey: {
        type: String,
        default: null,
    },
    wholeYear: {
        type: Boolean,
        default: false,
    },
    limit: {
        type: Number,
        default: 10,
    },
})

const { t } = useI18n()

const MONTHS = Object.freeze([
    { month: 1, short: "Jan", full: "January" },
    { month: 2, short: "Feb", full: "February" },
    { month: 3, short: "Mar", full: "March" },
    { month: 4, short: "Apr", full: "April" },
    { month: 5, short: "May", full: "May" },
    { month: 6, short: "Jun", full: "June" },
    { month: 7, short: "Jul", full: "July" },
    { month: 8, short: "Aug", full: "August" },
    { month: 9, short: "Sep", full: "September" },
    { month: 10, short: "Oct", full: "October" },
    { month: 11, short: "Nov", full: "November" },
    { month: 12, short: "Dec", full: "December" },
])

const sourcePeriods = computed(() => props.data.periods || [])
const sourceRows = computed(() => props.data.rows || [])

const selectedYear = computed(() => {
    const fromSelected = String(props.selectedPeriodKey || "").match(/^(\d{4})-/)?.[1]
    if (fromSelected) return Number(fromSelected)

    const fromPeriod = Number(sourcePeriods.value?.[0]?.year)
    if (Number.isFinite(fromPeriod) && fromPeriod > 0) return fromPeriod

    const fromMonth = Number(sourceRows.value?.[0]?.months?.[0]?.year)
    if (Number.isFinite(fromMonth) && fromMonth > 0) return fromMonth

    return new Date().getUTCFullYear()
})

// Keep the same Jan-Dec layout as ABSENT – Separate by department.
const periods = computed(() =>
    MONTHS.map((month) => {
        const key = `${selectedYear.value}-${String(month.month).padStart(2, "0")}`
        const source = sourcePeriods.value.find((item) => item.key === key)

        return {
            key,
            year: selectedYear.value,
            month: month.month,
            label: source?.label || month.short,
            fullLabel: month.full,
        }
    }),
)

const effectiveSelectedPeriodKey = computed(() =>
    props.wholeYear ? null : props.selectedPeriodKey,
)

const selectedPeriod = computed(() =>
    periods.value.find((period) => period.key === effectiveSelectedPeriodKey.value) || null,
)

const rankingLabel = computed(() => {
    if (props.wholeYear) return safeT("excom.turnover.wholeYear", "Whole Year")
    if (selectedPeriod.value) return selectedPeriod.value.fullLabel
    return safeT("excom.turnover.ytd", "YTD")
})

const rows = computed(() => {
    const sortable = sourceRows.value
        .filter((row) => rankingHeadcount(row) > 0 || rankingExits(row) > 0)
        .map((row) => ({
            row,
            score: rankingRate(row),
        }))

    sortable.sort((a, b) => {
        const scoreCompare = props.direction === "ASC"
            ? a.score - b.score
            : b.score - a.score

        if (scoreCompare !== 0) return scoreCompare

        const exitCompare = props.direction === "ASC"
            ? rankingExits(a.row) - rankingExits(b.row)
            : rankingExits(b.row) - rankingExits(a.row)

        if (exitCompare !== 0) return exitCompare

        return String(a.row.departmentName || a.row.label || "")
            .localeCompare(String(b.row.departmentName || b.row.label || ""))
    })

    return sortable
        .slice(0, Math.max(1, Number(props.limit) || 10))
        .map((entry) => entry.row)
})

const title = computed(() => {
    const directionLabel = props.direction === "ASC" ? "Low to High" : "High to Low"
    return `${directionLabel} of ${rankingLabel.value}`
})

function safeT(key, fallback) {
    const translated = t(key)
    return translated === key ? fallback : translated
}

function monthLabel(period) {
    return safeT(`excom.monthsShort.${period.month}`, period.label || "")
}

function formatPercent(value) {
    const number = Number(value) || 0
    return `${number.toFixed(2)}%`
}

function formatNumber(value) {
    return (Number(value) || 0).toLocaleString()
}

function monthFor(row, periodKey) {
    return (row?.months || []).find((month) => month.key === periodKey) || null
}

function monthRate(row, periodKey) {
    return Number(monthFor(row, periodKey)?.turnoverRate || 0)
}

function rankingHeadcount(row) {
    if (!effectiveSelectedPeriodKey.value) return Number(row?.averageHeadcount || 0)
    return Number(monthFor(row, effectiveSelectedPeriodKey.value)?.averageHeadcount || 0)
}

function rankingExits(row) {
    if (!effectiveSelectedPeriodKey.value) return Number(row?.exits || 0)
    return Number(monthFor(row, effectiveSelectedPeriodKey.value)?.exits || 0)
}

function rankingRate(row) {
    if (!effectiveSelectedPeriodKey.value) return Number(row?.turnoverRate || 0)
    return monthRate(row, effectiveSelectedPeriodKey.value)
}

function progressColor(value) {
    const number = Number(value) || 0

    if (number >= 10) return "rgba(50, 140, 175, 0.72)"
    if (number >= 7) return "rgba(115, 190, 220, 0.68)"
    if (number >= 5) return "rgba(169, 216, 235, 0.72)"
    if (number >= 3) return "rgba(207, 234, 245, 0.82)"
    if (number > 0) return "rgba(232, 246, 251, 0.95)"
    return "transparent"
}

function progressStyle(value) {
    const number = Number(value) || 0
    const progress = Math.min(Math.max(number, 0), 100)

    return {
        "--progress-width": `${progress}%`,
        "--progress-color": progressColor(number),
    }
}
</script>

<template>
    <div class="turnover-department-rank-card">
        <div class="turnover-department-rank-card__title">
            {{ title }}
        </div>

        <div class="turnover-department-rank-table-wrap">
            <table class="turnover-department-rank-table">
                <colgroup>
                    <col class="col-department" />
                    <col
                        v-for="period in periods"
                        :key="`col-${period.key}`"
                        class="col-month"
                    />
                    <col class="col-exits" />
                    <col class="col-rate" />
                </colgroup>

                <thead>
                    <tr>
                        <th class="turnover-department-rank-table__department">
                            {{ safeT("excom.turnover.department", "Department") }}
                        </th>

                        <th
                            v-for="period in periods"
                            :key="period.key"
                            :class="{
                                'is-selected-period': period.key === effectiveSelectedPeriodKey,
                            }"
                        >
                            {{ monthLabel(period) }}
                        </th>

                        <th class="turnover-department-rank-table__exits">
                            {{ safeT("excom.turnover.exitCount", "Exit count") }}
                        </th>

                        <th class="turnover-department-rank-table__rate">
                            {{ safeT("excom.turnover.turnoverRatePercent", "Turnover rate (%)") }}
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
                        <th
                            class="turnover-department-rank-table__department"
                            :title="row.departmentName || row.label"
                        >
                            {{ row.departmentName || row.label }}
                        </th>

                        <td
                            v-for="period in periods"
                            :key="`${row.departmentId}-${period.key}`"
                            class="percentage-progress-cell"
                            :class="{
                                'is-selected-period': period.key === effectiveSelectedPeriodKey,
                            }"
                            :style="progressStyle(monthRate(row, period.key))"
                        >
                            <span class="percentage-progress-cell__value">
                                {{ formatPercent(monthRate(row, period.key)) }}
                            </span>
                        </td>

                        <td class="turnover-department-rank-table__exits">
                            {{ formatNumber(rankingExits(row)) }}
                        </td>

                        <td
                            class="turnover-department-rank-table__rate percentage-progress-cell"
                            :style="progressStyle(rankingRate(row))"
                        >
                            <span class="percentage-progress-cell__value">
                                {{ formatPercent(rankingRate(row)) }}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style scoped>
.turnover-department-rank-card {
    display: grid;
    gap: 0.35rem;
    width: 100%;
    min-width: 0;
}

.turnover-department-rank-card__title {
    display: flex;
    min-height: 1.7rem;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0.45rem;
    background: #e8f7ff;
    color: #0b2d6b;
    font-size: clamp(0.72rem, 0.72vw, 0.84rem);
    font-weight: 700;
    text-align: center;
}

.turnover-department-rank-table-wrap {
    width: 100%;
    min-width: 0;
    overflow: hidden;
    border: 1px dotted #64748b;
}

.turnover-department-rank-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    color: #111827;
    font-size: clamp(0.43rem, 0.50vw, 0.60rem);
    font-weight: 400;
}

.turnover-department-rank-table col.col-department {
    width: 22%;
}

.turnover-department-rank-table col.col-month {
    width: 4.25%;
}

.turnover-department-rank-table col.col-exits {
    width: 8.5%;
}

.turnover-department-rank-table col.col-rate {
    width: 18.5%;
}

.turnover-department-rank-table th,
.turnover-department-rank-table td {
    min-width: 0;
    height: 1.34rem;
    padding: 0.08rem 0.05rem;
    border: 1px solid #334155;
    text-align: center;
    vertical-align: middle;
}

.turnover-department-rank-table thead th {
    background: #bfefff;
    font-weight: 700;
    line-height: 1.05;
    white-space: normal;
    overflow-wrap: anywhere;
}

.turnover-department-rank-table__department {
    text-align: left !important;
}

.turnover-department-rank-table thead .turnover-department-rank-table__department {
    text-align: center !important;
}

.turnover-department-rank-table tbody th {
    overflow: hidden;
    padding-right: 0.16rem;
    padding-left: 0.16rem;
    background: #ffffff;
    font-weight: 500;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.turnover-department-rank-table tbody td {
    font-weight: 400;
    white-space: nowrap;
}

.turnover-department-rank-table__exits,
.turnover-department-rank-table__rate {
    font-weight: 500 !important;
    line-height: 1.05;
}

.percentage-progress-cell {
    position: relative;
    overflow: hidden;
    isolation: isolate;
    background-color: #f8fbfd;
}

.percentage-progress-cell::before {
    position: absolute;
    z-index: -1;
    top: 0;
    bottom: 0;
    left: 0;
    width: var(--progress-width, 0%);
    background: var(--progress-color, transparent);
    content: "";
    transition: width 160ms ease, background-color 160ms ease;
}

.percentage-progress-cell__value {
    position: relative;
    z-index: 1;
    color: #111827;
    font-weight: inherit;
}

.turnover-department-rank-table .is-selected-period {
    border-right: 2px solid #ef1f1f !important;
    border-left: 2px solid #ef1f1f !important;
}

.turnover-department-rank-table thead .is-selected-period {
    border-top: 2px solid #ef1f1f !important;
}

.turnover-department-rank-table tbody tr:last-child .is-selected-period {
    border-bottom: 2px solid #ef1f1f !important;
}

@media (max-width: 760px) {
    .turnover-department-rank-table {
        font-size: 0.46rem;
    }
}
</style>
