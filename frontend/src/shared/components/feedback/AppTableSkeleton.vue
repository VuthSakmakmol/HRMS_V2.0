<script setup>
import Skeleton from "primevue/skeleton"
defineProps({ rows: { type: Number, default: 8 }, columns: { type: Number, default: 5 } })
</script>
<template>
    <div class="app-table-skeleton" aria-busy="true">
        <div v-for="row in rows" :key="row" class="app-table-skeleton__row">
            <Skeleton v-for="column in columns" :key="column" height="1.35rem" />
        </div>
    </div>
</template>
