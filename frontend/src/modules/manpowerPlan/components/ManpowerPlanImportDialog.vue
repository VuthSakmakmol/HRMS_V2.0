<script setup>
import Button from "primevue/button"
import Message from "primevue/message"
import ProgressBar from "primevue/progressbar"
import { computed, ref, watch } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"

const props = defineProps({
    visible: { type: Boolean, default: false },
    importing: { type: Boolean, default: false },
    progress: { type: Number, default: 0 },
    result: { type: Object, default: null },
    error: { type: Object, default: null },
})

const emit = defineEmits([
    "update:visible",
    "file-change",
    "download-template",
    "import",
    "close",
])

const { t, te } = useI18n()
const inputRef = ref(null)
const selectedFile = ref(null)

const fieldLabels = Object.freeze({
    file: "File",
    row: "Row",
    companyCode: "Company Code",
    branchCode: "Branch Code",
    year: "Year",
    month: "Month",
    departmentCode: "Department Code",
    positionCode: "Position Code",
    targetBudget: "Target Budget",
    targetRoadmap: "Target Roadmap",
    status: "Status",
    remark: "Remark",
})

function chooseFile() {
    if (props.importing) return
    if (inputRef.value) inputRef.value.value = ""
    inputRef.value?.click()
}

function setFile(event) {
    selectedFile.value = event.target.files?.[0] || null
    emit("file-change", selectedFile.value)
}

function clearFile({ notify = true } = {}) {
    selectedFile.value = null
    if (inputRef.value) inputRef.value.value = ""
    if (notify) emit("file-change", null)
}

function close() {
    if (props.importing) return
    clearFile()
    emit("update:visible", false)
    emit("close")
}

function updateVisible(visible) {
    if (visible) {
        emit("update:visible", true)
        return
    }

    close()
}

function fieldLabel(field) {
    if (fieldLabels[field]) return fieldLabels[field]

    return String(field || "row")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, (value) => value.toUpperCase())
}

function translatedError(item) {
    const key = item?.messageKey
    if (key && te(key)) return t(key)
    return item?.message || key || t("manpowerPlan.importUnknownError")
}

function normalizeApiError(error) {
    if (!error) return []

    if (Array.isArray(error.details?.errors)) {
        return error.details.errors
    }

    const fieldErrors = Object.entries(error.fields || {}).flatMap(
        ([field, messages]) =>
            (Array.isArray(messages) ? messages : [messages])
                .filter(Boolean)
                .map((messageKey) => ({
                    rowNumber: null,
                    field,
                    messageKey,
                    value: "",
                    expected: "",
                })),
    )

    if (fieldErrors.length) return fieldErrors

    if (error.messageKey) {
        return [
            {
                rowNumber: null,
                field: "file",
                messageKey: error.messageKey,
                message: error.message,
                value: "",
                expected: "",
            },
        ]
    }

    return []
}

const errors = computed(() => {
    if (Array.isArray(props.result?.errors)) return props.result.errors
    return normalizeApiError(props.error)
})

const hasErrors = computed(() => errors.value.length > 0 || Boolean(props.error))
const hasCompletedResult = computed(() => Boolean(props.result))
const resultSeverity = computed(() => {
    if (!hasErrors.value) return "success"
    return props.result?.validationFailed ? "error" : "warn"
})
const saveLabel = computed(() =>
    hasErrors.value
        ? t("manpowerPlan.importAgain")
        : t("manpowerPlan.importExcel"),
)
const genericErrorMessage = computed(() => {
    if (!props.error || errors.value.length) return ""
    if (props.error.messageKey && te(props.error.messageKey)) {
        return t(props.error.messageKey)
    }
    return props.error.message || t("manpowerPlan.importFailed")
})

watch(
    () => props.visible,
    (visible) => {
        if (!visible) clearFile({ notify: false })
    },
)
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="t('manpowerPlan.importTitle')"
        width="44rem"
        :busy="importing"
        @update:visible="updateVisible"
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

            <section class="manpower-import__guide">
                <div>
                    <strong>{{ t("manpowerPlan.importRequiredColumns") }}</strong>
                    <span>companyCode, branchCode, year, month, departmentCode, positionCode</span>
                </div>
                <div>
                    <strong>{{ t("manpowerPlan.importTargetRule") }}</strong>
                    <span>{{ t("manpowerPlan.importTargetRuleDetail") }}</span>
                </div>
                <div>
                    <strong>{{ t("manpowerPlan.importCodeRule") }}</strong>
                    <span>{{ t("manpowerPlan.importCodeRuleDetail") }}</span>
                </div>
            </section>

            <input
                ref="inputRef"
                class="manpower-import__native"
                type="file"
                accept=".xlsx"
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
                <strong>
                    {{ selectedFile?.name || t("manpowerPlan.chooseFile") }}
                </strong>
                <span>{{ t("manpowerPlan.importFileHint") }}</span>
                <small v-if="selectedFile">
                    {{ t("manpowerPlan.clickToReplaceFile") }}
                </small>
            </button>

            <Button
                v-if="selectedFile"
                icon="pi pi-times"
                :label="t('manpowerPlan.removeSelectedFile')"
                severity="secondary"
                text
                :disabled="importing"
                @click="clearFile()"
            />

            <div
                v-if="importing || progress > 0"
                class="manpower-import__progress"
            >
                <div>
                    <span>{{ t("manpowerPlan.importProgress") }}</span>
                    <strong>{{ progress }}%</strong>
                </div>
                <ProgressBar :value="progress" :show-value="false" />
            </div>

            <Message
                v-if="genericErrorMessage"
                severity="error"
                :closable="false"
            >
                {{ genericErrorMessage }}
            </Message>

            <Message
                v-if="hasCompletedResult || errors.length"
                :severity="resultSeverity"
                :closable="false"
            >
                <div class="manpower-import__result">
                    <div class="manpower-import__result-heading">
                        <strong>{{ t("manpowerPlan.importResultTitle") }}</strong>
                        <span v-if="props.result?.validationFailed">
                            {{ t("manpowerPlan.importNothingSaved") }}
                        </span>
                    </div>

                    <div class="manpower-import__result-summary">
                        <span>
                            {{ t("manpowerPlan.importTotal") }}:
                            <strong>{{ props.result?.totalRows ?? 0 }}</strong>
                        </span>
                        <span>
                            {{ t("manpowerPlan.importCreated") }}:
                            <strong>{{ props.result?.created ?? 0 }}</strong>
                        </span>
                        <span>
                            {{ t("manpowerPlan.importUpdated") }}:
                            <strong>{{ props.result?.updated ?? 0 }}</strong>
                        </span>
                        <span>
                            {{ t("manpowerPlan.importSkipped") }}:
                            <strong>{{ props.result?.skipped ?? 0 }}</strong>
                        </span>
                        <span>
                            {{ t("manpowerPlan.importErrors") }}:
                            <strong>{{ errors.length }}</strong>
                        </span>
                    </div>

                    <div
                        v-if="errors.length"
                        class="manpower-import__errors"
                    >
                        <div
                            v-for="(item, index) in errors"
                            :key="`${item.rowNumber ?? 'file'}-${item.field}-${index}`"
                            class="manpower-import__error"
                        >
                            <strong class="manpower-import__error-row">
                                {{
                                    item.rowNumber
                                        ? `${t('manpowerPlan.importRow')} ${item.rowNumber}`
                                        : t("manpowerPlan.importFileError")
                                }}
                            </strong>
                            <span class="manpower-import__error-field">
                                {{ fieldLabel(item.field) }}
                            </span>
                            <span class="manpower-import__reason">
                                <strong>{{ translatedError(item) }}</strong>
                                <small v-if="item.value">
                                    {{ t("manpowerPlan.importReceived") }}:
                                    {{ item.value }}
                                </small>
                                <small v-if="item.expected">
                                    {{ t("manpowerPlan.importExpected") }}:
                                    {{ item.expected }}
                                </small>
                            </span>
                        </div>
                    </div>

                    <p v-if="errors.length" class="manpower-import__retry-note">
                        {{ t("manpowerPlan.importRetryHint") }}
                    </p>
                </div>
            </Message>
        </div>

        <template #footer>
            <EnterpriseFormFooter
                :save-label="saveLabel"
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

.manpower-import__instructions h3 {
    font-size: 0.84rem;
}

.manpower-import__instructions p {
    margin-top: 0.35rem;
    color: var(--hrms-text-muted, var(--p-text-muted-color));
    font-size: 0.74rem;
    line-height: 1.5;
}

.manpower-import__guide {
    display: grid;
    gap: 0.45rem;
    padding: 0.7rem 0.8rem;
    border: 1px solid var(--hrms-border, var(--p-content-border-color));
    border-radius: var(--hrms-radius-md, 0.45rem);
    background: var(--hrms-surface-muted, var(--p-surface-50));
    font-size: 0.72rem;
}

.manpower-import__guide div {
    display: grid;
    grid-template-columns: 9rem minmax(0, 1fr);
    gap: 0.65rem;
}

.manpower-import__guide span,
.manpower-import__reason small,
.manpower-import__retry-note {
    color: var(--hrms-text-muted, var(--p-text-muted-color));
}

.manpower-import__native {
    display: none;
}

.manpower-import__dropzone {
    display: grid;
    min-height: 9rem;
    place-items: center;
    align-content: center;
    gap: 0.4rem;
    padding: 1rem;
    color: var(--hrms-text, var(--p-text-color));
    background: var(--hrms-surface-muted, var(--p-surface-50));
    border: 1px dashed var(--hrms-border-strong, var(--p-content-border-color));
    border-radius: var(--hrms-radius-md, 0.5rem);
    cursor: pointer;
}

.manpower-import__dropzone:hover:not(:disabled) {
    border-color: var(--p-primary-color);
    background: var(--p-primary-50, #eff6ff);
}

.manpower-import__dropzone i {
    color: var(--p-green-600, #16a34a);
    font-size: 1.8rem;
}

.manpower-import__dropzone span,
.manpower-import__dropzone small {
    color: var(--hrms-text-muted, var(--p-text-muted-color));
}

.manpower-import__progress {
    display: grid;
    gap: 0.4rem;
}

.manpower-import__progress > div {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
}

.manpower-import__result {
    display: grid;
    width: 100%;
    gap: 0.7rem;
    font-size: 0.75rem;
}

.manpower-import__result-heading {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem 1rem;
}

.manpower-import__result-heading span {
    font-weight: 600;
}

.manpower-import__result-summary {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.4rem;
}

.manpower-import__result-summary span {
    display: grid;
    gap: 0.15rem;
    padding: 0.45rem;
    border-radius: 0.35rem;
    background: color-mix(in srgb, var(--p-content-background) 78%, transparent);
}

.manpower-import__errors {
    display: grid;
    max-height: 18rem;
    gap: 0.4rem;
    overflow: auto;
    padding-right: 0.2rem;
}

.manpower-import__error {
    display: grid;
    grid-template-columns: 5rem 9.5rem minmax(0, 1fr);
    gap: 0.55rem;
    padding: 0.55rem;
    border: 1px solid var(--p-red-200, #fecaca);
    border-radius: 0.4rem;
    background: var(--p-red-50, #fef2f2);
    color: var(--p-red-950, #450a0a);
    overflow-wrap: anywhere;
}

.manpower-import__error-field {
    font-weight: 600;
}

.manpower-import__reason {
    display: grid;
    gap: 0.15rem;
}

.manpower-import__reason > strong {
    font-weight: 600;
}

.manpower-import__retry-note {
    margin: 0;
    line-height: 1.5;
}

@media (max-width: 700px) {
    .manpower-import__instructions {
        align-items: stretch;
        flex-direction: column;
    }

    .manpower-import__result-summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .manpower-import__error,
    .manpower-import__guide div {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
