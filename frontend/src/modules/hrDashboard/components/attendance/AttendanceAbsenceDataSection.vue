<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import DashboardSectionHeader from "../shared/DashboardSectionHeader.vue"
import AttendanceAbsenceOverallTable from "./AttendanceAbsenceOverallTable.vue"
import AttendanceTopAbsentTable from "./AttendanceTopAbsentTable.vue"

const props = defineProps({
    title: {
        type: String,
        required: true,
    },
    data: {
        type: Object,
        default: () => ({}),
    },
})

const { t } = useI18n()

const selectedLabel = computed(() =>
    props.data.absenceComparison?.selectedLabel || safeT("hrDashboard.attendance.selectedScope", "Selected"),
)

const absenceOverall = computed(() => props.data.absenceOverall || {})
const topAbsentDepartments = computed(() => props.data.topAbsentDepartments || {})
const hasOverallRows = computed(() => Boolean((absenceOverall.value.rows || []).length))
const hasTopRows = computed(() => Boolean((topAbsentDepartments.value.rows || []).length))
const hasData = computed(() => hasOverallRows.value || hasTopRows.value)

function safeT(key, fallback) {
    const translated = t(key)

    return translated === key ? fallback : translated
}
</script>

<template>
    <section class="dashboard-section attendance-absence-data-section">
        <DashboardSectionHeader :title="title" />

        <template v-if="hasData">
            <AttendanceAbsenceOverallTable :data="absenceOverall" />

            <AttendanceTopAbsentTable
                :data="topAbsentDepartments"
                :selected-label="selectedLabel"
            />
        </template>

        <div
            v-else
            class="attendance-absence-data-section__empty"
        >
            {{ safeT("hrDashboard.attendance.noAbsentData", "No absent data matched this filter.") }}
        </div>
    </section>
</template>

<style scoped>
.dashboard-section {
    display: grid;
    gap: 0;
}

.attendance-absence-data-section__empty {
    display: grid;
    min-height: 4.5rem;
    place-items: center;
    padding: 0.75rem;
    border-right: 1px solid #1f1f1f;
    border-bottom: 1px solid #1f1f1f;
    border-left: 1px solid #1f1f1f;
    background: #ffffff;
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 800;
}
</style>
