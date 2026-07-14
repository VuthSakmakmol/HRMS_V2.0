<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { fetchBranchesLookup } from "@/modules/organization/services/branch.api.js"
import { fetchCompaniesLookup } from "@/modules/organization/services/company.api.js"
import AppFilterBar from "@/shared/components/filter/AppFilterBar.vue"
import AppTableActions from "@/shared/components/table/AppTableActions.vue"
import AttendancePolicyForm from "../components/AttendancePolicyForm.vue"
import {
    createAttendancePolicy,
    fetchAttendancePolicies,
    updateAttendancePolicy,
} from "../services/attendance.api.js"
import "../styles/attendance-enterprise.css"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const selectedId = ref(null)
const items = ref([])
const companies = ref([])
const branches = ref([])

const filters = reactive({
    search: "",
    status: "ALL",
    companyId: null,
})

const form = reactive(createEmptyForm())

const canCreate = computed(() =>
    authStore.hasPermission("ATTENDANCE.POLICY.CREATE"),
)

const canUpdate = computed(() =>
    authStore.hasPermission("ATTENDANCE.POLICY.UPDATE"),
)

const statusOptions = [
    { label: "All statuses", value: "ALL" },
    { label: "Active", value: "ACTIVE" },
    { label: "Inactive", value: "INACTIVE" },
]

const dialogTitle = computed(() =>
    selectedId.value ? t("attendance.policy.edit") : t("attendance.policy.add"),
)

const filteredItems = computed(() => {
    const search = filters.search.trim().toLowerCase()

    return items.value.filter((item) => {
        if (filters.status !== "ALL" && item.status !== filters.status) {
            return false
        }

        const companyId = item.companyId?.id || item.companyId
        if (filters.companyId && companyId !== filters.companyId) {
            return false
        }

        if (!search) {
            return true
        }

        return [
            item.code,
            item.name,
            item.companyId?.displayName,
            item.branchId?.name,
        ].some((value) => String(value || "").toLowerCase().includes(search))
    })
})

function createEmptyForm() {
    return {
        companyId: null,
        branchId: null,
        name: "",
        code: "",
        graceInMinutes: 0,
        graceOutMinutes: 0,
        minimumWorkedMinutes: 0,
        lateRoundUnitMinutes: 1,
        lateRoundMethod: "CEIL",
        earlyLeaveRoundUnitMinutes: 1,
        earlyLeaveRoundMethod: "CEIL",
        autoGenerateAbsent: true,
        treatSundayAsRestDay: true,
        status: "ACTIVE",
    }
}

function resetForm() {
    selectedId.value = null
    Object.assign(form, createEmptyForm())
}

function resetFilters() {
    filters.search = ""
    filters.status = "ALL"
    filters.companyId = null
}

function openCreate() {
    resetForm()
    dialogVisible.value = true
}

function openEdit(item) {
    selectedId.value = item.id
    Object.assign(form, {
        companyId: item.companyId?.id || item.companyId,
        branchId: item.branchId?.id || item.branchId || null,
        name: item.name || "",
        code: item.code || "",
        graceInMinutes: Number(item.graceInMinutes || 0),
        graceOutMinutes: Number(item.graceOutMinutes || 0),
        minimumWorkedMinutes: Number(item.minimumWorkedMinutes || 0),
        lateRoundUnitMinutes: Number(item.lateRoundUnitMinutes || 1),
        lateRoundMethod: item.lateRoundMethod || "CEIL",
        earlyLeaveRoundUnitMinutes: Number(item.earlyLeaveRoundUnitMinutes || 1),
        earlyLeaveRoundMethod: item.earlyLeaveRoundMethod || "CEIL",
        autoGenerateAbsent: Boolean(item.autoGenerateAbsent),
        treatSundayAsRestDay: Boolean(item.treatSundayAsRestDay),
        status: item.status || "ACTIVE",
    })
    dialogVisible.value = true
}

async function loadLookups() {
    const [companyResult, branchResult] = await Promise.all([
        fetchCompaniesLookup({ page: 1, limit: 500, status: "ACTIVE" }),
        fetchBranchesLookup({ page: 1, limit: 1000, status: "ACTIVE" }),
    ])

    companies.value = companyResult || []
    branches.value = branchResult || []
}

async function loadItems() {
    loading.value = true

    try {
        items.value = await fetchAttendancePolicies({ status: "ALL" })
    } finally {
        loading.value = false
    }
}

async function save() {
    saving.value = true

    try {
        const payload = {
            ...form,
            branchId: form.branchId || null,
        }

        if (selectedId.value) {
            await updateAttendancePolicy(selectedId.value, payload)
        } else {
            await createAttendancePolicy(payload)
        }

        dialogVisible.value = false
        await loadItems()

        toast.add({
            severity: "success",
            summary: t("common.success"),
            detail: t("attendance.policy.saved"),
            life: 2500,
        })
    } finally {
        saving.value = false
    }
}

onMounted(async () => {
    await Promise.all([loadLookups(), loadItems()])
})
</script>

<template>
    <section class="attendance-enterprise-page hrms-list-page">
        <AppFilterBar :loading="loading">
            <InputText
                v-model.trim="filters.search"
                class="app-filter-field app-filter-field--search"
                placeholder="Search code, name, company or branch"
            />

            <Select
                v-model="filters.companyId"
                class="app-filter-field"
                :options="companies"
                option-label="displayName"
                option-value="id"
                placeholder="All companies"
                filter
                show-clear
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
                    icon="pi pi-filter-slash"
                    severity="secondary"
                    outlined
                    @click="resetFilters"
                />
                <Button
                    v-if="canCreate"
                    icon="pi pi-plus"
                    :label="t('attendance.policy.add')"
                    @click="openCreate"
                />
            </template>
        </AppFilterBar>

        <section class="hrms-list-card">
            <div class="hrms-table-wrap">
                <DataTable
                    :value="filteredItems"
                    :loading="loading"
                    data-key="id"
                    scrollable
                    striped-rows
                    paginator
                    :rows="20"
                    :rows-per-page-options="[20, 50, 100]"
                    class="hrms-standard-table hrms-standard-table--horizontal"
                    current-page-report-template="{first}-{last} / {totalRecords}"
                    paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                >
                    <template #empty>
                        <div class="hrms-empty-state">No attendance policies found.</div>
                    </template>

                    <Column field="code" :header="t('common.code')" style="min-width: 8rem" />
                    <Column field="name" :header="t('common.name')" style="min-width: 12rem" />

                    <Column :header="t('organization.company.title')" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ data.companyId?.displayName || "-" }}
                        </template>
                    </Column>

                    <Column :header="t('organization.branch.title')" style="min-width: 10rem">
                        <template #body="{ data }">
                            {{ data.branchId?.name || t("common.all") }}
                        </template>
                    </Column>

                    <Column :header="t('attendance.policy.graceIn')" style="min-width: 8rem">
                        <template #body="{ data }">
                            {{ data.graceInMinutes || 0 }}
                        </template>
                    </Column>

                    <Column :header="t('attendance.policy.graceOut')" style="min-width: 8rem">
                        <template #body="{ data }">
                            {{ data.graceOutMinutes || 0 }}
                        </template>
                    </Column>

                    <Column :header="t('attendance.policy.minimumWorked')" style="min-width: 9rem">
                        <template #body="{ data }">
                            {{ data.minimumWorkedMinutes || 0 }}
                        </template>
                    </Column>

                    <Column :header="t('common.status')" style="min-width: 7rem">
                        <template #body="{ data }">
                            <Tag
                                :value="data.status"
                                :severity="data.status === 'ACTIVE' ? 'success' : 'secondary'"
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
            <AttendancePolicyForm
                v-model="form"
                :companies="companies"
                :branches="branches"
            />

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
                    :loading="saving"
                    @click="save"
                />
            </template>
        </Dialog>
    </section>
</template>
