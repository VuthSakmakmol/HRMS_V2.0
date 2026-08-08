<script setup>
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
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
import {
    EXIT_REASON_PERMISSIONS,
    exitReasonColumns,
    statusOptions,
} from "../config/exitReason.config.js"
import { useExitReasonStore } from "../stores/exitReason.store.js"

const toast = useToast()
const { t } = useI18n()
const auth = useAuthStore()
const workspace = useWorkspaceStore()
const store = useExitReasonStore()

const query = reactive({
    page: 1,
    limit: 10,
    search: "",
    status: "ALL",
})

const errors = ref({})
const formVisible = ref(false)
const archiveVisible = ref(false)
const mode = ref("create")
const selectedId = ref("")
const archiveCandidate = ref(null)
const submitLocked = ref(false)
let searchTimer

const form = reactive(emptyForm())

const pagination = computed(() => store.pagination)
const activeFilterCount = computed(
    () => Number(Boolean(query.search.trim())) + Number(query.status !== "ALL"),
)
const hasWorkspaceScope = computed(
    () => Boolean(workspace.companyId && workspace.branchId),
)
const companyName = computed(
    () =>
        workspace.selectedCompany?.displayName ||
        workspace.selectedCompany?.legalName ||
        workspace.selectedCompany?.code ||
        "—",
)
const branchName = computed(
    () => workspace.selectedBranch?.name || workspace.selectedBranch?.code || "—",
)

function emptyForm() {
    return {
        companyId: "",
        branchId: "",
        code: "",
        name: "",
        description: "",
        status: "ACTIVE",
    }
}

function rowId(row) {
    return row?.id || row?._id || ""
}

function translateKey(value) {
    if (!value) return ""
    const translated = t(value)
    return translated === value ? "" : translated
}

function errorMessage(error) {
    const translated = translateKey(error?.messageKey)
    if (translated) return translated

    const codeMessages = {
        EXIT_REASON_CODE_EXISTS: "errors.organization.exitReason.codeExists",
        EXIT_REASON_NOT_FOUND: "errors.organization.exitReason.notFound",
        EXIT_REASON_ARCHIVED: "errors.organization.exitReason.archived",
        EXIT_REASON_SCOPE_REQUIRED: "errors.organization.exitReason.scopeRequired",
        EXIT_REASON_SCOPE_FORBIDDEN: "errors.authorization.insufficientScope",
        EXIT_REASON_COMPANY_NOT_FOUND: "errors.organization.exitReason.companyNotFound",
        EXIT_REASON_BRANCH_NOT_FOUND: "errors.organization.exitReason.branchNotFound",
    }

    const codeKey = codeMessages[error?.code]
    const codeMessage = translateKey(codeKey)
    if (codeMessage) return codeMessage

    return error?.message || t("errors.requestFailed")
}

function applyFieldErrors(fieldErrors = {}) {
    errors.value = Object.fromEntries(
        Object.entries(fieldErrors).filter(([, value]) => value?.length),
    )
}

async function load(overrides = {}) {
    if (!workspace.ready) return

    Object.assign(query, overrides)

    try {
        await store.loadExitReasons({
            ...query,
            companyId: workspace.companyId,
            branchId: workspace.branchId,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("exitReason.loadFailed"),
            detail: errorMessage(error),
            life: 4500,
        })
    }
}

function delayedSearch() {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => load({ page: 1 }), 350)
}

function clearFilters() {
    query.search = ""
    query.status = "ALL"
    load({ page: 1 })
}

function normalizeCode() {
    form.code = String(form.code || "")
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_-]/g, "")
}

function clearError(field) {
    if (!errors.value[field]) return

    const next = { ...errors.value }
    delete next[field]
    errors.value = next
}

function requireWorkspace() {
    if (hasWorkspaceScope.value) return true

    toast.add({
        severity: "warn",
        summary: t("exitReason.workspaceRequiredTitle"),
        detail: t("errors.organization.exitReason.scopeRequired"),
        life: 4000,
    })

    return false
}

function openCreate() {
    if (!requireWorkspace()) return

    mode.value = "create"
    selectedId.value = ""
    errors.value = {}

    Object.assign(form, emptyForm(), {
        companyId: workspace.companyId,
        branchId: workspace.branchId,
    })

    formVisible.value = true
}

async function openEdit(row) {
    const id = rowId(row)
    if (!id || store.detailLoading) return

    errors.value = {}

    try {
        const current = await store.loadExitReasonById(id)

        mode.value = "edit"
        selectedId.value = id
        Object.assign(form, emptyForm(), {
            ...current,
            companyId: current.companyId || workspace.companyId,
            branchId: current.branchId || workspace.branchId,
        })
        formVisible.value = true
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("exitReason.loadOneFailed"),
            detail: errorMessage(error),
            life: 4500,
        })
    }
}

async function save() {
    // This lock is intentionally separate from the store loading state.
    // It becomes true synchronously on the first event, so a rapid second
    // click cannot issue a second POST/PATCH before Vue repaints the button.
    if (submitLocked.value || store.saving) return
    if (!requireWorkspace()) return

    submitLocked.value = true
    errors.value = {}

    const operation = mode.value
    const payload = {
        companyId: workspace.companyId,
        branchId: workspace.branchId,
        code: form.code,
        name: form.name,
        description: form.description || "",
        status: form.status,
    }

    try {
        if (operation === "create") {
            await store.createExitReason(payload)
        } else {
            await store.updateExitReason(selectedId.value, payload)
        }

        formVisible.value = false
        toast.add({
            severity: "success",
            summary:
                operation === "create"
                    ? t("exitReason.created")
                    : t("exitReason.updated"),
            life: 2800,
        })

        await load()
    } catch (error) {
        applyFieldErrors(error?.fields || {})

        toast.add({
            severity: "error",
            summary: t("exitReason.saveFailed"),
            detail: errorMessage(error),
            life: 5000,
        })
    } finally {
        submitLocked.value = false
    }
}

function askArchive(row) {
    archiveCandidate.value = row
    archiveVisible.value = true
}

async function archiveReason() {
    if (store.archiving) return

    const id = rowId(archiveCandidate.value)
    if (!id) return

    try {
        await store.archiveExitReason(id)
        archiveVisible.value = false

        toast.add({
            severity: "success",
            summary: t("exitReason.archived"),
            life: 2800,
        })

        await load({
            page:
                store.items.length === 1 && query.page > 1
                    ? query.page - 1
                    : query.page,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("exitReason.archiveFailed"),
            detail: errorMessage(error),
            life: 4500,
        })
    }
}

function rowActions(row) {
    return [
        {
            label: t("common.edit"),
            icon: "pi pi-pencil",
            visible:
                auth.hasPermission(EXIT_REASON_PERMISSIONS.UPDATE) &&
                row.status !== "ARCHIVED",
            command: () => openEdit(row),
        },
        {
            label: t("exitReason.archive"),
            icon: "pi pi-archive",
            visible:
                auth.hasPermission(EXIT_REASON_PERMISSIONS.ARCHIVE) &&
                row.status !== "ARCHIVED",
            command: () => askArchive(row),
        },
    ]
}

function severity(status) {
    if (status === "ACTIVE") return "success"
    if (status === "INACTIVE") return "warn"
    return "danger"
}

function formatDate(value) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
    }).format(date)
}

watch(
    () => workspace.revision,
    () => {
        query.page = 1
        formVisible.value = false
        archiveVisible.value = false
        load()
    },
)

onMounted(() => load())
onBeforeUnmount(() => clearTimeout(searchTimer))
</script>

<template>
    <EnterpriseListPage
        :rows="store.items"
        :columns="exitReasonColumns"
        :loading="store.loading"
        :pagination="pagination"
        row-key="id"
        :empty-title="t('exitReason.empty')"
        :empty-description="t('exitReason.emptyDescription')"
        @retry="load"
        @page-change="load({ page: $event.page, limit: $event.limit })"
    >
        <template #controls>
            <EnterpriseListControls
                :filter-label="t('common.filters')"
                :hide-filter-label="t('common.hideFilters')"
                :active-filter-count="activeFilterCount"
            >
                <template #start>
                    <Button
                        :label="t('common.refresh')"
                        icon="pi pi-refresh"
                        severity="secondary"
                        text
                        :loading="store.loading"
                        @click="load"
                    />
                </template>

                <template #actions>
                    <PermissionButton
                        :permission="EXIT_REASON_PERMISSIONS.CREATE"
                        :label="t('exitReason.create')"
                        icon="pi pi-plus"
                        :disabled="!hasWorkspaceScope"
                        @click="openCreate"
                    />
                </template>

                <template #filters>
                    <EnterpriseFilterBar :loading="store.loading">
                        <EnterpriseFilterField
                            class="exit-search"
                            :label="t('common.search')"
                            search
                        >
                            <span class="exit-search-input">
                                <i class="pi pi-search" />
                                <InputText
                                    v-model="query.search"
                                    :placeholder="t('exitReason.searchPlaceholder')"
                                    @input="delayedSearch"
                                    @keyup.enter="load({ page: 1 })"
                                />
                            </span>
                        </EnterpriseFilterField>

                        <EnterpriseFilterField :label="t('exitReason.status')">
                            <Select
                                v-model="query.status"
                                :options="statusOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </EnterpriseFilterField>

                        <template #actions>
                            <Button
                                :label="t('common.clear')"
                                icon="pi pi-times"
                                severity="secondary"
                                outlined
                                :disabled="!activeFilterCount"
                                @click="clearFilters"
                            />
                            <Button
                                :label="t('common.apply')"
                                icon="pi pi-check"
                                :loading="store.loading"
                                @click="load({ page: 1 })"
                            />
                        </template>
                    </EnterpriseFilterBar>
                </template>
            </EnterpriseListControls>
        </template>

        <template #empty-action>
            <PermissionButton
                :permission="EXIT_REASON_PERMISSIONS.CREATE"
                :label="t('exitReason.create')"
                icon="pi pi-plus"
                :disabled="!hasWorkspaceScope"
                @click="openCreate"
            />
        </template>

        <template #cell-description="{ row }">
            <span
                class="enterprise-table__text"
                :title="row.description || '—'"
            >
                {{ row.description || "—" }}
            </span>
        </template>

        <template #cell-status="{ row }">
            <Tag :value="row.status" :severity="severity(row.status)" />
        </template>

        <template #cell-updatedAt="{ row }">
            <span class="enterprise-table__text">
                {{ formatDate(row.updatedAt) }}
            </span>
        </template>

        <template #actions="{ row }">
            <EnterpriseActionMenu
                :items="rowActions(row)"
                :aria-label="t('exitReason.actions')"
            />
        </template>
    </EnterpriseListPage>

    <ExitReasonFormDialog
        v-model:visible="formVisible"
        :mode="mode"
        :form="form"
        :errors="errors"
        :company-name="companyName"
        :branch-name="branchName"
        :saving="store.saving || submitLocked"
        @normalize-code="normalizeCode"
        @clear-error="clearError"
        @save="save"
    />

    <ExitReasonArchiveDialog
        v-model:visible="archiveVisible"
        :reason="archiveCandidate"
        :busy="store.archiving"
        @confirm="archiveReason"
    />
</template>

<style scoped>
.exit-search {
    min-width: min(20rem, 100%);
    flex: 1 1 22rem;
}

.exit-search-input {
    position: relative;
    display: block;
}

.exit-search-input > i {
    position: absolute;
    z-index: 1;
    top: 50%;
    left: .7rem;
    transform: translateY(-50%);
    color: var(--p-text-muted-color);
    font-size: .75rem;
    pointer-events: none;
}

.exit-search-input :deep(.p-inputtext) {
    width: 100%;
    padding-left: 2rem;
}
</style>
