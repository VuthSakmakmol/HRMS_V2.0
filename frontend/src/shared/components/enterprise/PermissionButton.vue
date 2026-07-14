<script setup>
import Button from "primevue/button"
import { computed } from "vue"
import { useAuthStore } from "@/app/stores/auth.store.js"

const props = defineProps({
    permission: { type: String, default: "" },
    permissions: { type: Array, default: () => [] },
    requireAll: { type: Boolean, default: false },
    hideWhenDenied: { type: Boolean, default: true },
})

const authStore = useAuthStore()
const required = computed(() => [props.permission, ...props.permissions].filter(Boolean))
const allowed = computed(() => {
    if (required.value.length === 0) return true
    const checks = required.value.map((code) => authStore.hasPermission(code))
    return props.requireAll ? checks.every(Boolean) : checks.some(Boolean)
})
</script>

<template>
    <Button
        v-if="allowed || !hideWhenDenied"
        v-bind="$attrs"
        :disabled="!allowed || Boolean($attrs.disabled)"
    >
        <slot />
    </Button>
</template>
