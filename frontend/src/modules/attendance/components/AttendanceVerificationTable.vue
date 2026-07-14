<script setup>
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Tag from "primevue/tag"

const props = defineProps({
    items: {
        type: Array,
        default: () => [],
    },
    loading: {
        type: Boolean,
        default: false,
    },
})

function statusSeverity(status) {
    if (status === "PRESENT") {
        return "success"
    }

    if (["LATE", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(status)) {
        return "warn"
    }

    if (["MISSING_IN", "MISSING_OUT", "ABSENT"].includes(status)) {
        return "danger"
    }

    return "info"
}
</script>

<template>
    <div class="hrms-table-wrap">
        <DataTable
            :value="props.items"
            :loading="props.loading"
            scrollable
            striped-rows
            class="hrms-standard-table hrms-standard-table--horizontal"
            data-key="id"
        >
            <template #empty>
                <div class="hrms-empty-state">No attendance records found.</div>
            </template>

            <Column field="employeeCode" header="Employee ID" style="min-width: 8rem" />
            <Column field="employeeName" header="Employee" style="min-width: 12rem" />
            <Column field="attendanceDate" header="Date" style="min-width: 7rem" />
            <Column field="firstInAt" header="First In" style="min-width: 7rem" />
            <Column field="lastOutAt" header="Last Out" style="min-width: 7rem" />
            <Column field="status" header="Status" style="min-width: 8rem">
                <template #body="{ data }">
                    <Tag
                        class="attendance-table-status"
                        :value="data.status"
                        :severity="statusSeverity(data.status)"
                    />
                </template>
            </Column>
        </DataTable>
    </div>
</template>
