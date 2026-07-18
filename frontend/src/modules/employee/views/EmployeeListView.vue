<script setup>
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import MultiSelect from "primevue/multiselect"
import Select from "primevue/select"
import Tag from "primevue/tag"
import { computed, onMounted, reactive, ref } from "vue"
import { useToast } from "primevue/usetoast"
import { useAuthStore } from "@/app/stores/auth.store.js"
import EnterpriseActionMenu from "@/shared/components/enterprise/EnterpriseActionMenu.vue"
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterpriseListControls from "@/shared/components/enterprise/EnterpriseListControls.vue"
import EnterpriseListPage from "@/shared/components/enterprise/EnterpriseListPage.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"
import { downloadEmployeeImportTemplate, exportEmployees, fetchEmployeeLookups } from "../api/employee.api.js"
import EmployeeArchiveDialog from "../components/EmployeeArchiveDialog.vue"
import EmployeeDetailsDrawer from "../components/EmployeeDetailsDrawer.vue"
import EmployeeFormDialog from "../components/EmployeeFormDialog.vue"
import EmployeeImportDialog from "../components/EmployeeImportDialog.vue"
import { useEmployeeDetails } from "../composables/useEmployeeDetails.js"
import { useEmployeeForm } from "../composables/useEmployeeForm.js"
import { useEmployeeImport } from "../composables/useEmployeeImport.js"
import { useEmployeeList } from "../composables/useEmployeeList.js"
import { defaultEmployeeColumns, EMPLOYEE_COLUMNS } from "../config/employee.columns.js"
import { EMPLOYMENT_STATUS_OPTIONS, RECORD_STATUS_OPTIONS } from "../config/employee.filters.js"
import { EMPLOYEE_PERMISSIONS } from "../config/employee.permissions.js"

const toast=useToast(),auth=useAuthStore(),list=useEmployeeList(),details=useEmployeeDetails(),formState=useEmployeeForm(),importState=useEmployeeImport()
const selectedColumns=ref(defaultEmployeeColumns()),lookups=reactive({companies:[],branches:[],departments:[],positions:[],lines:[],shifts:[],employeeTypes:[],recruitmentChannels:[],exitReasons:[],countries:[],provinces:[],districts:[],communes:[],villages:[]})
const archiveVisible=ref(false),archiveCandidate=ref(null),archiving=ref(false),exporting=ref(false),downloading=ref(false)
const columns=computed(()=>EMPLOYEE_COLUMNS.filter(c=>selectedColumns.value.includes(c.field)).map(c=>({...c,sortable:false,width:c.field==='displayName'?'14rem':'11rem',minWidth:c.field==='displayName'?'14rem':'11rem'})))
const canEdit=computed(()=>auth.hasPermission(EMPLOYEE_PERMISSIONS.UPDATE)),canArchive=computed(()=>auth.hasPermission(EMPLOYEE_PERMISSIONS.ARCHIVE))
const label=(item)=>{const code=item?.code||item?.employeeCode||'';const name=item?.displayName||item?.title||item?.name||code;return code&&name!==code?`${code} - ${name}`:name}
const map=(items)=>items.map(item=>({label:label(item),value:item.id,...item}))
const formOptions=computed(()=>({
 companyId:map(lookups.companies),branchId:map(lookups.branches.filter(x=>!formState.form.companyId||x.companyId===formState.form.companyId)),departmentId:map(lookups.departments.filter(x=>(!formState.form.companyId||x.companyId===formState.form.companyId)&&(!formState.form.branchId||x.branchId===formState.form.branchId))),positionId:map(lookups.positions.filter(x=>!formState.form.departmentId||x.departmentId===formState.form.departmentId)),lineId:map(lookups.lines.filter(x=>!formState.form.departmentId||x.departmentId===formState.form.departmentId)),shiftId:map(lookups.shifts.filter(x=>!formState.form.branchId||x.branchId===formState.form.branchId)),employeeTypeId:map(lookups.employeeTypes),recruitmentChannelId:map(lookups.recruitmentChannels),exitReasonId:map(lookups.exitReasons),countryId:map(lookups.countries),provinceId:map(lookups.provinces),districtId:map(lookups.districts),communeId:map(lookups.communes),villageId:map(lookups.villages),introducerEmployeeId:[],approvalPolicyId:[],defaultRoleId:[],
}))
const filterCompanies=computed(()=>[{label:'All companies',value:''},...map(lookups.companies)]),filterBranches=computed(()=>[{label:'All branches',value:''},...map(lookups.branches.filter(x=>!list.filters.companyId||x.companyId===list.filters.companyId))]),filterDepartments=computed(()=>[{label:'All departments',value:''},...map(lookups.departments.filter(x=>!list.filters.branchId||x.branchId===list.filters.branchId))])
const org=(v)=>v?.displayName||v?.title||v?.name||v?.code||'—';const date=(v)=>v?new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(v)):'—';const severity=(v)=>['WORKING','ACTIVE'].includes(v)?'success':['ARCHIVED','TERMINATED','ABANDONED','PASSED_AWAY'].includes(v)?'danger':'warn'
function rowActions(row){return [{label:'View details',icon:'pi pi-eye',command:()=>details.open(row.id)},...(canEdit.value?[{label:'Edit',icon:'pi pi-pencil',command:()=>formState.openEdit(row.id)}]:[]),...(canArchive.value?[{label:'Archive',icon:'pi pi-trash',danger:true,command:()=>{archiveCandidate.value=row;archiveVisible.value=true}}]:[])]}
function resetAssignment(){formState.form.branchId='';formState.form.departmentId='';formState.form.positionId='';formState.form.lineId='';formState.form.shiftId=''}
async function save(){try{await formState.save();toast.add({severity:'success',summary:'Employee saved',life:3000});await list.load()}catch(e){toast.add({severity:'error',summary:'Unable to save employee',detail:e?.response?.data?.error?.messageKey||e.message,life:5000})}}
async function confirmArchive(){archiving.value=true;try{await list.archive(archiveCandidate.value.id);archiveVisible.value=false;toast.add({severity:'success',summary:'Employee archived',life:3000})}finally{archiving.value=false}}
async function submitImport() {
    try {
        const summary = await importState.submit()
        const created = Number(summary?.created ?? 0)
        const updated = Number(summary?.updated ?? 0)
        const errors = Array.isArray(summary?.errors)
            ? summary.errors
            : []

        await list.load()

        if (errors.length > 0) {
            toast.add({
                severity: "warn",
                summary: "Import completed with errors",
                detail: `${created} created, ${updated} updated, ${errors.length} errors. Review the errors in the import dialog.`,
                life: 7000,
            })
            return
        }

        if (created + updated === 0) {
            toast.add({
                severity: "warn",
                summary: "No employees were saved",
                detail: "The Excel file contained no valid employee rows.",
                life: 6000,
            })
            return
        }

        toast.add({
            severity: "success",
            summary: "Employee import completed",
            detail: `${created} created and ${updated} updated.`,
            life: 4500,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: "Employee import failed",
            detail:
                error?.response?.data?.error?.messageKey ||
                error?.message ||
                "Unable to import employees.",
            life: 6000,
        })
    }
}
async function initialize(){try{Object.assign(lookups,await fetchEmployeeLookups());await list.load()}catch(e){toast.add({severity:'error',summary:'Unable to load employees',detail:e.message,life:5000})}}
onMounted(initialize)
</script>
<template><EnterpriseListPage :rows="list.rows.value" :columns="columns" :loading="list.loading.value" :error="list.error.value" :pagination="list.pagination" row-key="id" empty-title="No employees found" empty-description="Adjust the filters or create an employee." actions-header="Actions" @retry="list.load" @page-change="list.changePage">
 <template #controls><EnterpriseListControls filter-label="Filters" hide-filter-label="Hide Filters"><template #start><Button severity="secondary" text icon="pi pi-refresh" label="Refresh" :loading="list.loading.value" @click="list.load"/><PermissionButton :permission="EMPLOYEE_PERMISSIONS.EXPORT" severity="secondary" text icon="pi pi-download" label="Download Template" :loading="downloading" @click="downloading=true;downloadEmployeeImportTemplate().finally(()=>downloading=false)"/><PermissionButton :permission="EMPLOYEE_PERMISSIONS.IMPORT" severity="secondary" text icon="pi pi-upload" label="Import" @click="importState.open"/><PermissionButton :permission="EMPLOYEE_PERMISSIONS.EXPORT" severity="secondary" text icon="pi pi-file-export" label="Export" :loading="exporting" @click="exporting=true;exportEmployees(list.query.value).finally(()=>exporting=false)"/><MultiSelect v-model="selectedColumns" :options="EMPLOYEE_COLUMNS" option-label="header" option-value="field" display="chip" placeholder="Columns" class="employee-column-select"/></template><template #actions><PermissionButton :permission="EMPLOYEE_PERMISSIONS.CREATE" icon="pi pi-plus" label="New Employee" @click="formState.openCreate"/></template><template #filters><EnterpriseFilterBar :loading="list.loading.value"><EnterpriseFilterField label="Search" search><span class="enterprise-search-input"><i class="pi pi-search"/><InputText v-model="list.filters.search" placeholder="Code, name, phone or email" @keyup.enter="list.applyFilters"/></span></EnterpriseFilterField><EnterpriseFilterField label="Company"><Select v-model="list.filters.companyId" :options="filterCompanies" option-label="label" option-value="value" filter @change="list.filters.branchId='';list.filters.departmentId=''"/></EnterpriseFilterField><EnterpriseFilterField label="Branch"><Select v-model="list.filters.branchId" :options="filterBranches" option-label="label" option-value="value" filter :disabled="!list.filters.companyId" @change="list.filters.departmentId=''"/></EnterpriseFilterField><EnterpriseFilterField label="Department"><Select v-model="list.filters.departmentId" :options="filterDepartments" option-label="label" option-value="value" filter :disabled="!list.filters.branchId"/></EnterpriseFilterField><EnterpriseFilterField label="Employment"><Select v-model="list.filters.employmentStatus" :options="EMPLOYMENT_STATUS_OPTIONS" option-label="label" option-value="value"/></EnterpriseFilterField><EnterpriseFilterField label="Record Status"><Select v-model="list.filters.recordStatus" :options="RECORD_STATUS_OPTIONS" option-label="label" option-value="value"/></EnterpriseFilterField><template #actions><Button label="Clear" severity="secondary" outlined @click="list.clearFilters"/><Button label="Apply" icon="pi pi-check" :loading="list.loading.value" @click="list.applyFilters"/></template></EnterpriseFilterBar></template></EnterpriseListControls></template>
 <template #cell-employeeCode="{row}"><button type="button" class="employee-link" @click="details.open(row.id)">{{ row.employeeCode }}</button></template><template #cell-displayName="{row}"><span class="enterprise-table__text">{{ row.displayName||'—' }}</span></template><template #cell-gender="{row}"><span class="enterprise-table__text">{{ row.gender||'—' }}</span></template><template #cell-phoneNumber="{row}"><span class="enterprise-table__text">{{ row.phoneNumber||'—' }}</span></template><template #cell-email="{row}"><span class="enterprise-table__text">{{ row.email||'—' }}</span></template><template #cell-nationality="{row}"><span class="enterprise-table__text">{{ row.nationality||'—' }}</span></template><template v-for="field in ['company','branch','department','position','line','shift','employeeType']" #[`cell-${field}`]="{row}" :key="field"><span class="enterprise-table__text">{{ org(row[field]) }}</span></template><template #cell-employmentStatus="{row}"><Tag :value="row.employmentStatus" :severity="severity(row.employmentStatus)"/></template><template #cell-recordStatus="{row}"><Tag :value="row.recordStatus" :severity="severity(row.recordStatus)"/></template><template #cell-joinDate="{row}">{{ date(row.joinDate) }}</template><template #actions="{row}"><EnterpriseActionMenu :items="rowActions(row)" aria-label="Employee actions"/></template>
</EnterpriseListPage>
<EmployeeDetailsDrawer :visible="details.visible.value" :employee="details.employee.value" :loading="details.loading.value" @update:visible="details.visible.value=$event" @edit="formState.openEdit"/>
<EmployeeFormDialog :visible="formState.visible.value" :mode="formState.mode.value" :form="formState.form" :errors="formState.errors.value" :options="formOptions" :active-section="formState.activeSection.value" :saving="formState.saving.value" :loading="formState.loading.value" @update:visible="formState.visible.value=$event" @update:active-section="formState.activeSection.value=$event" @save="save" @clear-error="formState.clearError" @company-change="resetAssignment" @branch-change="formState.form.departmentId='';formState.form.positionId='';formState.form.lineId='';formState.form.shiftId=''" @department-change="formState.form.positionId='';formState.form.lineId=''"/>
<EmployeeArchiveDialog :visible="archiveVisible" :employee="archiveCandidate" :archiving="archiving" @update:visible="archiveVisible=$event" @confirm="confirmArchive"/>
<EmployeeImportDialog :visible="importState.visible.value" :importing="importState.importing.value" :progress="importState.progress.value" :result="importState.result.value" @update:visible="importState.visible.value=$event" @file-change="importState.setFile" @download-template="downloadEmployeeImportTemplate" @import="submitImport"/>
</template>
<style scoped>.employee-column-select{width:min(18rem,40vw)}.employee-link{padding:0;border:0;background:none;color:var(--p-primary-color);font:inherit;font-weight:700;cursor:pointer}</style>
