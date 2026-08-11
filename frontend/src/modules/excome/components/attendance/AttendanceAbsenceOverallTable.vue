<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

const props = defineProps({
    data: {
        type: Object,
        default: () => ({}),
    },
    selectedPeriodKey: {
        type: String,
        default: null,
    },
})

const { t } = useI18n()

const defaultColumns = [
    {
        code: "UL",
        label: "Unpaid Leave",
        group: "absence",
        showDay: false,
    },
    {
        code: "SL",
        label: "Sick Leave",
        group: "absence",
        showDay: true,
    },
    {
        code: "AB",
        label: "Absent",
        group: "absence",
        showDay: true,
    },
    {
        code: "AL",
        label: "Annual Leave",
        group: "leave",
        showDay: true,
    },
    {
        code: "ML",
        label: "Maternity Leave",
        group: "leave",
        showDay: true,
    },
]

const columns = computed(() => {
    if (Array.isArray(props.data?.columns) && props.data.columns.length) {
        return props.data.columns
    }

    return defaultColumns
})

const rows = computed(() => {
    if (Array.isArray(props.data?.rows)) {
        return props.data.rows
    }

    return []
})

const hasRows = computed(() => rows.value.length > 0)

function safeT(key, fallback) {
    const translated = t(key)

    return translated === key ? fallback : translated
}

function columnLabel(column) {
    return safeT(
        `excome.attendance.absenceTypes.${column.code}`,
        column.label || column.code,
    )
}

function rowLabel(row) {
    if (row?.label) {
        return row.label
    }

    if (row?.monthLabel) {
        return row.monthLabel
    }

    return row?.key || "-"
}

function normalizeNumber(value) {
    const number = Number(value)

    return Number.isFinite(number) ? number : 0
}

function formatDay(value) {
    const number = normalizeNumber(value)

    if (number % 1 === 0) {
        return number.toFixed(0)
    }

    return number.toFixed(1)
}

function formatPercent(value) {
    const number = normalizeNumber(value)

    return `${number.toFixed(2)}%`
}

function valueFor(row, column, key) {
    const typeValue = row?.types?.[column.code]

    if (!typeValue) {
        return 0
    }

    return typeValue[key] ?? 0
}

function columnClass(column) {
    return `is-${column.group || "absence"}`
}

function isSummaryRow(row) {
    return [
        "PREVIOUS_YEAR",
        "CURRENT_YTD",
        "CURRENT_YEAR",
        "YTD",
    ].includes(row?.rowType)
}

function isSelectedRow(row) {
    if (props.selectedPeriodKey) {
        return row?.key === props.selectedPeriodKey
    }

    return row?.rowType === "CURRENT_YTD"
}

function progressColor(value) {
    const number = normalizeNumber(value)

    if (number >= 10) return "rgba(50, 140, 175, 0.72)"
    if (number >= 7) return "rgba(115, 190, 220, 0.68)"
    if (number >= 5) return "rgba(169, 216, 235, 0.72)"
    if (number >= 3) return "rgba(207, 234, 245, 0.82)"
    if (number > 0) return "rgba(232, 246, 251, 0.95)"
    return "transparent"
}

function progressStyle(value) {
    const number = normalizeNumber(value)
    const progress = Math.min(Math.max(number, 0), 100)

    return {
        "--progress-width": `${progress}%`,
        "--progress-color": progressColor(number),
    }
}
</script>

<template>
    <div class="attendance-overall-table-card">
        <div
            v-if="hasRows"
            class="attendance-overall-table-wrap"
        >
            <table class="attendance-overall-table">
                <thead>
                    <tr>
                        <th
                            rowspan="2"
                            class="attendance-overall-table__label"
                        />

                        <th
                            v-for="column in columns"
                            :key="column.code"
                            :colspan="column.showDay ? 2 : 1"
                            :class="[
                                'attendance-overall-table__group',
                                columnClass(column),
                            ]"
                        >
                            {{ columnLabel(column) }}
                        </th>

                        <th
                            rowspan="2"
                            class="attendance-overall-table__rate is-total-rate"
                        >
                            {{ safeT("excome.attendance.absentRate", "Absent rate (%)") }}
                        </th>

                        <th
                            rowspan="2"
                            class="attendance-overall-table__rate is-workforce-rate"
                        >
                            {{ safeT("excome.attendance.absentRateWithoutAnnualMaternity", "Absent rate (%)-ANL&MA") }}
                        </th>
                    </tr>

                    <tr>
                        <template
                            v-for="column in columns"
                            :key="`sub-${column.code}`"
                        >
                            <th
                                v-if="column.showDay"
                                :class="[
                                    'attendance-overall-table__sub',
                                    columnClass(column),
                                ]"
                            >
                                {{ safeT("excome.attendance.day", "Day") }}
                            </th>

                            <th
                                :class="[
                                    'attendance-overall-table__sub',
                                    columnClass(column),
                                ]"
                            >
                                %
                            </th>
                        </template>
                    </tr>
                </thead>

                <tbody>
                    <tr
                        v-for="row in rows"
                        :key="row.key || row.label"
                        :class="{
                            'is-summary': isSummaryRow(row),
                            'is-filter-selected': isSelectedRow(row),
                        }"
                    >
                        <th class="attendance-overall-table__label">
                            {{ rowLabel(row) }}
                        </th>

                        <template
                            v-for="column in columns"
                            :key="`${row.key || row.label}-${column.code}`"
                        >
                            <td
                                v-if="column.showDay"
                                :class="[
                                    'attendance-overall-table__value',
                                    columnClass(column),
                                ]"
                            >
                                {{ formatDay(valueFor(row, column, "day")) }}
                            </td>

                            <td
                                :class="[
                                    'attendance-overall-table__value',
                                    columnClass(column),
                                    'percentage-progress-cell',
                                ]"
                                :style="progressStyle(valueFor(row, column, 'rate'))"
                            >
                                <span class="percentage-progress-cell__value">
                                    {{ formatPercent(valueFor(row, column, "rate")) }}
                                </span>
                            </td>
                        </template>

                        <td
                            class="attendance-overall-table__value is-total-rate percentage-progress-cell"
                            :style="progressStyle(row.absentRate)"
                        >
                            <span class="percentage-progress-cell__value">
                                {{ formatPercent(row.absentRate) }}
                            </span>
                        </td>

                        <td
                            class="attendance-overall-table__value is-workforce-rate percentage-progress-cell"
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

        <div
            v-else
            class="attendance-overall-table-empty"
        >
            {{ safeT("excome.attendance.noAbsentData", "No absent data matched this filter.") }}
        </div>
    </div>
</template>

<style scoped>
.attendance-overall-table-card {
    display: grid;
    gap: 0.45rem;
    padding: 0.6rem 0.8rem 0.7rem;
    border-right: 1px solid #1f1f1f;
    border-left: 1px solid #1f1f1f;
    background: #ffffff;
}

.attendance-overall-table-wrap {
    width: 100%;
    min-width: 0;
    overflow: hidden;
}

.attendance-overall-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    color: #111827;
    font-size: clamp(0.60rem, 0.62vw, 0.70rem);
    font-weight: 400;
}

.attendance-overall-table th,
.attendance-overall-table td {
    height: 1.35rem;
    padding: 0.14rem 0.18rem;
    border: 1px solid #334155;
    text-align: center;
    vertical-align: middle;
    white-space: nowrap;
}

.attendance-overall-table thead th {
    background: #f8fafc;
    font-weight: 700;
}

.attendance-overall-table tbody td {
    font-weight: 400;
}

.attendance-overall-table__label {
    width: 6.4rem;
    background: #ffffff;
    font-weight: 500;
}

.attendance-overall-table thead .attendance-overall-table__label {
    font-weight: 700;
}

.attendance-overall-table__group.is-absence,
.attendance-overall-table__sub.is-absence,
.attendance-overall-table__value.is-absence {
    background: #fce4d6;
}

.attendance-overall-table__group.is-leave,
.attendance-overall-table__sub.is-leave,
.attendance-overall-table__value.is-leave {
    background: #bfefff;
}

.attendance-overall-table__rate,
.attendance-overall-table__value.is-total-rate {
    background: #fce4d6;
    font-weight: 500;
}

.attendance-overall-table__value.is-workforce-rate,
.attendance-overall-table__rate.is-workforce-rate {
    background: #bfefff;
    color: #002060;
    font-weight: 500;
}

.percentage-progress-cell {
    position: relative;
    overflow: hidden;
    isolation: isolate;
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
    color: inherit;
    font-weight: inherit;
}

/* Summary rows stay distinguishable without the heavy bold treatment. */
.attendance-overall-table tbody tr.is-summary th,
.attendance-overall-table tbody tr.is-summary td {
    font-weight: 500;
}

.attendance-overall-table tbody tr.is-filter-selected th,
.attendance-overall-table tbody tr.is-filter-selected td {
    border-top: 2px solid #ef1f1f;
    border-bottom: 2px solid #ef1f1f;
}

.attendance-overall-table tbody tr.is-filter-selected th:first-child {
    border-left: 2px solid #ef1f1f;
}

.attendance-overall-table tbody tr.is-filter-selected td:last-child {
    border-right: 2px solid #ef1f1f;
}

.attendance-overall-table-empty {
    display: grid;
    min-height: 4rem;
    place-items: center;
    border: 1px dashed #cbd5e1;
    background: #f8fafc;
    color: #64748b;
    font-size: 0.84rem;
    font-weight: 500;
}

.attendance-overall-table tbody tr.is-selected-period-row > * {
    border-top: 2px solid #ef4444 !important;
    border-bottom: 2px solid #ef4444 !important;
}

.attendance-overall-table tbody tr.is-selected-period-row > *:first-child {
    border-left: 2px solid #ef4444 !important;
}

.attendance-overall-table tbody tr.is-selected-period-row > *:last-child {
    border-right: 2px solid #ef4444 !important;
}

@media (max-width: 760px) {
    .attendance-overall-table-card {
        padding: 0.5rem 0.45rem;
    }

    .attendance-overall-table {
        font-size: clamp(0.50rem, 1.65vw, 0.60rem);
    }

    .attendance-overall-table__label {
        width: 4.8rem;
    }
}
</style>
