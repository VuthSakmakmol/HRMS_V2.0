<script setup>
import Button from "primevue/button"
import Message from "primevue/message"
import ProgressBar from "primevue/progressbar"
import { computed, ref, watch } from "vue"
import { useI18n } from "vue-i18n"

import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"

const props = defineProps({
    visible: Boolean,
    importing: Boolean,
    progress: Number,
    result: Object,
})
const { t } = useI18n()
const emit = defineEmits(["update:visible", "file-change", "template", "import"])
const file = ref(null)
const errors = computed(() => props.result?.errors || [])

watch(
    () => props.visible,
    (visible) => {
        if (!visible) file.value = null
    },
)

function changed(event) {
    file.value = event.target.files?.[0] || null
    emit("file-change", file.value)
}
</script>

<template>
    <EnterpriseDialog
        :visible="visible"
        :title="t('hrDashboardTarget.importTitle')"
        width="44rem"
        :busy="importing"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="import-body">
            <div class="import-head">
                <span>{{ t('hrDashboardTarget.importDescription') }}</span>
                <Button
                    :label="t('hrDashboardTarget.sample')"
                    icon="pi pi-download"
                    severity="secondary"
                    outlined
                    @click="emit('template')"
                />
            </div>
            <input type="file" accept=".xlsx,.xls" @change="changed">
            <ProgressBar v-if="importing" :value="progress" />
            <Message v-if="result" :severity="result.errorCount ? 'warn' : 'success'" :closable="false">
                Created {{ result.created || 0 }}, updated {{ result.updated || 0 }}, errors {{ result.errorCount || 0 }}.
            </Message>
            <div v-if="errors.length" class="error-list">
                <div v-for="(error, index) in errors" :key="`${error.row}-${index}`">
                    <strong>Row {{ error.row }}</strong>
                    <span>{{ error.message }}</span>
                </div>
            </div>
        </div>
        <template #footer>
            <EnterpriseFormFooter
                :save-label="t('hrDashboardTarget.import')"
                :saving="importing"
                :disabled="!file"
                @cancel="emit('update:visible', false)"
                @save="emit('import')"
            />
        </template>
    </EnterpriseDialog>
</template>

<style scoped>
.import-body { display: grid; gap: 1rem; }
.import-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; color: var(--p-text-muted-color); font-size: .8rem; }
.error-list { max-height: 14rem; overflow: auto; border: 1px solid var(--p-orange-200); border-radius: .5rem; }
.error-list > div { display: grid; grid-template-columns: 5rem minmax(0, 1fr); gap: .75rem; padding: .5rem .65rem; border-top: 1px solid var(--p-content-border-color); font-size: .76rem; }
.error-list > div:first-child { border-top: 0; }
@media (max-width: 640px) { .import-head { align-items: stretch; flex-direction: column; } }
</style>
