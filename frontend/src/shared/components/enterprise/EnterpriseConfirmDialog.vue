<script setup>
import Button from "primevue/button"
import EnterpriseDialog from "./EnterpriseDialog.vue"

const props = defineProps({
    visible: { type: Boolean, default: false },
    title: { type: String, default: "Confirm action" },
    message: { type: String, default: "Are you sure you want to continue?" },
    confirmLabel: { type: String, default: "Confirm" },
    cancelLabel: { type: String, default: "Cancel" },
    severity: { type: String, default: "danger" },
    busy: { type: Boolean, default: false },
    icon: { type: String, default: "pi pi-exclamation-triangle" },
})

const emit = defineEmits(["update:visible", "confirm", "cancel"])

function close() {
    if (!props.busy) {
        emit("update:visible", false)
        emit("cancel")
    }
}
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="title"
        width="30rem"
        :busy="busy"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="enterprise-confirm">
            <span class="enterprise-confirm__icon">
                <i :class="icon" />
            </span>
            <p>{{ message }}</p>
        </div>
        <template #footer>
            <Button
                :label="cancelLabel"
                severity="secondary"
                text
                :disabled="busy"
                @click="close"
            />
            <Button
                :label="confirmLabel"
                :severity="severity"
                :loading="busy"
                @click="emit('confirm')"
            />
        </template>
    </EnterpriseDialog>
</template>
