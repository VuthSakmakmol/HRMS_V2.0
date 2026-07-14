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

const colors = [
    "#155e75",
    "#d96a27",
    "#17803b",
    "#0891b2",
    "#6d28d9",
    "#be123c",
    "#0f766e",
    "#ca8a04",
    "#475569",
    "#7c2d12",
]

const previousItems = computed(() => props.data.charts?.previousYear || [])
const currentItems = computed(() => props.data.charts?.currentYear || [])

function polarToCartesian(cx, cy, r, angleInDegrees) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180

    return {
        x: cx + r * Math.cos(angleInRadians),
        y: cy + r * Math.sin(angleInRadians),
    }
}

function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle)
    const end = polarToCartesian(cx, cy, r, startAngle)
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"

    return [
        `M ${cx} ${cy}`,
        `L ${start.x} ${start.y}`,
        `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
        "Z",
    ].join(" ")
}

function buildSlices(items) {
    const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0)
    let cursor = 0

    if (!total) return []

    return items.map((item, index) => {
        const value = Number(item.value) || 0
        const startAngle = cursor
        const endAngle = cursor + (value / total) * 360
        cursor = endAngle

        return {
            ...item,
            color: colors[index % colors.length],
            path: describeArc(110, 86, 72, startAngle, endAngle),
        }
    })
}

function formatPercent(value) {
    return `${Number(value || 0).toFixed(Number(value) % 1 === 0 ? 0 : 1)}%`
}
</script>

<template>
    <div class="recruitment-charts">
        <div class="recruitment-pie-card">
            <div class="recruitment-pie-card__chart">
                <svg
                    viewBox="0 0 220 180"
                    role="img"
                    :aria-label="t('hrDashboard.recruitment.previousYearChart')"
                >
                    <path
                        v-for="slice in buildSlices(previousItems)"
                        :key="slice.name"
                        :d="slice.path"
                        :fill="slice.color"
                        stroke="#ffffff"
                        stroke-width="1"
                    />
                    <text
                        v-if="!previousItems.length"
                        x="110"
                        y="90"
                        text-anchor="middle"
                        class="recruitment-pie-card__empty"
                    >
                        {{ t("hrDashboard.recruitment.noData") }}
                    </text>
                </svg>
            </div>

            <div class="recruitment-pie-card__legend">
                <div
                    v-for="(item, index) in previousItems"
                    :key="item.name"
                >
                    <i :style="{ background: colors[index % colors.length] }" />
                    <span>{{ item.name }}</span>
                    <strong>{{ formatPercent(item.percent) }}</strong>
                </div>
            </div>

            <div class="recruitment-pie-card__title">
                {{ t("hrDashboard.recruitment.previousYearChart", { year: data.previousYear }) }}
            </div>
        </div>

        <div class="recruitment-pie-card">
            <div class="recruitment-pie-card__chart">
                <svg
                    viewBox="0 0 220 180"
                    role="img"
                    :aria-label="t('hrDashboard.recruitment.currentYearChart')"
                >
                    <path
                        v-for="slice in buildSlices(currentItems)"
                        :key="slice.name"
                        :d="slice.path"
                        :fill="slice.color"
                        stroke="#ffffff"
                        stroke-width="1"
                    />
                    <text
                        v-if="!currentItems.length"
                        x="110"
                        y="90"
                        text-anchor="middle"
                        class="recruitment-pie-card__empty"
                    >
                        {{ t("hrDashboard.recruitment.noData") }}
                    </text>
                </svg>
            </div>

            <div class="recruitment-pie-card__legend">
                <div
                    v-for="(item, index) in currentItems"
                    :key="item.name"
                >
                    <i :style="{ background: colors[index % colors.length] }" />
                    <span>{{ item.name }}</span>
                    <strong>{{ formatPercent(item.percent) }}</strong>
                </div>
            </div>

            <div class="recruitment-pie-card__title">
                {{ t("hrDashboard.recruitment.currentYearChart", { year: data.currentYear }) }}
            </div>
        </div>
    </div>
</template>

<style scoped>
.recruitment-charts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    padding: 1.1rem 1rem 0.85rem;
    background: #ffffff;
}

.recruitment-pie-card {
    display: grid;
    grid-template-columns: minmax(12rem, 1fr) minmax(10rem, 0.8fr);
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
}

.recruitment-pie-card__chart svg {
    display: block;
    width: 100%;
    max-height: 13rem;
}

.recruitment-pie-card__empty {
    fill: #777777;
    font-size: 0.72rem;
    font-weight: 700;
}

.recruitment-pie-card__legend {
    display: grid;
    align-content: center;
    gap: 0.25rem;
    min-width: 0;
    font-size: 0.68rem;
}

.recruitment-pie-card__legend div {
    display: grid;
    grid-template-columns: 0.6rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.35rem;
}

.recruitment-pie-card__legend i {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
}

.recruitment-pie-card__legend span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.recruitment-pie-card__title {
    grid-column: 1 / -1;
    color: #1f2937;
    font-size: 0.82rem;
    font-weight: 600;
    text-align: center;
}

@media (max-width: 900px) {
    .recruitment-charts {
        grid-template-columns: 1fr;
    }
}
</style>
