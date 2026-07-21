<script setup>
import { computed, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Checkbox from "primevue/checkbox"
import Dialog from "primevue/dialog"
import Message from "primevue/message"
import ProgressSpinner from "primevue/progressspinner"

import EnterpriseFilterBar from "@/shared/components/enterprise/EnterpriseFilterBar.vue"
import EnterpriseCalendarDatePicker from "@/shared/components/enterprise/EnterpriseCalendarDatePicker.vue"
import { useWorkspaceStore } from "@/app/stores/workspace.store.js"
import { useModulePermissions } from "@/shared/auth/useModulePermissions.js"
import { runAttendanceVerification } from "../services/attendance.api.js"
import "../styles/attendance-enterprise.css"

const { t } = useI18n()
const toast = useToast()
const workspace = useWorkspaceStore()

const permissions = useModulePermissions({
    run: "ATTENDANCE.VERIFICATION.RUN",
})

const canRun = permissions.has("ATTENDANCE.VERIFICATION.RUN")

function localDateKey(date = new Date()) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

const today = localDateKey()
const running = ref(false)
const confirmVisible = ref(false)
const summary = ref(null)

const form = reactive({
    dateFrom: today,
    dateTo: today,
    overwriteCorrected: false,
})

const summaryCards = computed(() => {
    if (!summary.value) {
        return []
    }

    return [
        { label: t("attendance.verification.employees"), value: summary.value.employeeCount || 0 },
        { label: t("attendance.verification.processed"), value: summary.value.processedCount || 0 },
        { label: t("attendance.status.present"), value: summary.value.presentCount || 0 },
        { label: t("attendance.status.absent"), value: summary.value.absentCount || 0 },
        { label: t("attendance.verification.review"), value: summary.value.reviewCount || 0 },
        { label: t("attendance.status.restDay"), value: summary.value.restDayCount || 0 },
        { label: t("attendance.status.holiday"), value: summary.value.holidayCount || 0 },
        { label: t("attendance.verification.skipped"), value: summary.value.skippedCount || 0 },
    ]
})

function openConfirmation() {
    if (!canRun.value || running.value) {
        return
    }

    confirmVisible.value = true
}

async function runVerification() {
    confirmVisible.value = false
    running.value = true
    summary.value = null

    try {
        summary.value = await runAttendanceVerification({
            ...form,
            companyId: workspace.companyId,
            branchId: workspace.branchId,
        })

        toast.add({
            severity: "success",
            summary: t("common.success"),
            detail: t("attendance.verification.completed"),
            life: 3000,
        })
    } finally {
        running.value = false
    }
}
</script>

<template>
    <section class="attendance-enterprise-page hrms-list-page">
        <EnterpriseFilterBar :loading="running">
            <label class="app-filter-field hrms-form-field">
                <span>{{ t("common.dateFrom") }}</span>
                <EnterpriseCalendarDatePicker
                    v-model="form.dateFrom"
                    :company-id="workspace.companyId"
                    :branch-id="workspace.branchId"
                    compact
                    :show-status="false"
                />
            </label>

            <label class="app-filter-field hrms-form-field">
                <span>{{ t("common.dateTo") }}</span>
                <EnterpriseCalendarDatePicker
                    v-model="form.dateTo"
                    :company-id="workspace.companyId"
                    :branch-id="workspace.branchId"
                    compact
                    :show-status="false"
                />
            </label>

            <div class="app-filter-field hrms-form-field">
                <span>Corrected records</span>
                <div class="attendance-checkbox-row">
                    <Checkbox
                        v-model="form.overwriteCorrected"
                        binary
                        input-id="overwriteCorrected"
                    />
                    <label for="overwriteCorrected">
                        {{ t("attendance.verification.overwriteCorrected") }}
                    </label>
                </div>
            </div>

            <template #actions>
                <Button
                    v-if="canRun"
                    icon="pi pi-play"
                    :label="t('attendance.verification.run')"
                    :loading="running"
                    :disabled="!workspace.ready"
                    @click="openConfirmation"
                />
            </template>
        </EnterpriseFilterBar>

        <section v-if="running" class="hrms-list-card attendance-running-state">
            <ProgressSpinner stroke-width="4" />
            <p>{{ t("attendance.verification.running") }}</p>
        </section>

        <template v-if="summary">
            <Message severity="success" :closable="false">
                {{ t("attendance.verification.completed") }}
            </Message>

            <section class="attendance-metric-grid">
                <article
                    v-for="card in summaryCards"
                    :key="card.label"
                    class="attendance-metric-card"
                >
                    <strong>{{ card.value }}</strong>
                    <span>{{ card.label }}</span>
                </article>
            </section>
        </template>

        <section v-if="!running && !summary" class="hrms-list-card attendance-verification-guide">
            <i class="pi pi-verified" aria-hidden="true" />
            <div>
                <strong>{{ t("attendance.verification.title") }}</strong>
                <p>
                    Choose the attendance period and run verification. The backend will resolve raw scans, shifts, policies, holidays, overnight work, and protected manual corrections.
                </p>
            </div>
        </section>

        <Dialog
            v-model:visible="confirmVisible"
            modal
            :header="t('attendance.verification.run')"
            class="hrms-standard-dialog--small"
        >
            <p class="attendance-dialog-note">
                Verify attendance from <strong>{{ form.dateFrom }}</strong> to
                <strong>{{ form.dateTo }}</strong>.
                <template v-if="form.overwriteCorrected">
                    Manually corrected records will be recalculated.
                </template>
                <template v-else>
                    Manually corrected records will remain protected.
                </template>
            </p>

            <template #footer>
                <Button
                    :label="t('common.cancel')"
                    severity="secondary"
                    outlined
                    @click="confirmVisible = false"
                />
                <Button
                    :label="t('attendance.verification.run')"
                    icon="pi pi-play"
                    @click="runVerification"
                />
            </template>
        </Dialog>
    </section>
</template>

<style scoped>
.attendance-running-state {
    display: grid;
    min-height: 12rem;
    place-items: center;
    align-content: center;
    gap: 0.75rem;
}

.attendance-running-state p,
.attendance-verification-guide p {
    margin: 0;
    color: var(--hrms-text-muted);
    font-size: var(--hrms-font-size-sm);
}

.attendance-verification-guide {
    display: flex;
    min-height: 9rem;
    align-items: center;
    justify-content: center;
    gap: 0.85rem;
    text-align: left;
}

.attendance-verification-guide > i {
    color: var(--p-primary-color);
    font-size: 1.75rem;
}

.attendance-verification-guide > div {
    display: grid;
    max-width: 42rem;
    gap: 0.3rem;
}
</style>
