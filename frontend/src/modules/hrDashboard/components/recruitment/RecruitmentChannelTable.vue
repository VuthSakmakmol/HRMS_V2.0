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
const periods = computed(() => props.data.periods || [])
const previousYear = computed(() => props.data.previousYear || "")
const currentYear = computed(() => props.data.currentYear || "")

function monthLabel(period) {
    return t(`hrDashboard.monthsShort.${period.month}`)
}

function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value) || 0)
}
</script>

<template>
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
                <tr>
                    <th
                        class="recruitment-table__year-spacer"
                        colspan="2"
                    />
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

                <tr>
                    <th class="recruitment-table__no">
                        #
                    </th>
                    <th class="recruitment-table__channel">
                        {{ t("hrDashboard.recruitment.channels") }}
                    </th>
                    <th>
                        {{ t("hrDashboard.recruitment.previousAveragePerMonth") }}
                    </th>
                    <th class="recruitment-table__target">
                        {{ t("hrDashboard.recruitment.targetPerMonth") }}
                    </th>
                    <th
                        v-for="period in periods"
                        :key="period.key"
                        class="recruitment-table__month"
                        :class="{
                            'is-selected-period': period.key === selectedPeriodKey,
                        }"
                    >
                        {{ monthLabel(period) }}
                    </th>
                    <th>
                        {{ t("hrDashboard.recruitment.averagePerMonth") }}
                    </th>
                </tr>
            </thead>

            <tbody>
                <tr
                    v-for="(row, index) in rows"
                    :key="row.key || row.id || index"
                >
                    <td class="recruitment-table__no">
                        {{ index + 1 }}
                    </td>
                    <td class="recruitment-table__channel recruitment-table__channel-name">
                        <strong>{{ row.name }}</strong>
                        <span v-if="row.shortName && row.shortName !== row.name">
                            {{ row.shortName }}
                        </span>
                    </td>
                    <td>{{ formatNumber(row.previousAveragePerMonth) }}</td>
                    <td class="recruitment-table__target">
                        {{ formatNumber(row.targetPerMonth) }}
                    </td>
                    <td
                        v-for="month in row.months"
                        :key="month.key"
                        class="recruitment-table__month"
                        :class="{
                            'is-selected-period': month.key === selectedPeriodKey,
                            'is-empty': !Number(month.count),
                        }"
                    >
                        {{ formatNumber(month.count) }}
                    </td>
                    <td>{{ formatNumber(row.averagePerMonth) }}</td>
                </tr>

                <tr
                    v-if="total"
                    class="recruitment-table__total"
                >
                    <td />
                    <td class="recruitment-table__channel">
                        {{ t("hrDashboard.recruitment.total") }}
                    </td>
                    <td>{{ formatNumber(total.previousAveragePerMonth) }}</td>
                    <td class="recruitment-table__target">
                        {{ formatNumber(total.targetPerMonth) }}
                    </td>
                    <td
                        v-for="month in total.months"
                        :key="month.key"
                        class="recruitment-table__month"
                        :class="{
                            'is-selected-period': month.key === selectedPeriodKey,
                            'is-empty': !Number(month.count),
                        }"
                    >
                        {{ formatNumber(month.count) }}
                    </td>
                    <td>{{ formatNumber(total.averagePerMonth) }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.recruitment-table-wrap {
    min-width: 0;
    overflow: hidden;
    background: #ffffff;
}

.recruitment-table {
    width: 100%;
    min-width: 0;
    border-collapse: collapse;
    table-layout: fixed;
    color: #000000;
    font-size: 0.62rem;
    font-weight: 700;
}

.recruitment-table th,
.recruitment-table td {
    border: 1px solid #8e8e8e;
    padding: 0.2rem 0.18rem;
    text-align: center;
    vertical-align: middle;
}

.recruitment-table thead th {
    background: #ffffff;
    color: #000000;
    font-weight: 800;
}

.recruitment-table__year {
    background: #eaf7f8 !important;
    font-size: 0.7rem;
}

.recruitment-table__current-year,
.recruitment-table__target {
    background: #ccfbfb !important;
}

.recruitment-table__year-spacer {
    border-left-color: transparent !important;
    border-top-color: transparent !important;
}

.recruitment-col-no {
    width: 2.05rem;
}

.recruitment-col-channel {
    width: 31%;
}

.recruitment-col-previous,
.recruitment-col-target,
.recruitment-col-average {
    width: 4.7rem;
}

.recruitment-col-month {
    width: 3.2rem;
}

.recruitment-table__no {
    width: 2.05rem;
}

.recruitment-table__channel {
    text-align: left !important;
}

.recruitment-table__month {
    width: 3.2rem;
    min-width: 3.2rem;
    max-width: 3.2rem;
}

.recruitment-table__channel-name {
    white-space: nowrap;
    overflow: visible;
    font-size: 0.66rem;
    letter-spacing: -0.01em;
}

.recruitment-table__channel-name strong {
    color: #005ce6;
}

.recruitment-table__channel-name span {
    margin-left: 0.25rem;
    color: #000000;
    font-weight: 500;
}

.recruitment-table tbody tr:nth-child(even) td {
    background: #f6f6f6;
}

.recruitment-table td.is-empty {
    color: #8f8f8f;
}

.recruitment-table .is-selected-period {
    border-left: 2px solid #ff0000 !important;
    border-right: 2px solid #ff0000 !important;
}

.recruitment-table__total td {
    background: #d8ffff !important;
    border-top: 2px solid #555555;
    font-weight: 900;
}

@media (max-width: 900px) {
    .recruitment-table {
        font-size: 0.55rem;
    }

    .recruitment-col-channel {
        width: 38%;
    }

    .recruitment-col-month,
    .recruitment-table__month {
        width: 2.65rem;
        min-width: 2.65rem;
        max-width: 2.65rem;
    }

    .recruitment-col-previous,
    .recruitment-col-target,
    .recruitment-col-average {
        width: 4.1rem;
    }

    .recruitment-table__channel-name {
        font-size: 0.58rem;
    }
}
</style>
