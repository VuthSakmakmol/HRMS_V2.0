<script setup>
defineProps({
    label: { type: String, default: "" },
    forId: { type: String, default: "" },
    search: { type: Boolean, default: false },
    wide: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
})
</script>

<template>
    <div
        class="enterprise-filter-field"
        :class="{
            'enterprise-filter-field--search': search,
            'enterprise-filter-field--wide': wide,
        }"
    >
        <label v-if="label" :for="forId" class="enterprise-filter-field__label">
            {{ label }}<span v-if="required" aria-hidden="true"> *</span>
        </label>
        <slot />
    </div>
</template>
