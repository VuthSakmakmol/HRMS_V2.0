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
    width: 100%;
    min-width: 0;
    overflow: hidden;
    border: 1px solid #cbd5e1;
    border-top: 0;
    background: #ffffff;
}

.recruitment-table-wrap {
    width: 100%;
    min-width: 0;
    overflow: hidden;
}

/*
 * Fixed 100% layout: all 12 months always fit inside the Excome card.
 * There is intentionally no min-width and no horizontal scrolling.
 */
.recruitment-table {
    width: 100%;
    min-width: 0;
    border-collapse: collapse;
    table-layout: fixed;
    color: #0f172a;
    font-size: clamp(0.56rem, 0.48rem + 0.18vw, 0.72rem);
    font-weight: 650;
}

.recruitment-col-no {
    width: 3%;
}

.recruitment-col-channel {
    width: 20%;
}

.recruitment-col-previous,
.recruitment-col-target,
.recruitment-col-average {
    width: 6%;
}

.recruitment-col-month {
    width: 4.9167%;
}

.recruitment-table th,
.recruitment-table td {
    height: 1.9rem;
    padding: 0.22rem 0.16rem;
    border-right: 1px solid #cbd5e1;
    border-bottom: 1px solid #cbd5e1;
    text-align: center;
    vertical-align: middle;
}

.recruitment-table tr > *:last-child {
    border-right: 0;
}

.recruitment-table thead th {
    background: #f8fafc;
    color: #0f172a;
    font-weight: 850;
    line-height: 1.05;
    white-space: normal;
    overflow-wrap: anywhere;
}

.recruitment-table__year-row th {
    height: 1.6rem;
    padding-top: 0.15rem;
    padding-bottom: 0.15rem;
}

.recruitment-table__year {
    background: #e8f8fb !important;
    font-size: clamp(0.6rem, 0.52rem + 0.18vw, 0.74rem);
}

.recruitment-table__current-year,
.recruitment-table__target {
    background: #d9f7f7 !important;
}

.recruitment-table__year-spacer {
    background: #ffffff !important;
}

.recruitment-table__no {
    text-align: center !important;
}

.recruitment-table__channel {
    text-align: left !important;
}

.recruitment-table__channel-name {
    color: #075985;
    font-weight: 800;
    line-height: 1.12;
    white-space: normal;
    overflow-wrap: anywhere;
}

.recruitment-table tbody tr:nth-child(even) td {
    background: #f8fafc;
}

.recruitment-table tbody tr:hover td {
    background: #eff6ff;
}

.recruitment-table td.is-empty {
    color: #94a3b8;
    font-weight: 500;
}

.recruitment-table .is-future-period {
    color: #94a3b8;
    background: #fafafa !important;
}

/* Selected reporting month follows the same Excome red-range standard. */
.recruitment-table .is-selected-period {
    border-right: 2px solid #ef4444 !important;
    border-left: 2px solid #ef4444 !important;
    background: #fff7ed !important;
}

.recruitment-table thead .is-selected-period {
    border-top: 2px solid #ef4444 !important;
}

.recruitment-table tfoot .is-selected-period {
    border-bottom: 2px solid #ef4444 !important;
}

.recruitment-table tfoot td {
    background: #d9f7f7;
    color: #0f172a;
    font-weight: 900;
}

.recruitment-table__empty-row td {
    height: 4rem;
    color: #64748b;
    font-weight: 700;
    text-align: center;
}

@media (max-width: 1000px) {
    .recruitment-col-no {
        width: 2.5%;
    }

    .recruitment-col-channel {
        width: 18.5%;
    }

    .recruitment-col-previous,
    .recruitment-col-target,
    .recruitment-col-average {
        width: 5.5%;
    }

    .recruitment-col-month {
        width: 5.2083%;
    }

    .recruitment-table th,
    .recruitment-table td {
        padding-right: 0.1rem;
        padding-left: 0.1rem;
    }
}

@media (max-width: 700px) {
    .recruitment-table {
        font-size: 0.52rem;
    }

    .recruitment-table th,
    .recruitment-table td {
        height: 1.75rem;
        padding: 0.15rem 0.05rem;
    }

    .recruitment-table__year {
        font-size: 0.56rem;
    }
}
</style>
