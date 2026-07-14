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

const rows = computed(() =>
    (props.data.rows || []).filter((row) => Number(row.count || 0) > 0 || Number(row.rate || 0) > 0),
)

const title = computed(() =>
    props.data.title || t("hrDashboard.exitAnalysis.exitReasons"),
)

function safeNumber(value) {
    const number = Number(value)

    return Number.isFinite(number) ? number : 0
}

function formatPercent(value) {
    return `${safeNumber(value).toFixed(0)}%`
}

function barWidth(value) {
    return `${Math.min(100, Math.max(0, safeNumber(value)))}%`
}
</script>

<template>
    <article class="exit-reason-chart dashboard-card">
        <h3>{{ title }}</h3>

        <div
            v-if="rows.length"
            class="exit-reason-chart__body"
        >
            <div
                v-for="row in rows"
                :key="row.label"
                class="exit-reason-chart__row"
            >
                <div class="exit-reason-chart__label">
                    {{ row.label }}
                </div>

                <div class="exit-reason-chart__track">
                    <div
                        class="exit-reason-chart__bar"
                        :style="{ width: barWidth(row.rate) }"
                    />
                </div>

                <div class="exit-reason-chart__value">
                    {{ formatPercent(row.rate) }}
                </div>
            </div>
        </div>

        <div
            v-else
            class="exit-reason-chart__empty"
        >
            {{ t("hrDashboard.exitAnalysis.noExitData") }}
        </div>
    </article>
</template>

<style scoped>
.exit-reason-chart {
    min-width: 0;
    min-height: 18rem;
    padding: 0.75rem 1rem 1rem;
    border: 1px solid #1f2937;
    background: #ffffff;
}

.exit-reason-chart h3 {
    margin: 0 0 0.75rem;
    color: #555555;
    font-size: 0.98rem;
    font-weight: 900;
    text-align: center;
}

.exit-reason-chart__body {
    display: grid;
    gap: 0.55rem;
}

.exit-reason-chart__row {
    display: grid;
    grid-template-columns: minmax(10rem, 17rem) minmax(0, 1fr) 2.8rem;
    gap: 0.45rem;
    align-items: center;
}

.exit-reason-chart__label {
    overflow: hidden;
    color: #404040;
    font-size: 0.72rem;
    font-weight: 700;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.exit-reason-chart__track {
    height: 0.62rem;
    border-left: 1px solid #cbd5e1;
    background-image: repeating-linear-gradient(
        to right,
        transparent 0,
        transparent 11.5%,
        #d7d7d7 11.5%,
        #d7d7d7 12%
    );
}

.exit-reason-chart__bar {
    height: 100%;
    border-radius: 0 999px 999px 0;
    background: linear-gradient(180deg, #21b7e8 0%, #0798cf 100%);
    box-shadow: 0 0.06rem 0.25rem rgb(15 23 42 / 0.35);
}

.exit-reason-chart__value {
    color: #303030;
    font-size: 0.68rem;
    font-weight: 800;
}

.exit-reason-chart__empty {
    display: grid;
    min-height: 10rem;
    place-items: center;
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 800;
}

@media (max-width: 640px) {
    .exit-reason-chart__row {
        grid-template-columns: minmax(7rem, 11rem) minmax(0, 1fr) 2.6rem;
    }

    .exit-reason-chart__label {
        font-size: 0.62rem;
    }
}
</style>
