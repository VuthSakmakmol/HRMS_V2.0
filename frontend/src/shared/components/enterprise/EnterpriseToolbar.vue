<script setup>
defineProps({
    sticky: { type: Boolean, default: false },
})
</script>

<template>
    <div
        class="enterprise-toolbar"
        :class="{ 'enterprise-toolbar--sticky': sticky }"
    >
        <div v-if="$slots.start" class="enterprise-toolbar__start">
            <slot name="start" />
        </div>
        <div class="enterprise-toolbar__actions">
            <slot />
        </div>
    </div>
</template>
