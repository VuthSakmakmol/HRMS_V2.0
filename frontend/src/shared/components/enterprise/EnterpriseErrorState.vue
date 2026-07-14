<script setup>
import Button from "primevue/button"
import { computed } from "vue"

const props = defineProps({
    error: { type: [String, Object], default: null },
    title: { type: String, default: "Unable to load data" },
    retryLabel: { type: String, default: "Try again" },
})

const emit = defineEmits(["retry"])
const message = computed(() => {
    if (typeof props.error === "string") return props.error
    return props.error?.message || props.error?.messageKey || "An unexpected error occurred."
})
</script>

<template>
    <div class="enterprise-state enterprise-state--error" role="alert">
        <span class="enterprise-state__icon"><i class="pi pi-exclamation-circle" /></span>
        <strong>{{ title }}</strong>
        <p>{{ message }}</p>
        <Button :label="retryLabel" icon="pi pi-refresh" severity="secondary" @click="emit('retry')" />
    </div>
</template>
