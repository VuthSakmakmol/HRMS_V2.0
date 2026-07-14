<script setup>
defineProps({
    loading: {
        type: Boolean,
        default: false,
    },
})
</script>

<template>
    <section
        class="app-filter-bar hrms-card hrms-compact"
        :aria-busy="loading"
    >
        <div class="app-filter-bar__fields">
            <slot />
        </div>

        <div
            v-if="$slots.actions"
            class="app-filter-bar__actions"
        >
            <slot name="actions" />
        </div>
    </section>
</template>

<style scoped>
.app-filter-bar {
    display: flex;
    align-items: flex-end;
    gap: var(--hrms-filter-gap);
    min-width: 0;
    margin-bottom: var(--hrms-page-gap);
    background: var(--hrms-surface);
}

.app-filter-bar__fields {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--hrms-filter-gap);
    min-width: 0;
}

.app-filter-bar__actions {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
}

:deep(.app-filter-field) {
    flex: 0 1 12rem;
    min-width: 9rem;
}

:deep(.app-filter-field--search) {
    flex: 1 1 15rem;
    min-width: 12rem;
}

:deep(.app-filter-field > .p-component),
:deep(.app-filter-field > .p-inputtext),
:deep(.app-filter-field > .p-select),
:deep(.app-filter-field > .p-multiselect),
:deep(.app-filter-field > .p-datepicker) {
    width: 100%;
}

@media (max-width: 760px) {
    .app-filter-bar {
        align-items: stretch;
        flex-direction: column;
    }

    .app-filter-bar__actions {
        width: 100%;
    }
}

@media (max-width: 520px) {
    .app-filter-bar__fields {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        width: 100%;
    }

    :deep(.app-filter-field),
    :deep(.app-filter-field--search) {
        width: 100%;
        min-width: 0;
    }

    .app-filter-bar__actions {
        justify-content: stretch;
    }

    .app-filter-bar__actions :deep(.p-button) {
        flex: 1 1 auto;
    }
}
</style>
