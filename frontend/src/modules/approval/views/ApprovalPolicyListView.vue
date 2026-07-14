<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Card from "primevue/card"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { fetchCompaniesLookup } from "@/modules/organization/services/company.api.js"
import { fetchBranchesLookup } from "@/modules/organization/services/branch.api.js"
import { useApprovalStore } from "../stores/approval.store.js"

const { t } = useI18n()
const toast = useToast()
const approvalStore = useApprovalStore()

const companies = ref([])
const branches = ref([])
const activeTab = ref("policies")

const moduleDialogVisible = ref(false)
const policyDialogVisible = ref(false)
const previewDialogVisible = ref(false)
const archiveDialogVisible = ref(false)
const archiveType = ref("")
const archiveCandidate = ref(null)

const selectedModuleId = ref(null)
const selectedPolicyId = ref(null)

const moduleFilters = reactive({ page: 1, limit: 20, search: "", status: "ACTIVE" })
const policyFilters = reactive({ page: 1, limit: 20, search: "", status: "ACTIVE", moduleKey: "" })

const moduleForm = reactive(createEmptyModuleForm())
const policyForm = reactive(createEmptyPolicyForm())
const previewForm = reactive(createEmptyPreviewForm())

const tabOptions = computed(() => [
    { label: t("approval.tabs.policies"), value: "policies" },
    { label: t("approval.tabs.modules"), value: "modules" },
    { label: t("approval.tabs.resolvers"), value: "resolvers" },
])

const statusOptions = computed(() => [
    { label: t("common.all"), value: "ALL" },
    { label: t("common.active"), value: "ACTIVE" },
    { label: t("common.inactive"), value: "INACTIVE" },
    { label: t("common.archived"), value: "ARCHIVED" },
])

const editableStatusOptions = computed(() => [
    { label: t("common.active"), value: "ACTIVE" },
    { label: t("common.inactive"), value: "INACTIVE" },
])

const moduleOptions = computed(() => [
    { label: t("approval.allModules"), value: "" },
    ...approvalStore.modules.map((item) => ({
        label: `${item.moduleKey} - ${item.name}`,
        value: item.moduleKey,
    })),
])

const companyOptions = computed(() =>
    companies.value.map((company) => ({
        label: `${company.code} - ${company.displayName}`,
        value: company.id,
    })),
)

const branchOptions = computed(() =>
    branches.value
        .filter((branch) => !policyForm.scope.companyId || branch.companyId === policyForm.scope.companyId)
        .map((branch) => ({
            label: `${branch.code} - ${branch.name}`,
            value: branch.id,
        })),
)

function createEmptyModuleForm() {
    return {
        moduleKey: "",
        name: "",
        defaultActionKey: "REQUEST",
        description: "",
        status: "ACTIVE",
    }
}

function createEmptyPolicyForm() {
    return {
        moduleKey: "OT_REQUEST",
        actionKey: "REQUEST",
        code: "",
        name: "",
        scope: {
            companyId: "",
            branchId: "",
            departmentId: null,
            lineId: null,
            positionId: null,
            employeeId: null,
        },
        conditionsText: "{}",
        stepsText: JSON.stringify(
            [
                {
                    stepCode: "LEVEL_1",
                    stepName: "Level 1 Approval",
                    sequence: 1,
                    approvalMode: "ALL",
                    assignmentMode: "FIRST",
                    resolverKey: "LINE_LEADER",
                    resolverConfig: {},
                    fallbackResolvers: [
                        {
                            resolverKey: "DEPARTMENT_MANAGER",
                            resolverConfig: {},
                        },
                    ],
                    allowSelfApproval: false,
                    isRequired: true,
                    canReject: true,
                    canReturn: false,
                    description: "",
                },
            ],
            null,
            2,
        ),
        priority: 100,
        description: "",
        status: "ACTIVE",
    }
}

function createEmptyPreviewForm() {
    return {
        moduleKey: "OT_REQUEST",
        actionKey: "REQUEST",
        assignmentText: JSON.stringify(
            {
                employeeId: null,
                companyId: "",
                branchId: null,
                departmentId: null,
                positionId: null,
                lineId: null,
            },
            null,
            2,
        ),
        contextText: JSON.stringify(
            {
                amount: 0,
                hours: 0,
                requestType: "NORMAL",
            },
            null,
            2,
        ),
    }
}

function resetObject(target, source) {
    for (const key of Object.keys(target)) {
        delete target[key]
    }

    Object.assign(target, source)
}

function normalizeCode(value) {
    return String(value || "")
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_.-]/g, "")
}

function normalizeModuleFormCode(field) {
    moduleForm[field] = normalizeCode(moduleForm[field])
}

function normalizePolicyFormCode(field) {
    policyForm[field] = normalizeCode(policyForm[field])
}

function parseJson(text, label) {
    try {
        return JSON.parse(text || "{}")
    } catch (error) {
        throw new Error(`${label} JSON is invalid.`)
    }
}

function getErrorMessage(error) {
    const messageKey = error?.response?.data?.error?.messageKey

    if (messageKey) {
        const translated = t(messageKey)
        return translated === messageKey ? messageKey : translated
    }

    return error?.message || t("errors.internal")
}

function getStatusSeverity(status) {
    if (status === "ACTIVE") return "success"
    if (status === "INACTIVE") return "warn"
    if (status === "ARCHIVED") return "danger"
    return "secondary"
}

async function loadLookups() {
    const [companyResult, branchResult] = await Promise.all([
        fetchCompaniesLookup({ page: 1, limit: 100, status: "ACTIVE" }),
        fetchBranchesLookup({ page: 1, limit: 100, status: "ACTIVE" }),
    ])

    companies.value = companyResult || []
    branches.value = branchResult || []
}

async function loadAll() {
    await Promise.all([
        approvalStore.loadModules(moduleFilters),
        approvalStore.loadPolicies(policyFilters),
        approvalStore.loadResolverOptions(),
    ])
}

function openCreateModuleDialog() {
    selectedModuleId.value = null
    resetObject(moduleForm, createEmptyModuleForm())
    moduleDialogVisible.value = true
}

function openEditModuleDialog(item) {
    selectedModuleId.value = item.id
    resetObject(moduleForm, {
        moduleKey: item.moduleKey,
        name: item.name,
        defaultActionKey: item.defaultActionKey || "REQUEST",
        description: item.description || "",
        status: item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    })
    moduleDialogVisible.value = true
}

async function saveModule() {
    try {
        await approvalStore.saveModule(selectedModuleId.value, moduleForm)
        moduleDialogVisible.value = false
        await approvalStore.loadModules(moduleFilters)
        toast.add({ severity: "success", summary: t("approval.saved"), life: 3000 })
    } catch (error) {
        toast.add({ severity: "error", summary: t("approval.saveFailed"), detail: getErrorMessage(error), life: 5000 })
    }
}

function openCreatePolicyDialog() {
    selectedPolicyId.value = null
    resetObject(policyForm, createEmptyPolicyForm())

    if (approvalStore.modules.length > 0) {
        policyForm.moduleKey = approvalStore.modules[0].moduleKey
        policyForm.actionKey = approvalStore.modules[0].defaultActionKey || "REQUEST"
    }

    if (companies.value.length === 1) {
        policyForm.scope.companyId = companies.value[0].id
    }

    policyDialogVisible.value = true
}

function openEditPolicyDialog(item) {
    selectedPolicyId.value = item.id
    resetObject(policyForm, {
        moduleKey: item.moduleKey,
        actionKey: item.actionKey,
        code: item.code,
        name: item.name,
        scope: {
            companyId: item.scope?.companyId || "",
            branchId: item.scope?.branchId || "",
            departmentId: item.scope?.departmentId || null,
            lineId: item.scope?.lineId || null,
            positionId: item.scope?.positionId || null,
            employeeId: item.scope?.employeeId || null,
        },
        conditionsText: JSON.stringify(item.conditions || {}, null, 2),
        stepsText: JSON.stringify(item.steps || [], null, 2),
        priority: Number(item.priority || 100),
        description: item.description || "",
        status: item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    })
    policyDialogVisible.value = true
}

function buildPolicyPayload() {
    return {
        moduleKey: policyForm.moduleKey,
        actionKey: policyForm.actionKey,
        code: policyForm.code,
        name: policyForm.name,
        scope: {
            companyId: policyForm.scope.companyId,
            branchId: policyForm.scope.branchId || null,
            departmentId: policyForm.scope.departmentId || null,
            lineId: policyForm.scope.lineId || null,
            positionId: policyForm.scope.positionId || null,
            employeeId: policyForm.scope.employeeId || null,
        },
        conditions: parseJson(policyForm.conditionsText, "Conditions"),
        steps: parseJson(policyForm.stepsText, "Steps"),
        priority: policyForm.priority,
        description: policyForm.description,
        status: policyForm.status,
    }
}

async function savePolicy() {
    try {
        await approvalStore.savePolicy(selectedPolicyId.value, buildPolicyPayload())
        policyDialogVisible.value = false
        await approvalStore.loadPolicies(policyFilters)
        toast.add({ severity: "success", summary: t("approval.saved"), life: 3000 })
    } catch (error) {
        toast.add({ severity: "error", summary: t("approval.saveFailed"), detail: getErrorMessage(error), life: 5000 })
    }
}

function openArchiveDialog(type, item) {
    archiveType.value = type
    archiveCandidate.value = item
    archiveDialogVisible.value = true
}

async function confirmArchive() {
    try {
        if (archiveType.value === "module") {
            await approvalStore.archiveModule(archiveCandidate.value.id)
            await approvalStore.loadModules(moduleFilters)
        } else {
            await approvalStore.archivePolicy(archiveCandidate.value.id)
            await approvalStore.loadPolicies(policyFilters)
        }

        archiveDialogVisible.value = false
        toast.add({ severity: "success", summary: t("approval.archived"), life: 3000 })
    } catch (error) {
        toast.add({ severity: "error", summary: t("approval.archiveFailed"), detail: getErrorMessage(error), life: 5000 })
    }
}

function openPreviewDialog(policy = null) {
    resetObject(previewForm, createEmptyPreviewForm())

    if (policy) {
        previewForm.moduleKey = policy.moduleKey
        previewForm.actionKey = policy.actionKey
        previewForm.assignmentText = JSON.stringify(
            {
                employeeId: policy.scope?.employeeId || null,
                companyId: policy.scope?.companyId || "",
                branchId: policy.scope?.branchId || null,
                departmentId: policy.scope?.departmentId || null,
                positionId: policy.scope?.positionId || null,
                lineId: policy.scope?.lineId || null,
            },
            null,
            2,
        )
    }

    approvalStore.preview = null
    previewDialogVisible.value = true
}

async function runPreview() {
    try {
        await approvalStore.previewPolicy({
            moduleKey: previewForm.moduleKey,
            actionKey: previewForm.actionKey,
            assignment: parseJson(previewForm.assignmentText, "Assignment"),
            context: parseJson(previewForm.contextText, "Context"),
        })
    } catch (error) {
        toast.add({ severity: "error", summary: t("approval.previewFailed"), detail: getErrorMessage(error), life: 5000 })
    }
}

onMounted(async () => {
    try {
        await Promise.all([loadLookups(), loadAll()])
    } catch (error) {
        toast.add({ severity: "error", summary: t("approval.loadFailed"), detail: getErrorMessage(error), life: 5000 })
    }
})
</script>

<template>
    <section class="approval-page">
        <div class="approval-page__header">
            <div>
                <span class="approval-page__eyebrow">{{ t("approval.eyebrow") }}</span>
                <h2>{{ t("approval.title") }}</h2>
                <p>{{ t("approval.description") }}</p>
            </div>
            <div class="approval-page__actions">
                <Button severity="secondary" outlined icon="pi pi-sitemap" :label="t('approval.preview')" @click="openPreviewDialog()" />
                <Button v-if="activeTab === 'modules'" icon="pi pi-plus" :label="t('approval.newModule')" @click="openCreateModuleDialog" />
                <Button v-if="activeTab === 'policies'" icon="pi pi-plus" :label="t('approval.newPolicy')" @click="openCreatePolicyDialog" />
            </div>
        </div>

        <div class="approval-tabs">
            <Button
                v-for="tab in tabOptions"
                :key="tab.value"
                size="small"
                :outlined="activeTab !== tab.value"
                :severity="activeTab === tab.value ? undefined : 'secondary'"
                :label="tab.label"
                @click="activeTab = tab.value"
            />
        </div>

        <Card v-if="activeTab === 'policies'" class="approval-card">
            <template #content>
                <div class="approval-toolbar">
                    <InputText v-model="policyFilters.search" :placeholder="t('approval.searchPolicy')" @keyup.enter="approvalStore.loadPolicies(policyFilters)" />
                    <Select v-model="policyFilters.moduleKey" :options="moduleOptions" option-label="label" option-value="value" @change="approvalStore.loadPolicies(policyFilters)" />
                    <Select v-model="policyFilters.status" :options="statusOptions" option-label="label" option-value="value" @change="approvalStore.loadPolicies(policyFilters)" />
                    <Button icon="pi pi-refresh" severity="secondary" outlined :label="t('common.refresh')" @click="approvalStore.loadPolicies(policyFilters)" />
                </div>

                <DataTable size="small" :value="approvalStore.policies" :loading="approvalStore.loading" data-key="id" scrollable>
                    <Column field="moduleKey" :header="t('approval.moduleKey')" style="min-width: 10rem" />
                    <Column field="actionKey" :header="t('approval.actionKey')" style="min-width: 9rem" />
                    <Column field="code" :header="t('approval.code')" style="min-width: 12rem" />
                    <Column field="name" :header="t('approval.name')" style="min-width: 16rem" />
                    <Column :header="t('approval.scope')" style="min-width: 18rem">
                        <template #body="{ data }">
                            <span class="approval-muted">{{ data.scope }}</span>
                        </template>
                    </Column>
                    <Column :header="t('approval.steps')" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag severity="info" :value="String(data.steps?.length || 0)" />
                        </template>
                    </Column>
                    <Column field="version" :header="t('approval.version')" style="min-width: 7rem" />
                    <Column field="status" :header="t('common.status')" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag :severity="getStatusSeverity(data.status)" :value="data.status" />
                        </template>
                    </Column>
                    <Column :header="t('common.actions')" style="min-width: 12rem">
                        <template #body="{ data }">
                            <div class="approval-row-actions">
                                <Button text rounded size="small" icon="pi pi-sitemap" @click="openPreviewDialog(data)" />
                                <Button v-if="data.status !== 'ARCHIVED'" text rounded size="small" icon="pi pi-pencil" @click="openEditPolicyDialog(data)" />
                                <Button v-if="data.status !== 'ARCHIVED'" text rounded size="small" severity="danger" icon="pi pi-archive" @click="openArchiveDialog('policy', data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </template>
        </Card>

        <Card v-if="activeTab === 'modules'" class="approval-card">
            <template #content>
                <div class="approval-toolbar">
                    <InputText v-model="moduleFilters.search" :placeholder="t('approval.searchModule')" @keyup.enter="approvalStore.loadModules(moduleFilters)" />
                    <Select v-model="moduleFilters.status" :options="statusOptions" option-label="label" option-value="value" @change="approvalStore.loadModules(moduleFilters)" />
                    <Button icon="pi pi-refresh" severity="secondary" outlined :label="t('common.refresh')" @click="approvalStore.loadModules(moduleFilters)" />
                </div>

                <DataTable size="small" :value="approvalStore.modules" :loading="approvalStore.loading" data-key="id">
                    <Column field="moduleKey" :header="t('approval.moduleKey')" />
                    <Column field="name" :header="t('approval.name')" />
                    <Column field="defaultActionKey" :header="t('approval.defaultActionKey')" />
                    <Column field="description" :header="t('approval.descriptionLabel')" />
                    <Column field="status" :header="t('common.status')">
                        <template #body="{ data }">
                            <Tag :severity="getStatusSeverity(data.status)" :value="data.status" />
                        </template>
                    </Column>
                    <Column :header="t('common.actions')">
                        <template #body="{ data }">
                            <div class="approval-row-actions">
                                <Button v-if="data.status !== 'ARCHIVED'" text rounded size="small" icon="pi pi-pencil" @click="openEditModuleDialog(data)" />
                                <Button v-if="data.status !== 'ARCHIVED'" text rounded size="small" severity="danger" icon="pi pi-archive" @click="openArchiveDialog('module', data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </template>
        </Card>

        <Card v-if="activeTab === 'resolvers'" class="approval-card">
            <template #content>
                <DataTable size="small" :value="approvalStore.resolverOptions" data-key="resolverKey">
                    <Column field="resolverKey" :header="t('approval.resolverKey')" style="min-width: 14rem" />
                    <Column field="label" :header="t('approval.name')" style="min-width: 14rem" />
                    <Column field="description" :header="t('approval.descriptionLabel')" style="min-width: 22rem" />
                    <Column :header="t('approval.sampleConfig')" style="min-width: 20rem">
                        <template #body="{ data }">
                            <pre class="approval-pre">{{ JSON.stringify(data.sampleConfig, null, 2) }}</pre>
                        </template>
                    </Column>
                </DataTable>
            </template>
        </Card>

        <Dialog v-model:visible="moduleDialogVisible" modal class="approval-dialog" :header="selectedModuleId ? t('approval.editModule') : t('approval.newModule')">
            <div class="approval-form-grid">
                <label>
                    <span>{{ t("approval.moduleKey") }}</span>
                    <InputText v-model="moduleForm.moduleKey" @input="normalizeModuleFormCode('moduleKey')" />
                </label>
                <label>
                    <span>{{ t("approval.name") }}</span>
                    <InputText v-model="moduleForm.name" />
                </label>
                <label>
                    <span>{{ t("approval.defaultActionKey") }}</span>
                    <InputText v-model="moduleForm.defaultActionKey" @input="normalizeModuleFormCode('defaultActionKey')" />
                </label>
                <label>
                    <span>{{ t("common.status") }}</span>
                    <Select v-model="moduleForm.status" :options="editableStatusOptions" option-label="label" option-value="value" />
                </label>
                <label class="approval-wide">
                    <span>{{ t("approval.descriptionLabel") }}</span>
                    <Textarea v-model="moduleForm.description" rows="3" />
                </label>
            </div>
            <template #footer>
                <Button severity="secondary" outlined :label="t('common.cancel')" @click="moduleDialogVisible = false" />
                <Button :loading="approvalStore.saving" :label="t('common.save')" @click="saveModule" />
            </template>
        </Dialog>

        <Dialog v-model:visible="policyDialogVisible" modal class="approval-policy-dialog" :header="selectedPolicyId ? t('approval.editPolicy') : t('approval.newPolicy')">
            <div class="approval-form-grid">
                <label>
                    <span>{{ t("approval.moduleKey") }}</span>
                    <InputText v-model="policyForm.moduleKey" @input="normalizePolicyFormCode('moduleKey')" />
                </label>
                <label>
                    <span>{{ t("approval.actionKey") }}</span>
                    <InputText v-model="policyForm.actionKey" @input="normalizePolicyFormCode('actionKey')" />
                </label>
                <label>
                    <span>{{ t("approval.code") }}</span>
                    <InputText v-model="policyForm.code" @input="normalizePolicyFormCode('code')" />
                </label>
                <label>
                    <span>{{ t("approval.name") }}</span>
                    <InputText v-model="policyForm.name" />
                </label>
                <label>
                    <span>{{ t("approval.company") }}</span>
                    <Select v-model="policyForm.scope.companyId" :options="companyOptions" option-label="label" option-value="value" />
                </label>
                <label>
                    <span>{{ t("approval.branch") }}</span>
                    <Select v-model="policyForm.scope.branchId" :options="[{ label: t('approval.companyWide'), value: '' }, ...branchOptions]" option-label="label" option-value="value" />
                </label>
                <label>
                    <span>{{ t("approval.priority") }}</span>
                    <InputNumber v-model="policyForm.priority" :min="0" :max="9999" :use-grouping="false" />
                </label>
                <label>
                    <span>{{ t("common.status") }}</span>
                    <Select v-model="policyForm.status" :options="editableStatusOptions" option-label="label" option-value="value" />
                </label>
                <label class="approval-wide">
                    <span>{{ t("approval.lowerScopeIds") }}</span>
                    <div class="approval-small-grid">
                        <InputText v-model="policyForm.scope.departmentId" placeholder="departmentId optional" />
                        <InputText v-model="policyForm.scope.lineId" placeholder="lineId optional" />
                        <InputText v-model="policyForm.scope.positionId" placeholder="positionId optional" />
                        <InputText v-model="policyForm.scope.employeeId" placeholder="employeeId optional" />
                    </div>
                </label>
                <label class="approval-wide">
                    <span>{{ t("approval.conditionsJson") }}</span>
                    <Textarea v-model="policyForm.conditionsText" rows="6" class="approval-code-input" />
                </label>
                <label class="approval-wide">
                    <span>{{ t("approval.stepsJson") }}</span>
                    <Textarea v-model="policyForm.stepsText" rows="14" class="approval-code-input" />
                </label>
                <label class="approval-wide">
                    <span>{{ t("approval.descriptionLabel") }}</span>
                    <Textarea v-model="policyForm.description" rows="3" />
                </label>
            </div>
            <template #footer>
                <Button severity="secondary" outlined :label="t('common.cancel')" @click="policyDialogVisible = false" />
                <Button :loading="approvalStore.saving" :label="t('common.save')" @click="savePolicy" />
            </template>
        </Dialog>

        <Dialog v-model:visible="previewDialogVisible" modal class="approval-policy-dialog" :header="t('approval.preview')">
            <div class="approval-form-grid">
                <label>
                    <span>{{ t("approval.moduleKey") }}</span>
                    <InputText v-model="previewForm.moduleKey" @input="previewForm.moduleKey = normalizeCode(previewForm.moduleKey)" />
                </label>
                <label>
                    <span>{{ t("approval.actionKey") }}</span>
                    <InputText v-model="previewForm.actionKey" @input="previewForm.actionKey = normalizeCode(previewForm.actionKey)" />
                </label>
                <label class="approval-wide">
                    <span>{{ t("approval.assignmentJson") }}</span>
                    <Textarea v-model="previewForm.assignmentText" rows="7" class="approval-code-input" />
                </label>
                <label class="approval-wide">
                    <span>{{ t("approval.contextJson") }}</span>
                    <Textarea v-model="previewForm.contextText" rows="5" class="approval-code-input" />
                </label>
            </div>

            <div v-if="approvalStore.preview" class="approval-preview-result">
                <h3>{{ approvalStore.preview.policy?.name || t("approval.noPolicy") }}</h3>
                <p v-if="approvalStore.preview.warnings?.length" class="approval-warning">{{ approvalStore.preview.warnings.join(', ') }}</p>
                <DataTable size="small" :value="approvalStore.preview.steps || []">
                    <Column field="sequence" :header="t('approval.sequence')" />
                    <Column field="stepName" :header="t('approval.stepName')" />
                    <Column field="resolverKey" :header="t('approval.resolverKey')" />
                    <Column :header="t('approval.approvers')">
                        <template #body="{ data }">
                            <span>{{ (data.approvers || []).map((item) => `${item.employeeCode} - ${item.displayName}`).join(', ') || '-' }}</span>
                        </template>
                    </Column>
                </DataTable>
            </div>

            <template #footer>
                <Button severity="secondary" outlined :label="t('common.close')" @click="previewDialogVisible = false" />
                <Button :loading="approvalStore.previewing" :label="t('approval.runPreview')" @click="runPreview" />
            </template>
        </Dialog>

        <Dialog v-model:visible="archiveDialogVisible" modal class="approval-dialog" :header="t('approval.archiveTitle')">
            <p>{{ t("approval.archiveMessage", { name: archiveCandidate?.name || archiveCandidate?.code || '-' }) }}</p>
            <template #footer>
                <Button severity="secondary" outlined :label="t('common.cancel')" @click="archiveDialogVisible = false" />
                <Button severity="danger" :loading="approvalStore.archiving" :label="t('common.archive')" @click="confirmArchive" />
            </template>
        </Dialog>
    </section>
</template>

<style scoped>
.approval-page {
    width: 100%;
    display: grid;
    gap: 1rem;
}

.approval-page__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
}

.approval-page__eyebrow {
    color: var(--hrms-color-primary);
    font-size: 0.76rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.approval-page__header h2 {
    margin: 0.35rem 0 0;
}

.approval-page__header p {
    margin: 0.45rem 0 0;
    color: var(--hrms-text-muted);
}

.approval-page__actions,
.approval-tabs,
.approval-toolbar,
.approval-row-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.approval-toolbar {
    margin-bottom: 0.8rem;
}

.approval-card {
    min-width: 0;
}

.approval-muted {
    color: var(--hrms-text-muted);
    font-size: 0.76rem;
}

.approval-dialog {
    width: min(42rem, calc(100vw - 2rem));
}

.approval-policy-dialog {
    width: min(72rem, calc(100vw - 2rem));
}

.approval-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
}

.approval-form-grid label {
    display: grid;
    gap: 0.35rem;
}

.approval-form-grid label > span {
    color: var(--hrms-text-muted);
    font-size: 0.76rem;
    font-weight: 700;
}

.approval-wide {
    grid-column: 1 / -1;
}

.approval-small-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
}

.approval-code-input,
.approval-pre {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 0.75rem;
}

.approval-pre {
    margin: 0;
    white-space: pre-wrap;
}

.approval-preview-result {
    margin-top: 1rem;
    display: grid;
    gap: 0.75rem;
}

.approval-warning {
    margin: 0;
    color: var(--hrms-color-warning);
    font-size: 0.82rem;
}

:deep(.p-datatable-thead > tr > th),
:deep(.p-datatable-tbody > tr > td) {
    text-align: center;
    vertical-align: middle;
    font-size: 0.78rem;
}

@media (max-width: 800px) {
    .approval-page__header {
        flex-direction: column;
    }

    .approval-form-grid,
    .approval-small-grid {
        grid-template-columns: 1fr;
    }
}
</style>
