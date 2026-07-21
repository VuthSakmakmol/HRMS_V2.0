<script setup>
import Button from "primevue/button"
import Message from "primevue/message"
import ProgressBar from "primevue/progressbar"
import { computed,ref } from "vue"
import { useI18n } from "vue-i18n"
import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
const props=defineProps({visible:Boolean,importing:Boolean,progress:{type:Number,default:0},phase:{type:String,default:"IDLE"},phaseMessageKey:{type:String,default:""},processedRows:{type:Number,default:0},totalRows:{type:Number,default:0},result:{type:Object,default:null}})
const emit=defineEmits(['update:visible','file-change','download-template','import','close']);const inputRef=ref(null),file=ref(null);const fileName=computed(()=>file.value?.name||'')
const { t, te } = useI18n()
const requiredFields = ["employeeCode", "departmentCode", "positionCode", "lineCode", "shiftCode", "joinDate"]
const optionalExamples = "Names, gender, dateOfBirth, email, phoneNumber, employeeType, addresses, documents, skills and account creation"
function fieldLabel(field) { return String(field || "employee").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, value => value.toUpperCase()) }
function errorText(item) { return item?.messageKey && te(item.messageKey) ? t(item.messageKey) : (item?.message || item?.messageKey || "Invalid value") }
const progressText=computed(()=>{
    if(props.phaseMessageKey&&te(props.phaseMessageKey))return t(props.phaseMessageKey)
    const labels={UPLOADING:"Uploading file",UPLOADED:"File uploaded",READING_FILE:"Reading Excel file",VALIDATING:"Validating rows",RESOLVING_REFERENCES:"Checking master data",SAVING_ROWS:"Saving employees",COMPLETED:"Import completed",FAILED:"Import failed"}
    return labels[props.phase]||"Processing import"
})
function changed(e){file.value=e.target.files?.[0]||null;emit('file-change',file.value)}function close(){if(file.value){file.value=null;emit('file-change',null)}emit('update:visible',false);emit('close')}
</script>
<template>
    <EnterpriseDialog
        :visible="visible"
        title="Import Employees"
        width="38rem"
        :busy="importing"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="employee-import">
            <section class="employee-import__instructions">
                <div>
                    <h3>Import Employees</h3>
                    <p>
                        Download the template and keep its column names. The complete file is validated before anything is saved.
                    </p>
                </div>

                <Button
                    icon="pi pi-download"
                    label="Download Template"
                    severity="secondary"
                    outlined
                    :disabled="importing"
                    @click="emit('download-template')"
                />
            </section>

            <section class="employee-import__guide">
                <div><strong>Required columns</strong><span>{{ requiredFields.join(", ") }}</span></div>
                <div><strong>Optional columns</strong><span>{{ optionalExamples }}</span></div>
                <div><strong>Important formats</strong><span>Dates: DD/MM/YYYY · phone numbers: digits only · codes must match active master data.</span></div>
            </section>

            <input
                ref="inputRef"
                type="file"
                accept=".xlsx,.xls"
                hidden
                @change="changed"
            />

            <button
                type="button"
                class="employee-import__dropzone"
                :disabled="importing"
                @click="inputRef?.click()"
            >
                <i class="pi pi-file-excel" />
                <strong>{{ fileName || "Choose employee Excel file" }}</strong>
                <small>.xlsx or .xls</small>
            </button>

            <ProgressBar
                v-if="importing || progress"
                :value="progress"
                :show-value="true"
            />
            <div v-if="importing" class="employee-import__progress-copy">
                <strong>{{ progressText }}</strong>
                <span v-if="totalRows">{{ processedRows }} / {{ totalRows }} rows</span>
            </div>

            <Message
                v-if="result"
                :severity="result.errors?.length ? 'warn' : 'success'"
                :closable="false"
            >
                <div class="employee-import__result">
                    <strong>Import result</strong>

                    <div class="employee-import__result-summary">
                        <span>Total: {{ result.totalRows ?? 0 }}</span>
                        <span>Created: {{ result.created ?? 0 }}</span>
                        <span>Updated: {{ result.updated ?? 0 }}</span>
                        <span>Skipped: {{ result.skipped ?? 0 }}</span>
                        <span>Errors: {{ result.errors?.length ?? 0 }}</span>
                    </div>

                    <div
                        v-if="result.errors?.length"
                        class="employee-import__errors"
                    >
                        <div
                            v-for="(item, index) in result.errors"
                            :key="`${item.rowNumber}-${item.field}-${index}`"
                            class="employee-import__error"
                        >
                            <strong>Row {{ item.rowNumber ?? "—" }}</strong>
                            <span>{{ fieldLabel(item.field) }}</span>
                            <span class="employee-import__reason">
                                <strong>{{ errorText(item) }}</strong>
                                <small v-if="item.value">Received: {{ item.value }}</small>
                                <small v-if="item.expected">Expected: {{ item.expected }}</small>
                            </span>
                        </div>
                    </div>
                </div>
            </Message>
        </div>

        <template #footer>
            <EnterpriseFormFooter
                save-label="Import Excel"
                cancel-label="Cancel"
                :saving="importing"
                :disabled="!file"
                @save="emit('import')"
                @cancel="close"
            />
        </template>
    </EnterpriseDialog>
</template>
<style scoped>
.employee-import {
    display: grid;
    gap: 1rem;
}

.employee-import__instructions {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.employee-import h3 {
    margin: 0;
    font-size: 0.84rem;
}

.employee-import p {
    margin: 0.35rem 0 0;
    color: var(--p-text-muted-color, #64748b);
    font-size: 0.74rem;
    line-height: 1.5;
}

.employee-import__dropzone {
    display: grid;
    min-height: 9rem;
    place-items: center;
    align-content: center;
    gap: 0.45rem;
    padding: 1rem;
    border: 1px dashed var(--p-content-border-color, #cbd5e1);
    border-radius: 0.5rem;
    background: var(--p-surface-50, #f8fafc);
    cursor: pointer;
}

.employee-import__guide {
    display: grid;
    gap: 0.45rem;
    padding: 0.7rem 0.8rem;
    border: 1px solid var(--p-content-border-color, #dbe3ef);
    border-radius: 0.45rem;
    background: var(--p-surface-50, #f8fafc);
    font-size: 0.72rem;
}

.employee-import__guide div { display: grid; grid-template-columns: 8.5rem minmax(0, 1fr); gap: 0.65rem; }
.employee-import__guide span, .employee-import__reason small { color: var(--p-text-muted-color, #64748b); }
.employee-import__reason { display: grid; gap: 0.15rem; }
.employee-import__reason strong { font-weight: 600; }
.employee-import__progress-copy { display: flex; justify-content: space-between; gap: 1rem; color: var(--p-text-muted-color, #64748b); font-size: 0.72rem; }

.employee-import__dropzone:hover:not(:disabled) {
    border-color: var(--p-primary-color);
    background: var(--p-primary-50, #eff6ff);
}

.employee-import__dropzone .pi {
    color: var(--p-green-600, #16a34a);
    font-size: 1.65rem;
}

.employee-import__dropzone small {
    color: var(--p-text-muted-color, #64748b);
}

.employee-import__result {
    display: grid;
    gap: 0.65rem;
    width: 100%;
    font-size: 0.75rem;
}

.employee-import__result-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.35rem 0.75rem;
}

.employee-import__errors {
    display: grid;
    max-height: 14rem;
    gap: 0.35rem;
    overflow: auto;
}

.employee-import__error {
    display: grid;
    grid-template-columns: 5rem 8rem minmax(0, 1fr);
    gap: 0.5rem;
    padding: 0.45rem;
    border-radius: 0.35rem;
    background: var(--p-red-50, #fef2f2);
    overflow-wrap: anywhere;
}

@media (max-width: 560px) {
    .employee-import__instructions {
        flex-direction: column;
    }

    .employee-import__result-summary,
    .employee-import__error,
    .employee-import__guide div {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
