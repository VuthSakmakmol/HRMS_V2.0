<script setup>
import Button from "primevue/button"
import Message from "primevue/message"
import ProgressBar from "primevue/progressbar"
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"

const props = defineProps({
    visible: { type: Boolean, default: false },
    importing: { type: Boolean, default: false },
    progress: { type: Number, default: 0 },
    result: { type: Object, default: null },
    errorMessage: { type: String, default: "" },
})

const emit = defineEmits([
    "update:visible",
    "file-change",
    "download-template",
    "import",
    "close",
])

const { t } = useI18n()
const inputRef = ref(null)
const selectedFile = ref(null)
const errors = computed(() => props.result?.errors || [])

function chooseFile() {
    inputRef.value?.click()
}

function setFile(event) {
    selectedFile.value = event.target.files?.[0] || null
    emit("file-change", selectedFile.value)
}

function clearFile() {
    selectedFile.value = null
    if (inputRef.value) inputRef.value.value = ""
    emit("file-change", null)
}

function close() {
    if (props.importing) return
    clearFile()
    emit("update:visible", false)
    emit("close")
}
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="t('manpowerPlan.importTitle')"
        width="38rem"
        :busy="importing"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="manpower-import">
            <section class="manpower-import__instructions">
                <div>
                    <h3>{{ t("manpowerPlan.importInstructionsTitle") }}</h3>
                    <p>{{ t("manpowerPlan.importInstructions") }}</p>
                </div>
                <Button
                    icon="pi pi-download"
                    :label="t('manpowerPlan.downloadTemplate')"
                    severity="secondary"
                    outlined
                    :disabled="importing"
                    @click="emit('download-template')"
                />
            </section>

            <input
                ref="inputRef"
                class="manpower-import__native"
                type="file"
                accept=".xlsx,.xls"
                :disabled="importing"
                @change="setFile"
            />

            <button
                type="button"
                class="manpower-import__dropzone"
                :disabled="importing"
                @click="chooseFile"
            >
                <i class="pi pi-file-excel" />
                <strong>{{ selectedFile?.name || t("manpowerPlan.chooseFile") }}</strong>
                <span>{{ t("manpowerPlan.importFileHint") }}</span>
            </button>

            <Button
                v-if="selectedFile"
                icon="pi pi-times"
                :label="t('manpowerPlan.removeSelectedFile')"
                severity="secondary"
                text
                :disabled="importing"
                @click="clearFile"
            />

            <div v-if="importing || progress > 0" class="manpower-import__progress">
                <div>
                    <span>{{ t("manpowerPlan.importProgress") }}</span>
                    <strong>{{ progress }}%</strong>
                </div>
                <ProgressBar :value="progress" :show-value="false" />
            </div>

            <Message v-if="errorMessage" severity="error" :closable="false">
                {{ errorMessage }}
            </Message>

            <Message
                v-if="result"
                :severity="errors.length ? 'warn' : 'success'"
                :closable="false"
            >
                {{ t("manpowerPlan.importResultSummary", {
                    created: result.created || 0,
                    updated: result.updated || 0,
                    skipped: result.skipped || 0,
                    failed: errors.length,
                }) }}
            </Message>
        </div>

        <template #footer>
            <EnterpriseFormFooter
                :save-label="t('manpowerPlan.import')"
                :cancel-label="t('common.cancel')"
                :saving="importing"
                :disabled="!selectedFile"
                @save="emit('import')"
                @cancel="close"
            />
        </template>
    </EnterpriseDialog>
</template>

<style scoped>
.manpower-import {
    display: grid;
    gap: 1rem;
}

.manpower-import__instructions {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.manpower-import__instructions h3,
.manpower-import__instructions p {
    margin: 0;
}

.manpower-import__instructions p {
    margin-top: 0.35rem;
    color: var(--hrms-text-muted);
}

.manpower-import__native {
    display: none;
}

.manpower-import__dropzone {
    display: grid;
    min-height: 10rem;
    place-items: center;
    gap: 0.35rem;
    padding: 1rem;
    color: var(--hrms-text);
    background: var(--hrms-surface-muted);
    border: 1px dashed var(--hrms-border-strong);
    border-radius: var(--hrms-radius-md);
    cursor: pointer;
}

.manpower-import__dropzone i {
    color: var(--p-green-500);
    font-size: 2rem;
}

.manpower-import__dropzone span {
    color: var(--hrms-text-muted);
}

.manpower-import__progress {
    display: grid;
    gap: 0.4rem;
}

.manpower-import__progress > div {
    display: flex;
    justify-content: space-between;
}

@media (max-width: 620px) {
    .manpower-import__instructions {
        align-items: stretch;
        flex-direction: column;
    }
}
</style>
