<script setup>
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import Tag from "primevue/tag"
import { computed, reactive, ref, watch } from "vue"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterprisePaginator from "@/shared/components/enterprise/EnterprisePaginator.vue"
import EnterpriseTable from "@/shared/components/enterprise/EnterpriseTable.vue"

import { fetchAttendanceImportIssues } from "../services/attendance.api.js"

const props = defineProps({
    visible: Boolean,
    companyId: { type: String, default: "" },
    branchId: { type: String, default: "" },
    revision: { type: Number, default: 0 },
})

const emit = defineEmits(["update:visible"])

const loading = ref(false)
const error = ref("")
const items = ref([])
const query = reactive({ page: 1, limit: 10, search: "" })
const pagination = reactive({ page: 1, limit: 10, total: 0, totalPages: 1 })
const columns = [
    { field: "attendanceDate", header: "Record Date", width: "8rem" },
    { field: "employeeCode", header: "Employee No", width: "9rem" },
    { field: "firstInAt", header: "Time1", width: "7rem" },
    { field: "lastOutAt", header: "Time2", width: "7rem" },
    { field: "sourceRow", header: "Excel Row", width: "7rem" },
    { field: "status", header: "Status", width: "11rem" },
    { field: "importBatchId", header: "Import Batch", minWidth: "14rem" },
]

const canLoad = computed(() => Boolean(props.companyId && props.branchId))

function date(value) {
    if (!value) return "—"
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Asia/Phnom_Penh",
    }).format(new Date(value))
}

function time(value) {
    if (!value) return "—"
    return new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Phnom_Penh",
    }).format(new Date(value))
}

async function load(overrides = {}) {
    Object.assign(query, overrides)
    if (!canLoad.value) return

    loading.value = true
    error.value = ""
    try {
        const result = await fetchAttendanceImportIssues({
            ...query,
            companyId: props.companyId,
            branchId: props.branchId,
            status: "NO_EMPLOYEE_MATCH",
        })
        items.value = result.items || []
        Object.assign(pagination, result.pagination || {})
    } catch (requestError) {
        error.value = requestError?.response?.data?.error?.message ||
            requestError?.message || "Unable to load unmatched attendance."
    } finally {
        loading.value = false
    }
}

watch(
    () => [props.visible, props.revision, props.companyId, props.branchId],
    ([visible]) => {
        if (visible) load({ page: 1 })
    },
)
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        title="Unmatched Attendance"
        width="72rem"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="unmatched-dialog">
            <div class="unmatched-toolbar">
                <span class="search-box">
                    <i class="pi pi-search" />
                    <InputText
                        v-model="query.search"
                        placeholder="Search Employee No"
                        @keyup.enter="load({ page: 1 })"
                    />
                </span>
                <Button
                    label="Search"
                    icon="pi pi-search"
                    :loading="loading"
                    @click="load({ page: 1 })"
                />
                <Button
                    label="Refresh"
                    icon="pi pi-refresh"
                    severity="secondary"
                    outlined
                    :loading="loading"
                    @click="load()"
                />
            </div>

            <div v-if="error" class="unmatched-error">
                <span>{{ error }}</span>
                <Button label="Try again" size="small" @click="load()" />
            </div>

            <EnterpriseTable
                v-else
                :rows="items"
                :columns="columns"
                :loading="loading"
                row-key="id"
                scroll-height="25rem"
            >
                <template #cell-attendanceDate="{ row }">{{ date(row.attendanceDate) }}</template>
                <template #cell-firstInAt="{ row }">{{ time(row.firstInAt) }}</template>
                <template #cell-lastOutAt="{ row }">{{ time(row.lastOutAt) }}</template>
                <template #cell-status><Tag value="NO EMPLOYEE MATCH" severity="warn" /></template>
            </EnterpriseTable>

            <div v-if="!loading && !error && !items.length" class="unmatched-empty">
                No unmatched attendance for this branch.
            </div>

            <EnterprisePaginator
                v-if="!error"
                :page="pagination.page"
                :limit="pagination.limit"
                :total="pagination.total"
                :total-pages="pagination.totalPages"
                :disabled="loading"
                @change="load({ page: $event.page, limit: $event.limit })"
            />
        </div>
    </EnterpriseDialog>
</template>

<style scoped>
.unmatched-dialog { display: grid; gap: .75rem; min-height: 30rem; }
.unmatched-toolbar { display: flex; align-items: center; gap: .5rem; }
.search-box { position: relative; flex: 1 1 18rem; }
.search-box i { position: absolute; z-index: 1; left: .7rem; top: 50%; transform: translateY(-50%); color: var(--p-text-muted-color); }
.search-box :deep(.p-inputtext) { width: 100%; padding-left: 2rem; }
.unmatched-error { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .75rem; border: 1px solid var(--p-red-200); border-radius: .5rem; color: var(--p-red-600); }
.unmatched-empty { padding: 2rem; text-align: center; color: var(--p-text-muted-color); }
@media (max-width: 640px) { .unmatched-toolbar { align-items: stretch; flex-direction: column; } .search-box { flex-basis: auto; width: 100%; } }
</style>
