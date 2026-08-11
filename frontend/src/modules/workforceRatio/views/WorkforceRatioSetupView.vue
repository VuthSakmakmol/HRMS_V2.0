<script setup>
import Button from "primevue/button"
import Tag from "primevue/tag"
import { computed, onMounted, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import EnterpriseConfirmDialog from "@/shared/components/enterprise/EnterpriseConfirmDialog.vue"
import PermissionButton from "@/shared/components/enterprise/PermissionButton.vue"

import WorkforceRatioFormDialog from "../components/WorkforceRatioFormDialog.vue"
import { WORKFORCE_RATIO_PERMISSIONS } from "../config/workforceRatio.config.js"
import { useWorkforceRatioStore } from "../stores/workforceRatio.store.js"

const { t, te } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const workspace = useWorkspaceStore()
const store = useWorkforceRatioStore()

const dialogVisible = ref(false)
const archiveVisible = ref(false)
const editing = ref(false)
const errors = ref({})

const form = reactive(emptyForm())

const setup = computed(() => store.setup)
const hasScope = computed(() => Boolean(workspace.companyId && workspace.branchId))
const companyName = computed(() =>
    workspace.selectedCompany?.displayName ||
    workspace.selectedCompany?.legalName ||
    workspace.selectedCompany?.code ||
    "—",
)
const branchName = computed(() =>
    workspace.selectedBranch?.name || workspace.selectedBranch?.code || "—",
)

const canCreate = computed(() => auth.hasPermission(WORKFORCE_RATIO_PERMISSIONS.CREATE))
const canArchive = computed(() => auth.hasPermission(WORKFORCE_RATIO_PERMISSIONS.ARCHIVE))

function emptyForm() {
    return {
        directEmployeeTypeIds: [],
        indirectEmployeeTypeIds: [],
        budgetYear: new Date().getFullYear(),
        budgetRatio: null,
        status: "ACTIVE",
    }
}

function statusSeverity(value) {
    if (value === "ACTIVE") return "success"
    if (value === "INACTIVE") return "warn"
    return "secondary"
}

function errorMessage(error) {
    const apiError = error?.response?.data?.error || error
    const key = apiError?.messageKey

    if (key && te(key)) return t(key)

    return apiError?.message || error?.message || t("errors.requestFailed")
}

function applyFieldErrors(error) {
    const fields = error?.response?.data?.error?.fields || error?.fields || {}

    errors.value = Object.fromEntries(
        Object.entries(fields)
            .filter(([, value]) => value?.length)
            .map(([field, value]) => [
                field,
                (Array.isArray(value) ? value : [value]).map((message) =>
                    te(message) ? t(message) : message,
                ),
            ]),
    )
}

function clearError(field) {
    if (!errors.value[field]) return

    const next = { ...errors.value }
    delete next[field]
    errors.value = next
}

async function load() {
    if (!hasScope.value) {
        store.clear()
        return
    }

    try {
        await Promise.all([
            store.loadCurrent({
                companyId: workspace.companyId,
                branchId: workspace.branchId,
            }),
            store.loadEmployeeTypes({
                companyId: workspace.companyId,
                branchId: workspace.branchId,
            }),
        ])
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("workforceRatio.loadFailed"),
            detail: errorMessage(error),
            life: 4500,
        })
    }
}

function openCreate() {
    if (!hasScope.value) return

    editing.value = false
    errors.value = {}
    Object.assign(form, emptyForm())
    dialogVisible.value = true
}

function openEdit() {
    if (!setup.value) return

    editing.value = true
    errors.value = {}
    Object.assign(form, emptyForm(), {
        directEmployeeTypeIds: [...(setup.value.directEmployeeTypeIds || [])],
        indirectEmployeeTypeIds: [...(setup.value.indirectEmployeeTypeIds || [])],
        budgetYear: Number(setup.value.budgetYear) || new Date().getFullYear(),
        budgetRatio:
            setup.value.budgetRatio !== null &&
            setup.value.budgetRatio !== undefined &&
            Number.isFinite(Number(setup.value.budgetRatio))
                ? Number(setup.value.budgetRatio)
                : null,
        status: setup.value.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    })
    dialogVisible.value = true
}

async function save() {
    errors.value = {}

    const payload = {
        directEmployeeTypeIds: [...form.directEmployeeTypeIds],
        indirectEmployeeTypeIds: [...form.indirectEmployeeTypeIds],
        budgetYear: Number(form.budgetYear),
        budgetRatio: Number(form.budgetRatio),
        status: form.status,
    }

    try {
        if (editing.value && setup.value?.id) {
            await store.updateSetup(setup.value.id, payload)
        } else {
            await store.createSetup({
                companyId: workspace.companyId,
                branchId: workspace.branchId,
                ...payload,
            })
        }

        dialogVisible.value = false
        toast.add({
            severity: "success",
            summary: editing.value ? t("common.updated") : t("common.created"),
            detail: editing.value
                ? t("workforceRatio.updated")
                : t("workforceRatio.created"),
            life: 2800,
        })
    } catch (error) {
        applyFieldErrors(error)
        toast.add({
            severity: "error",
            summary: t("workforceRatio.saveFailed"),
            detail: errorMessage(error),
            life: 4500,
        })
    }
}

async function archive() {
    if (!setup.value?.id) return

    try {
        await store.archiveSetup(setup.value.id)
        archiveVisible.value = false
        toast.add({
            severity: "success",
            summary: t("common.archived"),
            detail: t("workforceRatio.archived"),
            life: 2800,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("workforceRatio.archiveFailed"),
            detail: errorMessage(error),
            life: 4500,
        })
    }
}

watch(
    () => [workspace.companyId, workspace.branchId],
    () => load(),
)

onMounted(load)
</script>

<template>
    <section class="workforce-ratio-page">
        <header class="workforce-ratio-page__header">
            <div>
                <span class="workforce-ratio-page__eyebrow">
                    {{ t("workforceRatio.module") }}
                </span>
                <h1>{{ t("workforceRatio.title") }}</h1>
                <p>{{ t("workforceRatio.description") }}</p>
            </div>

            <div class="workforce-ratio-page__header-actions">
                <PermissionButton
                    v-if="!setup && hasScope"
                    :permission="WORKFORCE_RATIO_PERMISSIONS.CREATE"
                    icon="pi pi-plus"
                    :label="t('workforceRatio.createTitle')"
                    @click="openCreate"
                />

                <PermissionButton
                    v-if="setup"
                    :permission="WORKFORCE_RATIO_PERMISSIONS.UPDATE"
                    icon="pi pi-pencil"
                    :label="t('common.edit')"
                    @click="openEdit"
                />
            </div>
        </header>

        <div v-if="!hasScope" class="workforce-ratio-page__empty">
            <i class="pi pi-building" />
            <strong>{{ t("workforceRatio.workspaceRequired") }}</strong>
            <span>{{ t("workforceRatio.workspaceRequiredHint") }}</span>
        </div>

        <div v-else-if="store.loading" class="workforce-ratio-page__empty">
            <i class="pi pi-spin pi-spinner" />
            <span>{{ t("common.loading") }}</span>
        </div>

        <div v-else-if="!setup" class="workforce-ratio-page__empty">
            <i class="pi pi-sitemap" />
            <strong>{{ t("workforceRatio.notConfigured") }}</strong>
            <span>{{ t("workforceRatio.notConfiguredHint") }}</span>
            <Button
                v-if="canCreate"
                icon="pi pi-plus"
                :label="t('workforceRatio.createTitle')"
                @click="openCreate"
            />
        </div>

        <article v-else class="workforce-ratio-card">
            <div class="workforce-ratio-card__scope">
                <div>
                    <small>{{ t("workforceRatio.company") }}</small>
                    <strong>{{ companyName }}</strong>
                </div>
                <div>
                    <small>{{ t("workforceRatio.branch") }}</small>
                    <strong>{{ branchName }}</strong>
                </div>
                <Tag
                    :value="setup.status"
                    :severity="statusSeverity(setup.status)"
                />
            </div>

            <div class="workforce-ratio-card__groups">
                <section class="ratio-group ratio-group--direct">
                    <header>
                        <i class="pi pi-arrow-up-right" />
                        <div>
                            <strong>{{ t("workforceRatio.direct") }}</strong>
                            <small>{{ t("workforceRatio.directHint") }}</small>
                        </div>
                    </header>
                    <div class="ratio-group__chips">
                        <span
                            v-for="item in setup.directEmployeeTypes"
                            :key="item.id"
                            class="ratio-chip"
                        >
                            <b>{{ item.code }}</b>
                            <span>{{ item.name }}</span>
                        </span>
                    </div>
                </section>

                <section class="ratio-group ratio-group--indirect">
                    <header>
                        <i class="pi pi-arrow-down-right" />
                        <div>
                            <strong>{{ t("workforceRatio.indirect") }}</strong>
                            <small>{{ t("workforceRatio.indirectHint") }}</small>
                        </div>
                    </header>
                    <div class="ratio-group__chips">
                        <span
                            v-for="item in setup.indirectEmployeeTypes"
                            :key="item.id"
                            class="ratio-chip"
                        >
                            <b>{{ item.code }}</b>
                            <span>{{ item.name }}</span>
                        </span>
                    </div>
                </section>
            </div>

            <section class="workforce-ratio-card__budget">
                <div>
                    <small>{{ t("workforceRatio.budgetYear") }}</small>
                    <strong>{{ setup.budgetYear || "—" }}</strong>
                </div>
                <div>
                    <small>{{ t("workforceRatio.budgetRatio") }}</small>
                    <strong>
                        {{ setup.budgetRatio !== null && setup.budgetRatio !== undefined && Number.isFinite(Number(setup.budgetRatio)) ? Number(setup.budgetRatio).toFixed(2) : "—" }}
                    </strong>
                </div>
            </section>

            <footer class="workforce-ratio-card__footer">
                <div>
                    <i class="pi pi-info-circle" />
                    <span>{{ t("workforceRatio.excomeBehavior") }}</span>
                </div>

                <Button
                    v-if="canArchive"
                    severity="danger"
                    text
                    size="small"
                    icon="pi pi-archive"
                    :label="t('common.archive')"
                    @click="archiveVisible = true"
                />
            </footer>
        </article>

        <WorkforceRatioFormDialog
            v-model:visible="dialogVisible"
            :editing="editing"
            :form="form"
            :employee-types="store.employeeTypes"
            :errors="errors"
            :company-name="companyName"
            :branch-name="branchName"
            :saving="store.saving"
            @clear-error="clearError"
            @save="save"
        />

        <EnterpriseConfirmDialog
            v-model:visible="archiveVisible"
            :title="t('workforceRatio.archiveTitle')"
            :message="t('workforceRatio.archiveMessage')"
            :confirm-label="t('common.archive')"
            severity="danger"
            :busy="store.archiving"
            @confirm="archive"
        />
    </section>
</template>

<style scoped>
.workforce-ratio-page {
    display: grid;
    gap: 1rem;
    min-width: 0;
}

.workforce-ratio-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.workforce-ratio-page__eyebrow {
    color: #0b2d6b;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.workforce-ratio-page__header h1 {
    margin: 0.2rem 0;
    font-size: 1.35rem;
}

.workforce-ratio-page__header p {
    max-width: 50rem;
    margin: 0;
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.78rem;
    line-height: 1.45;
}

.workforce-ratio-page__header-actions {
    display: flex;
    gap: 0.5rem;
}

.workforce-ratio-page__empty {
    display: grid;
    min-height: 15rem;
    place-items: center;
    align-content: center;
    gap: 0.55rem;
    padding: 1.5rem;
    border: 1px dashed var(--p-content-border-color, #cbd5e1);
    border-radius: 0.8rem;
    background: #ffffff;
    color: #64748b;
    text-align: center;
}

.workforce-ratio-page__empty i {
    color: #0b2d6b;
    font-size: 1.8rem;
}

.workforce-ratio-card {
    overflow: hidden;
    border: 1px solid #dbe3ec;
    border-radius: 0.8rem;
    background: #ffffff;
    box-shadow: 0 0.25rem 1rem rgb(15 23 42 / 0.05);
}

.workforce-ratio-card__scope {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
}

.workforce-ratio-card__scope div {
    display: grid;
    gap: 0.15rem;
}

.workforce-ratio-card__scope small {
    color: #64748b;
    font-size: 0.67rem;
    text-transform: uppercase;
}

.workforce-ratio-card__groups {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    padding: 1rem;
}

.ratio-group {
    min-width: 0;
    padding: 1rem;
    border: 1px solid #dbe3ec;
    border-radius: 0.7rem;
}

.ratio-group--direct {
    border-top: 4px solid #2563eb;
}

.ratio-group--indirect {
    border-top: 4px solid #0ea5e9;
}

.ratio-group header {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    margin-bottom: 0.8rem;
}

.ratio-group header > i {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: 50%;
    background: #eff6ff;
    color: #0b2d6b;
}

.ratio-group header div {
    display: grid;
    gap: 0.1rem;
}

.ratio-group header small {
    color: #64748b;
    font-size: 0.68rem;
}

.ratio-group__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
}

.ratio-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
    padding: 0.35rem 0.5rem;
    border: 1px solid #dbe3ec;
    border-radius: 0.45rem;
    background: #f8fafc;
    font-size: 0.72rem;
}

.ratio-chip b {
    color: #0b2d6b;
}

.ratio-chip span {
    color: #475569;
}

.workforce-ratio-card__budget {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem;
    margin: 0 1rem 1rem;
    padding: 0.8rem 1rem;
    border: 1px solid #bfdbfe;
    border-radius: 0.65rem;
    background: #f8fbff;
}

.workforce-ratio-card__budget div {
    display: grid;
    gap: 0.2rem;
}

.workforce-ratio-card__budget small {
    color: #64748b;
    font-size: 0.67rem;
    font-weight: 700;
    text-transform: uppercase;
}

.workforce-ratio-card__budget strong {
    color: #0b2d6b;
    font-size: 1.05rem;
}

.workforce-ratio-card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
}

.workforce-ratio-card__footer > div {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    color: #475569;
    font-size: 0.72rem;
}

.workforce-ratio-card__footer i {
    color: #2563eb;
}

@media (max-width: 760px) {
    .workforce-ratio-page__header,
    .workforce-ratio-card__footer {
        align-items: stretch;
        flex-direction: column;
    }

    .workforce-ratio-card__scope,
    .workforce-ratio-card__groups,
    .workforce-ratio-card__budget {
        grid-template-columns: 1fr;
    }
}
</style>
