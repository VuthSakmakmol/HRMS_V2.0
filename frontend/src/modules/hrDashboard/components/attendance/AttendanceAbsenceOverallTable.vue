<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

const props = defineProps({
    data: {
        type: Object,
        default: () => ({}),
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
        `hrDashboard.attendance.absenceTypes.${column.code}`,
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
</script>

<template>
    <div class="attendance-overall-table-card">
        <div class="attendance-overall-table-card__title">
            {{ safeT("hrDashboard.attendance.absentData", "Absent Data") }}
        </div>

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
                            {{ safeT("hrDashboard.attendance.absentRate", "Absent rate (%)") }}
                        </th>

                        <th
                            rowspan="2"
                            class="attendance-overall-table__rate is-workforce-rate"
                        >
                            {{ safeT("hrDashboard.attendance.absentRateWithoutAnnualMaternity", "Absent rate (%)-ANL&MA") }}
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
                                {{ safeT("hrDashboard.attendance.day", "Day") }}
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
                                ]"
                            >
                                {{ formatPercent(valueFor(row, column, "rate")) }}
                            </td>
                        </template>

                        <td class="attendance-overall-table__value is-total-rate">
                            {{ formatPercent(row.absentRate) }}
                        </td>

                        <td class="attendance-overall-table__value is-workforce-rate">
                            {{ formatPercent(row.absentRateExcludingAnnualMaternity) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div
            v-else
            class="attendance-overall-table-empty"
        >
            {{ safeT("hrDashboard.attendance.noAbsentData", "No absent data matched this filter.") }}
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

.attendance-overall-table-card__title {
    color: #111111;
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.01em;
}

.attendance-overall-table-wrap {
    width: 100%;
    overflow: hidden;
}

.attendance-overall-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    color: #000000;
    font-size: 0.58rem;
    font-weight: 800;
}

.attendance-overall-table th,
.attendance-overall-table td {
    height: 1.2rem;
    padding: 0.12rem 0.16rem;
    border: 1px solid #101010;
    text-align: center;
    vertical-align: middle;
    white-space: nowrap;
}

.attendance-overall-table thead th {
    background: #f8fafc;
    font-weight: 900;
}

.attendance-overall-table__label {
    width: 6.4rem;
    background: #ffffff;
    font-weight: 900;
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
    font-weight: 900;
}

.attendance-overall-table__value.is-workforce-rate,
.attendance-overall-table__rate.is-workforce-rate {
    background: #bfefff;
    color: #002060;
    font-weight: 900;
}

.attendance-overall-table tbody tr.is-summary th,
.attendance-overall-table tbody tr.is-summary td {
    border-top: 2px solid #ff0000;
    border-bottom: 2px solid #ff0000;
}

.attendance-overall-table tbody tr.is-summary th:first-child {
    border-left: 2px solid #ff0000;
}

.attendance-overall-table tbody tr.is-summary td:last-child {
    border-right: 2px solid #ff0000;
}

.attendance-overall-table-empty {
    display: grid;
    min-height: 4rem;
    place-items: center;
    border: 1px dashed #cbd5e1;
    background: #f8fafc;
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 800;
}

@media (max-width: 760px) {
    .attendance-overall-table-card {
        padding: 0.5rem 0.45rem;
    }

    .attendance-overall-table {
        font-size: 0.48rem;
    }

    .attendance-overall-table__label {
        width: 4.8rem;
    }
}
</style>