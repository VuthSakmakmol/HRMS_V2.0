<script setup>
import Button from "primevue/button"
import Message from "primevue/message"
import ProgressBar from "primevue/progressbar"
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"

const props = defineProps({
    visible: Boolean,
    importing: Boolean,
    progress: Number,
    phase: String,
    processedRows: Number,
    totalRows: Number,
    result: Object,
})

const emit = defineEmits([
    "update:visible",
    "file-change",
    "template",
    "import",
])

const { t } = useI18n()
const file = ref(null)

const errors = computed(() => props.result?.errors || [])
const issues = computed(() => props.result?.issues || [])
const listedProblems = computed(() => [
    ...errors.value,
    ...issues.value,
])

function changed(event) {
    file.value = event.target.files?.[0] || null
    emit("file-change", file.value)
}

function downloadErrors() {
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`
    const rows = listedProblems.value.map((error) => [
        escape(error.row),
        escape(error.code),
        escape(error.employeeCode),
        escape(error.message),
    ].join(","))
    const csv = [
        "Row,Code,Employee No,Reason",
        ...rows,
    ].join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], {
        type: "text/csv;charset=utf-8",
    }))
    const link = document.createElement("a")
    link.href = url
    link.download = "attendance-import-errors.csv"
    link.click()
    URL.revokeObjectURL(url)
}
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="t('attendance.importTitle')"
        width="46rem"
        :busy="importing"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="import-body">
            <div class="import-head">
                <span>{{ t("attendance.importDescription") }}</span>
                <Button
                    label="Download Sample"
                    icon="pi pi-download"
                    severity="secondary"
                    outlined
                    @click="emit('template')"
                />
            </div>

            <input
                type="file"
                accept=".xlsx,.xls"
                @change="changed"
            >

            <small class="monthly-note">
                Excome monthly format: Record Date, Employee No, Working Hours. Working Hours = 0 is Absent; any value above 0 is Present. Extra payroll columns are ignored because HRMS uses Employee Master.
            </small>

            <div
                v-if="importing"
                class="progress-detail"
            >
                <div>
                    <strong>{{ String(phase || "PROCESSING").replaceAll("_", " ") }}</strong>
                    <span v-if="totalRows">
                        {{ processedRows || 0 }} / {{ totalRows }} rows
                    </span>
                </div>
                <ProgressBar :value="progress" />
            </div>

            <Message
                v-if="result"
                :severity="listedProblems.length ? 'warn' : 'success'"
                :closable="false"
            >
                <div class="import-result">
                    <strong>
                        {{ result.importMode === "MONTHLY_SUMMARY" ? "Monthly attendance imported" : "Attendance imported" }}
                    </strong>
                    <span>
                        {{ result.successCount || 0 }} / {{ result.totalRows || 0 }} rows
                        <template v-if="result.dateFrom && result.dateTo">
                            · {{ result.dateFrom }} to {{ result.dateTo }}
                        </template>
                        <template v-if="result.uniqueEmployeeCount">
                            · {{ result.uniqueEmployeeCount }} employees
                        </template>
                    </span>
                    <span v-if="result.importMode === 'MONTHLY_SUMMARY'">
                        Absent {{ Number(result.absentCount || 0).toFixed(2) }}
                    </span>
                    <span v-else>
                        AB {{ Number(result.absentCount || 0).toFixed(2) }} ·
                        AL {{ Number(result.annualLeaveCount || 0).toFixed(2) }} ·
                        SP {{ Number(result.specialPermissionCount || 0).toFixed(2) }} ·
                        ML {{ Number(result.maternityLeaveCount || 0).toFixed(2) }} ·
                        SL {{ Number(result.sickLeaveCount || 0).toFixed(2) }} ·
                        UL {{ Number(result.unpaidLeaveCount || 0).toFixed(2) }}
                    </span>
                    <span v-if="result.unmatchedCount || result.errorCount || result.duplicateCount">
                        Unmatched {{ result.unmatchedCount || 0 }} · Invalid {{ result.errorCount || 0 }} · Duplicates {{ result.duplicateCount || 0 }}
                    </span>
                </div>
            </Message>

            <section
                v-if="listedProblems.length"
                class="error-panel"
            >
                <div class="error-head">
                    <strong>Backend import results</strong>
                    <Button
                        label="Download List"
                        icon="pi pi-download"
                        severity="secondary"
                        text
                        size="small"
                        @click="downloadErrors"
                    />
                </div>
                <div class="error-list">
                    <div
                        v-for="(error, index) in listedProblems"
                        :key="`${error.row}-${index}`"
                        class="error-row"
                    >
                        <strong>Row {{ error.row }}</strong>
                        <span>{{ error.message }}</span>
                    </div>
                </div>
            </section>
        </div>

        <template #footer>
            <EnterpriseFormFooter
                save-label="Import"
                :saving="importing"
                :disabled="!file"
                @cancel="emit('update:visible', false)"
                @save="emit('import')"
            />
        </template>
    </EnterpriseDialog>
</template>

<style scoped>
.import-body {
    display: grid;
    gap: 1rem;
}

.import-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: var(--p-text-muted-color);
    font-size: 0.8rem;
}

.monthly-note {
    color: var(--p-text-muted-color);
    font-size: 0.76rem;
    line-height: 1.45;
}

.import-result {
    display: grid;
    gap: 0.2rem;
    font-size: 0.78rem;
}

.error-panel {
    border: 1px solid var(--p-orange-200);
    border-radius: 0.5rem;
    overflow: hidden;
}

.error-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.45rem 0.65rem;
    background: var(--p-orange-50);
    font-size: 0.78rem;
}

.error-list {
    max-height: 14rem;
    overflow: auto;
}

.error-row {
    display: grid;
    grid-template-columns: 5rem minmax(0, 1fr);
    gap: 0.65rem;
    padding: 0.45rem 0.65rem;
    border-top: 1px solid var(--p-content-border-color);
    font-size: 0.76rem;
}

.error-row span {
    overflow-wrap: anywhere;
}

@media (max-width: 640px) {
    .import-head {
        align-items: stretch;
        flex-direction: column;
    }

    .error-row {
        grid-template-columns: 1fr;
    }
}
</style>
