<script setup>
import Button from "primevue/button"
import Message from "primevue/message"
import ProgressBar from "primevue/progressbar"
import { computed, ref, watch } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"

const props = defineProps({
    visible: {
        type: Boolean,
        default: false,
    },
    importing: {
        type: Boolean,
        default: false,
    },
    progress: {
        type: Number,
        default: 0,
    },
    result: {
        type: Object,
        default: null,
    },
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

const selectedFileName = computed(() => selectedFile.value?.name || "")
const resultSummary = computed(() => ({
    totalRows: Number(props.result?.totalRows ?? props.result?.total ?? 0),
    created: Number(props.result?.created ?? 0),
    updated: Number(props.result?.updated ?? 0),
    skipped: Number(props.result?.skipped ?? 0),
}))

watch(
    () => props.visible,
    (visible) => {
        if (!visible && !props.importing) {
            clearFile()
        }
    },
)

function chooseFile() {
    inputRef.value?.click()
}

function onFileChange(event) {
    const file = event.target.files?.[0] ?? null
    selectedFile.value = file
    emit("file-change", file)
}

function clearFile() {
    selectedFile.value = null

    if (inputRef.value) {
        inputRef.value.value = ""
    }

    emit("file-change", null)
}

function closeDialog() {
    if (props.importing) {
        return
    }

    clearFile()
    emit("update:visible", false)
    emit("close")
}

function submitImport() {
    if (!selectedFile.value || props.importing) {
        return
    }

    emit("import")
}
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="t('organization.calendar.day.importTitle')"
        width="38rem"
        :busy="importing"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="calendar-import">
            <section class="calendar-import__instructions">
                <div>
                    <h3>
                        {{ t("organization.calendar.day.importTitle") }}
                    </h3>

                    <p>
                        {{ t("organization.calendar.day.importDescription") }}
                    </p>
                </div>

                <Button
                    type="button"
                    icon="pi pi-download"
                    :label="t('organization.calendar.day.downloadSample')"
                    severity="secondary"
                    outlined
                    :disabled="importing"
                    @click="emit('download-template')"
                />
            </section>

            <section class="calendar-import__file-section">
                <input
                    ref="inputRef"
                    class="calendar-import__native-input"
                    type="file"
                    accept=".xlsx,.xls"
                    :disabled="importing"
                    @change="onFileChange"
                />

                <button
                    type="button"
                    class="calendar-import__dropzone"
                    :disabled="importing"
                    @click="chooseFile"
                >
                    <i class="pi pi-file-excel" />

                    <span class="calendar-import__dropzone-title">
                        {{
                            selectedFileName ||
                            t("organization.calendar.day.importExcel")
                        }}
                    </span>

                    <span class="calendar-import__dropzone-description">
                        .xlsx or .xls
                    </span>
                </button>

                <Button
                    v-if="selectedFileName"
                    type="button"
                    icon="pi pi-times"
                    :label="t('common.remove')"
                    severity="secondary"
                    text
                    :disabled="importing"
                    @click="clearFile"
                />
            </section>

            <div
                v-if="importing || progress > 0"
                class="calendar-import__progress"
            >
                <div class="calendar-import__progress-header">
                    <span>
                        {{ t("organization.calendar.day.importExcel") }}
                    </span>

                    <strong>{{ progress }}%</strong>
                </div>

                <ProgressBar
                    :value="progress"
                    :show-value="false"
                />
            </div>

            <Message
                v-if="result"
                severity="success"
                :closable="false"
            >
                <div class="calendar-import__result-grid">
                    <span>Rows: <strong>{{ resultSummary.totalRows }}</strong></span>
                    <span>Created: <strong>{{ resultSummary.created }}</strong></span>
                    <span>Updated: <strong>{{ resultSummary.updated }}</strong></span>
                    <span>Skipped: <strong>{{ resultSummary.skipped }}</strong></span>
                </div>
            </Message>
        </div>

        <template #footer>
            <EnterpriseFormFooter
                :save-label="t('organization.calendar.day.importExcel')"
                :cancel-label="t('common.cancel')"
                :saving="importing"
                :disabled="!selectedFile"
                @save="submitImport"
                @cancel="closeDialog"
            />
        </template>
    </EnterpriseDialog>
</template>

<style scoped>
.calendar-import {
    display: grid;
    gap: 1rem;
}

.calendar-import__instructions {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.calendar-import__instructions h3 {
    margin: 0;
    font-size: 0.84rem;
}

.calendar-import__instructions p {
    margin: 0.35rem 0 0;
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.74rem;
    line-height: 1.5;
}

.calendar-import__file-section {
    display: grid;
    gap: 0.5rem;
}

.calendar-import__native-input {
    display: none;
}

.calendar-import__dropzone {
    display: grid;
    min-height: 9rem;
    place-items: center;
    align-content: center;
    gap: 0.45rem;
    padding: 1rem;
    border: 1px dashed var(--p-content-border-color, #cbd5e1);
    border-radius: var(--hrms-radius-md, 0.5rem);
    background: var(--p-surface-50, #f8fafc);
    color: inherit;
    cursor: pointer;
}

.calendar-import__dropzone:hover:not(:disabled) {
    border-color: var(--p-primary-color);
    background: var(--p-primary-50, #eff6ff);
}

.calendar-import__dropzone:disabled {
    cursor: not-allowed;
    opacity: 0.65;
}

.calendar-import__dropzone > .pi {
    color: var(--p-green-600, #16a34a);
    font-size: 1.65rem;
}

.calendar-import__dropzone-title {
    max-width: 100%;
    overflow: hidden;
    font-size: 0.78rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.calendar-import__dropzone-description {
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.7rem;
}

.calendar-import__progress {
    display: grid;
    gap: 0.4rem;
}

.calendar-import__progress-header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.72rem;
}

.calendar-import__result-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem 1rem;
    font-size: 0.74rem;
}

@media (max-width: 560px) {
    .calendar-import__instructions {
        align-items: stretch;
        flex-direction: column;
    }

    .calendar-import__result-grid {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
