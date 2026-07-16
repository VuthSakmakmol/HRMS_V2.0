<script setup>
import Button from "primevue/button"
import Message from "primevue/message"
import ProgressBar from "primevue/progressbar"
import {
    computed,
    ref,
} from "vue"
import {
    useI18n,
} from "vue-i18n"

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

    phaseMessageKey: {
        type: String,
        default: "",
    },

    processedRows: {
        type: Number,
        default: 0,
    },

    totalRows: {
        type: Number,
        default: 0,
    },

    result: {
        type: Object,
        default: null,
    },

    errorMessage: {
        type: String,
        default: "",
    },
})

const emit = defineEmits([
    "update:visible",
    "file-change",
    "download-template",
    "import",
    "close",
])

const {
    t,
} = useI18n()

const inputRef = ref(null)
const selectedFile = ref(null)

const selectedFileName = computed(() => {
    return selectedFile.value?.name || ""
})

const resultErrors = computed(() => {
    return Array.isArray(props.result?.errors) ? props.result.errors : []
})

const hasResultErrors = computed(() => {
    return resultErrors.value.length > 0
})

const resultSummary = computed(() => {
    return {
        totalRows: Number(props.result?.totalRows ?? props.result?.total ?? 0),
        created: Number(props.result?.created ?? 0),
        updated: Number(props.result?.updated ?? 0),
        skipped: Number(props.result?.skipped ?? 0),
        failed: resultErrors.value.length,
    }
})

const progressPhaseLabel = computed(() => {
    if (!props.phaseMessageKey) {
        return t("organization.line.importProgress")
    }

    return t(props.phaseMessageKey)
})

const rowProgressLabel = computed(() => {
    if (!props.totalRows) {
        return ""
    }

    return t("organization.line.importRowsProcessed", {
        processed: props.processedRows,
        total: props.totalRows,
    })
})

function chooseFile() {
    inputRef.value?.click()
}

function onFileChange(event) {
    const nextFile = event.target.files?.[0] ?? null

    selectedFile.value = nextFile
    emit("file-change", nextFile)
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
        :title="t('organization.line.importTitle')"
        width="38rem"
        :busy="importing"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="line-import">
            <section class="line-import__instructions">
                <div>
                    <h3>
                        {{ t("organization.line.importInstructionsTitle") }}
                    </h3>

                    <p>
                        {{ t("organization.line.importInstructions") }}
                    </p>
                </div>

                <Button
                    type="button"
                    icon="pi pi-download"
                    :label="t('organization.line.downloadTemplate')"
                    severity="secondary"
                    outlined
                    :disabled="importing"
                    @click="emit('download-template')"
                />
            </section>

            <section class="line-import__file-section">
                <input
                    ref="inputRef"
                    class="line-import__native-input"
                    type="file"
                    accept=".xlsx,.xls"
                    :disabled="importing"
                    @change="onFileChange"
                />

                <button
                    type="button"
                    class="line-import__dropzone"
                    :disabled="importing"
                    @click="chooseFile"
                >
                    <i class="pi pi-file-excel" />

                    <span class="line-import__dropzone-title">
                        {{
                            selectedFileName ||
                            t("organization.line.chooseImportFile")
                        }}
                    </span>

                    <span class="line-import__dropzone-description">
                        {{ t("organization.line.importFileHint") }}
                    </span>
                </button>

                <Button
                    v-if="selectedFileName"
                    type="button"
                    icon="pi pi-times"
                    :label="t('organization.line.removeSelectedFile')"
                    severity="secondary"
                    text
                    :disabled="importing"
                    @click="clearFile"
                />
            </section>

            <div
                v-if="importing || progress > 0"
                class="line-import__progress"
            >
                <div class="line-import__progress-header">
                    <div class="line-import__progress-copy">
                        <span>
                            {{ progressPhaseLabel }}
                        </span>

                        <small v-if="rowProgressLabel">
                            {{ rowProgressLabel }}
                        </small>
                    </div>

                    <strong>
                        {{ progress }}%
                    </strong>
                </div>

                <ProgressBar
                    :value="progress"
                    :show-value="false"
                />
            </div>

            <Message
                v-if="errorMessage"
                severity="error"
                :closable="false"
            >
                {{ errorMessage }}
            </Message>

            <Message
                v-if="result"
                :severity="hasResultErrors ? 'warn' : 'success'"
                :closable="false"
            >
                <div class="line-import__result">
                    <strong>
                        {{ t("organization.line.importResult") }}
                    </strong>

                    <div class="line-import__result-grid">
                        <span>
                            {{ t("organization.line.importTotalRows") }}:
                            <strong>{{ resultSummary.totalRows }}</strong>
                        </span>

                        <span>
                            {{ t("organization.line.importCreatedCount") }}:
                            <strong>{{ resultSummary.created }}</strong>
                        </span>

                        <span>
                            {{ t("organization.line.importUpdatedCount") }}:
                            <strong>{{ resultSummary.updated }}</strong>
                        </span>

                        <span>
                            {{ t("organization.line.importSkippedCount") }}:
                            <strong>{{ resultSummary.skipped }}</strong>
                        </span>

                        <span>
                            {{ t("organization.line.importFailedCount") }}:
                            <strong>{{ resultSummary.failed }}</strong>
                        </span>
                    </div>

                    <div
                        v-if="resultErrors.length"
                        class="line-import__errors"
                    >
                        <div
                            v-for="(item, index) in resultErrors"
                            :key="`${item.rowNumber}-${item.field}-${index}`"
                            class="line-import__error-row"
                        >
                            <strong>
                                {{
                                    t("organization.line.importRow", {
                                        row: item.rowNumber,
                                    })
                                }}
                            </strong>

                            <span>
                                {{ item.field }}
                            </span>

                            <span>
                                {{ t(item.messageKey) }}
                            </span>
                        </div>
                    </div>
                </div>
            </Message>
        </div>

        <template #footer>
            <EnterpriseFormFooter
                :save-label="t('organization.line.importAction')"
                :cancel-label="t('common.close')"
                :saving="importing"
                :disabled="!selectedFile"
                @save="submitImport"
                @cancel="closeDialog"
            />
        </template>
    </EnterpriseDialog>
</template>

<style scoped>
.line-import {
    display: grid;
    gap: 1rem;
}

.line-import__instructions {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.line-import__instructions h3 {
    margin: 0;
    font-size: 0.84rem;
}

.line-import__instructions p {
    margin: 0.35rem 0 0;
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.74rem;
    line-height: 1.5;
}

.line-import__file-section {
    display: grid;
    gap: 0.5rem;
}

.line-import__native-input {
    display: none;
}

.line-import__dropzone {
    display: grid;
    min-height: 9rem;
    place-items: center;
    align-content: center;
    gap: 0.45rem;
    padding: 1rem;
    border: 1px dashed var(--p-content-border-color, #cbd5e1);
    border-radius: var(--hrms-radius-md);
    background: var(--p-surface-50, #f8fafc);
    color: inherit;
    cursor: pointer;
}

.line-import__dropzone:hover:not(:disabled) {
    border-color: var(--p-primary-color);
    background: var(--p-primary-50, #eff6ff);
}

.line-import__dropzone:disabled {
    cursor: not-allowed;
    opacity: 0.65;
}

.line-import__dropzone > .pi {
    color: var(--p-green-600, #16a34a);
    font-size: 1.65rem;
}

.line-import__dropzone-title {
    max-width: 100%;
    overflow: hidden;
    font-size: 0.78rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.line-import__dropzone-description {
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.7rem;
}

.line-import__progress {
    display: grid;
    gap: 0.4rem;
}

.line-import__progress-copy {
    display: grid;
    gap: 0.15rem;
}

.line-import__progress-copy small {
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.68rem;
}

.line-import__progress-header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.72rem;
}

.line-import__result {
    font-size: 0.74rem;
    line-height: 1.5;
}

@media (max-width: 560px) {
    .line-import__instructions {
        align-items: stretch;
        flex-direction: column;
    }
}
</style>

<style scoped>
.line-import__result {
    display: grid;
    gap: 0.625rem;
    width: 100%;
}

.line-import__result-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.5rem;
    font-size: 0.72rem;
}

.line-import__result-grid > span {
    display: grid;
    gap: 0.15rem;
    padding: 0.45rem;
    border: 1px solid var(--p-content-border-color, #e2e8f0);
    border-radius: 0.375rem;
    background: var(--p-content-background, #fff);
}

.line-import__errors {
    display: grid;
    max-height: 12rem;
    overflow: auto;
    border: 1px solid var(--p-content-border-color, #e2e8f0);
    border-radius: 0.375rem;
}

.line-import__error-row {
    display: grid;
    grid-template-columns: 4.5rem 9rem minmax(0, 1fr);
    gap: 0.5rem;
    padding: 0.45rem 0.55rem;
    border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
    font-size: 0.7rem;
}

.line-import__error-row:last-child {
    border-bottom: 0;
}

@media (max-width: 640px) {
    .line-import__result-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .line-import__error-row {
        grid-template-columns: 1fr;
    }
}
</style>
