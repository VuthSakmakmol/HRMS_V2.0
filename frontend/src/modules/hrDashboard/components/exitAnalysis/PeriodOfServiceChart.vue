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

const rows = computed(() => props.data.rows || [])
const maxRate = computed(() => Math.max(30, ...rows.value.map((row) => Number(row.rate || 0))))
const title = computed(() =>
    props.data.title || t("hrDashboard.exitAnalysis.periodOfService"),
)

function safeNumber(value) {
    const number = Number(value)

    return Number.isFinite(number) ? number : 0
}

function barHeight(value) {
    const rate = safeNumber(value)
    const max = maxRate.value || 1

    return `${Math.min(100, Math.max(0, (rate / max) * 100))}%`
}

function formatPercent(value) {
    return `${safeNumber(value).toFixed(0)}%`
}
</script>

<template>
    <article class="service-chart dashboard-card">
        <h3>{{ title }}</h3>

        <div
            v-if="rows.length"
            class="service-chart__body"
        >
            <div class="service-chart__axis">
                <span>30%</span>
                <span>25%</span>
                <span>20%</span>
                <span>15%</span>
                <span>10%</span>
                <span>5%</span>
                <span>0%</span>
            </div>

            <div class="service-chart__plot">
                <div
                    v-for="row in rows"
                    :key="row.key"
                    class="service-chart__item"
                >
                    <div class="service-chart__value">
                        {{ formatPercent(row.rate) }}
                    </div>

                    <div class="service-chart__bar-wrap">
                        <div
                            class="service-chart__bar"
                            :style="{ height: barHeight(row.rate) }"
                        />
                    </div>

                    <div class="service-chart__label">
                        {{ row.label }}
                    </div>
                </div>
            </div>
        </div>

        <div
            v-else
            class="service-chart__empty"
        >
            {{ t("hrDashboard.exitAnalysis.noExitData") }}
        </div>
    </article>
</template>

<style scoped>
.service-chart {
    min-width: 0;
    min-height: 18rem;
    padding: 0.75rem 1rem 1rem;
    border: 1px solid #1f2937;
    background: #ffffff;
}

.service-chart h3 {
    margin: 0 0 0.75rem;
    color: #555555;
    font-size: 0.98rem;
    font-weight: 900;
    text-align: center;
}

.service-chart__body {
    display: grid;
    grid-template-columns: 2.2rem minmax(0, 1fr);
    gap: 0.45rem;
    min-height: 14rem;
}

.service-chart__axis {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    color: #444444;
    font-size: 0.62rem;
    font-weight: 700;
}

.service-chart__plot {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 0.35rem;
    align-items: end;
    background-image: repeating-linear-gradient(
        to bottom,
        #d7d7d7 0,
        #d7d7d7 1px,
        transparent 1px,
        transparent calc(100% / 6)
    );
}

.service-chart__item {
    display: grid;
    grid-template-rows: 1.2rem 10.8rem 1.4rem;
    align-items: end;
    justify-items: center;
    min-width: 0;
}

.service-chart__value {
    color: #333333;
    font-size: 0.62rem;
    font-weight: 800;
}

.service-chart__bar-wrap {
    position: relative;
    width: 100%;
    height: 10.8rem;
}

.service-chart__bar {
    position: absolute;
    right: 22%;
    bottom: 0;
    left: 22%;
    min-height: 0.18rem;
    background: #16a9d8;
}

.service-chart__label {
    overflow: hidden;
    width: 100%;
    color: #333333;
    font-size: 0.58rem;
    font-weight: 800;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.service-chart__empty {
    display: grid;
    min-height: 10rem;
    place-items: center;
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 800;
}
</style>
