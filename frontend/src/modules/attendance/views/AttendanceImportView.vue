<script setup>
import { onMounted, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputText from "primevue/inputtext"
import ProgressBar from "primevue/progressbar"
import Tag from "primevue/tag"

import AppFilterBar from "@/shared/components/filter/AppFilterBar.vue"
import { useModulePermissions } from "@/shared/auth/useModulePermissions.js"
import {
    downloadRawScanTemplate,
    fetchRawScans,
    importRawScans,
} from "../services/attendance.api.js"
import "../styles/attendance-enterprise.css"

const { t } = useI18n()
const toast = useToast()

const { canImport } = useModulePermissions({
    view: "ATTENDANCE.SCAN.VIEW",
    import: "ATTENDANCE.SCAN.IMPORT",
})

function localDateKey(date = new Date()) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

const today = localDateKey()
const firstDay = `${today.slice(0, 8)}01`

const loading = ref(false)
const importing = ref(false)
const progress = ref(0)
const importDialogVisible = ref(false)
const selectedFile = ref(null)
const items = ref([])
const pagination = reactive({ page: 1, limit: 50, total: 0 })
const filters = reactive({
    dateFrom: firstDay,
    dateTo: today,
    search: "",
})

function formatDateTime(value) {
    if (!value) {
        return "-"
    }

    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).format(new Date(value))
}

function directionSeverity(direction) {
    if (direction === "IN") {
        return "success"
    }

    if (direction === "OUT") {
        return "info"
    }

    return "secondary"
}

async function load(page = 1) {
    loading.value = true
    pagination.page = page

    try {
        const result = await fetchRawScans({
            ...filters,
            page,
            limit: pagination.limit,
        })
        items.value = result.items || []
        Object.assign(pagination, result.pagination || {})
    } finally {
        loading.value = false
    }
}

function resetFilters() {
    filters.search = ""
    filters.dateFrom = firstDay
    filters.dateTo = today
    load(1)
}

function onFileChange(event) {
    selectedFile.value = event.target.files?.[0] || null
}

async function runImport() {
    if (!selectedFile.value) {
        return
    }

    importing.value = true
    progress.value = 1

    try {
        const summary = await importRawScans(selectedFile.value, (event) => {
            if (event.total) {
                progress.value = Math.min(
                    95,
                    Math.round((event.loaded * 100) / event.total),
                )
            }
        })

        progress.value = 100
        importDialogVisible.value = false
        selectedFile.value = null

        toast.add({
            severity: summary.errorCount ? "warn" : "success",
            summary: t("common.success"),
            detail: `${summary.importedCount || 0} imported, ${summary.duplicateCount || 0} duplicates, ${summary.errorCount || 0} errors`,
            life: 4500,
        })

        await load(1)
    } finally {
        importing.value = false
    }
}

onMounted(() => load(1))
</script>

<template>
    <section class="attendance-enterprise-page hrms-list-page">
        <AppFilterBar :loading="loading">
            <InputText
                v-model.trim="filters.search"
                class="app-filter-field app-filter-field--search"
                :placeholder="t('attendance.employeeId')"
                @keyup.enter="load(1)"
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

            <template #actions>
                <Button
                    icon="pi pi-search"
                    :label="t('common.search')"
                    :loading="loading"
                    @click="load(1)"
                />
                <Button
                    icon="pi pi-filter-slash"
                    severity="secondary"
                    outlined
                    @click="resetFilters"
                />
                <Button
                    v-if="canImport"
                    icon="pi pi-download"
                    :label="t('attendance.scan.template')"
                    severity="secondary"
                    outlined
                    @click="downloadRawScanTemplate"
                />
                <Button
                    v-if="canImport"
                    icon="pi pi-upload"
                    :label="t('attendance.scan.import')"
                    @click="importDialogVisible = true"
                />
            </template>
        </AppFilterBar>

        <section class="hrms-list-card">
            <div class="hrms-table-wrap">
                <DataTable
                    :value="items"
                    :loading="loading"
                    data-key="id"
                    paginator
                    lazy
                    striped-rows
                    scrollable
                    :rows="pagination.limit"
                    :total-records="pagination.total"
                    :rows-per-page-options="[20, 50, 100]"
                    class="hrms-standard-table hrms-standard-table--horizontal"
                    current-page-report-template="{first}-{last} / {totalRecords}"
                    paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                    @page="load($event.page + 1)"
                >
                    <template #empty>
                        <div class="hrms-empty-state">No raw scans found.</div>
                    </template>

                    <Column field="employeeCode" :header="t('attendance.employeeId')" style="min-width: 9rem" />

                    <Column :header="t('attendance.scan.scannedAt')" style="min-width: 11rem">
                        <template #body="{ data }">
                            {{ formatDateTime(data.scannedAt) }}
                        </template>
                    </Column>

                    <Column :header="t('attendance.scan.direction')" style="min-width: 7rem">
                        <template #body="{ data }">
                            <Tag
                                :value="data.direction || 'UNKNOWN'"
                                :severity="directionSeverity(data.direction)"
                            />
                        </template>
                    </Column>

                    <Column field="deviceCode" :header="t('attendance.scan.device')" style="min-width: 9rem">
                        <template #body="{ data }">
                            {{ data.deviceCode || "-" }}
                        </template>
                    </Column>

                    <Column field="importBatchId" :header="t('attendance.scan.batch')" style="min-width: 15rem">
                        <template #body="{ data }">
                            <span class="attendance-cell-muted">
                                {{ data.importBatchId || "-" }}
                            </span>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </section>

        <Dialog
            v-model:visible="importDialogVisible"
            modal
            :header="t('attendance.scan.import')"
            class="hrms-standard-dialog--small"
        >
            <div class="attendance-upload-box">
                <input type="file" accept=".xlsx,.xls" @change="onFileChange" />
                <p class="attendance-dialog-note">
                    Import original machine scans. Exact duplicate scans are ignored by the backend.
                </p>
                <ProgressBar v-if="importing" :value="progress" />
            </div>

            <template #footer>
                <Button
                    :label="t('common.cancel')"
                    severity="secondary"
                    outlined
                    :disabled="importing"
                    @click="importDialogVisible = false"
                />
                <Button
                    :label="t('attendance.scan.import')"
                    icon="pi pi-upload"
                    :disabled="!selectedFile"
                    :loading="importing"
                    @click="runImport"
                />
            </template>
        </Dialog>
    </section>
</template>
