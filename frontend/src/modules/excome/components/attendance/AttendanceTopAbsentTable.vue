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

// Always render Jan-Dec so the department view remains a true full-year
// comparison even when the user ranks by one selected month.
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

// A Jan-Dec range means "all months", not December. The backend still returns
// a selectedPeriodKey based on the range end date, so ignore that key here
// while the whole-year filter is active.
const effectiveSelectedPeriodKey = computed(() =>
    props.wholeYear ? null : props.selectedPeriodKey,
)

const selectedPeriod = computed(() =>
    periods.value.find((period) => period.key === effectiveSelectedPeriodKey.value) || null,
)

const rankingLabel = computed(() => {
    if (props.wholeYear) return safeT("excome.attendance.wholeYear", "Whole Year")
    if (selectedPeriod.value) return selectedPeriod.value.fullLabel
    return safeT("excome.attendance.ytd", "YTD")
})

const rows = computed(() => {
    const sortable = sourceRows.value
        .filter((row) => rankingExpected(row) > 0)
        .map((row) => ({
            row,
            score: rankingRate(row),
        }))

    sortable.sort((a, b) => {
        const scoreCompare = props.direction === "ASC"
            ? a.score - b.score
            : b.score - a.score

        if (scoreCompare !== 0) return scoreCompare

        const annualCompare = props.direction === "ASC"
            ? Number(a.row.absentRateExcludingAnnualMaternity || 0) - Number(b.row.absentRateExcludingAnnualMaternity || 0)
            : Number(b.row.absentRateExcludingAnnualMaternity || 0) - Number(a.row.absentRateExcludingAnnualMaternity || 0)

        if (annualCompare !== 0) return annualCompare

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
    return safeT(`excome.monthsShort.${period.month}`, period.label || "")
}

function formatPercent(value) {
    const number = Number(value) || 0
    return `${number.toFixed(2)}%`
}

function monthFor(row, periodKey) {
    return (row?.months || []).find((month) => month.key === periodKey) || null
}

function monthRate(row, periodKey) {
    return Number(monthFor(row, periodKey)?.absentRateExcludingAnnualMaternity || 0)
}

function rankingExpected(row) {
    if (!effectiveSelectedPeriodKey.value) return Number(row?.expected || 0)
    return Number(monthFor(row, effectiveSelectedPeriodKey.value)?.expected || 0)
}

function rankingRate(row) {
    if (!effectiveSelectedPeriodKey.value) {
        return Number(row?.absentRateExcludingAnnualMaternity || 0)
    }

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
    <div class="attendance-department-rank-card">
        <div class="attendance-department-rank-card__title">
            {{ title }}
        </div>

        <div class="attendance-department-rank-table-wrap">
            <table class="attendance-department-rank-table">
                <colgroup>
                    <col class="col-department" />
                    <col
                        v-for="period in periods"
                        :key="`col-${period.key}`"
                        class="col-month"
                    />
                    <col class="col-rate" />
                    <col class="col-rate" />
                </colgroup>

                <thead>
                    <tr>
                        <th class="attendance-department-rank-table__department">
                            {{ safeT("excome.attendance.department", "Department") }}
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

                        <th class="attendance-department-rank-table__rate">
                            {{ safeT("excome.attendance.absentRate", "Absent rate (%)") }}
                        </th>

                        <th class="attendance-department-rank-table__rate is-workforce-rate">
                            {{ safeT("excome.attendance.absentRateWithoutAnnualMaternity", "Absent rate (%)-ANL&MA") }}
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
                            class="attendance-department-rank-table__department"
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

                        <td
                            class="attendance-department-rank-table__rate percentage-progress-cell"
                            :style="progressStyle(row.absentRate)"
                        >
                            <span class="percentage-progress-cell__value">
                                {{ formatPercent(row.absentRate) }}
                            </span>
                        </td>

                        <td
                            class="attendance-department-rank-table__rate is-workforce-rate percentage-progress-cell"
                            :style="progressStyle(row.absentRateExcludingAnnualMaternity)"
                        >
                            <span class="percentage-progress-cell__value">
                                {{ formatPercent(row.absentRateExcludingAnnualMaternity) }}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style scoped>
.attendance-department-rank-card {
    display: grid;
    gap: 0.35rem;
    width: 100%;
    min-width: 0;
}

.attendance-department-rank-card__title {
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

.attendance-department-rank-table-wrap {
    width: 100%;
    min-width: 0;
    overflow: hidden;
    border: 1px dotted #64748b;
}

.attendance-department-rank-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    color: #111827;
    font-size: clamp(0.43rem, 0.50vw, 0.60rem);
    font-weight: 400;
}

.attendance-department-rank-table col.col-department {
    width: 22%;
}

.attendance-department-rank-table col.col-month {
    width: 4.45%;
}

.attendance-department-rank-table col.col-rate {
    width: 12.3%;
}

.attendance-department-rank-table th,
.attendance-department-rank-table td {
    min-width: 0;
    height: 1.34rem;
    padding: 0.08rem 0.05rem;
    border: 1px solid #334155;
    text-align: center;
    vertical-align: middle;
}

.attendance-department-rank-table thead th {
    background: #bfefff;
    font-weight: 700;
    line-height: 1.05;
    white-space: normal;
    overflow-wrap: anywhere;
}

.attendance-department-rank-table__department {
    text-align: left !important;
}

.attendance-department-rank-table thead .attendance-department-rank-table__department {
    text-align: center !important;
}

.attendance-department-rank-table tbody th {
    overflow: hidden;
    padding-right: 0.16rem;
    padding-left: 0.16rem;
    background: #ffffff;
    font-weight: 500;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.attendance-department-rank-table tbody td {
    font-weight: 400;
    white-space: nowrap;
}

.attendance-department-rank-table__rate {
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

.attendance-department-rank-table .is-selected-period {
    border-right: 2px solid #ef1f1f !important;
    border-left: 2px solid #ef1f1f !important;
}

.attendance-department-rank-table thead .is-selected-period {
    border-top: 2px solid #ef1f1f !important;
}

.attendance-department-rank-table tbody tr:last-child .is-selected-period {
    border-bottom: 2px solid #ef1f1f !important;
}

@media (max-width: 1240px) {
    .attendance-department-rank-table {
        font-size: clamp(0.40rem, 0.56vw, 0.54rem);
    }

    .attendance-department-rank-table col.col-department {
        width: 20%;
    }

    .attendance-department-rank-table col.col-month {
        width: 4.55%;
    }

    .attendance-department-rank-table col.col-rate {
        width: 12.7%;
    }
}

@media (max-width: 760px) {
    .attendance-department-rank-table {
        font-size: clamp(0.38rem, 1.35vw, 0.50rem);
    }

    .attendance-department-rank-table th,
    .attendance-department-rank-table td {
        padding-right: 0.02rem;
        padding-left: 0.02rem;
    }

    .attendance-department-rank-table col.col-department {
        width: 18%;
    }

    .attendance-department-rank-table col.col-month {
        width: 4.65%;
    }

    .attendance-department-rank-table col.col-rate {
        width: 13.1%;
    }
}
</style>
