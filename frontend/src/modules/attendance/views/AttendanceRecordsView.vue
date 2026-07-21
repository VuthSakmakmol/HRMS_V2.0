<script setup>
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import { computed,onBeforeUnmount,onMounted,reactive,ref,watch } from "vue"
import { useToast } from "primevue/usetoast"
import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import { useAuthStore } from "@/app/stores/auth.store.js"
import { lookupDepartments } from "@/modules/organization/department/api/department.api.js"
import EnterpriseActionMenu from "@/shared/components/enterprise/EnterpriseActionMenu.vue"
import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterpriseListControls from "@/shared/components/enterprise/EnterpriseListControls.vue"
import EnterpriseListPage from "@/shared/components/enterprise/EnterpriseListPage.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"
import AttendanceImportDialog from "../components/AttendanceImportDialog.vue"
import AttendanceRecordDialog from "../components/AttendanceRecordDialog.vue"
import AttendanceUnmatchedDialog from "../components/AttendanceUnmatchedDialog.vue"
import { ATTENDANCE_PERMISSIONS,attendanceColumns,attendanceStatusOptions,verificationOptions } from "../config/attendance.config.js"
import { useAttendanceStore } from "../stores/attendance.store.js"

const toast=useToast(),workspace=useWorkspaceStore(),auth=useAuthStore(),store=useAttendanceStore()
function dateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
const today=dateKey(),firstDay=`${today.slice(0,8)}01`
const query=reactive({page:1,limit:10,search:"",dateFrom:firstDay,dateTo:today,status:"ALL",verificationStatus:"ALL",departmentId:""})
const departments=ref([]),dialogVisible=ref(false),importVisible=ref(false),unmatchedVisible=ref(false),unmatchedRevision=ref(0),selectedId=ref(""),selectedFile=ref(null)
const form=reactive({employeeCode:"",attendanceDate:today,firstInAt:"",lastOutAt:"",note:""})
let timer
const rows=computed(()=>store.items.map(item=>({...item,employeeName:item.employeeId?.displayName||"—",department:item.departmentId?.name||"—",position:item.positionId?.title||item.positionId?.name||"—",line:item.lineId?.name||"—",shift:item.shiftId?.name||item.shiftId?.code||"—"})))
const departmentOptions=computed(()=>[{id:"",name:"All Departments"},...departments.value])
const activeFilterCount=computed(()=>[query.search,query.departmentId,query.status!=="ALL",query.verificationStatus!=="ALL",query.dateFrom!==firstDay,query.dateTo!==today].filter(Boolean).length)
function errorMessage(e){return e?.response?.data?.error?.message||e?.message||"The request could not be completed."}
async function load(overrides={},force=false){if(!workspace.ready)return;Object.assign(query,overrides);try{await store.load({...query,companyId:workspace.companyId,branchId:workspace.branchId},{force})}catch(e){toast.add({severity:"error",summary:"Unable to load attendance",detail:errorMessage(e),life:4500})}}
async function loadLookups(){departments.value=workspace.ready?await lookupDepartments({companyId:workspace.companyId,branchId:workspace.branchId,status:"ACTIVE"}):[]}
function delayedSearch(){clearTimeout(timer);timer=setTimeout(()=>load({page:1}),350)}
function clearFilters(){Object.assign(query,{page:1,search:"",dateFrom:firstDay,dateTo:today,status:"ALL",verificationStatus:"ALL",departmentId:""});load({},true)}
function resetForm(){selectedId.value="";Object.assign(form,{employeeCode:"",attendanceDate:today,firstInAt:"",lastOutAt:"",note:""})}
function localDateTime(value){if(!value)return"";const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function openCreate(){resetForm();dialogVisible.value=true}
function openEdit(row){selectedId.value=row.id;Object.assign(form,{employeeCode:row.employeeCode,attendanceDate:String(row.attendanceDate).slice(0,10),firstInAt:localDateTime(row.firstInAt),lastOutAt:localDateTime(row.lastOutAt),note:row.note||"Manual correction"});dialogVisible.value=true}
async function save(){try{await store.save({...form,companyId:workspace.companyId,branchId:workspace.branchId,firstInAt:form.firstInAt||null,lastOutAt:form.lastOutAt||null},selectedId.value||null);dialogVisible.value=false;toast.add({severity:"success",summary:"Attendance saved",life:2500});await load({},true)}catch(e){toast.add({severity:"error",summary:"Save failed",detail:errorMessage(e),life:4500})}}
async function importFile(){if(!selectedFile.value)return;try{const summary=await store.importFile(selectedFile.value);const hasIssues=summary.errorCount>0||summary.unmatchedCount>0;if(!hasIssues)importVisible.value=false;unmatchedRevision.value+=1;toast.add({severity:hasIssues?"warn":"success",summary:hasIssues?"Import completed with issues":"Import completed",detail:hasIssues?`${summary.successCount} imported, ${summary.unmatchedCount} unmatched, ${summary.errorCount} invalid.`:undefined,life:5000});await load({page:1},true)}catch(e){toast.add({severity:"error",summary:"Import failed",detail:errorMessage(e),life:5000})}}
function formatDate(v){const d=new Date(v);return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat(undefined,{dateStyle:"medium"}).format(d)}
function formatTime(v){if(!v)return"—";return new Intl.DateTimeFormat(undefined,{hour:"2-digit",minute:"2-digit"}).format(new Date(v))}
function duration(v){const m=Number(v||0);return `${Math.floor(m/60)}h ${m%60}m`}
function severity(v){if(v==="PRESENT")return"success";if(["LATE","EARLY_LEAVE","LATE_AND_EARLY_LEAVE"].includes(v))return"warn";if(["ABSENT","MISSING_IN","MISSING_OUT"].includes(v))return"danger";return"info"}
function actions(row){return[{label:"Correct Record",icon:"pi pi-pencil",visible:auth.hasPermission(ATTENDANCE_PERMISSIONS.RECORD_UPDATE)&&!["PAYROLL_LOCKED","FINALIZED"].includes(row.lockStatus),command:()=>openEdit(row)}]}
watch(()=>workspace.revision,async()=>{query.page=1;await Promise.all([loadLookups(),load({},true)])})
onMounted(()=>Promise.all([loadLookups(),load()]))
onBeforeUnmount(()=>clearTimeout(timer))
</script>

<template>
<EnterpriseListPage :rows="rows" :columns="attendanceColumns" :loading="store.loading" :error="store.error" :pagination="store.pagination" row-key="id" empty-title="No attendance records" empty-description="Import scans or run verification for this period." @retry="load({},true)" @page-change="load({page:$event.page,limit:$event.limit})">
 <template #controls><EnterpriseListControls filter-label="Filters" hide-filter-label="Hide Filters" :active-filter-count="activeFilterCount">
  <template #start><Button label="Refresh" icon="pi pi-refresh" severity="secondary" text :loading="store.loading" @click="load({},true)"/><PermissionButton :permission="ATTENDANCE_PERMISSIONS.RECORD_IMPORT" label="Sample" icon="pi pi-download" severity="secondary" text @click="store.downloadTemplate()"/><PermissionButton :permission="ATTENDANCE_PERMISSIONS.RECORD_IMPORT" label="Import" icon="pi pi-upload" severity="secondary" text @click="importVisible=true"/><PermissionButton :permission="ATTENDANCE_PERMISSIONS.RECORD_VIEW" label="Unmatched" icon="pi pi-exclamation-triangle" severity="warn" text @click="unmatchedVisible=true"/><PermissionButton :permission="ATTENDANCE_PERMISSIONS.RECORD_EXPORT" label="Export" icon="pi pi-file-export" severity="secondary" text :loading="store.exporting" @click="store.exportFile({...query,companyId:workspace.companyId,branchId:workspace.branchId})"/></template>
  <template #actions><PermissionButton :permission="ATTENDANCE_PERMISSIONS.RECORD_CREATE" label="Add Record" icon="pi pi-plus" :disabled="!workspace.ready" @click="openCreate"/></template>
  <template #filters><EnterpriseFilterBar :loading="store.loading"><EnterpriseFilterField class="attendance-search" label="Search" search><span class="search-input"><i class="pi pi-search"/><InputText v-model="query.search" placeholder="Employee ID or name" @input="delayedSearch" @keyup.enter="load({page:1})"/></span></EnterpriseFilterField><EnterpriseFilterField label="From"><EnterpriseCalendarDatePicker v-model="query.dateFrom" :company-id="workspace.companyId" :branch-id="workspace.branchId" compact :show-status="false"/></EnterpriseFilterField><EnterpriseFilterField label="To"><EnterpriseCalendarDatePicker v-model="query.dateTo" :company-id="workspace.companyId" :branch-id="workspace.branchId" compact :show-status="false"/></EnterpriseFilterField><EnterpriseFilterField label="Department"><Select v-model="query.departmentId" :options="departmentOptions" option-label="name" option-value="id" filter/></EnterpriseFilterField><EnterpriseFilterField label="Status"><Select v-model="query.status" :options="attendanceStatusOptions" option-label="label" option-value="value"/></EnterpriseFilterField><EnterpriseFilterField label="Verification"><Select v-model="query.verificationStatus" :options="verificationOptions" option-label="label" option-value="value"/></EnterpriseFilterField><template #actions><Button label="Clear" icon="pi pi-times" severity="secondary" outlined :disabled="!activeFilterCount" @click="clearFilters"/><Button label="Apply" icon="pi pi-check" :loading="store.loading" @click="load({page:1},true)"/></template></EnterpriseFilterBar></template>
 </EnterpriseListControls></template>
 <template #cell-attendanceDate="{row}">{{formatDate(row.attendanceDate)}}</template><template #cell-firstInAt="{row}">{{formatTime(row.firstInAt)}}</template><template #cell-lastOutAt="{row}">{{formatTime(row.lastOutAt)}}</template><template #cell-workedMinutes="{row}">{{duration(row.workedMinutes)}}</template><template #cell-lateMinutes="{row}">{{row.lateMinutes||0}}m</template><template #cell-earlyLeaveMinutes="{row}">{{row.earlyLeaveMinutes||0}}m</template><template #cell-status="{row}"><Tag :value="row.status.replaceAll('_',' ')" :severity="severity(row.status)"/></template><template #cell-verificationStatus="{row}"><Tag :value="row.verificationStatus.replaceAll('_',' ')" :severity="row.verificationStatus==='NEEDS_REVIEW'?'warn':'secondary'"/></template><template #actions="{row}"><EnterpriseActionMenu :items="actions(row)" aria-label="Attendance actions"/></template>
</EnterpriseListPage>
<AttendanceRecordDialog v-model:visible="dialogVisible" :form="form" :editing="Boolean(selectedId)" :saving="store.saving" :company-id="workspace.companyId" :branch-id="workspace.branchId" @save="save"/><AttendanceImportDialog v-model:visible="importVisible" :importing="store.importing" :progress="store.importProgress" :result="store.importSummary" @file-change="selectedFile=$event" @template="store.downloadTemplate()" @import="importFile"/>
<AttendanceUnmatchedDialog v-model:visible="unmatchedVisible" :company-id="workspace.companyId" :branch-id="workspace.branchId" :revision="unmatchedRevision"/>
</template>
<style scoped>.attendance-search{min-width:min(18rem,100%);flex:1 1 20rem}.search-input{position:relative;display:block}.search-input>i{position:absolute;z-index:1;left:.7rem;top:50%;transform:translateY(-50%);color:var(--p-text-muted-color);font-size:.75rem}.search-input :deep(.p-inputtext){width:100%;padding-left:2rem}</style>
