<script setup>
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Tag from "primevue/tag";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useToast } from "primevue/usetoast";
import { useI18n } from "vue-i18n";
import { useWorkspaceStore } from "@/app/stores/workspace.store.js";
import { useAuthStore } from "@/app/stores/auth.store.js";
import {
  fetchEmployeeDepartments,
  fetchEmployeePositions,
  fetchEmployeeLines,
  fetchEmployeeShifts,
  fetchEmployeeTypes,
} from "@/modules/employee/api/employee.api.js";
import EnterpriseActionMenu from "@/shared/components/enterprise/EnterpriseActionMenu.vue";
import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue";
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue";
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue";
import EnterpriseListControls from "@/shared/components/enterprise/EnterpriseListControls.vue";
import EnterpriseListPage from "@/shared/components/enterprise/EnterpriseListPage.vue";
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue";
import AttendanceImportDialog from "../components/AttendanceImportDialog.vue";
import AttendanceRecordDialog from "../components/AttendanceRecordDialog.vue";
import AttendanceUnmatchedDialog from "../components/AttendanceUnmatchedDialog.vue";
import {
  ATTENDANCE_PERMISSIONS,
  attendanceColumns,
  attendanceStatusOptions,
} from "../config/attendance.config.js";
import { useAttendanceStore } from "../stores/attendance.store.js";

const toast = useToast(),
  { t } = useI18n(),
  workspace = useWorkspaceStore(),
  auth = useAuthStore(),
  store = useAttendanceStore();
function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const today = dateKey(),
  firstDay = `${today.slice(0, 8)}01`;
const query = reactive({
  page: 1,
  limit: 10,
  search: "",
  dateFrom: firstDay,
  dateTo: today,
  status: "ALL",
  leaveCode: "ALL",
  departmentId: "",
  positionId: "",
  lineId: "",
  shiftId: "",
  employeeTypeId: "",
  employeeTypeChildId: "",
  employmentStatus: "ALL",
  scanCondition: "ALL",
  source: "ALL",
  lockStatus: "ALL",
  lateCondition: "ALL",
  earlyLeaveCondition: "ALL",
});
const departments = ref([]),
  positions = ref([]),
  lines = ref([]),
  shifts = ref([]),
  employeeTypes = ref([]),
  dialogVisible = ref(false),
  importVisible = ref(false),
  unmatchedVisible = ref(false),
  unmatchedRevision = ref(0),
  selectedId = ref(""),
  selectedFile = ref(null);
const form = reactive({
  employeeCode: "",
  attendanceDate: today,
  firstInAt: "",
  lastOutAt: "",
  note: "",
});
let timer;
const leaveLabels = {
  AL: "Annual Leave",
  SP: "Special Permission",
  ML: "Maternity Leave",
  SL: "Sick Leave",
  UL: "Unpaid Leave",
};
const rows = computed(() =>
  store.items.map((item) => ({
    ...item,
    employeeName: item.employeeId?.displayName || "—",
    department: item.departmentId?.name || "—",
    position: item.positionId?.title || item.positionId?.name || "—",
    line: item.lineId?.name || "—",
    shift: item.shiftId?.name || item.shiftId?.code || "—",
    vacation: leaveLabels[item.leaveCode] || "—",
  })),
);

const simpleOptions = (items, allLabel) => [
  { label: allLabel, value: "" },
  ...items.map((item) => ({ label: `${item.code ? `${item.code} - ` : ""}${item.name || item.title || item.displayName || item.code}`, value: item.id || item._id })),
];
const positionOptions = computed(() => simpleOptions(positions.value, "All Positions"));
const lineOptions = computed(() => simpleOptions(lines.value, "All Lines"));
const shiftOptions = computed(() => simpleOptions(shifts.value, "All Shifts"));
const employeeTypeOptions = computed(() => simpleOptions(employeeTypes.value, "All Employee Types"));
const employeeTypeChildOptions = computed(() => {
  const selected = employeeTypes.value.find((item) => (item.id || item._id) === query.employeeTypeId);
  return [
    { label: "All Child Groups", value: "" },
    ...(selected?.children || []).map((item) => ({ label: `${item.code ? `${item.code} - ` : ""}${item.name || item.code}`, value: item.id || item._id })),
  ];
});
const employmentOptions = [
  { label: "All Employment Statuses", value: "ALL" },
  { label: "Working", value: "WORKING" },
  { label: "Maternity Leave", value: "MATERNITY_LEAVE" },
  { label: "Resigned", value: "RESIGNED" },
  { label: "Terminated", value: "TERMINATED" },
  { label: "Abandoned", value: "ABANDONED" },
  { label: "Passed Away", value: "PASSED_AWAY" },
  { label: "Retired", value: "RETIRED" },
];
const scanOptions = [
  { label: "All Scan Conditions", value: "ALL" },
  { label: "Complete Scan", value: "COMPLETE" },
  { label: "Has Any Scan", value: "HAS_ANY" },
  { label: "Missing Both", value: "MISSING_BOTH" },
  { label: "Missing Time 1", value: "MISSING_IN" },
  { label: "Missing Time 2", value: "MISSING_OUT" },
  { label: "Time 1 Only", value: "TIME1_ONLY" },
  { label: "Time 2 Only", value: "TIME2_ONLY" },
];
const sourceOptions = [
  { label: "All Sources", value: "ALL" },
  { label: "Manual Entry", value: "MANUAL" },
  { label: "Excel Import", value: "EXCEL_IMPORT" },
  { label: "Machine Sync", value: "MACHINE_SYNC" },
];
const lockOptions = [
  { label: "All Lock Statuses", value: "ALL" },
  { label: "Open", value: "OPEN" },
  { label: "HR Verified", value: "HR_VERIFIED" },
  { label: "Payroll Locked", value: "PAYROLL_LOCKED" },
  { label: "Finalized", value: "FINALIZED" },
];
const yesNoOptions = (yes, no) => [
  { label: "All", value: "ALL" }, { label: yes, value: yes === "Late" ? "LATE" : "EARLY" }, { label: no, value: yes === "Late" ? "NOT_LATE" : "NOT_EARLY" },
];

const departmentOptions = computed(() => [
  { id: "", name: "All Departments" },
  ...departments.value,
]);
const vacationOptions = computed(() => [
  { label: t("attendance.vacationFilter.all"), value: "ALL" },
  { label: t("attendance.vacationFilter.blank"), value: "BLANK" },
  { label: t("attendance.annualLeave"), value: "AL" },
  { label: t("attendance.specialPermission"), value: "SP" },
  { label: t("attendance.maternityLeave"), value: "ML" },
  { label: t("attendance.sickLeave"), value: "SL" },
  { label: t("attendance.unpaidLeave"), value: "UL" },
]);
const activeFilterCount = computed(
  () =>
    [
      query.search,
      query.departmentId,
      query.positionId, query.lineId, query.shiftId, query.employeeTypeId, query.employeeTypeChildId,
      query.employmentStatus !== "ALL", query.scanCondition !== "ALL", query.source !== "ALL", query.lockStatus !== "ALL", query.lateCondition !== "ALL", query.earlyLeaveCondition !== "ALL",
      query.status !== "ALL",
      query.leaveCode !== "ALL",
      query.dateFrom !== firstDay,
      query.dateTo !== today,
    ].filter(Boolean).length,
);
function errorMessage(e) {
  return (
    e?.response?.data?.error?.message ||
    e?.message ||
    "The request could not be completed."
  );
}
async function load(overrides = {}, force = false) {
  if (!workspace.ready) return;
  Object.assign(query, overrides);
  try {
    await store.load(
      {
        ...query,
        companyId: workspace.companyId,
        branchId: workspace.branchId,
      },
      { force },
    );
  } catch (e) {
    toast.add({
      severity: "error",
      summary: "Unable to load attendance",
      detail: errorMessage(e),
      life: 4500,
    });
  }
}
async function loadLookups() {
  if (!workspace.ready) {
    departments.value = []; positions.value = []; lines.value = []; shifts.value = []; employeeTypes.value = [];
    return;
  }
  const [departmentRows, lineRows, shiftRows, typeRows] = await Promise.all([
    fetchEmployeeDepartments({ companyId: workspace.companyId, branchId: workspace.branchId }),
    fetchEmployeeLines({ companyId: workspace.companyId, branchId: workspace.branchId }),
    fetchEmployeeShifts({ companyId: workspace.companyId, branchId: workspace.branchId }),
    fetchEmployeeTypes(workspace.companyId),
  ]);
  departments.value = departmentRows;
  lines.value = lineRows;
  shifts.value = shiftRows;
  employeeTypes.value = (Array.isArray(typeRows) ? typeRows : typeRows?.items || []).filter((item) => !item.branchId || item.branchId === workspace.branchId);
}
async function onDepartmentChange() {
  query.positionId = "";
  positions.value = query.departmentId ? await fetchEmployeePositions({ companyId: workspace.companyId, branchId: workspace.branchId, departmentId: query.departmentId }) : [];
}
function onEmployeeTypeChange() { query.employeeTypeChildId = ""; }
function delayedSearch() {
  clearTimeout(timer);
  timer = setTimeout(() => load({ page: 1 }), 350);
}
function clearFilters() {
  Object.assign(query, {
    page: 1,
    search: "",
    dateFrom: firstDay,
    dateTo: today,
    status: "ALL",
    leaveCode: "ALL",
    departmentId: "", positionId: "", lineId: "", shiftId: "", employeeTypeId: "", employeeTypeChildId: "",
    employmentStatus: "ALL", scanCondition: "ALL", source: "ALL", lockStatus: "ALL", lateCondition: "ALL", earlyLeaveCondition: "ALL",
  });
  load({}, true);
}
function resetForm() {
  selectedId.value = "";
  Object.assign(form, {
    employeeCode: "",
    attendanceDate: today,
    firstInAt: "",
    lastOutAt: "",
    note: "",
  });
}
function localDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function openCreate() {
  resetForm();
  dialogVisible.value = true;
}
function openEdit(row) {
  selectedId.value = row.id;
  Object.assign(form, {
    employeeCode: row.employeeCode,
    attendanceDate: String(row.attendanceDate).slice(0, 10),
    firstInAt: localDateTime(row.firstInAt),
    lastOutAt: localDateTime(row.lastOutAt),
    note: row.note || "Manual correction",
  });
  dialogVisible.value = true;
}
async function save() {
  try {
    await store.save(
      {
        ...form,
        companyId: workspace.companyId,
        branchId: workspace.branchId,
        firstInAt: form.firstInAt || null,
        lastOutAt: form.lastOutAt || null,
      },
      selectedId.value || null,
    );
    dialogVisible.value = false;
    toast.add({ severity: "success", summary: "Attendance saved", life: 2500 });
    await load({}, true);
  } catch (e) {
    toast.add({
      severity: "error",
      summary: "Save failed",
      detail: errorMessage(e),
      life: 4500,
    });
  }
}
async function importFile() {
  if (!selectedFile.value) return;
  try {
    const summary = await store.importFile(selectedFile.value);
    const hasIssues = summary.errorCount > 0 || summary.unmatchedCount > 0;
    if (!hasIssues) importVisible.value = false;
    unmatchedRevision.value += 1;
    toast.add({
      severity: hasIssues ? "warn" : "success",
      summary: hasIssues ? "Import completed with issues" : "Import completed",
      detail: hasIssues
        ? `${summary.successCount} imported, ${summary.unmatchedCount} unmatched, ${summary.errorCount} invalid.`
        : undefined,
      life: 5000,
    });
    await load({ page: 1 }, true);
  } catch (e) {
    toast.add({
      severity: "error",
      summary: "Import failed",
      detail: errorMessage(e),
      life: 5000,
    });
  }
}
function formatDate(v) {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
}
function formatTime(v) {
  if (!v) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(v));
}
function duration(v) {
  const m = Number(v || 0);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function severity(v) {
  if (v === "PRESENT") return "success";
  if (["LATE", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(v))
    return "warn";
  if (["ABSENT", "MISSING_IN", "MISSING_OUT"].includes(v)) return "danger";
  return "info";
}
function actions(row) {
  return [
    {
      label: "Correct Record",
      icon: "pi pi-pencil",
      visible:
        auth.hasPermission(ATTENDANCE_PERMISSIONS.RECORD_UPDATE) &&
        !["PAYROLL_LOCKED", "FINALIZED"].includes(row.lockStatus),
      command: () => openEdit(row),
    },
  ];
}
watch(
  () => workspace.revision,
  async () => {
    query.page = 1;
    await Promise.all([loadLookups(), load({}, true)]);
  },
);
onMounted(() => Promise.all([loadLookups(), load()]));
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <EnterpriseListPage
    :rows="rows"
    :columns="attendanceColumns"
    :loading="store.loading"
    :error="store.error"
    :pagination="store.pagination"
    row-key="id"
    empty-title="No attendance records"
    empty-description="Import attendance records for this period."
    @retry="load({}, true)"
    @page-change="load({ page: $event.page, limit: $event.limit })"
  >
    <template #controls
      ><EnterpriseListControls
        filter-label="Filters"
        hide-filter-label="Hide Filters"
        :active-filter-count="activeFilterCount"
      >
        <template #start
          ><Button
            label="Refresh"
            icon="pi pi-refresh"
            severity="secondary"
            text
            :loading="store.loading"
            @click="load({}, true)" /><PermissionButton
            :permission="ATTENDANCE_PERMISSIONS.RECORD_IMPORT"
            label="Sample"
            icon="pi pi-download"
            severity="secondary"
            text
            @click="store.downloadTemplate()" /><PermissionButton
            :permission="ATTENDANCE_PERMISSIONS.RECORD_IMPORT"
            label="Import"
            icon="pi pi-upload"
            severity="secondary"
            text
            @click="importVisible = true" /><PermissionButton
            :permission="ATTENDANCE_PERMISSIONS.RECORD_VIEW"
            label="Unmatched"
            icon="pi pi-exclamation-triangle"
            severity="warn"
            text
            @click="unmatchedVisible = true" /><PermissionButton
            :permission="ATTENDANCE_PERMISSIONS.RECORD_EXPORT"
            label="Export"
            icon="pi pi-file-export"
            severity="secondary"
            text
            :loading="store.exporting"
            @click="
              store.exportFile({
                ...query,
                companyId: workspace.companyId,
                branchId: workspace.branchId,
              })
            "
        /></template>
        <template #actions
          ><PermissionButton
            :permission="ATTENDANCE_PERMISSIONS.RECORD_CREATE"
            label="Add Record"
            icon="pi pi-plus"
            :disabled="!workspace.ready"
            @click="openCreate"
        /></template>
        <template #filters
          ><EnterpriseFilterBar :loading="store.loading"
            ><EnterpriseFilterField
              class="attendance-search"
              label="Search"
              search
              ><span class="search-input"
                ><i class="pi pi-search" /><InputText
                  v-model="query.search"
                  placeholder="Employee ID or name"
                  @input="delayedSearch"
                  @keyup.enter="
                    load({ page: 1 })
                  " /></span></EnterpriseFilterField
            ><EnterpriseFilterField label="From"
              ><EnterpriseCalendarDatePicker
                v-model="query.dateFrom"
                :company-id="workspace.companyId"
                :branch-id="workspace.branchId"
                compact
                :show-status="false" /></EnterpriseFilterField
            ><EnterpriseFilterField label="To"
              ><EnterpriseCalendarDatePicker
                v-model="query.dateTo"
                :company-id="workspace.companyId"
                :branch-id="workspace.branchId"
                compact
                :show-status="false" /></EnterpriseFilterField
            ><EnterpriseFilterField label="Employee Type"><Select v-model="query.employeeTypeId" :options="employeeTypeOptions" option-label="label" option-value="value" filter @change="onEmployeeTypeChange" /></EnterpriseFilterField>
            <EnterpriseFilterField v-if="employeeTypeChildOptions.length > 1" label="Child Group"><Select v-model="query.employeeTypeChildId" :options="employeeTypeChildOptions" option-label="label" option-value="value" filter /></EnterpriseFilterField>
            <EnterpriseFilterField label="Department"><Select v-model="query.departmentId" :options="departmentOptions" option-label="name" option-value="id" filter @change="onDepartmentChange" /></EnterpriseFilterField>
            <EnterpriseFilterField label="Position"><Select v-model="query.positionId" :options="positionOptions" option-label="label" option-value="value" filter :disabled="!query.departmentId" /></EnterpriseFilterField>
            <EnterpriseFilterField label="Line"><Select v-model="query.lineId" :options="lineOptions" option-label="label" option-value="value" filter /></EnterpriseFilterField>
            <EnterpriseFilterField label="Shift"><Select v-model="query.shiftId" :options="shiftOptions" option-label="label" option-value="value" filter /></EnterpriseFilterField>
            <EnterpriseFilterField label="Employment"><Select v-model="query.employmentStatus" :options="employmentOptions" option-label="label" option-value="value" /></EnterpriseFilterField>
            <EnterpriseFilterField label="Status"
              ><Select
                v-model="query.status"
                :options="attendanceStatusOptions"
                option-label="label"
                option-value="value" /></EnterpriseFilterField
            ><EnterpriseFilterField :label="t('attendance.vacation')"><Select v-model="query.leaveCode" :options="vacationOptions" option-label="label" option-value="value" /></EnterpriseFilterField>
            <EnterpriseFilterField label="Scan Condition"><Select v-model="query.scanCondition" :options="scanOptions" option-label="label" option-value="value" /></EnterpriseFilterField>
            <EnterpriseFilterField label="Late"><Select v-model="query.lateCondition" :options="yesNoOptions('Late', 'Not Late')" option-label="label" option-value="value" /></EnterpriseFilterField>
            <EnterpriseFilterField label="Early Leave"><Select v-model="query.earlyLeaveCondition" :options="yesNoOptions('Early Leave', 'Not Early Leave')" option-label="label" option-value="value" /></EnterpriseFilterField>
            <EnterpriseFilterField label="Source"><Select v-model="query.source" :options="sourceOptions" option-label="label" option-value="value" /></EnterpriseFilterField>
            <EnterpriseFilterField label="Lock Status"><Select v-model="query.lockStatus" :options="lockOptions" option-label="label" option-value="value" /></EnterpriseFilterField>
            <template #actions
              ><Button
                label="Clear"
                icon="pi pi-times"
                severity="secondary"
                outlined
                :disabled="!activeFilterCount"
                @click="clearFilters" /><Button
                label="Apply"
                icon="pi pi-check"
                :loading="store.loading"
                @click="
                  load({ page: 1 }, true)
                " /></template></EnterpriseFilterBar
        ></template> </EnterpriseListControls
    ></template>
    <template #cell-attendanceDate="{ row }">{{
      formatDate(row.attendanceDate)
    }}</template
    ><template #cell-firstInAt="{ row }">{{
      formatTime(row.firstInAt)
    }}</template
    ><template #cell-lastOutAt="{ row }">{{
      formatTime(row.lastOutAt)
    }}</template
    ><template #cell-workedMinutes="{ row }">{{
      duration(row.workedMinutes)
    }}</template
    ><template #cell-lateMinutes="{ row }">{{ row.lateMinutes || 0 }}m</template
    ><template #cell-earlyLeaveMinutes="{ row }"
      >{{ row.earlyLeaveMinutes || 0 }}m</template
    ><template #cell-status="{ row }"
      ><Tag
        :value="row.status.replaceAll('_', ' ')"
        :severity="severity(row.status)" /></template
    ><template #actions="{ row }"
      ><EnterpriseActionMenu
        :items="actions(row)"
        aria-label="Attendance actions"
    /></template>
  </EnterpriseListPage>
  <AttendanceRecordDialog
    v-model:visible="dialogVisible"
    :form="form"
    :editing="Boolean(selectedId)"
    :saving="store.saving"
    :company-id="workspace.companyId"
    :branch-id="workspace.branchId"
    @save="save"
  /><AttendanceImportDialog
    v-model:visible="importVisible"
    :importing="store.importing"
    :progress="store.importProgress"
    :phase="store.importPhase"
    :processed-rows="store.importProcessedRows"
    :total-rows="store.importTotalRows"
    :result="store.importSummary"
    @file-change="selectedFile = $event"
    @template="store.downloadTemplate()"
    @import="importFile"
  />
  <AttendanceUnmatchedDialog
    v-model:visible="unmatchedVisible"
    :company-id="workspace.companyId"
    :branch-id="workspace.branchId"
    :date-from="query.dateFrom"
    :date-to="query.dateTo"
    :revision="unmatchedRevision"
  />
</template>
<style scoped>
.attendance-search {
  min-width: min(18rem, 100%);
  flex: 1 1 20rem;
}
.search-input {
  position: relative;
  display: block;
}
.search-input > i {
  position: absolute;
  z-index: 1;
  left: 0.7rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
}
.search-input :deep(.p-inputtext) {
  width: 100%;
  padding-left: 2rem;
}
</style>
