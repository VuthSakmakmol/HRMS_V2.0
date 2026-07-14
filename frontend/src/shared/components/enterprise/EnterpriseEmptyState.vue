<script setup>
defineProps({
    title: { type: String, default: "No records found" },
    description: { type: String, default: "There is no data to display." },
    icon: { type: String, default: "pi pi-inbox" },
})
</script>

<template>
    <div class="enterprise-state enterprise-state--empty">
        <span class="enterprise-state__icon"><i :class="icon" /></span>
        <strong>{{ title }}</strong>
        <p>{{ description }}</p>
        <div v-if="$slots.action" class="enterprise-state__action"><slot name="action" /></div>
    </div>
</template>
