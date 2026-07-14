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
        :style="{ width }"
        class="enterprise-dialog"
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
