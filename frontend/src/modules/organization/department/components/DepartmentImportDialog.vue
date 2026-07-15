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

const hasResultErrors = computed(() => {
    return Number(props.result?.failed ?? props.result?.errors?.length ?? 0) > 0
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
        :title="t('organization.department.importTitle')"
        width="38rem"
        :busy="importing"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="department-import">
            <section class="department-import__instructions">
                <div>
                    <h3>
                        {{ t("organization.department.importInstructionsTitle") }}
                    </h3>

                    <p>
                        {{ t("organization.department.importInstructions") }}
                    </p>
                </div>

                <Button
                    type="button"
                    icon="pi pi-download"
                    :label="t('organization.department.downloadTemplate')"
                    severity="secondary"
                    outlined
                    :disabled="importing"
                    @click="emit('download-template')"
                />
            </section>

            <section class="department-import__file-section">
                <input
                    ref="inputRef"
                    class="department-import__native-input"
                    type="file"
                    accept=".xlsx,.xls"
                    :disabled="importing"
                    @change="onFileChange"
                />

                <button
                    type="button"
                    class="department-import__dropzone"
                    :disabled="importing"
                    @click="chooseFile"
                >
                    <i class="pi pi-file-excel" />

                    <span class="department-import__dropzone-title">
                        {{
                            selectedFileName ||
                            t("organization.department.chooseImportFile")
                        }}
                    </span>

                    <span class="department-import__dropzone-description">
                        {{ t("organization.department.importFileHint") }}
                    </span>
                </button>

                <Button
                    v-if="selectedFileName"
                    type="button"
                    icon="pi pi-times"
                    :label="t('organization.department.removeSelectedFile')"
                    severity="secondary"
                    text
                    :disabled="importing"
                    @click="clearFile"
                />
            </section>

            <div
                v-if="importing || progress > 0"
                class="department-import__progress"
            >
                <div class="department-import__progress-header">
                    <span>
                        {{ t("organization.department.importProgress") }}
                    </span>

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
                <div class="department-import__result">
                    <span>
                        {{
                            t("organization.department.importResult", {
                                total: result.total ?? 0,
                                created: result.created ?? 0,
                                updated: result.updated ?? 0,
                                failed:
                                    result.failed ??
                                    result.errors?.length ??
                                    0,
                            })
                        }}
                    </span>
                </div>
            </Message>
        </div>

        <template #footer>
            <EnterpriseFormFooter
                :save-label="t('organization.department.importAction')"
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
.department-import {
    display: grid;
    gap: 1rem;
}

.department-import__instructions {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.department-import__instructions h3 {
    margin: 0;
    font-size: 0.84rem;
}

.department-import__instructions p {
    margin: 0.35rem 0 0;
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.74rem;
    line-height: 1.5;
}

.department-import__file-section {
    display: grid;
    gap: 0.5rem;
}

.department-import__native-input {
    display: none;
}

.department-import__dropzone {
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

.department-import__dropzone:hover:not(:disabled) {
    border-color: var(--p-primary-color);
    background: var(--p-primary-50, #eff6ff);
}

.department-import__dropzone:disabled {
    cursor: not-allowed;
    opacity: 0.65;
}

.department-import__dropzone > .pi {
    color: var(--p-green-600, #16a34a);
    font-size: 1.65rem;
}

.department-import__dropzone-title {
    max-width: 100%;
    overflow: hidden;
    font-size: 0.78rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.department-import__dropzone-description {
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.7rem;
}

.department-import__progress {
    display: grid;
    gap: 0.4rem;
}

.department-import__progress-header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.72rem;
}

.department-import__result {
    font-size: 0.74rem;
    line-height: 1.5;
}

@media (max-width: 560px) {
    .department-import__instructions {
        align-items: stretch;
        flex-direction: column;
    }
}
</style>
