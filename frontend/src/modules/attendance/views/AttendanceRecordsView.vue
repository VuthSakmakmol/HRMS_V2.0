<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputText from "primevue/inputtext"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import AppFilterBar from "@/shared/components/filter/AppFilterBar.vue"
import AppTableActions from "@/shared/components/table/AppTableActions.vue"
import { useModulePermissions } from "@/shared/auth/useModulePermissions.js"
import { useAttendanceStore } from "../stores/attendance.store.js"
import "../styles/attendance-enterprise.css"

const { t } = useI18n()
const toast = useToast()
const attendanceStore = useAttendanceStore()

function localDateKey(date = new Date()) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

const today = localDateKey()
const firstDay = `${today.slice(0, 8)}01`

const filters = reactive({
    page: 1,
    limit: 20,
    search: "",
    dateFrom: firstDay,
    dateTo: today,
    status: "ALL",
})

const dialogVisible = ref(false)
const selectedId = ref(null)
const importDialogVisible = ref(false)
const selectedFile = ref(null)

const form = reactive({
    employeeCode: "",
    attendanceDate: today,
    firstInAt: "",
    lastOutAt: "",
    note: "",
})

const { canCreate, canUpdate, canImport } = useModulePermissions({
    view: "ATTENDANCE.RECORD.VIEW",
    create: "ATTENDANCE.RECORD.CREATE",
    update: "ATTENDANCE.RECORD.UPDATE",
    import: "ATTENDANCE.RECORD.IMPORT",
})

const statusOptions = computed(() => [
    { label: t("attendance.status.all"), value: "ALL" },
    { label: t("attendance.status.present"), value: "PRESENT" },
    { label: t("attendance.status.late"), value: "LATE" },
    { label: t("attendance.status.earlyLeave"), value: "EARLY_LEAVE" },
    { label: t("attendance.status.missingIn"), value: "MISSING_IN" },
    { label: t("attendance.status.missingOut"), value: "MISSING_OUT" },
    { label: t("attendance.status.absent"), value: "ABSENT" },
    { label: t("attendance.status.restDay"), value: "REST_DAY" },
    { label: t("attendance.status.holiday"), value: "HOLIDAY" },
])

const dialogTitle = computed(() =>
    selectedId.value ? t("attendance.editRecord") : t("attendance.addRecord"),
)

function toDateTimeValue(value) {
    if (!value) {
        return ""
    }

    const date = new Date(value)
    const offset = date.getTimezoneOffset() * 60_000
    return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(value) {
    if (!value) {
        return "-"
    }

    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(value))
}

function formatTime(value) {
    if (!value) {
        return "-"
    }

    return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value))
}

function formatWorkedMinutes(value) {
    const minutes = Number(value || 0)
    const hours = Math.floor(minutes / 60)
    const remaining = minutes % 60

    if (!hours) {
        return `${remaining}m`
    }

    return remaining ? `${hours}h ${remaining}m` : `${hours}h`
}

function statusLabel(status) {
    const key = `attendance.status.${String(status || "").toLowerCase()}`
    const translated = t(key)
    return translated === key ? status || "-" : translated
}

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

async function loadRecords(page = filters.page, force = false) {
    filters.page = page
    await attendanceStore.load({ ...filters }, { force })
}

function resetFilters() {
    filters.search = ""
    filters.dateFrom = firstDay
    filters.dateTo = today
    filters.status = "ALL"
    loadRecords(1, true)
}

function resetForm() {
    selectedId.value = null
    Object.assign(form, {
        employeeCode: "",
        attendanceDate: today,
        firstInAt: "",
        lastOutAt: "",
        note: "",
    })
}

function openCreate() {
    resetForm()
    dialogVisible.value = true
}

function openEdit(record) {
    selectedId.value = record.id
    Object.assign(form, {
        employeeCode: record.employeeCode || "",
        attendanceDate: String(record.attendanceDate || "").slice(0, 10),
        firstInAt: toDateTimeValue(record.firstInAt),
        lastOutAt: toDateTimeValue(record.lastOutAt),
        note: record.note || "",
    })
    dialogVisible.value = true
}

async function saveRecord() {
    await attendanceStore.save(
        {
            employeeCode: form.employeeCode,
            attendanceDate: form.attendanceDate,
            firstInAt: form.firstInAt || null,
            lastOutAt: form.lastOutAt || null,
            note: form.note,
        },
        selectedId.value,
    )

    dialogVisible.value = false
    toast.add({
        severity: "success",
        summary: t("common.success"),
        detail: t("attendance.saved"),
        life: 2500,
    })
    await loadRecords(filters.page, true)
}

function onFileChange(event) {
    selectedFile.value = event.target.files?.[0] || null
}

async function runImport() {
    if (!selectedFile.value) {
        return
    }

    await attendanceStore.importFile(selectedFile.value)
    importDialogVisible.value = false
    selectedFile.value = null
    await loadRecords(1, true)
}

onMounted(() => {
    loadRecords(1)
})
</script>

<template>
    <section class="attendance-enterprise-page hrms-list-page">
        <AppFilterBar :loading="attendanceStore.loading">
            <InputText
                v-model.trim="filters.search"
                class="app-filter-field app-filter-field--search"
                :placeholder="t('attendance.searchPlaceholder')"
                @keyup.enter="loadRecords(1)"
            />

            <input
                v-model="filters.dateFrom"
                type="date"
                class="app-filter-field attendance-native-control"
                :aria-label="t('common.dateFrom')"
            />

            <input
                v-model="filters.dateTo"
                type="date"
                class="app-filter-field attendance-native-control"
                :aria-label="t('common.dateTo')"
            />

            <Select
                v-model="filters.status"
                class="app-filter-field"
                :options="statusOptions"
                option-label="label"
                option-value="value"
            />

            <template #actions>
                <Button
                    icon="pi pi-search"
                    :label="t('common.search')"
                    :loading="attendanceStore.loading"
                    @click="loadRecords(1)"
                />
                <Button
                    icon="pi pi-filter-slash"
                    severity="secondary"
                    outlined
                    :aria-label="t('common.reset')"
                    @click="resetFilters"
                />
                <Button
                    v-if="canImport"
                    icon="pi pi-download"
                    :label="t('attendance.template')"
                    severity="secondary"
                    outlined
                    @click="attendanceStore.downloadTemplate()"
                />
                <Button
                    v-if="canImport"
                    icon="pi pi-upload"
                    :label="t('attendance.import')"
                    severity="secondary"
                    @click="importDialogVisible = true"
                />
                <Button
                    v-if="canCreate"
                    icon="pi pi-plus"
                    :label="t('attendance.addRecord')"
                    @click="openCreate"
                />
            </template>
        </AppFilterBar>

        <section class="hrms-list-card">
            <div class="hrms-table-wrap">
                <DataTable
                    :value="attendanceStore.items"
                    :loading="attendanceStore.loading"
                    data-key="id"
                    striped-rows
                    scrollable
                    paginator
                    lazy
                    :rows="attendanceStore.pagination.limit"
                    :total-records="attendanceStore.pagination.total"
                    class="hrms-standard-table hrms-standard-table--horizontal"
                    paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                    current-page-report-template="{first}-{last} / {totalRecords}"
                    :rows-per-page-options="[20, 50, 100]"
                    @page="loadRecords($event.page + 1)"
                >
                    <template #empty>
                        <div class="hrms-empty-state">No attendance records found.</div>
                    </template>

                    <Column :header="t('attendance.date')" style="min-width: 7.5rem">
                        <template #body="{ data }">
                            {{ formatDate(data.attendanceDate) }}
                        </template>
                    </Column>

                    <Column field="employeeCode" :header="t('attendance.employeeId')" style="min-width: 8.5rem" />

                    <Column :header="t('attendance.employeeName')" style="min-width: 12rem">
                        <template #body="{ data }">
                            <span class="attendance-cell-primary">
                                {{ data.employeeId?.displayName || data.employeeName || "-" }}
                            </span>
                        </template>
                    </Column>

                    <Column :header="t('attendance.shift')" style="min-width: 7rem">
                        <template #body="{ data }">
                            {{ data.shiftId?.code || data.shiftSnapshot?.code || "-" }}
                        </template>
                    </Column>

                    <Column :header="t('attendance.firstIn')" style="min-width: 7rem">
                        <template #body="{ data }">
                            {{ formatTime(data.firstInAt) }}
                        </template>
                    </Column>

                    <Column :header="t('attendance.lastOut')" style="min-width: 7rem">
                        <template #body="{ data }">
                            {{ formatTime(data.lastOutAt) }}
                        </template>
                    </Column>

                    <Column :header="t('attendance.workedMinutes')" style="min-width: 8rem">
                        <template #body="{ data }">
                            {{ formatWorkedMinutes(data.workedMinutes) }}
                        </template>
                    </Column>

                    <Column :header="t('attendance.statusLabel')" style="min-width: 9rem">
                        <template #body="{ data }">
                            <Tag
                                class="attendance-table-status"
                                :value="statusLabel(data.status)"
                                :severity="statusSeverity(data.status)"
                            />
                        </template>
                    </Column>

                    <Column
                        v-if="canUpdate"
                        :header="t('common.actions')"
                        style="min-width: 5rem"
                    >
                        <template #body="{ data }">
                            <AppTableActions
                                :can-edit="canUpdate"
                                :edit-label="t('common.edit')"
                                @edit="openEdit(data)"
                            />
                        </template>
                    </Column>
                </DataTable>
            </div>
        </section>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            :header="dialogTitle"
            class="hrms-standard-dialog"
        >
            <div class="hrms-form-grid">
                <label class="hrms-form-field">
                    <span>{{ t("attendance.employeeId") }}</span>
                    <InputText
                        v-model.trim="form.employeeCode"
                        :disabled="Boolean(selectedId)"
                    />
                </label>

                <label class="hrms-form-field">
                    <span>{{ t("attendance.date") }}</span>
                    <input
                        v-model="form.attendanceDate"
                        type="date"
                        class="attendance-native-control"
                    />
                </label>

                <label class="hrms-form-field">
                    <span>{{ t("attendance.firstIn") }}</span>
                    <input
                        v-model="form.firstInAt"
                        type="datetime-local"
                        class="attendance-native-control"
                    />
                </label>

                <label class="hrms-form-field">
                    <span>{{ t("attendance.lastOut") }}</span>
                    <input
                        v-model="form.lastOutAt"
                        type="datetime-local"
                        class="attendance-native-control"
                    />
                </label>

                <label class="hrms-form-field hrms-form-field--wide">
                    <span>{{ t("common.note") }}</span>
                    <Textarea v-model="form.note" rows="3" auto-resize />
                </label>
            </div>

            <template #footer>
                <Button
                    :label="t('common.cancel')"
                    severity="secondary"
                    outlined
                    @click="dialogVisible = false"
                />
                <Button
                    :label="t('common.save')"
                    icon="pi pi-check"
                    :loading="attendanceStore.saving"
                    @click="saveRecord"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importDialogVisible"
            modal
            :header="t('attendance.importTitle')"
            class="hrms-standard-dialog--small"
        >
            <div class="attendance-upload-box">
                <input type="file" accept=".xlsx,.xls" @change="onFileChange" />
                <p class="attendance-dialog-note">
                    Select the completed attendance Excel file. Existing records are validated by the backend before import.
                </p>
                <ProgressBar
                    v-if="attendanceStore.importing"
                    :value="attendanceStore.importProgress"
                />
            </div>

            <template #footer>
                <Button
                    :label="t('common.cancel')"
                    severity="secondary"
                    outlined
                    :disabled="attendanceStore.importing"
                    @click="importDialogVisible = false"
                />
                <Button
                    :label="t('attendance.import')"
                    icon="pi pi-upload"
                    :disabled="!selectedFile"
                    :loading="attendanceStore.importing"
                    @click="runImport"
                />
            </template>
        </Dialog>
    </section>
</template>
