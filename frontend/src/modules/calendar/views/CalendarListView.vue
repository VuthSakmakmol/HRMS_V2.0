<script setup>
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import { computed, onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"
import { useAuthStore } from "@/app/stores/auth.store.js"
import { useUiStore } from "@/app/stores/ui.store.js"
import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import EnterpriseActionMenu from "@/shared/components/enterprise/EnterpriseActionMenu.vue"
import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterpriseListControls from "@/shared/components/enterprise/EnterpriseListControls.vue"
import EnterpriseListPage from "@/shared/components/enterprise/EnterpriseListPage.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"
import {
    resolveCalendarDay,
    resolveCalendarRange,
} from "@/modules/calendar/api/calendar.api.js"
import CalendarArchiveDialog from "../components/CalendarArchiveDialog.vue"
import CalendarFormDialog from "../components/CalendarFormDialog.vue"
import CalendarImportDialog from "../components/CalendarImportDialog.vue"
import { useCalendarForm } from "../composables/useCalendarForm.js"
import { useCalendarImport } from "../composables/useCalendarImport.js"
import { useCalendarList } from "../composables/useCalendarList.js"
import { createCalendarColumns } from "../config/calendar.columns.js"
import { createCalendarDayTypeOptions, createCalendarScopeOptions, createCalendarStatusOptions } from "../config/calendar.filters.js"
import { CALENDAR_PERMISSIONS } from "../config/calendar.permissions.js"

const { t } = useI18n(), toast = useToast(), auth = useAuthStore(), ui = useUiStore(), workspaceStore = useWorkspaceStore()
const list = useCalendarList(), formState = useCalendarForm(), importState = useCalendarImport()
const formVisible = ref(false), archiveVisible = ref(false), archiveCandidate = ref(null), importVisible = ref(false), exporting = ref(false), downloading = ref(false)
const columns = computed(() => createCalendarColumns(t))
const statusOptions = computed(() => createCalendarStatusOptions(t)), scopeOptions = computed(() => createCalendarScopeOptions(t)), dayTypeOptions = computed(() => createCalendarDayTypeOptions(t))
const canUpdate = computed(() => auth.hasPermission(CALENDAR_PERMISSIONS.UPDATE)), canArchive = computed(() => auth.hasPermission(CALENDAR_PERMISSIONS.ARCHIVE))
const activeFilterCount = computed(() => [list.query.search, list.query.startDate, list.query.endDate, list.query.scopeLevel !== "ALL", list.query.dayType !== "ALL", list.query.status !== "ALL"].filter(Boolean).length)
const workspaceCompanyName = computed(() => workspaceStore.selectedCompany?.displayName || workspaceStore.selectedCompany?.legalName || workspaceStore.selectedCompany?.code || "—")
const workspaceBranchName = computed(() => workspaceStore.selectedBranch?.name || workspaceStore.selectedBranch?.code || "—")
function errorText(error) { const key = error?.response?.data?.error?.messageKey; return key && t(key) !== key ? t(key) : t("errors.internal") }
async function load() { if (!workspaceStore.ready) return; try { await list.load() } catch (e) { toast.add({ severity: "error", summary: t("organization.calendar.day.loadFailed"), detail: errorText(e), life: 4500 }) } }
function openCreate() { formState.openCreate({ companyId: workspaceStore.companyId, branchId: workspaceStore.branchId }); formVisible.value = true }
function openEdit(row) { formState.openEdit(row); formVisible.value = true }
function scopeChange() { formState.form.companyId = formState.form.scopeLevel === "GLOBAL" ? "" : workspaceStore.companyId; formState.form.branchId = formState.form.scopeLevel === "BRANCH" ? workspaceStore.branchId : "" }
async function save() { try { const edit = formState.isEdit.value; await formState.save(); formVisible.value = false; toast.add({ severity: "success", summary: t(edit ? "organization.calendar.day.updated" : "organization.calendar.day.created"), life: 3000 }); await list.load() } catch (e) { toast.add({ severity: "error", summary: t("organization.calendar.day.saveFailed"), detail: errorText(e), life: 5000 }) } }
function askArchive(row) { archiveCandidate.value = row; archiveVisible.value = true }
async function confirmArchive() { try { await list.archive(archiveCandidate.value.id); archiveVisible.value = false; archiveCandidate.value = null; toast.add({ severity: "success", summary: t("organization.calendar.day.archived"), life: 3000 }) } catch (e) { toast.add({ severity: "error", summary: t("organization.calendar.day.archiveFailed"), detail: errorText(e), life: 5000 }) } }
function actions(row) { return [{ label: t("common.edit"), icon: "pi pi-pencil", visible: canUpdate.value && row.status !== "ARCHIVED", command: () => openEdit(row) }, { label: t("common.archive"), icon: "pi pi-archive", visible: canArchive.value && row.status !== "ARCHIVED", command: () => askArchive(row) }] }
function severity(value) { if (["ACTIVE", "WORKING_DAY", "SPECIAL_WORKING_DAY", "COMPANY_EVENT"].includes(value)) return "success"; if (["INACTIVE", "WEEKEND"].includes(value)) return "warn"; if (["ARCHIVED", "HOLIDAY", "CLOSED_DAY"].includes(value)) return "danger"; return "secondary" }
function dateTime(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(ui.locale, { dateStyle: "medium", timeStyle: "short" }).format(date) }
async function template() { downloading.value = true; try { await downloadCalendarImportTemplate() } finally { downloading.value = false } }
async function exportRows() { exporting.value = true; try { await exportCalendarDays({ ...list.query, page: undefined, limit: undefined }) } finally { exporting.value = false } }
async function submitImport() { try { await importState.submit(); await list.load({ page: 1 }) } catch (e) { toast.add({ severity: "error", summary: t("organization.calendar.day.importFailed"), detail: errorText(e), life: 5000 }) } }
onMounted(load)
</script>

<template>
    <EnterpriseListPage :rows="list.rows.value" :columns="columns" :loading="list.loading.value"
        :error="list.error.value" :pagination="list.pagination" row-key="id" :actions-header="t('common.actions')"
        :empty-title="t('organization.calendar.day.empty')"
        :empty-description="t('organization.calendar.day.description')" @retry="list.load"
        @page-change="list.changePage" @sort-change="list.changeSort">
        <template #controls>
            <EnterpriseListControls :filter-label="t('common.filters')" :hide-filter-label="t('common.hideFilters')"
                :active-filter-count="activeFilterCount">
                <template #start><Button severity="secondary" text icon="pi pi-refresh" :label="t('common.refresh')"
                        :loading="list.loading.value" @click="list.load" />
                    <PermissionButton :permission="CALENDAR_PERMISSIONS.VIEW" severity="secondary" text
                        icon="pi pi-download" :label="t('organization.calendar.day.downloadSample')"
                        :loading="downloading" @click="template" />
                    <PermissionButton :permission="CALENDAR_PERMISSIONS.IMPORT" severity="secondary" text
                        icon="pi pi-upload" :label="t('organization.calendar.day.importExcel')"
                        :disabled="!workspaceStore.ready"
                        @click="importVisible = true" />
                    <PermissionButton :permission="CALENDAR_PERMISSIONS.EXPORT" severity="secondary" text
                        icon="pi pi-file-export" :label="t('organization.calendar.day.exportExcel')"
                        :loading="exporting" :disabled="!workspaceStore.ready" @click="exportRows" />
                </template>
                <template #actions>
                    <PermissionButton :permission="CALENDAR_PERMISSIONS.CREATE" icon="pi pi-plus"
                        :label="t('organization.calendar.day.newDay')" :disabled="!workspaceStore.ready" @click="openCreate" />
                </template>
                <template #filters>
                    <EnterpriseFilterBar :loading="list.loading.value">
                        <EnterpriseFilterField :label="t('common.search')" search><span
                                class="enterprise-search-input"><i class="pi pi-search" />
                                <InputText v-model="list.query.search"
                                    :placeholder="t('organization.calendar.day.searchPlaceholder')"
                                    @keyup.enter="list.applyFilters" />
                            </span></EnterpriseFilterField>
                        <EnterpriseFilterField :label="t('common.startDate')">
                            <EnterpriseCalendarDatePicker v-model="list.query.startDate" :show-status="false" />
                        </EnterpriseFilterField>
                        <EnterpriseFilterField :label="t('common.endDate')">
                            <EnterpriseCalendarDatePicker v-model="list.query.endDate" :show-status="false" />
                        </EnterpriseFilterField>
                        <EnterpriseFilterField :label="t('organization.calendar.day.scope')"><Select
                                v-model="list.query.scopeLevel" :options="scopeOptions" option-label="label"
                                option-value="value" /></EnterpriseFilterField>
                        <EnterpriseFilterField :label="t('organization.calendar.day.dayType')"><Select
                                v-model="list.query.dayType" :options="dayTypeOptions" option-label="label"
                                option-value="value" /></EnterpriseFilterField>
                        <EnterpriseFilterField :label="t('common.status')"><Select v-model="list.query.status"
                                :options="statusOptions" option-label="label" option-value="value" />
                        </EnterpriseFilterField><template #actions><Button severity="secondary" outlined
                                icon="pi pi-times" :label="t('common.clear')" :disabled="!list.hasActiveFilters.value"
                                @click="list.clearFilters" /><Button icon="pi pi-check" :label="t('common.apply')"
                                :loading="list.loading.value" @click="list.applyFilters" /></template>
                    </EnterpriseFilterBar>
                </template>
            </EnterpriseListControls>
        </template>
        <template #empty-action>
            <PermissionButton :permission="CALENDAR_PERMISSIONS.CREATE" icon="pi pi-plus"
                :label="t('organization.calendar.day.newDay')" :disabled="!workspaceStore.ready" @click="openCreate" />
        </template>
        <template #cell-dateKey="{ row }"><span class="enterprise-table__text enterprise-table__code">{{ row.dateKey
                }}</span></template><template #cell-dayType="{ row }">
            <Tag :severity="severity(row.dayType)" :value="t(`organization.calendar.dayTypes.${row.dayType}`)" />
        </template><template #cell-scopeLevel="{ row }">{{ t(`organization.calendar.scope.${row.scopeLevel}`)
            }}</template><template #cell-company="{ row }">{{ row.company?.displayName || '—' }}</template><template
            #cell-branch="{ row }">{{ row.branch?.name || '—' }}</template><template #cell-isPaidHoliday="{ row }">
            <Tag :severity="row.isPaidHoliday ? 'success' : 'secondary'"
                :value="row.isPaidHoliday ? t('common.yes') : t('common.no')" />
        </template><template #cell-status="{ row }">
            <Tag :severity="severity(row.status)" :value="t(`organization.calendar.status.${row.status}`)" />
        </template><template #cell-updatedAt="{ row }">{{ dateTime(row.updatedAt) }}</template><template
            #actions="{ row }">
            <EnterpriseActionMenu :items="actions(row)" />
        </template>
    </EnterpriseListPage>
    <CalendarFormDialog v-model:visible="formVisible" :mode="formState.mode.value" :form="formState.form"
        :errors="formState.errors.value" :company-name="workspaceCompanyName" :branch-name="workspaceBranchName"
        :saving="formState.saving.value" @save="save" @clear-error="formState.clearError" @scope-change="scopeChange"
    />
    <CalendarArchiveDialog v-model:visible="archiveVisible" :day="archiveCandidate" :busy="list.archiving.value"
        @confirm="confirmArchive" />
    <CalendarImportDialog v-model:visible="importVisible" :importing="importState.importing.value"
        :progress="importState.progress.value" :result="importState.result.value" @file-change="importState.setFile"
        @download-template="template" @import="submitImport" @close="importState.reset" />
</template>
