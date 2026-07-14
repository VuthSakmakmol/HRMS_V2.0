<script setup>
import Button from "primevue/button"

defineProps({
    canView: { type: Boolean, default: false },
    canEdit: { type: Boolean, default: false },
    canDelete: { type: Boolean, default: false },
    canArchive: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    viewLabel: { type: String, default: "View" },
    editLabel: { type: String, default: "Edit" },
    deleteLabel: { type: String, default: "Delete" },
    archiveLabel: { type: String, default: "Archive" },
})

defineEmits(["view", "edit", "delete", "archive"])
</script>

<template>
    <div class="hrms-table-actions">
        <Button
            v-if="canView"
            icon="pi pi-eye"
            severity="secondary"
            text
            rounded
            class="hrms-icon-button"
            :aria-label="viewLabel"
            :title="viewLabel"
            :disabled="disabled"
            @click="$emit('view')"
        />
        <Button
            v-if="canEdit"
            icon="pi pi-pencil"
            severity="info"
            text
            rounded
            class="hrms-icon-button"
            :aria-label="editLabel"
            :title="editLabel"
            :disabled="disabled"
            @click="$emit('edit')"
        />
        <Button
            v-if="canArchive"
            icon="pi pi-box"
            severity="warn"
            text
            rounded
            class="hrms-icon-button"
            :aria-label="archiveLabel"
            :title="archiveLabel"
            :disabled="disabled"
            @click="$emit('archive')"
        />
        <Button
            v-if="canDelete"
            icon="pi pi-trash"
            severity="danger"
            text
            rounded
            class="hrms-icon-button"
            :aria-label="deleteLabel"
            :title="deleteLabel"
            :disabled="disabled"
            @click="$emit('delete')"
        />
        <slot />
    </div>
</template>
