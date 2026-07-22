<script setup>
import Button from "primevue/button"
import { useI18n } from "vue-i18n"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"

defineProps({
    visible: { type: Boolean, default: false },
    summary: {
        type: Object,
        default: () => ({
            totalAffected: 0,
            reassigned: 0,
            reviewRequired: 0,
        }),
    },
})

const emit = defineEmits(["confirm", "cancel"])
const { t } = useI18n()
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="t('organization.employeeType.reconciliationTitle')"
        width="34rem"
        @update:visible="!$event && emit('cancel')"
    >
        <div class="reconciliation-confirmation">
            <div class="reconciliation-confirmation__intro">
                <span class="reconciliation-confirmation__icon">
                    <i class="pi pi-users" aria-hidden="true" />
                </span>
                <p>
                    {{
                        t('organization.employeeType.reconciliationAffected', {
                            count: summary.totalAffected,
                        })
                    }}
                </p>
            </div>

            <div class="reconciliation-confirmation__summary">
                <div class="summary-item summary-item--success">
                    <strong>{{ summary.reassigned }}</strong>
                    <span>{{ t('organization.employeeType.reconciliationReassigned') }}</span>
                </div>
                <div class="summary-item summary-item--warning">
                    <strong>{{ summary.reviewRequired }}</strong>
                    <span>{{ t('organization.employeeType.reconciliationReview') }}</span>
                </div>
            </div>

            <p class="reconciliation-confirmation__question">
                {{ t('organization.employeeType.reconciliationQuestion') }}
            </p>
        </div>

        <template #footer>
            <Button
                :label="t('common.cancel')"
                severity="secondary"
                text
                @click="emit('cancel')"
            />
            <Button
                :label="t('organization.employeeType.continueReconciliation')"
                icon="pi pi-check"
                @click="emit('confirm')"
            />
        </template>
    </EnterpriseDialog>
</template>

<style scoped>
.reconciliation-confirmation {
    display: grid;
    gap: 1rem;
}

.reconciliation-confirmation__intro {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.reconciliation-confirmation__intro p,
.reconciliation-confirmation__question {
    margin: 0;
    line-height: 1.55;
}

.reconciliation-confirmation__icon {
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    flex: 0 0 2.5rem;
    place-items: center;
    border-radius: 50%;
    color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
}

.reconciliation-confirmation__summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}

.summary-item {
    display: grid;
    gap: 0.25rem;
    padding: 0.875rem;
    border: 1px solid var(--surface-border);
    border-radius: 0.75rem;
    background: var(--surface-50);
}

.summary-item strong {
    font-size: 1.35rem;
}

.summary-item span {
    color: var(--text-color-secondary);
    font-size: 0.82rem;
}

.summary-item--success strong {
    color: var(--green-600);
}

.summary-item--warning strong {
    color: var(--orange-600);
}

@media (max-width: 36rem) {
    .reconciliation-confirmation__summary {
        grid-template-columns: 1fr;
    }
}
</style>
