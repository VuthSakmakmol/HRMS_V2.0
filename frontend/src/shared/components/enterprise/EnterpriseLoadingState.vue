<script setup>
import Skeleton from "primevue/skeleton"

defineProps({
    columns: { type: Number, default: 5 },
    rows: { type: Number, default: 8 },
})
</script>

<template>
    <div class="enterprise-loading-state" aria-busy="true" aria-label="Loading records">
        <div v-for="row in rows" :key="row" class="enterprise-loading-state__row">
            <Skeleton v-for="column in columns" :key="column" height="0.9rem" />
        </div>
    </div>
</template>
