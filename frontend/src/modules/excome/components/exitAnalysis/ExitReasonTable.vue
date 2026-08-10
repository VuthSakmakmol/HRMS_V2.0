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

const months = computed(() => Array.isArray(props.data.months) ? props.data.months : [])

const rows = computed(() =>
    (Array.isArray(props.data.rows) ? props.data.rows : [])
        .filter((row) => Number(row.count || 0) > 0),
)

const totals = computed(() => {
    const supplied = props.data.totals || {}
    const monthly = { ...(supplied.monthly || {}) }

    // Backward-safe fallback. If an older API response reaches this component,
    // calculate totals from the row values that are available.
    if (!Object.keys(monthly).length) {
        for (const month of months.value) {
            monthly[month.key] = rows.value.reduce(
                (sum, row) => sum + Number(row.monthly?.[month.key] || 0),
                0,
            )
        }
    }

    const count = Number(supplied.count)

    return {
        monthly,
        count: Number.isFinite(count)
            ? count
            : rows.value.reduce((sum, row) => sum + Number(row.count || 0), 0),
    }
})

const hasData = computed(() => rows.value.length > 0)
const reasonHeader = computed(() => {
    const selectedLabel = String(props.data.selectedLabel || "").trim()
    return selectedLabel ? `Reasons - ${selectedLabel}` : "Reasons"
})

function displayCount(value, { showZero = false } = {}) {
    const count = Number(value || 0)

    if (!count && !showZero) return ""
    return count.toLocaleString()
}
</script>

<template>
    <div class="resign-reason-card">
        <div class="resign-reason-card__heading">
            {{ data.title || "RESIGN by Reason" }}
        </div>

        <div v-if="hasData" class="resign-reason-table-scroll">
            <table class="resign-reason-table">
                <thead>
                    <tr>
                        <th class="resign-reason-table__reason-col">
                            {{ reasonHeader }}
                        </th>
                        <th
                            v-for="month in months"
                            :key="month.key"
                            class="resign-reason-table__month-col"
                        >
                            {{ month.label }}
                        </th>
                        <th class="resign-reason-table__total-col">
                            {{ t("common.total") }}
                        </th>
                    </tr>
                </thead>

                <tbody>
                    <tr v-for="row in rows" :key="row.label">
                        <td class="resign-reason-table__reason">
                            {{ row.label }}
                        </td>
                        <td
                            v-for="month in months"
                            :key="`${row.label}-${month.key}`"
                            class="resign-reason-table__number"
                        >
                            {{ displayCount(row.monthly?.[month.key]) }}
                        </td>
                        <td class="resign-reason-table__number resign-reason-table__row-total">
                            {{ displayCount(row.count, { showZero: true }) }}
                        </td>
                    </tr>
                </tbody>

                <tfoot>
                    <tr>
                        <th class="resign-reason-table__grand-label">
                            {{ t("common.total") }}
                        </th>
                        <th
                            v-for="month in months"
                            :key="`total-${month.key}`"
                            class="resign-reason-table__number resign-reason-table__grand-number"
                        >
                            {{ displayCount(totals.monthly?.[month.key], { showZero: true }) }}
                        </th>
                        <th class="resign-reason-table__number resign-reason-table__grand-total">
                            {{ displayCount(totals.count, { showZero: true }) }}
                        </th>
                    </tr>
                </tfoot>
            </table>
        </div>

        <div v-else class="empty-state">
            <strong>{{ data.title || "RESIGN by Reason" }}</strong>
            <span>{{ t("excome.exitAnalysis.noData") }}</span>
        </div>
    </div>
</template>

<style scoped>
.resign-reason-card {
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--hrms-border, #cbd5e1);
    border-radius: 0.55rem;
    background: var(--hrms-surface, #ffffff);
}

.resign-reason-card__heading {
    padding: 0.68rem 0.78rem 0.5rem;
    color: var(--p-text-color, #0f172a);
    font-size: 1rem;
    font-weight: 900;
    line-height: 1.2;
}

.resign-reason-table-scroll {
    width: 100%;
    overflow-x: auto;
    scrollbar-width: thin;
}

.resign-reason-table {
    width: 100%;
    min-width: 960px;
    border-collapse: collapse;
    table-layout: fixed;
    color: var(--p-text-color, #111827);
    font-size: 0.76rem;
}

.resign-reason-table th,
.resign-reason-table td {
    height: 2rem;
    padding: 0.28rem 0.42rem;
    border: 1px solid #64748b;
    vertical-align: middle;
}

.resign-reason-table thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: #1fb7df;
    color: #07111c;
    font-weight: 900;
    text-align: center;
    white-space: nowrap;
}

.resign-reason-table__reason-col {
    left: 0;
    z-index: 4 !important;
    width: 300px;
    text-align: left !important;
}

.resign-reason-table__month-col {
    width: 62px;
}

.resign-reason-table__total-col {
    width: 74px;
}

.resign-reason-table tbody tr:nth-child(even) td {
    background: color-mix(in srgb, var(--p-surface-100, #f1f5f9) 72%, transparent);
}

.resign-reason-table tbody tr:hover td {
    background: color-mix(in srgb, #dbeafe 65%, var(--hrms-surface, #ffffff));
}

.resign-reason-table__reason {
    position: sticky;
    left: 0;
    z-index: 1;
    overflow: hidden;
    width: 300px;
    background: var(--hrms-surface, #ffffff);
    font-weight: 650;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.resign-reason-table__number {
    text-align: center;
    font-variant-numeric: tabular-nums;
}

.resign-reason-table__row-total {
    background: color-mix(in srgb, #dbeafe 70%, var(--hrms-surface, #ffffff));
    font-weight: 800;
}

.resign-reason-table tfoot th {
    background: color-mix(in srgb, #e2e8f0 85%, var(--hrms-surface, #ffffff));
    font-weight: 900;
}

.resign-reason-table__grand-label {
    position: sticky;
    left: 0;
    z-index: 3;
    text-align: left;
}

.resign-reason-table__grand-total {
    background: color-mix(in srgb, #bae6fd 80%, var(--hrms-surface, #ffffff)) !important;
}

.empty-state {
    display: grid;
    min-height: 12rem;
    padding: 1.25rem;
    place-content: center;
    text-align: center;
}

.empty-state strong {
    color: var(--p-text-color, #0f172a);
    font-size: 0.95rem;
}

.empty-state span {
    margin-top: 0.35rem;
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.78rem;
}

@media (max-width: 760px) {
    .resign-reason-table {
        min-width: 900px;
    }

    .resign-reason-table__reason-col,
    .resign-reason-table__reason {
        width: 240px;
    }
}
</style>
