<script setup>
import Paginator from "primevue/paginator"

const props = defineProps({
    page: { type: Number, default: 1 },
    rows: { type: Number, default: 25 },
    totalRecords: { type: Number, default: 0 },
    rowsPerPageOptions: { type: Array, default: () => [10, 25, 50, 100] },
    disabled: { type: Boolean, default: false },
})

defineEmits(["page"])
</script>

<template>
    <div class="app-paginator" :class="{ 'app-paginator--disabled': disabled }">
        <Paginator
            :first="Math.max(0, (props.page - 1) * props.rows)"
            :rows="props.rows"
            :total-records="props.totalRecords"
            :rows-per-page-options="props.rowsPerPageOptions"
            template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
            current-page-report-template="{first}-{last} of {totalRecords}"
            @page="$emit('page', $event)"
        />
    </div>
</template>

<style scoped>
.app-paginator {
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid var(--hrms-border);
}
.app-paginator--disabled {
    pointer-events: none;
    opacity: 0.65;
}
:deep(.p-paginator) {
    width: 100%;
    justify-content: flex-end;
    padding: 0.35rem 0;
    background: transparent;
}
</style>
