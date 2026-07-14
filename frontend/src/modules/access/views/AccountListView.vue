<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useToast } from "primevue/usetoast"
import Button from "primevue/button"
import Card from "primevue/card"
import Checkbox from "primevue/checkbox"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputText from "primevue/inputtext"
import MultiSelect from "primevue/multiselect"
import Password from "primevue/password"
import Select from "primevue/select"
import Tag from "primevue/tag"

import { useAuthStore } from "@/app/stores/auth.store.js"

import {
    createAccount,
    fetchAccounts,
    fetchRoleLookup,
    fetchScopeLookup,
    resetAccountPassword,
    updateAccount,
} from "../services/access.api.js"

const toast = useToast()
const auth = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const loadingLookups = ref(false)
const items = ref([])
const roles = ref([])
const companies = ref([])
const branches = ref([])
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const search = ref("")
const status = ref("ALL")
const dialogVisible = ref(false)
const editing = ref(null)
const resetDialogVisible = ref(false)
const resetTarget = ref(null)
const newPassword = ref("")

const form = reactive({
    loginId: "",
    displayName: "",
    password: "",
    status: "ACTIVE",
    assignments: [],
})

const canCreate = computed(() =>
    auth.hasPermission("ACCESS.ACCOUNT.CREATE"),
)
const canUpdate = computed(() =>
    auth.hasPermission("ACCESS.ACCOUNT.UPDATE"),
)
const canReset = computed(() =>
    auth.hasPermission("ACCESS.ACCOUNT.RESET_PASSWORD"),
)

const roleOptions = computed(() =>
    roles.value.map((role) => ({
        label: `${role.name} (${role.code})`,
        value: role.id,
    })),
)

const companyOptions = computed(() =>
    companies.value.map((company) => ({
        label: `${company.code} - ${company.displayName}`,
        value: company.id,
    })),
)

function toId(value) {
    if (!value) {
        return null
    }

    if (typeof value === "string") {
        return value
    }

    return toId(value.id || value._id)
}

function getRole(roleId) {
    return roles.value.find((role) => role.id === roleId) || null
}

function getRoleCompanyId(role) {
    return toId(role?.companyId)
}

function getBranchOptions(assignment) {
    if (!assignment.companyId) {
        return []
    }

    return branches.value
        .filter((branch) => toId(branch.companyId) === assignment.companyId)
        .map((branch) => ({
            label: `${branch.code} - ${branch.name}`,
            value: branch.id,
        }))
}

function assignmentSummary(row) {
    return (
        (row.roleAssignments || [])
            .map((assignment) => {
                const role = assignment.roleId
                const roleName = role?.name || role?.code || "-"

                if (role?.scope === "GLOBAL") {
                    return `${roleName} · Global`
                }

                const company = assignment.companyId
                const companyName =
                    company?.displayName || company?.code || "No company"

                if (assignment.allBranches) {
                    return `${roleName} · ${companyName} · All branches`
                }

                return `${roleName} · ${companyName} · ${(assignment.branchIds || []).length} branches`
            })
            .join(", ") || "-"
    )
}

function createEmptyAssignment(roleId = null) {
    const role = getRole(roleId)

    return {
        roleId,
        companyId:
            role?.scope === "COMPANY" ? getRoleCompanyId(role) : null,
        allBranches: true,
        branchIds: [],
    }
}

function resetForm() {
    Object.assign(form, {
        loginId: "",
        displayName: "",
        password: "",
        status: "ACTIVE",
        assignments: [],
    })
}

async function loadLookups() {
    loadingLookups.value = true

    try {
        const [roleResponse, scopeResponse] = await Promise.all([
            fetchRoleLookup(),
            fetchScopeLookup(),
        ])

        roles.value = roleResponse.items || []
        companies.value = scopeResponse.companies || []
        branches.value = scopeResponse.branches || []
    } catch (error) {
        showError("Unable to load account options", error)
        throw error
    } finally {
        loadingLookups.value = false
    }
}

async function loadAccounts() {
    loading.value = true

    try {
        const response = await fetchAccounts({
            page: page.value,
            limit: limit.value,
            search: search.value.trim(),
            status: status.value,
        })

        items.value = response.items || []
        total.value = response.pagination?.total || 0
    } catch (error) {
        showError("Unable to load accounts", error)
    } finally {
        loading.value = false
    }
}

async function openCreate() {
    resetForm()
    editing.value = null

    if (!roles.value.length || !companies.value.length) {
        await loadLookups()
    }

    dialogVisible.value = true
}

async function openEdit(row) {
    editing.value = row

    if (!roles.value.length || !companies.value.length) {
        await loadLookups()
    }

    Object.assign(form, {
        loginId: row.loginId || "",
        displayName: row.displayName || "",
        password: "",
        status: row.status || "ACTIVE",
        assignments: (row.roleAssignments || []).map((assignment) => {
            const roleId = toId(assignment.roleId)
            const role = getRole(roleId)

            return {
                roleId,
                companyId:
                    role?.scope === "GLOBAL"
                        ? null
                        : toId(assignment.companyId) ||
                          getRoleCompanyId(role),
                allBranches:
                    role?.scope === "GLOBAL"
                        ? true
                        : Boolean(assignment.allBranches),
                branchIds:
                    role?.scope === "GLOBAL" || assignment.allBranches
                        ? []
                        : (assignment.branchIds || [])
                              .map(toId)
                              .filter(Boolean),
            }
        }),
    })

    dialogVisible.value = true
}

function addAssignment() {
    form.assignments.push(createEmptyAssignment())
}

function removeAssignment(index) {
    form.assignments.splice(index, 1)
}

function onRoleChange(assignment) {
    const role = getRole(assignment.roleId)

    if (!role) {
        assignment.companyId = null
        assignment.allBranches = true
        assignment.branchIds = []
        return
    }

    if (role.scope === "GLOBAL") {
        assignment.companyId = null
        assignment.allBranches = true
        assignment.branchIds = []
        return
    }

    assignment.companyId = getRoleCompanyId(role)
    assignment.allBranches = true
    assignment.branchIds = []
}

function onCompanyChange(assignment) {
    assignment.branchIds = []
}

function onAllBranchesChange(assignment) {
    if (assignment.allBranches) {
        assignment.branchIds = []
    }
}

function validateForm() {
    if (!form.loginId.trim() || !form.displayName.trim()) {
        showWarning("Login ID and display name are required")
        return false
    }

    if (!editing.value && form.password.length < 8) {
        showWarning("Initial password must contain at least 8 characters")
        return false
    }

    const roleIds = form.assignments
        .map((assignment) => assignment.roleId)
        .filter(Boolean)

    if (new Set(roleIds).size !== roleIds.length) {
        showWarning("The same role cannot be assigned more than once")
        return false
    }

    for (const assignment of form.assignments) {
        const role = getRole(assignment.roleId)

        if (!role) {
            showWarning("Select a role for every assignment")
            return false
        }

        if (role.scope === "COMPANY" && !assignment.companyId) {
            showWarning(`Select a company for ${role.name}`)
            return false
        }

        if (
            role.scope === "COMPANY" &&
            !assignment.allBranches &&
            !assignment.branchIds.length
        ) {
            showWarning(`Select at least one branch for ${role.name}`)
            return false
        }
    }

    return true
}

async function saveAccount() {
    if (!validateForm()) {
        return
    }

    saving.value = true

    try {
        const roleAssignments = form.assignments.map((assignment) => {
            const role = getRole(assignment.roleId)

            if (role.scope === "GLOBAL") {
                return {
                    roleId: assignment.roleId,
                    companyId: null,
                    allBranches: true,
                    branchIds: [],
                }
            }

            return {
                roleId: assignment.roleId,
                companyId: assignment.companyId,
                allBranches: assignment.allBranches,
                branchIds: assignment.allBranches
                    ? []
                    : assignment.branchIds,
            }
        })

        const payload = {
            loginId: form.loginId.trim(),
            displayName: form.displayName.trim(),
            status: form.status,
            roleAssignments,
        }

        if (editing.value) {
            await updateAccount(editing.value.id, payload)
        } else {
            await createAccount({
                ...payload,
                password: form.password,
            })
        }

        dialogVisible.value = false
        toast.add({
            severity: "success",
            summary: editing.value ? "Account updated" : "Account created",
            life: 2500,
        })

        await loadAccounts()
    } catch (error) {
        showError("Unable to save account", error)
    } finally {
        saving.value = false
    }
}

async function resetPassword() {
    try {
        await resetAccountPassword(resetTarget.value.id, newPassword.value)
        resetDialogVisible.value = false

        toast.add({
            severity: "success",
            summary: "Password reset successfully",
            life: 2500,
        })
    } catch (error) {
        showError("Unable to reset password", error)
    }
}

function onPage(event) {
    page.value = event.page + 1
    limit.value = event.rows
    loadAccounts()
}

function showWarning(summary) {
    toast.add({ severity: "warn", summary, life: 3500 })
}

function showError(summary, error) {
    toast.add({
        severity: "error",
        summary,
        detail:
            error.response?.data?.error?.messageKey ||
            error.response?.data?.message ||
            error.message,
        life: 4500,
    })
}

onMounted(async () => {
    await Promise.all([loadLookups(), loadAccounts()])
})
</script>

<template>
    <div class="access-page">
        <Card>
            <template #title>
                <div class="page-head">
                    <div>
                        <h2>Accounts</h2>
                        <p>
                            Assign roles together with their company and branch
                            data scope.
                        </p>
                    </div>

                    <Button
                        v-if="canCreate"
                        label="New Account"
                        icon="pi pi-user-plus"
                        @click="openCreate"
                    />
                </div>
            </template>

            <template #content>
                <div class="filters">
                    <InputText
                        v-model="search"
                        placeholder="Search login or name..."
                        @keyup.enter="page = 1; loadAccounts()"
                    />

                    <Select
                        v-model="status"
                        :options="['ALL', 'ACTIVE', 'DISABLED', 'LOCKED']"
                        @change="page = 1; loadAccounts()"
                    />

                    <Button
                        label="Apply"
                        icon="pi pi-filter"
                        severity="secondary"
                        @click="page = 1; loadAccounts()"
                    />
                </div>

                <DataTable
                    :value="items"
                    :loading="loading"
                    lazy
                    paginator
                    striped-rows
                    responsive-layout="scroll"
                    :rows="limit"
                    :total-records="total"
                    :rows-per-page-options="[10, 20, 50, 100]"
                    @page="onPage"
                >
                    <Column field="loginId" header="Login ID" />
                    <Column field="displayName" header="Display Name" />

                    <Column header="Role assignments" style="min-width: 24rem">
                        <template #body="{ data }">
                            {{ assignmentSummary(data) }}
                        </template>
                    </Column>

                    <Column header="Status">
                        <template #body="{ data }">
                            <Tag
                                :value="data.status"
                                :severity="
                                    data.status === 'ACTIVE'
                                        ? 'success'
                                        : data.status === 'LOCKED'
                                          ? 'warn'
                                          : 'danger'
                                "
                            />
                        </template>
                    </Column>

                    <Column header="Actions" frozen align-frozen="right">
                        <template #body="{ data }">
                            <div class="actions">
                                <Button
                                    v-if="canUpdate"
                                    icon="pi pi-pencil"
                                    text
                                    rounded
                                    @click="openEdit(data)"
                                />

                                <Button
                                    v-if="canReset"
                                    icon="pi pi-key"
                                    text
                                    rounded
                                    severity="warn"
                                    @click="
                                        resetTarget = data;
                                        newPassword = '';
                                        resetDialogVisible = true
                                    "
                                />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </template>
        </Card>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            :header="editing ? 'Edit Account' : 'Create Account'"
            class="account-dialog"
            :style="{ width: 'min(920px, 96vw)' }"
        >
            <div class="form-grid">
                <label>
                    Login ID
                    <InputText v-model="form.loginId" />
                </label>

                <label>
                    Display Name
                    <InputText v-model="form.displayName" />
                </label>

                <label v-if="!editing">
                    Initial Password
                    <Password
                        v-model="form.password"
                        toggle-mask
                        :feedback="false"
                    />
                </label>

                <label>
                    Status
                    <Select
                        v-model="form.status"
                        :options="['ACTIVE', 'DISABLED', 'LOCKED']"
                    />
                </label>
            </div>

            <div class="assignment-header">
                <div>
                    <strong>Role assignments</strong>
                    <small>
                        GLOBAL roles cover all companies. COMPANY roles require
                        company and branch scope.
                    </small>
                </div>

                <Button
                    icon="pi pi-plus"
                    label="Add Role"
                    size="small"
                    :disabled="loadingLookups"
                    @click="addAssignment"
                />
            </div>

            <div v-if="!form.assignments.length" class="empty-assignments">
                No role assigned.
            </div>

            <div
                v-for="(assignment, index) in form.assignments"
                :key="index"
                class="assignment-card"
            >
                <div class="assignment-grid">
                    <label>
                        Role
                        <Select
                            v-model="assignment.roleId"
                            :options="roleOptions"
                            option-label="label"
                            option-value="value"
                            filter
                            placeholder="Select role"
                            @change="onRoleChange(assignment)"
                        />
                    </label>

                    <template v-if="getRole(assignment.roleId)?.scope === 'COMPANY'">
                        <label>
                            Company
                            <Select
                                v-model="assignment.companyId"
                                :options="companyOptions"
                                option-label="label"
                                option-value="value"
                                filter
                                placeholder="Select company"
                                @change="onCompanyChange(assignment)"
                            />
                        </label>

                        <label class="checkbox-field">
                            <Checkbox
                                v-model="assignment.allBranches"
                                binary
                                @change="onAllBranchesChange(assignment)"
                            />
                            <span>All branches in this company</span>
                        </label>

                        <label v-if="!assignment.allBranches">
                            Branches
                            <MultiSelect
                                v-model="assignment.branchIds"
                                :options="getBranchOptions(assignment)"
                                option-label="label"
                                option-value="value"
                                filter
                                display="chip"
                                placeholder="Select branches"
                            />
                        </label>
                    </template>

                    <div v-else-if="assignment.roleId" class="global-scope-note">
                        <i class="pi pi-globe" />
                        This role has global company scope.
                    </div>
                </div>

                <Button
                    icon="pi pi-trash"
                    severity="danger"
                    text
                    rounded
                    aria-label="Remove assignment"
                    @click="removeAssignment(index)"
                />
            </div>

            <template #footer>
                <Button
                    label="Cancel"
                    text
                    severity="secondary"
                    @click="dialogVisible = false"
                />

                <Button
                    label="Save"
                    :loading="saving"
                    @click="saveAccount"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="resetDialogVisible"
            modal
            header="Reset Password"
            :style="{ width: '30rem', maxWidth: '94vw' }"
        >
            <label class="password-field">
                New password for {{ resetTarget?.displayName }}
                <Password v-model="newPassword" toggle-mask />
            </label>

            <template #footer>
                <Button
                    label="Cancel"
                    text
                    @click="resetDialogVisible = false"
                />

                <Button
                    label="Reset Password"
                    severity="warn"
                    :disabled="newPassword.length < 8"
                    @click="resetPassword"
                />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.access-page {
    padding: 1rem;
}

.page-head,
.filters,
.actions,
.assignment-header,
.assignment-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.page-head,
.assignment-header {
    justify-content: space-between;
}

.page-head h2 {
    margin: 0;
}

.page-head p,
.assignment-header small {
    display: block;
    margin: 0.25rem 0 0;
    color: var(--p-text-muted-color);
    font-size: 0.82rem;
}

.filters {
    margin-bottom: 1rem;
    flex-wrap: wrap;
}

.actions {
    justify-content: center;
}

.form-grid,
.assignment-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
}

.form-grid label,
.assignment-grid label,
.password-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.82rem;
    font-weight: 600;
}

.assignment-header {
    margin: 1.25rem 0 0.75rem;
}

.assignment-card {
    align-items: flex-start;
    padding: 0.9rem;
    margin-bottom: 0.75rem;
    border: 1px solid var(--p-content-border-color);
    border-radius: 0.75rem;
    background: var(--p-content-background);
}

.assignment-grid {
    flex: 1;
}

.checkbox-field {
    flex-direction: row !important;
    align-items: center;
    align-self: end;
    min-height: 2.5rem;
}

.global-scope-note {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    align-self: end;
    min-height: 2.5rem;
    color: var(--p-primary-color);
    font-size: 0.84rem;
    font-weight: 600;
}

.empty-assignments {
    padding: 1rem;
    border: 1px dashed var(--p-content-border-color);
    border-radius: 0.75rem;
    text-align: center;
    color: var(--p-text-muted-color);
}

@media (max-width: 700px) {
    .page-head,
    .assignment-header {
        align-items: flex-start;
        flex-direction: column;
    }

    .form-grid,
    .assignment-grid {
        grid-template-columns: 1fr;
    }
}
</style>
