<script setup>
import Button from "primevue/button"

defineProps({
    canEdit: { type: Boolean, default: false },
    canDelete: { type: Boolean, default: false },
    canArchive: { type: Boolean, default: false },
    editLabel: { type: String, default: "Edit" },
    deleteLabel: { type: String, default: "Delete" },
    archiveLabel: { type: String, default: "Archive" },
    disabled: { type: Boolean, default: false },
})

defineEmits(["edit", "delete", "archive"])
</script>

<template>
    <div class="enterprise-table-actions">
        <Button
            v-if="canEdit"
            icon="pi pi-pencil"
            severity="secondary"
            text
            rounded
            :label="editLabel"
            :aria-label="editLabel"
            :disabled="disabled"
            @click="$emit('edit')"
        />

        <Button
            v-if="canArchive"
            icon="pi pi-box"
            severity="warn"
            text
            rounded
            :label="archiveLabel"
            :aria-label="archiveLabel"
            :disabled="disabled"
            @click="$emit('archive')"
        />

        <Button
            v-if="canDelete"
            icon="pi pi-trash"
            severity="danger"
            text
            rounded
            :label="deleteLabel"
            :aria-label="deleteLabel"
            :disabled="disabled"
            @click="$emit('delete')"
        />
    </div>
</template>
