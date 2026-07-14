<script setup>
defineProps({
    compactMobile: {
        type: Boolean,
        default: true,
    },
})
</script>

<template>
    <div
        class="app-module-toolbar"
        :class="{
            'app-module-toolbar--compact-mobile': compactMobile,
        }"
    >
        <div
            v-if="$slots.start"
            class="app-module-toolbar__start"
        >
            <slot name="start" />
        </div>

        <div
            v-if="$slots.default"
            class="app-module-toolbar__actions"
        >
            <slot />
        </div>
    </div>
</template>

<style scoped>
.app-module-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
    margin-bottom: var(--hrms-page-gap);
}

.app-module-toolbar__start {
    display: flex;
    align-items: center;
    min-width: 0;
}

.app-module-toolbar__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
    margin-left: auto;
}

@media (max-width: 640px) {
    .app-module-toolbar--compact-mobile {
        align-items: stretch;
        flex-direction: column;
    }

    .app-module-toolbar--compact-mobile .app-module-toolbar__start,
    .app-module-toolbar--compact-mobile .app-module-toolbar__actions {
        width: 100%;
    }

    .app-module-toolbar--compact-mobile .app-module-toolbar__actions {
        justify-content: flex-end;
    }
}
</style>
