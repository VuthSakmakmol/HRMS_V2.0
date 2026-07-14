<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

const props = defineProps({
    data: {
        type: Object,
        default: () => ({}),
    },
    employeeTypeLabel: {
        type: String,
        default: "",
    },
})

const { t } = useI18n()

function safeT(key, fallback) {
    const translated = t(key)

    return translated === key ? fallback : translated
}

function formatNumber(value, digits = 1) {
    const number = Number(value)

    if (!Number.isFinite(number)) {
        return "0"
    }

    return number.toFixed(digits).replace(/\.0$/, "")
}

function formatInteger(value) {
    const number = Number(value)

    if (!Number.isFinite(number)) {
        return "0"
    }

    return new Intl.NumberFormat().format(Math.round(number))
}

function formatRatio(value) {
    const number = Number(value)

    if (!Number.isFinite(number)) {
        return "0.00"
    }

    return number.toFixed(2)
}

const selectedLabel = computed(() => {
    return props.data.selectedLabel ||
        props.employeeTypeLabel ||
        safeT("hrDashboard.general.selected", "Selected")
})

const budgetLabel = computed(() =>
    props.data.budgetLabel || safeT("hrDashboard.general.budget", "Budget"),
)

const cards = computed(() => [
    {
        key: "averageAge",
        icon: "pi pi-users",
        label: safeT("hrDashboard.general.averageAge", "Avg. Age"),
        firstLabel: safeT("hrDashboard.general.total", "Total"),
        firstValue: formatNumber(props.data.total?.averageAge),
        secondLabel: selectedLabel.value,
        secondValue: formatNumber(props.data.selected?.averageAge),
        suffix: safeT("hrDashboard.units.years", "years"),
    },
    {
        key: "averageService",
        icon: "pi pi-briefcase",
        label: safeT("hrDashboard.general.averageService", "Years Of Service"),
        firstLabel: safeT("hrDashboard.general.total", "Total"),
        firstValue: formatNumber(props.data.total?.averageServiceYears),
        secondLabel: selectedLabel.value,
        secondValue: formatNumber(props.data.selected?.averageServiceYears),
        suffix: safeT("hrDashboard.units.years", "years"),
    },
    {
        key: "indirectDirectRatio",
        icon: "pi pi-sitemap",
        label: safeT("hrDashboard.general.indirectDirectRatio", "Indirect / Direct Ratio"),
        firstLabel: safeT("hrDashboard.general.actual", "Actual"),
        firstValue: formatRatio(props.data.indirectDirect?.actualRatio),
        secondLabel: budgetLabel.value,
        secondValue: formatRatio(props.data.indirectDirect?.budgetRatio),
        suffix: "",
    },
])

const workforceCategory = computed(() => props.data.workforceCategory || {})

const workforceRows = computed(() => {
    if (!Array.isArray(workforceCategory.value.rows)) {
        return []
    }

    return workforceCategory.value.rows
})

const hasWorkforceRows = computed(() => workforceRows.value.length > 0)
</script>

<template>
    <section class="general-data-section">
        <article
            v-for="card in cards"
            :key="card.key"
            class="general-metric-card"
        >
            <div class="general-metric-card__identity">
                <i
                    :class="card.icon"
                    aria-hidden="true"
                />
                <span>{{ card.label }}</span>
            </div>

            <div class="general-metric-card__divider" />

            <div class="general-metric-card__values">
                <div class="general-metric-card__value-block general-metric-card__value-block--plain">
                    <span
                        class="general-metric-card__caption"
                        :title="card.firstLabel"
                    >
                        {{ card.firstLabel }}
                    </span>

                    <strong class="general-metric-card__number">
                        {{ card.firstValue }}
                    </strong>

                    <small
                        v-if="card.suffix"
                        class="general-metric-card__suffix"
                    >
                        {{ card.suffix }}
                    </small>
                </div>

                <div class="general-metric-card__value-block general-metric-card__value-block--accent">
                    <span
                        class="general-metric-card__caption"
                        :title="card.secondLabel"
                    >
                        {{ card.secondLabel }}
                    </span>

                    <strong class="general-metric-card__number">
                        {{ card.secondValue }}
                    </strong>

                    <small
                        v-if="card.suffix"
                        class="general-metric-card__suffix"
                    >
                        {{ card.suffix }}
                    </small>
                </div>
            </div>
        </article>

        <div
            v-if="hasWorkforceRows"
            class="general-workforce-table-card"
        >
            <table class="general-workforce-table">
                <thead>
                    <tr>
                        <th class="general-workforce-table__category">
                            {{ safeT("hrDashboard.general.category", "Category") }}
                        </th>
                        <th class="general-workforce-table__department">
                            {{ safeT("hrDashboard.general.department", "Department") }}
                        </th>
                        <th class="general-workforce-table__count">
                            {{ workforceCategory.monthLabel || safeT("hrDashboard.general.selectedMonth", "Selected") }}
                        </th>
                    </tr>
                </thead>

                <tbody>
                    <tr
                        v-for="row in workforceRows"
                        :key="row.key"
                        :class="{
                            'is-highlight': row.highlight,
                        }"
                    >
                        <td :title="row.category">
                            {{ row.category }}
                        </td>
                        <td :title="row.department">
                            {{ row.department }}
                        </td>
                        <td>{{ formatInteger(row.count) }}</td>
                    </tr>

                    <tr class="is-total">
                        <td colspan="2">
                            {{ safeT("hrDashboard.general.grandTotal", "Grand Total") }}
                        </td>
                        <td>{{ formatInteger(workforceCategory.total) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>
</template>

<style scoped>
.general-data-section {
    display: grid;
    grid-template-columns: repeat(3, minmax(15rem, 1fr)) minmax(24rem, 1.45fr);
    align-items: stretch;
    gap: 0.55rem;
    width: 100%;
    min-width: 0;
}

.general-metric-card {
    display: grid;
    grid-template-columns: 4.55rem 1px minmax(0, 1fr);
    align-items: stretch;
    min-width: 0;
    min-height: 4.45rem;
    border: 1px solid #1f1f1f;
    border-radius: 0.26rem;
    background: #ffffff;
    overflow: hidden;
}

.general-metric-card__identity {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 0.2rem;
    min-width: 0;
    padding: 0.36rem 0.26rem;
    color: #1f1f1f;
    text-align: center;
}

.general-metric-card__identity i {
    color: #000000;
    font-size: 1.45rem;
    line-height: 1;
}

.general-metric-card__identity span {
    max-width: 4rem;
    font-size: 0.54rem;
    font-weight: 900;
    line-height: 1.08;
}

.general-metric-card__divider {
    align-self: stretch;
    width: 1px;
    background: #b8b8b8;
}

.general-metric-card__values {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 0.5rem;
    min-width: 0;
    height: 100%;
    padding: 0.38rem 0.5rem;
}

.general-metric-card__value-block {
    display: grid;
    grid-template-rows: 0.86rem minmax(1.9rem, 1fr) 0.58rem;
    align-items: center;
    justify-items: center;
    min-width: 0;
    height: 100%;
}

.general-metric-card__caption {
    width: 100%;
    color: #555555;
    font-size: 0.5rem;
    font-weight: 900;
    line-height: 1;
    padding-top: 0.1rem;
    text-align: center;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.general-metric-card__number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: center;
    justify-self: center;
    min-width: 3.75rem;
    min-height: 1.75rem;
    margin: auto;
    padding: 0.16rem 0.46rem;
    border: 1px solid #7d7d7d;
    border-radius: 0.34rem;
    background: linear-gradient(180deg, #f8f8f8 0%, #e4e4e4 100%);
    box-shadow: inset 0 0.1rem 0.18rem rgb(255 255 255 / 0.9), 0 0.08rem 0.24rem rgb(0 0 0 / 0.25);
    color: #002060;
    font-size: 1.12rem;
    font-weight: 950;
    letter-spacing: -0.02em;
    line-height: 1;
    text-align: center;
}

.general-metric-card__value-block--accent .general-metric-card__number {
    border-color: #4f9bb7;
    background: linear-gradient(180deg, #91d8f2 0%, #56b9db 100%);
}

.general-metric-card__suffix {
    align-self: start;
    margin-top: 0.02rem;
    color: #333333;
    font-size: 0.5rem;
    font-weight: 900;
    line-height: 1;
    text-align: center;
}

.general-workforce-table-card {
    width: 100%;
    min-width: 0;
    overflow: hidden;
    border: 1px solid #d9e2f3;
    background: #ffffff;
}

.general-workforce-table {
    width: 100%;
    height: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    color: #000000;
    font-size: 0.56rem;
    line-height: 1.08;
}

.general-workforce-table th,
.general-workforce-table td {
    height: 0.92rem;
    padding: 0.06rem 0.2rem;
    border: 1px solid #ffffff;
    background: #dbe5f1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.general-workforce-table thead th {
    background: #00b0f0;
    color: #000000;
    font-weight: 900;
    text-align: center;
}

.general-workforce-table__category {
    width: 6.8rem;
}

.general-workforce-table__department {
    width: auto;
}

.general-workforce-table__count {
    width: 4.2rem;
}

.general-workforce-table tbody td:first-child,
.general-workforce-table tbody td:nth-child(2) {
    text-align: left;
}

.general-workforce-table tbody td:last-child {
    text-align: right;
}

.general-workforce-table tbody tr.is-highlight td {
    color: #ff0000;
}

.general-workforce-table tbody tr.is-total td {
    background: #dbe5f1;
    color: #000000;
    font-weight: 900;
}

.general-workforce-table tbody tr.is-total td:first-child {
    text-align: center;
}

@media (max-width: 1440px) {
    .general-data-section {
        grid-template-columns: repeat(3, minmax(13.5rem, 1fr)) minmax(20rem, 1.3fr);
        gap: 0.45rem;
    }

    .general-metric-card {
        grid-template-columns: 4.05rem 1px minmax(0, 1fr);
    }

    .general-metric-card__values {
        gap: 0.35rem;
        padding-inline: 0.42rem;
    }

    .general-metric-card__number {
        min-width: 3.3rem;
        font-size: 1rem;
    }
}

@media (max-width: 1180px) {
    .general-data-section {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 760px) {
    .general-data-section {
        grid-template-columns: minmax(0, 1fr);
    }

    .general-workforce-table {
        font-size: 0.6rem;
    }

    .general-workforce-table__category {
        width: 7.2rem;
    }

    .general-workforce-table__count {
        width: 4rem;
    }
}

@media (max-width: 560px) {
    .general-metric-card {
        grid-template-columns: 4.2rem 1px minmax(0, 1fr);
        min-height: 4.5rem;
    }

    .general-metric-card__identity i {
        font-size: 1.35rem;
    }

    .general-metric-card__identity span {
        font-size: 0.52rem;
    }

    .general-metric-card__caption {
        font-size: 0.49rem;
    }

    .general-metric-card__number {
        min-width: 3.4rem;
        min-height: 1.72rem;
        font-size: 1rem;
    }
}
</style>
