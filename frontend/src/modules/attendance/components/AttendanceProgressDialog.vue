<script setup>
import Dialog from "primevue/dialog"
import ProgressBar from "primevue/progressbar"

const props = defineProps({
    visible: {
        type: Boolean,
        default: false,
    },
    title: {
        type: String,
        default: "Processing attendance",
    },
    progress: {
        type: Number,
        default: 0,
    },
    message: {
        type: String,
        default: "",
    },
})

const emit = defineEmits(["update:visible"])
</script>

<template>
    <Dialog
        :visible="props.visible"
        modal
        :closable="false"
        :dismissable-mask="false"
        :header="props.title"
        class="hrms-standard-dialog--small"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="attendance-progress-content">
            <ProgressBar :value="props.progress" />
            <p v-if="props.message" class="attendance-progress-copy">
                {{ props.message }}
            </p>
        </div>
    </Dialog>
</template>

<style scoped>
.attendance-progress-content {
    display: grid;
    gap: 0.75rem;
}
</style>
