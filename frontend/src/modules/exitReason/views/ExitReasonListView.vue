<script setup>
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue"
import { useToast } from "primevue/usetoast"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import EnterpriseActionMenu from "@/shared/components/enterprise/EnterpriseActionMenu.vue"
import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseFilterField from "@/shared/components/enterprise/EnterpriseFilterField.vue"
import EnterpriseListControls from "@/shared/components/enterprise/EnterpriseListControls.vue"
import EnterpriseListPage from "@/shared/components/enterprise/EnterpriseListPage.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"

import ExitReasonArchiveDialog from "../components/ExitReasonArchiveDialog.vue"
import ExitReasonFormDialog from "../components/ExitReasonFormDialog.vue"
import { EXIT_REASON_PERMISSIONS, exitReasonColumns, statusOptions } from "../config/exitReason.config.js"
import { useExitReasonStore } from "../stores/exitReason.store.js"

const toast = useToast()
const auth = useAuthStore()
const workspace = useWorkspaceStore()
const store = useExitReasonStore()

const query = reactive({ page: 1, limit: 10, search: "", status: "ALL" })
const errors = ref({})
const formVisible = ref(false)
const archiveVisible = ref(false)
const mode = ref("create")
const selectedId = ref("")
const archiveCandidate = ref(null)
let searchTimer

const form = reactive(emptyForm())
const pagination = computed(() => store.pagination)
const activeFilterCount = computed(() => Number(Boolean(query.search.trim())) + Number(query.status !== "ALL"))
const companyName = computed(() => workspace.selectedCompany?.displayName || workspace.selectedCompany?.legalName || workspace.selectedCompany?.code || "—")
const branchName = computed(() => workspace.selectedBranch?.name || workspace.selectedBranch?.code || "—")

function emptyForm() { return { companyId: "", branchId: "", code: "", name: "", description: "", status: "ACTIVE" } }
function errorMessage(error) { return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || "The request could not be completed." }

async function load(overrides = {}) {
    if (!workspace.ready) return
    Object.assign(query, overrides)
    try {
        await store.loadExitReasons({ ...query, companyId: workspace.companyId, branchId: workspace.branchId })
    } catch (error) { toast.add({ severity:"error", summary:"Unable to load exit reasons", detail:errorMessage(error), life:4500 }) }
}

function delayedSearch() { clearTimeout(searchTimer); searchTimer=setTimeout(()=>load({page:1}),350) }
function clearFilters() { query.search=""; query.status="ALL"; load({page:1}) }
function normalizeCode() { form.code=String(form.code||"").toUpperCase().replace(/\s+/g,"_").replace(/[^A-Z0-9_-]/g,"") }
function clearError(field) { if (errors.value[field]) { const next={...errors.value}; delete next[field]; errors.value=next } }

function openCreate() {
    mode.value="create"; selectedId.value=""; errors.value={}
    Object.assign(form, emptyForm(), { companyId:workspace.companyId, branchId:workspace.branchId })
    formVisible.value=true
}
function openEdit(row) {
    mode.value="edit"; selectedId.value=row.id; errors.value={}
    Object.assign(form, emptyForm(), { ...row, companyId:workspace.companyId, branchId:workspace.branchId })
    formVisible.value=true
}
async function save() {
    errors.value={}
    const payload={ companyId:workspace.companyId, branchId:workspace.branchId, code:form.code, name:form.name, description:form.description||"", status:form.status }
    try {
        if(mode.value==="create") await store.createExitReason(payload)
        else await store.updateExitReason(selectedId.value,payload)
        formVisible.value=false
        toast.add({severity:"success",summary:mode.value==="create"?"Exit reason created":"Exit reason updated",life:2800})
        await load()
    } catch(error) {
        errors.value=error?.response?.data?.error?.fields||{}
        toast.add({severity:"error",summary:"Save failed",detail:errorMessage(error),life:4500})
    }
}
function askArchive(row){archiveCandidate.value=row;archiveVisible.value=true}
async function archiveReason(){
    try{await store.archiveExitReason(archiveCandidate.value.id);archiveVisible.value=false;toast.add({severity:"success",summary:"Exit reason archived",life:2800});await load({page:store.items.length===1&&query.page>1?query.page-1:query.page})}
    catch(error){toast.add({severity:"error",summary:"Archive failed",detail:errorMessage(error),life:4500})}
}
function rowActions(row){return[
    {label:"Edit",icon:"pi pi-pencil",visible:auth.hasPermission(EXIT_REASON_PERMISSIONS.UPDATE)&&row.status!=="ARCHIVED",command:()=>openEdit(row)},
    {label:"Archive",icon:"pi pi-archive",visible:auth.hasPermission(EXIT_REASON_PERMISSIONS.ARCHIVE)&&row.status!=="ARCHIVED",command:()=>askArchive(row)},
]}
function severity(status){return status==="ACTIVE"?"success":status==="INACTIVE"?"warn":"danger"}
function formatDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat(undefined,{dateStyle:"medium"}).format(date)}

watch(()=>workspace.revision,()=>{query.page=1;load()})
onMounted(()=>load())
onBeforeUnmount(()=>clearTimeout(searchTimer))
</script>

<template>
    <EnterpriseListPage :rows="store.items" :columns="exitReasonColumns" :loading="store.loading" :pagination="pagination" row-key="id" empty-title="No exit reasons" empty-description="Create reasons employees can select when leaving this branch." @retry="load" @page-change="load({page:$event.page,limit:$event.limit})">
        <template #controls>
            <EnterpriseListControls filter-label="Filters" hide-filter-label="Hide Filters" :active-filter-count="activeFilterCount">
                <template #start><Button label="Refresh" icon="pi pi-refresh" severity="secondary" text :loading="store.loading" @click="load" /></template>
                <template #actions><PermissionButton :permission="EXIT_REASON_PERMISSIONS.CREATE" label="New Exit Reason" icon="pi pi-plus" :disabled="!workspace.ready" @click="openCreate" /></template>
                <template #filters>
                    <EnterpriseFilterBar :loading="store.loading">
                        <EnterpriseFilterField class="exit-search" label="Search" search><span class="exit-search-input"><i class="pi pi-search"/><InputText v-model="query.search" placeholder="Search code, name or description" @input="delayedSearch" @keyup.enter="load({page:1})" /></span></EnterpriseFilterField>
                        <EnterpriseFilterField label="Status"><Select v-model="query.status" :options="statusOptions" option-label="label" option-value="value" /></EnterpriseFilterField>
                        <template #actions><Button label="Clear" icon="pi pi-times" severity="secondary" outlined :disabled="!activeFilterCount" @click="clearFilters"/><Button label="Apply" icon="pi pi-check" :loading="store.loading" @click="load({page:1})"/></template>
                    </EnterpriseFilterBar>
                </template>
            </EnterpriseListControls>
        </template>
        <template #empty-action><PermissionButton :permission="EXIT_REASON_PERMISSIONS.CREATE" label="New Exit Reason" icon="pi pi-plus" @click="openCreate" /></template>
        <template #cell-description="{row}"><span class="enterprise-table__text" :title="row.description||'—'">{{ row.description||"—" }}</span></template>
        <template #cell-status="{row}"><Tag :value="row.status" :severity="severity(row.status)" /></template>
        <template #cell-updatedAt="{row}"><span class="enterprise-table__text">{{ formatDate(row.updatedAt) }}</span></template>
        <template #actions="{row}"><EnterpriseActionMenu :items="rowActions(row)" aria-label="Exit reason actions" /></template>
    </EnterpriseListPage>

    <ExitReasonFormDialog v-model:visible="formVisible" :mode="mode" :form="form" :errors="errors" :company-name="companyName" :branch-name="branchName" :saving="store.saving" @normalize-code="normalizeCode" @clear-error="clearError" @save="save" />
    <ExitReasonArchiveDialog v-model:visible="archiveVisible" :reason="archiveCandidate" :busy="store.archiving" @confirm="archiveReason" />
</template>

<style scoped>
.exit-search{min-width:min(20rem,100%);flex:1 1 22rem}.exit-search-input{position:relative;display:block}.exit-search-input>i{position:absolute;z-index:1;top:50%;left:.7rem;transform:translateY(-50%);color:var(--p-text-muted-color);font-size:.75rem;pointer-events:none}.exit-search-input :deep(.p-inputtext){width:100%;padding-left:2rem}
</style>
