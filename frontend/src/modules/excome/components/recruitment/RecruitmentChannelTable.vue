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

const rows = computed(() => props.data.rows || [])
const total = computed(() => props.data.total || null)
const sourcePeriods = computed(() => props.data.periods || [])
const previousYear = computed(() => props.data.previousYear || "")
const currentYear = computed(() => props.data.currentYear || "")

const MONTH_NUMBERS = Object.freeze(Array.from({ length: 12 }, (_, index) => index + 1))

function monthNumber(value) {
    const raw = String(value ?? "").trim()
    const numeric = Number(raw)

    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric

    const match = raw.match(/(?:^|[-/])(\d{1,2})(?:$|[-/])/)
    if (match) {
        const parsed = Number(match[1])
        if (parsed >= 1 && parsed <= 12) return parsed
    }

    return null
}

function periodMonth(period) {
    return monthNumber(period?.month) || monthNumber(period?.key)
}

function periodKeyForMonth(month) {
    const existing = sourcePeriods.value.find((period) => periodMonth(period) === month)
    if (existing?.key) return existing.key

    const year = Number(currentYear.value)
    return Number.isFinite(year) && year > 0
        ? `${year}-${String(month).padStart(2, "0")}`
        : String(month)
}

const periods = computed(() => MONTH_NUMBERS.map((month) => {
    const existing = sourcePeriods.value.find((period) => periodMonth(period) === month)

    return {
        ...(existing || {}),
        month,
        key: existing?.key || periodKeyForMonth(month),
        isFuture: existing?.isFuture === true,
    }
}))

function monthLabel(period) {
    return t(`excome.monthsShort.${period.month}`)
}

function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value) || 0)
}

function isFuturePeriod(period) {
    return period?.isFuture === true
}

function monthEntryForPeriod(months, period) {
    const list = Array.isArray(months) ? months : []

    return list.find((entry) => {
        if (entry?.key && period?.key && entry.key === period.key) return true
        return periodMonth(entry) === period.month
    }) || null
}

function monthCount(months, period) {
    return Number(monthEntryForPeriod(months, period)?.count || 0)
}

function monthIsFuture(months, period) {
    const entry = monthEntryForPeriod(months, period)
    return entry?.isFuture === true || period?.isFuture === true
}

function isSelectedPeriod(period) {
    if (!props.selectedPeriodKey) return false
    if (period.key === props.selectedPeriodKey) return true

    const selectedMonth = monthNumber(props.selectedPeriodKey)
    return selectedMonth !== null && selectedMonth === period.month
}
</script>

<template>
    <div class="recruitment-table-shell">
        <div class="recruitment-table-wrap">
            <table class="recruitment-table">
                <colgroup>
                    <col class="recruitment-col-no">
                    <col class="recruitment-col-channel">
                    <col class="recruitment-col-previous">
                    <col class="recruitment-col-target">
                    <col
                        v-for="period in periods"
                        :key="`col-${period.key}`"
                        class="recruitment-col-month"
                    >
                    <col class="recruitment-col-average">
                </colgroup>

                <thead>
                    <tr class="recruitment-table__year-row">
                        <th class="recruitment-table__year-spacer" colspan="2" />
                        <th class="recruitment-table__year">
                            {{ previousYear }}
                        </th>
                        <th
                            class="recruitment-table__year recruitment-table__current-year"
                            :colspan="periods.length + 2"
                        >
                            {{ currentYear }}
                        </th>
                    </tr>

                    <tr class="recruitment-table__header-row">
                        <th class="recruitment-table__no">#</th>
                        <th class="recruitment-table__channel">
                            {{ t("excome.recruitment.channels") }}
                        </th>
                        <th>{{ t("excome.recruitment.previousAveragePerMonth") }}</th>
                        <th class="recruitment-table__target">
                            {{ t("excome.recruitment.targetPerMonth") }}
                        </th>
                        <th
                            v-for="period in periods"
                            :key="period.key"
                            class="recruitment-table__month selected-month-top"
                            :class="{
                                'is-selected-period': isSelectedPeriod(period),
                                'is-future-period': isFuturePeriod(period),
                            }"
                        >
                            {{ monthLabel(period) }}
                        </th>
                        <th>{{ t("excome.recruitment.averagePerMonth") }}</th>
                    </tr>
                </thead>

                <tbody>
                    <tr
                        v-for="(row, index) in rows"
                        :key="row.key || row.id || index"
                    >
                        <td class="recruitment-table__no">{{ index + 1 }}</td>
                        <td class="recruitment-table__channel recruitment-table__channel-name">
                            {{ row.name }}
                        </td>
                        <td>{{ formatNumber(row.previousAveragePerMonth) }}</td>
                        <td class="recruitment-table__target">
                            {{ formatNumber(row.targetPerMonth) }}
                        </td>
                        <td
                            v-for="period in periods"
                            :key="`${row.key || row.id || index}-${period.key}`"
                            class="recruitment-table__month"
                            :class="{
                                'is-selected-period': isSelectedPeriod(period),
                                'is-empty': !monthCount(row.months, period),
                                'is-future-period': monthIsFuture(row.months, period),
                            }"
                        >
                            {{ formatNumber(monthCount(row.months, period)) }}
                        </td>
                        <td>{{ formatNumber(row.averagePerMonth) }}</td>
                    </tr>

                    <tr v-if="!rows.length" class="recruitment-table__empty-row">
                        <td :colspan="periods.length + 5">
                            {{ t("excome.recruitment.noData") }}
                        </td>
                    </tr>
                </tbody>

                <tfoot v-if="total">
                    <tr class="recruitment-table__total">
                        <td />
                        <td class="recruitment-table__channel">
                            {{ t("excome.recruitment.total") }}
                        </td>
                        <td>{{ formatNumber(total.previousAveragePerMonth) }}</td>
                        <td class="recruitment-table__target">
                            {{ formatNumber(total.targetPerMonth) }}
                        </td>
                        <td
                            v-for="period in periods"
                            :key="`total-${period.key}`"
                            class="recruitment-table__month selected-month-bottom"
                            :class="{
                                'is-selected-period': isSelectedPeriod(period),
                                'is-empty': !monthCount(total.months, period),
                                'is-future-period': monthIsFuture(total.months, period),
                            }"
                        >
                            {{ formatNumber(monthCount(total.months, period)) }}
                        </td>
                        <td>{{ formatNumber(total.averagePerMonth) }}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>
</template>

<style scoped>
.recruitment-table-shell {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
}

.recruitment-table-wrap {
    width: 100%;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
}

.recruitment-table {
    width: 100%;
    min-width: 72rem;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
    color: #0f172a;
    font-size: 0.68rem;
    font-weight: 650;
}

.recruitment-table th,
.recruitment-table td {
    height: 1.75rem;
    padding: 0.22rem 0.28rem;
    border-right: 1px solid #cbd5e1;
    border-bottom: 1px solid #cbd5e1;
    text-align: center;
    vertical-align: middle;
    white-space: nowrap;
}

.recruitment-table tr > *:last-child {
    border-right: 0;
}

.recruitment-table thead th {
    position: sticky;
    z-index: 4;
    top: 0;
    background: #f8fafc;
    color: #0f172a;
    font-weight: 800;
}

.recruitment-table__year-row th {
    top: 0;
    height: 1.65rem;
}

.recruitment-table__header-row th {
    top: 1.65rem;
}

.recruitment-table__year {
    background: #e8f8fb !important;
    font-size: 0.72rem;
}

.recruitment-table__current-year,
.recruitment-table__target {
    background: #d9f7f7 !important;
}

.recruitment-table__year-spacer {
    background: #ffffff !important;
}

.recruitment-col-no {
    width: 2.4rem;
}

.recruitment-col-channel {
    width: 20rem;
}

.recruitment-col-previous,
.recruitment-col-target,
.recruitment-col-average {
    width: 5.5rem;
}

.recruitment-col-month {
    width: 4.15rem;
}

.recruitment-table__no {
    position: sticky;
    z-index: 3;
    left: 0;
    width: 2.4rem;
    background: #ffffff;
}

.recruitment-table__channel {
    position: sticky;
    z-index: 2;
    left: 2.4rem;
    background: #ffffff;
    text-align: left !important;
}

.recruitment-table thead .recruitment-table__channel,
.recruitment-table thead .recruitment-table__no {
    z-index: 6;
    background: #f8fafc;
}

.recruitment-table__channel-name {
    overflow: hidden;
    color: #075985;
    font-size: 0.72rem;
    font-weight: 750;
    text-overflow: ellipsis;
}

.recruitment-table tbody tr:nth-child(even) td {
    background: #f8fafc;
}

.recruitment-table tbody tr:nth-child(even) .recruitment-table__channel,
.recruitment-table tbody tr:nth-child(even) .recruitment-table__no {
    background: #f8fafc;
}

.recruitment-table tbody tr:hover td,
.recruitment-table tbody tr:hover .recruitment-table__channel,
.recruitment-table tbody tr:hover .recruitment-table__no {
    background: #eff6ff;
}

.recruitment-table td.is-empty {
    color: #94a3b8;
    font-weight: 500;
}

/* Future months remain visible for comparison; only their text is muted. */
.recruitment-table .is-future-period {
    color: #94a3b8;
    background: #fafafa !important;
}

/* Selected month is a complete red rectangle from header to total row. */
.recruitment-table .is-selected-period {
    border-left: 2px solid #ef4444 !important;
    border-right: 2px solid #ef4444 !important;
    background: #fff7ed !important;
}

.recruitment-table thead .is-selected-period {
    border-top: 2px solid #ef4444 !important;
}

.recruitment-table tfoot .is-selected-period,
.recruitment-table tbody tr:last-child .is-selected-period:not(:has(+ *)) {
    border-bottom: 2px solid #ef4444 !important;
}

.recruitment-table tfoot td {
    position: sticky;
    z-index: 3;
    bottom: 0;
}

.recruitment-table__total td {
    background: #dffafa !important;
    border-top: 2px solid #475569;
    border-bottom: 0;
    font-weight: 900;
}

.recruitment-table__total .recruitment-table__no,
.recruitment-table__total .recruitment-table__channel {
    z-index: 5;
    background: #dffafa !important;
}

.recruitment-table__total .is-selected-period {
    border-bottom: 2px solid #ef4444 !important;
    background: #fff1e8 !important;
}

.recruitment-table__empty-row td {
    height: 4rem;
    color: #64748b;
    font-weight: 600;
}

@media (max-width: 900px) {
    .recruitment-table {
        min-width: 66rem;
        font-size: 0.62rem;
    }

    .recruitment-col-channel {
        width: 16rem;
    }

    .recruitment-col-month {
        width: 3.7rem;
    }

    .recruitment-table__channel-name {
        font-size: 0.66rem;
    }
}
</style>
