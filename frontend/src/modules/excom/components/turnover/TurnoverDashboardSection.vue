<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import TurnoverComparisonChart from "./TurnoverComparisonChart.vue"
import TurnoverDepartmentRankTable from "./TurnoverDepartmentRankTable.vue"

const props = defineProps({
    title: {
        type: String,
        default: "",
    },
    data: {
        type: Object,
        default: () => ({}),
    },
    selectedPeriodKey: {
        type: String,
        default: null,
    },
    wholeYear: {
        type: Boolean,
        default: false,
    },
})

const { t } = useI18n()

const rows = computed(() => props.data.rows || [])
const departmentData = computed(() => props.data.byDepartment || {})
const hasDepartmentRows = computed(() => Boolean((departmentData.value.rows || []).length))

function safeT(key, fallback) {
    const translated = t(key)
    return translated === key ? fallback : translated
}

const employeeTypeLabel = computed(() =>
    String(
        props.data.selectedLabel ||
        safeT("excom.filters.allEmployeeTypes", "All Employee Types"),
    ).trim(),
)

const turnoverLabel = computed(() =>
    safeT("excom.turnover.turnover", "Turnover"),
)

const sectionTitle = computed(() =>
    `${employeeTypeLabel.value} ${turnoverLabel.value}`
        .replace(/\s+/g, " ")
        .trim(),
)

const departmentTitle = computed(() =>
    safeT(
        "excom.turnover.separateByDepartment",
        "{employeeType} TURNOVER – Separate by department",
    ).replace("{employeeType}", employeeTypeLabel.value),
)
</script>

<template>
    <section class="dashboard-section turnover-dashboard-section">
        <!--
            Keep exactly one Turnover title, using the same standardized
            navy title bar as Movement / IN & OUT / Absent sections.
            The chart itself intentionally has no internal title.
        -->
        <div class="turnover-titlebar">
            {{ sectionTitle }}
        </div>

        <TurnoverComparisonChart
            :rows="rows"
            :previous-year="data.previousYear"
            :current-year="data.currentYear"
            :target-rate="data.targetRate"
            :selected-period-key="selectedPeriodKey"
        />

        <template v-if="hasDepartmentRows">
            <div class="turnover-titlebar turnover-titlebar--department">
                {{ departmentTitle }}
            </div>

            <div class="turnover-department-ranking-grid">
                <TurnoverDepartmentRankTable
                    :data="departmentData"
                    direction="DESC"
                    :selected-period-key="selectedPeriodKey"
                    :whole-year="wholeYear"
                />

                <TurnoverDepartmentRankTable
                    :data="departmentData"
                    direction="ASC"
                    :selected-period-key="selectedPeriodKey"
                    :whole-year="wholeYear"
                />
            </div>
        </template>
    </section>
</template>

<style scoped>
.dashboard-section {
    display: grid;
    gap: 0;
    min-width: 0;
}

.turnover-titlebar {
    display: flex;
    min-height: 2.25rem;
    align-items: center;
    justify-content: center;
    padding: 0.42rem 0.75rem;
    background: #0b2d6b;
    color: #ffffff;
    font-size: 1.08rem;
    font-weight: 900;
    letter-spacing: 0.01em;
    text-align: center;
    text-transform: uppercase;
}

.turnover-titlebar--department {
    margin-top: 0.85rem;
}

.turnover-department-ranking-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.7rem;
    min-width: 0;
    padding: 0.65rem 0.75rem 0.8rem;
    border-right: 1px solid #1f1f1f;
    border-bottom: 1px solid #1f1f1f;
    border-left: 1px solid #1f1f1f;
    background: #ffffff;
}

@media (max-width: 1040px) {
    .turnover-department-ranking-grid {
        grid-template-columns: minmax(0, 1fr);
    }
}

@media (max-width: 760px) {
    .turnover-titlebar {
        font-size: 0.92rem;
    }
}
</style>
