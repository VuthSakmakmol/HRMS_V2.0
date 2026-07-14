<script setup>
import Button from "primevue/button"
import Menu from "primevue/menu"
import { computed, ref } from "vue"

const props = defineProps({
    items: { type: Array, default: () => [] },
    disabled: { type: Boolean, default: false },
    ariaLabel: { type: String, default: "Row actions" },
})

const menu = ref(null)
const visibleItems = computed(() => props.items.filter((item) => item.visible !== false))

function toggle(event) {
    menu.value?.toggle(event)
}
</script>

<template>
    <div class="enterprise-action-menu">
        <Button
            icon="pi pi-ellipsis-v"
            severity="secondary"
            text
            rounded
            :disabled="disabled || visibleItems.length === 0"
            :aria-label="ariaLabel"
            @click="toggle"
        />
        <Menu ref="menu" :model="visibleItems" popup />
    </div>
</template>
