<script setup>
import Tag from "primevue/tag"

import EnterpriseActionMenu from "@/shared/components/enterprise/EnterpriseActionMenu.vue"
import EnterpriseTable from "@/shared/components/enterprise/EnterpriseTable.vue"

const props = defineProps({
    items: {
        type: Array,
        default: () => [],
    },
    loading: {
        type: Boolean,
        default: false,
    },
    canCorrect: {
        type: Boolean,
        default: false,
    },
    canAccept: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(["correct", "accept"])

const columns = [
    {
        field: "attendanceDate",
        header: "Date",
        frozen: true,
        width: "8rem",
        minWidth: "8rem",
    },
    {
        field: "employeeCode",
        header: "Employee ID",
        width: "9rem",
        minWidth: "9rem",
    },
    {
        field: "employeeName",
        header: "Employee",
        width: "14rem",
        minWidth: "14rem",
    },
    {
        field: "departmentName",
        header: "Department",
        width: "12rem",
        minWidth: "12rem",
    },
    {
        field: "firstInAt",
        header: "First In",
        width: "8rem",
        minWidth: "8rem",
    },
    {
        field: "lastOutAt",
        header: "Last Out",
        width: "8rem",
        minWidth: "8rem",
    },
    {
        field: "status",
        header: "Status",
        width: "11rem",
        minWidth: "11rem",
    },
    {
        field: "verificationStatus",
        header: "Verification",
        width: "11rem",
        minWidth: "11rem",
    },
    {
        field: "issueCodes",
        header: "Detected Issues",
        width: "18rem",
        minWidth: "18rem",
    },
    {
        field: "source",
        header: "Source",
        width: "10rem",
        minWidth: "10rem",
    },
]

function formatDate(value) {
    if (!value) return "—"
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Asia/Phnom_Penh",
    }).format(new Date(value))
}

function formatTime(value) {
    if (!value) return "—"
    return new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Phnom_Penh",
    }).format(new Date(value))
}

function label(value) {
    return String(value || "—").replaceAll("_", " ")
}

function statusSeverity(status) {
    if (status === "PRESENT") return "success"
    if (["LATE", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(status)) {
        return "warn"
    }
    if (["MISSING_IN", "MISSING_OUT", "ABSENT"].includes(status)) {
        return "danger"
    }
    return "info"
}

function verificationSeverity(status) {
    if (status === "VERIFIED") return "success"
    if (status === "NEEDS_REVIEW") return "warn"
    if (status === "CORRECTED") return "info"
    return "secondary"
}

function issueText(row) {
    return (row.issueCodes || []).map(label).join(", ") || "—"
}

function actions(row) {
    const unlocked = !["PAYROLL_LOCKED", "FINALIZED"].includes(row.lockStatus)
    return [
        {
            label: "Correct times",
            icon: "pi pi-pencil",
            visible: props.canCorrect && unlocked,
            command: () => emit("correct", row),
        },
        {
            label: "Accept as reviewed",
            icon: "pi pi-check-circle",
            visible:
                props.canAccept &&
                unlocked &&
                row.verificationStatus === "NEEDS_REVIEW",
            command: () => emit("accept", row),
        },
    ]
}
</script>

<template>
    <EnterpriseTable
        :rows="items"
        :columns="columns"
        :loading="loading"
        row-key="id"
        scroll-height="31rem"
        striped-rows
    >
        <template #cell-attendanceDate="{ row }">
            {{ formatDate(row.attendanceDate) }}
        </template>

        <template #cell-firstInAt="{ row }">
            {{ formatTime(row.firstInAt) }}
        </template>

        <template #cell-lastOutAt="{ row }">
            {{ formatTime(row.lastOutAt) }}
        </template>

        <template #cell-status="{ row }">
            <Tag
                :value="label(row.status)"
                :severity="statusSeverity(row.status)"
                class="attendance-table-status"
            />
        </template>

        <template #cell-verificationStatus="{ row }">
            <Tag
                :value="label(row.verificationStatus)"
                :severity="verificationSeverity(row.verificationStatus)"
                class="attendance-table-status"
            />
        </template>

        <template #cell-issueCodes="{ row }">
            <span class="attendance-issue-text" :title="issueText(row)">
                {{ issueText(row) }}
            </span>
        </template>

        <template #cell-source="{ row }">
            {{ label(row.source) }}
        </template>

        <template #actions="{ row }">
            <EnterpriseActionMenu
                :items="actions(row)"
                aria-label="Attendance verification actions"
            />
        </template>
    </EnterpriseTable>
</template>

<style scoped>
.attendance-issue-text {
    display: block;
    overflow: hidden;
    color: var(--hrms-text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
