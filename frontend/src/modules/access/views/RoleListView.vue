<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useToast } from "primevue/usetoast"
import Button from "primevue/button"
import Checkbox from "primevue/checkbox"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputIcon from "primevue/inputicon"
import IconField from "primevue/iconfield"
import InputText from "primevue/inputtext"
import MultiSelect from "primevue/multiselect"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import AppFilterBar from "@/shared/components/filter/AppFilterBar.vue"
import AppModuleToolbar from "@/shared/components/page/AppModuleToolbar.vue"
import AppTableActions from "@/shared/components/table/AppTableActions.vue"
import { useModulePermissions } from "@/shared/auth/useModulePermissions.js"

import {
    createRole,
    deleteRole as removeRole,
    fetchPermissions,
    fetchRoles,
    fetchScopeLookup,
    updateRole,
} from "../services/access.api.js"

const toast = useToast()

const access = useModulePermissions({
    view: "ACCESS.ROLE.VIEW",
    create: "ACCESS.ROLE.CREATE",
    update: "ACCESS.ROLE.UPDATE",
    delete: "ACCESS.ROLE.DELETE",
})

const loading = ref(false)
const saving = ref(false)
const loadingPermissions = ref(false)
const items = ref([])
const permissions = ref([])
const companies = ref([])
const branches = ref([])
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const search = ref("")
const status = ref("ALL")
const dialogVisible = ref(false)
const editing = ref(null)
const confirmDeleteVisible = ref(false)
const deleteCandidate = ref(null)
const permissionSearch = ref("")

const form = reactive({
    code: "",
    name: "",
    description: "",
    scope: "COMPANY",
    companyId: null,
    branchIds: [],
    permissionIds: [],
    isActive: true,
})

const statusOptions = Object.freeze([
    { label: "All statuses", value: "ALL" },
    { label: "Active", value: "ACTIVE" },
    { label: "Inactive", value: "INACTIVE" },
])

const scopeOptions = Object.freeze([
    { label: "Global", value: "GLOBAL" },
    { label: "Company", value: "COMPANY" },
    { label: "Branch", value: "BRANCH" },
])

const companyOptions = computed(() => [
    { label: "Select company", value: null },
    ...companies.value.map((company) => ({
        label: company.displayName || company.name || company.code,
        value: company.id,
    })),
])


const branchOptions = computed(() => {
    if (!form.companyId) {
        return []
    }

    return branches.value
        .filter(
            (branch) =>
                normalizeObjectId(branch.companyId) === form.companyId,
        )
        .map((branch) => ({
            label: [branch.code, branch.name].filter(Boolean).join(" - "),
            value: branch.id,
        }))
})

const filteredPermissions = computed(() => {
    const query = permissionSearch.value.trim().toLowerCase()

    if (!query) {
        return permissions.value
    }

    return permissions.value.filter((permission) =>
        [
            permission.code,
            permission.module,
            permission.action,
            permission.name,
            permission.description,
        ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query)),
    )
})

const permissionGroups = computed(() => {
    const groups = new Map()

    for (const permission of filteredPermissions.value) {
        const moduleName = permission.module || "OTHER"

        if (!groups.has(moduleName)) {
            groups.set(moduleName, [])
        }

        groups.get(moduleName).push(permission)
    }

    return [...groups.entries()]
        .map(([moduleName, groupPermissions]) => ({
            module: moduleName,
            label: formatModuleLabel(moduleName),
            permissions: [...groupPermissions].sort((a, b) =>
                String(a.action).localeCompare(String(b.action)),
            ),
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
})

const selectedPermissionCount = computed(() => form.permissionIds.length)
const allVisiblePermissionIds = computed(() =>
    filteredPermissions.value.map((permission) => permission.id),
)
const allVisibleSelected = computed(() => {
    const visibleIds = allVisiblePermissionIds.value

    return (
        visibleIds.length > 0 &&
        visibleIds.every((permissionId) =>
            form.permissionIds.includes(permissionId),
        )
    )
})

const canShowActions = computed(
    () => access.canUpdate.value || access.canDelete.value,
)

function normalizeObjectId(value) {
    if (!value) {
        return null
    }

    if (typeof value === "string") {
        return value
    }

    if (typeof value === "object") {
        return normalizeObjectId(value.id || value._id)
    }

    return null
}

function normalizePermissionIds(values = []) {
    return [
        ...new Set(
            values
                .map((value) => normalizeObjectId(value))
                .filter(Boolean),
        ),
    ]
}

function formatModuleLabel(moduleName) {
    return String(moduleName || "")
        .split(".")
        .map((segment) =>
            segment
                .toLowerCase()
                .replace(/(^|_)(\w)/g, (_, prefix, character) =>
                    `${prefix ? " " : ""}${character.toUpperCase()}`,
                ),
        )
        .join(" / ")
}

function formatActionLabel(action) {
    return String(action || "")
        .toLowerCase()
        .replace(/(^|_)(\w)/g, (_, prefix, character) =>
            `${prefix ? " " : ""}${character.toUpperCase()}`,
        )
}

function resetForm() {
    Object.assign(form, {
        code: "",
        name: "",
        description: "",
        scope: "COMPANY",
        companyId: null,
        branchIds: [],
        permissionIds: [],
        isActive: true,
    })

    permissionSearch.value = ""
}

async function loadRoles() {
    if (!access.assert("view")) {
        return
    }

    loading.value = true

    try {
        const response = await fetchRoles({
            page: page.value,
            limit: limit.value,
            search: search.value.trim(),
            status: status.value,
        })

        items.value = response.items || []
        total.value = response.pagination?.total || 0
    } catch (error) {
        showError("Unable to load roles", error)
    } finally {
        loading.value = false
    }
}

async function loadLookups() {
    loadingPermissions.value = true

    try {
        const [permissionResponse, scopeResponse] = await Promise.all([
            fetchPermissions(),
            fetchScopeLookup(),
        ])

        permissions.value = permissionResponse.items || []
        companies.value = scopeResponse.companies || []
        branches.value = scopeResponse.branches || []
    } catch (error) {
        showError("Unable to load role options", error)
    } finally {
        loadingPermissions.value = false
    }
}

function applyFilters() {
    page.value = 1
    loadRoles()
}

function clearFilters() {
    search.value = ""
    status.value = "ALL"
    page.value = 1
    loadRoles()
}

function openCreate() {
    if (!access.assert("create")) {
        return
    }

    editing.value = null
    resetForm()
    dialogVisible.value = true
}

function openEdit(role) {
    if (!access.assert("update")) {
        return
    }

    editing.value = role

    Object.assign(form, {
        code: role.code || "",
        name: role.name || "",
        description: role.description || "",
        scope: role.scope || "COMPANY",
        companyId: normalizeObjectId(role.companyId),
        branchIds: normalizePermissionIds(role.branchIds),
        permissionIds: normalizePermissionIds(role.permissionIds),
        isActive: Boolean(role.isActive),
    })

    permissionSearch.value = ""
    dialogVisible.value = true
}

function validateForm() {
    if (!form.code.trim()) {
        toast.add({
            severity: "warn",
            summary: "Code is required",
            life: 3000,
        })
        return false
    }

    if (!form.name.trim()) {
        toast.add({
            severity: "warn",
            summary: "Role name is required",
            life: 3000,
        })
        return false
    }

    if (["COMPANY", "BRANCH"].includes(form.scope) && !form.companyId) {
        toast.add({
            severity: "warn",
            summary: "Company is required for this role scope",
            life: 3500,
        })
        return false
    }

    if (form.scope === "BRANCH" && form.branchIds.length === 0) {
        toast.add({
            severity: "warn",
            summary: "Select at least one branch",
            life: 3500,
        })
        return false
    }

    return true
}

async function saveRole() {
    const action = editing.value ? "update" : "create"

    if (!access.assert(action) || !validateForm()) {
        return
    }

    saving.value = true

    try {
        const payload = {
            code: form.code.trim(),
            name: form.name.trim(),
            description: form.description.trim(),
            scope: form.scope,
            companyId: form.scope === "GLOBAL" ? null : form.companyId,
            branchIds:
                form.scope === "BRANCH"
                    ? normalizePermissionIds(form.branchIds)
                    : [],
            permissionIds: normalizePermissionIds(form.permissionIds),
            isActive: form.isActive,
        }

        if (editing.value) {
            await updateRole(editing.value.id, payload)
        } else {
            await createRole(payload)
        }

        dialogVisible.value = false
        toast.add({
            severity: "success",
            summary: editing.value ? "Role updated" : "Role created",
            life: 2500,
        })

        await loadRoles()
    } catch (error) {
        showError("Unable to save role", error)
    } finally {
        saving.value = false
    }
}

function askDelete(role) {
    if (!access.assert("delete") || role.isSystem) {
        return
    }

    deleteCandidate.value = role
    confirmDeleteVisible.value = true
}

async function deleteRole() {
    if (!access.assert("delete") || !deleteCandidate.value) {
        return
    }

    try {
        await removeRole(deleteCandidate.value.id)
        confirmDeleteVisible.value = false
        deleteCandidate.value = null

        toast.add({
            severity: "success",
            summary: "Role deleted",
            life: 2500,
        })

        if (items.value.length === 1 && page.value > 1) {
            page.value -= 1
        }

        await loadRoles()
    } catch (error) {
        showError("Unable to delete role", error)
    }
}

function isGroupSelected(group) {
    return group.permissions.every((permission) =>
        form.permissionIds.includes(permission.id),
    )
}

function togglePermissionGroup(group) {
    const groupIds = group.permissions.map((permission) => permission.id)
    const nextIds = new Set(form.permissionIds)

    if (isGroupSelected(group)) {
        groupIds.forEach((permissionId) => nextIds.delete(permissionId))
    } else {
        groupIds.forEach((permissionId) => nextIds.add(permissionId))
    }

    form.permissionIds = [...nextIds]
}

function toggleAllVisiblePermissions() {
    const nextIds = new Set(form.permissionIds)

    if (allVisibleSelected.value) {
        allVisiblePermissionIds.value.forEach((permissionId) =>
            nextIds.delete(permissionId),
        )
    } else {
        allVisiblePermissionIds.value.forEach((permissionId) =>
            nextIds.add(permissionId),
        )
    }

    form.permissionIds = [...nextIds]
}

function onScopeChange() {
    if (form.scope === "GLOBAL") {
        form.companyId = null
        form.branchIds = []
        return
    }

    if (form.scope === "COMPANY") {
        form.branchIds = []
    }
}

function onCompanyChange() {
    form.branchIds = []
}

function onPage(event) {
    page.value = event.page + 1
    limit.value = event.rows
    loadRoles()
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
    await Promise.all([loadLookups(), loadRoles()])
})
</script>

<template>
    <div class="role-page hrms-compact">
        <AppModuleToolbar>
            <Button
                v-if="access.canCreate.value"
                icon="pi pi-plus"
                label="New Role"
                @click="openCreate"
            />
        </AppModuleToolbar>

        <AppFilterBar :loading="loading">
            <div class="app-filter-field app-filter-field--search">
                <IconField>
                    <InputIcon class="pi pi-search" />
                    <InputText
                        v-model="search"
                        placeholder="Search code, role or description..."
                        @keyup.enter="applyFilters"
                    />
                </IconField>
            </div>

            <div class="app-filter-field role-status-filter">
                <Select
                    v-model="status"
                    :options="statusOptions"
                    option-label="label"
                    option-value="value"
                    aria-label="Role status"
                    @change="applyFilters"
                />
            </div>

            <template #actions>
                <Button
                    icon="pi pi-filter"
                    label="Apply"
                    :loading="loading"
                    @click="applyFilters"
                />

                <Button
                    icon="pi pi-times"
                    label="Clear"
                    severity="secondary"
                    outlined
                    :disabled="loading"
                    @click="clearFilters"
                />

                <Button
                    v-tooltip.top="'Refresh'"
                    class="hrms-icon-button"
                    icon="pi pi-refresh"
                    severity="secondary"
                    outlined
                    aria-label="Refresh roles"
                    :loading="loading"
                    @click="loadRoles"
                />
            </template>
        </AppFilterBar>

        <section class="role-table-card hrms-card">
            <DataTable
                class="role-table"
                :value="items"
                :loading="loading"
                lazy
                paginator
                striped-rows
                responsive-layout="scroll"
                :rows="limit"
                :first="(page - 1) * limit"
                :total-records="total"
                :rows-per-page-options="[10, 20, 50, 100]"
                paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                current-page-report-template="{first}–{last} of {totalRecords}"
                @page="onPage"
            >
                <template #empty>
                    <div class="role-empty-state">
                        <i class="pi pi-shield" />
                        <span>No roles found.</span>
                    </div>
                </template>

                <Column
                    field="code"
                    header="Code"
                    style="min-width: 9rem"
                >
                    <template #body="{ data }">
                        <span class="role-code">{{ data.code }}</span>
                    </template>
                </Column>

                <Column
                    field="name"
                    header="Role"
                    style="min-width: 13rem"
                >
                    <template #body="{ data }">
                        <div class="role-name-cell">
                            <strong>{{ data.name }}</strong>
                            <small v-if="data.isSystem">System protected</small>
                        </div>
                    </template>
                </Column>

                <Column
                    header="Scope"
                    style="min-width: 9rem"
                >
                    <template #body="{ data }">
                        <div class="role-scope-cell">
                            <Tag
                                :value="data.scope"
                                :severity="data.scope === 'GLOBAL' ? 'info' : 'secondary'"
                            />
                            <small v-if="data.scope !== 'GLOBAL'">
                                {{ data.companyId?.displayName || data.companyId?.code || "No company" }}
                            </small>
                            <small v-if="data.scope === 'BRANCH'">
                                {{ data.branchIds?.length || 0 }} branch(es)
                            </small>
                        </div>
                    </template>
                </Column>

                <Column
                    header="Permissions"
                    style="min-width: 8rem"
                >
                    <template #body="{ data }">
                        <span class="permission-count">
                            {{ data.permissionIds?.length || 0 }}
                        </span>
                    </template>
                </Column>

                <Column
                    header="Status"
                    style="min-width: 8rem"
                >
                    <template #body="{ data }">
                        <Tag
                            :value="data.isActive ? 'Active' : 'Inactive'"
                            :severity="data.isActive ? 'success' : 'danger'"
                        />
                    </template>
                </Column>

                <Column
                    v-if="canShowActions"
                    header="Actions"
                    frozen
                    align-frozen="right"
                    style="width: 7rem"
                >
                    <template #body="{ data }">
                        <AppTableActions
                            :can-edit="access.canUpdate.value"
                            :can-delete="access.canDelete.value && !data.isSystem"
                            @edit="openEdit(data)"
                            @delete="askDelete(data)"
                        />
                    </template>
                </Column>
            </DataTable>
        </section>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            maximizable
            :header="editing ? 'Edit Role' : 'Create Role'"
            class="role-dialog"
            :draggable="false"
        >
            <div class="role-form">
                <section class="role-form-section">
                    <div class="role-form-grid">
                        <label class="role-field">
                            <span>Code <b>*</b></span>
                            <InputText
                                v-model="form.code"
                                :disabled="editing?.isSystem"
                                placeholder="Example: HR_MANAGER"
                            />
                        </label>

                        <label class="role-field">
                            <span>Role name <b>*</b></span>
                            <InputText
                                v-model="form.name"
                                placeholder="Example: HR Manager"
                            />
                        </label>

                        <label class="role-field">
                            <span>Scope <b>*</b></span>
                            <Select
                                v-model="form.scope"
                                :options="scopeOptions"
                                option-label="label"
                                option-value="value"
                                :disabled="editing?.isSystem"
                                @change="onScopeChange"
                            />
                        </label>

                        <label
                            v-if="form.scope !== 'GLOBAL'"
                            class="role-field"
                        >
                            <span>Company <b>*</b></span>
                            <Select
                                v-model="form.companyId"
                                :options="companyOptions"
                                option-label="label"
                                option-value="value"
                                filter
                                :disabled="editing?.isSystem"
                                placeholder="Select company"
                                @change="onCompanyChange"
                            />
                        </label>

                        <label
                            v-if="form.scope === 'BRANCH'"
                            class="role-field role-field--wide"
                        >
                            <span>Branches <b>*</b></span>
                            <MultiSelect
                                v-model="form.branchIds"
                                :options="branchOptions"
                                option-label="label"
                                option-value="value"
                                filter
                                display="chip"
                                :disabled="editing?.isSystem || !form.companyId"
                                placeholder="Select one or more branches"
                            />
                        </label>

                        <label class="role-field role-field--wide">
                            <span>Description</span>
                            <Textarea
                                v-model="form.description"
                                rows="2"
                                auto-resize
                                placeholder="Describe who should use this role..."
                            />
                        </label>

                        <label class="role-active-field">
                            <Checkbox
                                v-model="form.isActive"
                                binary
                                input-id="role-active"
                            />
                            <span for="role-active">Active role</span>
                        </label>
                    </div>
                </section>

                <section class="permission-section">
                    <div class="permission-toolbar">
                        <div>
                            <strong>Permissions</strong>
                            <small>
                                {{ selectedPermissionCount }} selected
                            </small>
                        </div>

                        <div class="permission-toolbar__actions">
                            <IconField class="permission-search">
                                <InputIcon class="pi pi-search" />
                                <InputText
                                    v-model="permissionSearch"
                                    placeholder="Search permissions..."
                                />
                            </IconField>

                            <Button
                                :label="allVisibleSelected ? 'Clear visible' : 'Select visible'"
                                :icon="allVisibleSelected ? 'pi pi-times' : 'pi pi-check-square'"
                                severity="secondary"
                                outlined
                                :disabled="loadingPermissions || !filteredPermissions.length"
                                @click="toggleAllVisiblePermissions"
                            />
                        </div>
                    </div>

                    <div
                        v-if="loadingPermissions"
                        class="permission-loading"
                    >
                        <i class="pi pi-spin pi-spinner" />
                        Loading permissions...
                    </div>

                    <div
                        v-else-if="permissionGroups.length"
                        class="permission-groups"
                    >
                        <section
                            v-for="group in permissionGroups"
                            :key="group.module"
                            class="permission-group"
                        >
                            <button
                                type="button"
                                class="permission-group__header"
                                @click="togglePermissionGroup(group)"
                            >
                                <span>
                                    <Checkbox
                                        :model-value="isGroupSelected(group)"
                                        binary
                                        readonly
                                    />
                                    <strong>{{ group.label }}</strong>
                                </span>
                                <small>
                                    {{ group.permissions.filter((permission) => form.permissionIds.includes(permission.id)).length }}/{{ group.permissions.length }}
                                </small>
                            </button>

                            <div class="permission-group__items">
                                <label
                                    v-for="permission in group.permissions"
                                    :key="permission.id"
                                    class="permission-item"
                                >
                                    <Checkbox
                                        v-model="form.permissionIds"
                                        :input-id="`permission-${permission.id}`"
                                        :value="permission.id"
                                    />
                                    <span>
                                        <strong>{{ formatActionLabel(permission.action) }}</strong>
                                        <small>{{ permission.code }}</small>
                                    </span>
                                </label>
                            </div>
                        </section>
                    </div>

                    <div
                        v-else
                        class="permission-empty"
                    >
                        No permissions match your search.
                    </div>
                </section>
            </div>

            <template #footer>
                <Button
                    label="Cancel"
                    severity="secondary"
                    outlined
                    :disabled="saving"
                    @click="dialogVisible = false"
                />
                <Button
                    label="Save Role"
                    icon="pi pi-check"
                    :loading="saving"
                    @click="saveRole"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="confirmDeleteVisible"
            modal
            header="Delete Role"
            class="role-delete-dialog"
            :draggable="false"
        >
            <p>
                Delete <strong>{{ deleteCandidate?.name }}</strong>?
                A role assigned to an account cannot be deleted.
            </p>

            <template #footer>
                <Button
                    label="Cancel"
                    severity="secondary"
                    outlined
                    @click="confirmDeleteVisible = false"
                />
                <Button
                    label="Delete"
                    icon="pi pi-trash"
                    severity="danger"
                    @click="deleteRole"
                />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.role-page {
    min-width: 0;
}

.role-status-filter {
    flex: 0 1 11rem;
}

.role-table-card {
    min-width: 0;
    overflow: hidden;
}

.role-table :deep(.p-datatable-thead > tr > th),
.role-table :deep(.p-datatable-tbody > tr > td) {
    text-align: center;
    vertical-align: middle;
}

.role-table :deep(.p-datatable-column-header-content) {
    justify-content: center;
}

.role-name-cell,
.role-scope-cell {
    display: grid;
    justify-items: center;
    gap: 0.1rem;
    text-align: center;
}

.role-name-cell small,
.role-scope-cell small {
    color: var(--hrms-text-muted);
    font-size: 0.68rem;
}

.role-code {
    color: var(--p-primary-color);
    font-weight: 700;
}

.permission-count {
    display: inline-grid;
    place-items: center;
    min-width: 1.75rem;
    height: 1.5rem;
    padding: 0 0.45rem;
    border-radius: 999px;
    background: var(--p-primary-50);
    color: var(--p-primary-700);
    font-size: 0.72rem;
    font-weight: 700;
}

.role-empty-state {
    display: grid;
    place-items: center;
    gap: 0.45rem;
    min-height: 10rem;
    color: var(--hrms-text-muted);
}

.role-empty-state i {
    font-size: 1.5rem;
}

.role-form {
    display: grid;
    gap: 0.75rem;
}

.role-form-section,
.permission-section {
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
    background: var(--hrms-surface);
}

.role-form-section {
    padding: 0.75rem;
}

.role-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
}

.role-field {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
    color: var(--hrms-text);
    font-size: var(--hrms-label-font-size);
    font-weight: 600;
}

.role-field > span b {
    color: var(--hrms-danger);
}

.role-field--wide {
    grid-column: 1 / -1;
}

.role-active-field {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    width: max-content;
    font-size: var(--hrms-label-font-size);
    font-weight: 600;
}

.permission-section {
    min-height: 18rem;
    overflow: hidden;
}

.permission-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    padding: 0.65rem 0.75rem;
    border-bottom: 1px solid var(--hrms-border);
}

.permission-toolbar > div:first-child {
    display: grid;
    gap: 0.08rem;
}

.permission-toolbar small {
    color: var(--hrms-text-muted);
    font-size: 0.68rem;
}

.permission-toolbar__actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.permission-search {
    width: min(18rem, 40vw);
}

.permission-groups {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
    max-height: 48vh;
    padding: 0.65rem;
    overflow-y: auto;
}

.permission-group {
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-sm);
}

.permission-group__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    min-height: 2.2rem;
    padding: 0.35rem 0.55rem;
    border: 0;
    border-bottom: 1px solid var(--hrms-border);
    background: var(--hrms-surface-soft);
    color: var(--hrms-text);
    cursor: pointer;
    text-align: left;
}

.permission-group__header > span {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
}

.permission-group__header strong {
    overflow: hidden;
    font-size: 0.73rem;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.permission-group__header small {
    flex: 0 0 auto;
    color: var(--hrms-text-muted);
    font-size: 0.66rem;
}

.permission-group__items {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.2rem;
    padding: 0.4rem;
}

.permission-item {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    min-width: 0;
    padding: 0.35rem;
    border-radius: 0.3rem;
    cursor: pointer;
}

.permission-item:hover {
    background: var(--hrms-surface-soft);
}

.permission-item > span {
    display: grid;
    min-width: 0;
}

.permission-item strong {
    font-size: 0.7rem;
    font-weight: 600;
}

.permission-item small {
    overflow: hidden;
    color: var(--hrms-text-muted);
    font-size: 0.6rem;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.permission-loading,
.permission-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 12rem;
    color: var(--hrms-text-muted);
    font-size: 0.75rem;
}

:deep(.role-dialog) {
    width: min(980px, 96vw);
}

:deep(.role-delete-dialog) {
    width: min(28rem, 94vw);
}

:deep(.role-dialog .p-dialog-content) {
    padding: 0.75rem;
}

:deep(.role-dialog .p-dialog-footer) {
    padding: 0.65rem 0.75rem;
    border-top: 1px solid var(--hrms-border);
}

@media (max-width: 760px) {
    .role-form-grid,
    .permission-groups {
        grid-template-columns: minmax(0, 1fr);
    }

    .permission-toolbar {
        align-items: stretch;
        flex-direction: column;
    }

    .permission-toolbar__actions,
    .permission-search {
        width: 100%;
    }

    .permission-search {
        flex: 1 1 auto;
    }
}

@media (max-width: 520px) {
    .permission-toolbar__actions {
        align-items: stretch;
        flex-direction: column;
    }

    .permission-group__items {
        grid-template-columns: minmax(0, 1fr);
    }

    :deep(.role-dialog) {
        width: 100vw;
        max-height: 100dvh;
        margin: 0;
        border-radius: 0;
    }
}
</style>
