<script setup>
import Dialog from "primevue/dialog"

const props = defineProps({
    visible: { type: Boolean, default: false },
    title: { type: String, default: "" },
    width: { type: String, default: "42rem" },
    modal: { type: Boolean, default: true },
    closable: { type: Boolean, default: true },
    closeOnEscape: { type: Boolean, default: true },
    dismissableMask: { type: Boolean, default: false },
    busy: { type: Boolean, default: false },
    fullscreen: { type: Boolean, default: false },
    hideHeader: { type: Boolean, default: false },
})

const emit = defineEmits(["update:visible", "hide"])
</script>

<template>
    <Dialog
        :visible="visible"
        :header="title"
        :modal="modal"
        :closable="closable && !busy"
        :close-on-escape="closeOnEscape && !busy"
        :dismissable-mask="dismissableMask && !busy"
        :show-header="!hideHeader"
        :style="{ width: fullscreen ? '100vw' : width }"
        :class="[
            'enterprise-dialog',
            { 'enterprise-dialog--fullscreen': fullscreen },
        ]"
        @update:visible="emit('update:visible', $event)"
        @hide="emit('hide')"
    >
        <div class="enterprise-dialog__body" :aria-busy="busy">
            <slot />
        </div>
        <template v-if="$slots.footer" #footer>
            <div class="enterprise-dialog__footer">
                <slot name="footer" />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
:global(.enterprise-dialog--fullscreen) {
    display: flex !important;
    width: 100vw !important;
    max-width: 100vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    flex-direction: column;
}

:global(.enterprise-dialog--fullscreen .p-dialog-content) {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    overflow: hidden;
}

:global(.enterprise-dialog--fullscreen .enterprise-dialog__body) {
    display: flex;
    height: 100%;
    width: 100%;
    min-height: 0;
    flex: 1 1 auto;
}
</style>
