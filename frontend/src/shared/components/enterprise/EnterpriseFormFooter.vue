<script setup>
import Button from "primevue/button"

defineProps({
    saveLabel: { type: String, default: "Save" },
    cancelLabel: { type: String, default: "Cancel" },
    saving: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
})

const emit = defineEmits(["save", "cancel"])
</script>

<template>
    <div class="enterprise-form-footer">
        <div class="enterprise-form-footer__start"><slot /></div>
        <div class="enterprise-form-footer__actions">
            <Button
                :label="cancelLabel"
                severity="secondary"
                text
                :disabled="saving"
                @click="emit('cancel')"
            />
            <Button
                :label="saveLabel"
                icon="pi pi-check"
                :loading="saving"
                :disabled="disabled"
                @click="emit('save')"
            />
        </div>
    </div>
</template>
