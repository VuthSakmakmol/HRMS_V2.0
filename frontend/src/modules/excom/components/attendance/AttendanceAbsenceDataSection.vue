<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import AttendanceAbsenceOverallTable from "./AttendanceAbsenceOverallTable.vue"
import AttendanceTopAbsentTable from "./AttendanceTopAbsentTable.vue"

const props = defineProps({
    data: {
        type: Object,
        default: () => ({}),
    },
    employeeTypeLabel: {
        type: String,
        default: "",
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

const scopeLabel = computed(() =>
    String(
        props.employeeTypeLabel ||
        props.data.absenceComparison?.selectedLabel ||
        safeT("excom.filters.allEmployeeTypes", "All Employee Types"),
    ).trim(),
)

const absenceOverall = computed(() => props.data.absenceOverall || {})
const departmentData = computed(() => props.data.topAbsentDepartments || {})
const hasOverallRows = computed(() => Boolean((absenceOverall.value.rows || []).length))
const hasDepartmentRows = computed(() => Boolean((departmentData.value.rows || []).length))
const hasData = computed(() => hasOverallRows.value || hasDepartmentRows.value)

const separateByTypeTitle = computed(() =>
    safeT(
        "excom.attendance.absentSeparateByType",
        "{employeeType} ABSENT – Separate by type",
    ).replace("{employeeType}", scopeLabel.value),
)

const separateByDepartmentTitle = computed(() =>
    safeT(
        "excom.attendance.absentSeparateByDepartment",
        "{employeeType} ABSENT – Separate by department",
    ).replace("{employeeType}", scopeLabel.value),
)

function safeT(key, fallback) {
    const translated = t(key)

    return translated === key ? fallback : translated
}
</script>

<template>
    <section class="attendance-absence-data-section">
        <template v-if="hasData">
            <div class="attendance-absence-titlebar">
                {{ separateByTypeTitle }}
            </div>

            <AttendanceAbsenceOverallTable
                :data="absenceOverall"
                :selected-period-key="selectedPeriodKey"
            />

            <div class="attendance-absence-titlebar attendance-absence-titlebar--department">
                {{ separateByDepartmentTitle }}
            </div>

            <div class="attendance-department-ranking-grid">
                <AttendanceTopAbsentTable
                    :data="departmentData"
                    direction="DESC"
                    :selected-period-key="selectedPeriodKey"
                    :whole-year="wholeYear"
                />

                <AttendanceTopAbsentTable
                    :data="departmentData"
                    direction="ASC"
                    :selected-period-key="selectedPeriodKey"
                    :whole-year="wholeYear"
                />
            </div>
        </template>

        <div
            v-else
            class="attendance-absence-data-section__empty"
        >
            {{ safeT("excom.attendance.noAbsentData", "No absent data matched this filter.") }}
        </div>
    </section>
</template>

<style scoped>
.attendance-absence-data-section {
    display: grid;
    gap: 0;
    min-width: 0;
    background: #ffffff;
}

.attendance-absence-titlebar {
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

.attendance-absence-titlebar--department {
    margin-top: 0.85rem;
}

.attendance-department-ranking-grid {
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

.attendance-absence-data-section__empty {
    display: grid;
    min-height: 4.5rem;
    place-items: center;
    padding: 0.75rem;
    border: 1px solid #1f1f1f;
    background: #ffffff;
    color: #64748b;
    font-size: 0.86rem;
    font-weight: 800;
}

@media (max-width: 1040px) {
    .attendance-department-ranking-grid {
        grid-template-columns: minmax(0, 1fr);
    }
}

@media (max-width: 700px) {
    .attendance-absence-titlebar {
        font-size: 0.92rem;
    }

    .attendance-department-ranking-grid {
        gap: 0.55rem;
        padding: 0.5rem;
    }
}
</style>
