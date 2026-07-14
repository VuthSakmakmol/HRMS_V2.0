<script setup>
import Paginator from "primevue/paginator"

const props = defineProps({
    page: { type: Number, default: 1 },
    limit: { type: Number, default: 20 },
    total: { type: Number, default: 0 },
    totalPages: { type: Number, default: 0 },
    disabled: { type: Boolean, default: false },
    rowsPerPageOptions: { type: Array, default: () => [10, 20, 50, 100] },
})

const emit = defineEmits(["change"])

function onPage(event) {
    emit("change", {
        page: event.page + 1,
        limit: event.rows,
        first: event.first,
    })
}
</script>

<template>
    <div class="enterprise-paginator" :class="{ 'is-disabled': disabled }">
        <div class="enterprise-paginator__summary">
            <span>{{ total.toLocaleString() }} records</span>
            <span v-if="totalPages > 0">Page {{ page }} of {{ totalPages }}</span>
        </div>
        <Paginator
            :first="Math.max(0, (page - 1) * limit)"
            :rows="limit"
            :total-records="total"
            :rows-per-page-options="rowsPerPageOptions"
            template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
            @page="onPage"
        />
    </div>
</template>
