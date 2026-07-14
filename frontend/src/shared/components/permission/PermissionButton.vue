<script setup>
import Button from "primevue/button"
import { computed, useAttrs } from "vue"

import { useAuthStore } from "@/app/stores/auth.store.js"

const props = defineProps({
    permission: { type: String, default: "" },
    permissions: { type: Array, default: () => [] },
    requireAll: { type: Boolean, default: false },
})

const authStore = useAuthStore()
const attrs = useAttrs()

const visible = computed(() => {
    const required = props.permissions.length
        ? props.permissions
        : props.permission
          ? [props.permission]
          : []

    if (!required.length) return true
    const checker = authStore.hasPermission || ((code) => authStore.permissionCodes?.includes(code))
    return props.requireAll ? required.every(checker) : required.some(checker)
})
</script>

<template>
    <Button v-if="visible" v-bind="attrs"><slot /></Button>
</template>
