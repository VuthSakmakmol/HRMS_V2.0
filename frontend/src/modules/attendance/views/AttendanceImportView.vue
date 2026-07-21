<script setup>
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import ProgressBar from "primevue/progressbar"
import Tag from "primevue/tag"
import { computed, onMounted, reactive, ref, watch } from "vue"
import { useToast } from "primevue/usetoast"

import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
import EnterpriseListControls from "@/shared/components/enterprise/EnterpriseListControls.vue"
import EnterpriseListPage from "@/shared/components/enterprise/EnterpriseListPage.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"

import { ATTENDANCE_PERMISSIONS, rawScanColumns } from "../config/attendance.config.js"
import { downloadRawScanTemplate, fetchRawScans, importRawScans } from "../services/attendance.api.js"

const toast = useToast()
const workspace = useWorkspaceStore()

function dateKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

const today = dateKey()
const firstDay = `${today.slice(0, 8)}01`
const rows = ref([])
const loading = ref(false)
const importing = ref(false)
const progress = ref(0)
const dialogVisible = ref(false)
const selectedFile = ref(null)
const importSummary = ref(null)
const query = reactive({ page: 1, limit: 10, search: "", dateFrom: firstDay, dateTo: today })
const pagination = reactive({ page: 1, limit: 10, total: 0, totalPages: 1 })
const activeFilters = computed(() => Number(Boolean(query.search)) + Number(query.dateFrom !== firstDay) + Number(query.dateTo !== today))

function errorMessage(error) {
    return error?.response?.data?.error?.message || error?.message || "The request could not be completed."
}

async function load(overrides = {}) {
    if (!workspace.ready) return
    Object.assign(query, overrides)
    loading.value = true
    try {
        const result = await fetchRawScans({ ...query, companyId: workspace.companyId, branchId: workspace.branchId })
        rows.value = (result.items || []).map((item) => ({ ...item, employeeName: item.employeeId?.displayName || "—" }))
        Object.assign(pagination, result.pagination || {})
    } catch (error) {
        toast.add({ severity: "error", summary: "Unable to load raw scans", detail: errorMessage(error), life: 4500 })
    } finally {
        loading.value = false
    }
}

function clearFilters() {
    Object.assign(query, { page: 1, search: "", dateFrom: firstDay, dateTo: today })
    load()
}

async function runImport() {
    if (!selectedFile.value) return
    importing.value = true
    progress.value = 1
    importSummary.value = null
    try {
        const summary = await importRawScans(selectedFile.value, (event) => {
            if (event.total) progress.value = Math.min(95, Math.round((event.loaded * 100) / event.total))
        })
        progress.value = 100
        importSummary.value = summary
        dialogVisible.value = false
        toast.add({ severity: "success", summary: "Raw scans imported", detail: `${summary.importedCount} new, ${summary.duplicateCount} duplicates.`, life: 3500 })
        await load({ page: 1 })
    } catch (error) {
        importSummary.value = error?.response?.data?.error?.details?.importSummary || null
        toast.add({ severity: "error", summary: "Import rejected", detail: errorMessage(error), life: 5000 })
    } finally {
        importing.value = false
    }
}

function formatDateTime(value) {
    return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value)) : "—"
}

watch(() => workspace.revision, () => load({ page: 1 }))
onMounted(() => load())
</script>

<template>
    <EnterpriseListPage
        :rows="rows"
        :columns="rawScanColumns"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        empty-title="No raw scans"
        empty-description="Import the original scanner file for this workspace and period."
        @retry="load"
        @page-change="load({ page: $event.page, limit: $event.limit })"
    >
        <template #controls>
            <EnterpriseListControls filter-label="Filters" hide-filter-label="Hide Filters" :active-filter-count="activeFilters">
                <template #start>
                    <Button label="Refresh" icon="pi pi-refresh" severity="secondary" text :loading="loading" @click="load" />
                    <PermissionButton :permission="ATTENDANCE_PERMISSIONS.SCAN_IMPORT" label="Sample" icon="pi pi-download" severity="secondary" text @click="downloadRawScanTemplate" />
                </template>
                <template #actions>
                    <PermissionButton :permission="ATTENDANCE_PERMISSIONS.SCAN_IMPORT" label="Import Scans" icon="pi pi-upload" :disabled="!workspace.ready" @click="dialogVisible = true" />
                </template>
                <template #filters>
                    <EnterpriseFilterBar :loading="loading">
                        <EnterpriseFilterField class="scan-search" label="Search" search><InputText v-model="query.search" placeholder="Employee ID" @keyup.enter="load({ page: 1 })" /></EnterpriseFilterField>
                        <EnterpriseFilterField label="From"><EnterpriseCalendarDatePicker v-model="query.dateFrom" :company-id="workspace.companyId" :branch-id="workspace.branchId" compact :show-status="false" /></EnterpriseFilterField>
                        <EnterpriseFilterField label="To"><EnterpriseCalendarDatePicker v-model="query.dateTo" :company-id="workspace.companyId" :branch-id="workspace.branchId" compact :show-status="false" /></EnterpriseFilterField>
                        <template #actions><Button label="Clear" severity="secondary" outlined :disabled="!activeFilters" @click="clearFilters" /><Button label="Apply" icon="pi pi-check" @click="load({ page: 1 })" /></template>
                    </EnterpriseFilterBar>
                </template>
            </EnterpriseListControls>
        </template>
        <template #cell-scannedAt="{ row }">{{ formatDateTime(row.scannedAt) }}</template>
        <template #cell-direction="{ row }"><Tag :value="row.direction" :severity="row.direction === 'IN' ? 'success' : row.direction === 'OUT' ? 'info' : 'secondary'" /></template>
    </EnterpriseListPage>

    <EnterpriseDialog :visible="dialogVisible" title="Import Raw Scanner Data" width="38rem" :busy="importing" @update:visible="dialogVisible = $event">
        <div class="scan-import"><p>The backend validates every Employee ID against the active company and branch. If any row is invalid, nothing is saved.</p><input type="file" accept=".xlsx,.xls" @change="selectedFile = $event.target.files?.[0] || null"><ProgressBar v-if="importing" :value="progress" /></div>
        <template #footer><EnterpriseFormFooter save-label="Import" :saving="importing" :disabled="!selectedFile" @cancel="dialogVisible = false" @save="runImport" /></template>
    </EnterpriseDialog>
</template>

<style scoped>
.scan-search { min-width: 18rem; flex: 1 1 18rem; }
.scan-search :deep(.p-inputtext) { width: 100%; }
.scan-import { display: grid; gap: 1rem; }
.scan-import p { margin: 0; color: var(--p-text-muted-color); font-size: .8rem; }
</style>
