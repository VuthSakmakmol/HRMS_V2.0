<script setup>
defineProps({ icon: { type: String, default: "pi pi-inbox" }, title: { type: String, default: "No records" }, message: { type: String, default: "" } })
</script>
<template>
    <div class="app-empty-state">
        <i :class="icon" aria-hidden="true" />
        <strong>{{ title }}</strong>
        <span v-if="message">{{ message }}</span>
        <slot />
    </div>
</template>
