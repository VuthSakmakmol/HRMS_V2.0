<script setup>
defineProps({
    loading: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    collapsed: { type: Boolean, default: false },
})

const emit = defineEmits(["update:collapsed"])
</script>

<template>
    <section class="enterprise-filter-bar" :aria-busy="loading">
        <button
            v-if="collapsible"
            type="button"
            class="enterprise-filter-bar__toggle"
            @click="emit('update:collapsed', !collapsed)"
        >
            <i :class="collapsed ? 'pi pi-chevron-down' : 'pi pi-chevron-up'" />
            <span>Filters</span>
        </button>

        <div v-show="!collapsed" class="enterprise-filter-bar__content">
            <div class="enterprise-filter-bar__fields">
                <slot />
            </div>
            <div v-if="$slots.actions" class="enterprise-filter-bar__actions">
                <slot name="actions" />
            </div>
        </div>
    </section>
</template>
