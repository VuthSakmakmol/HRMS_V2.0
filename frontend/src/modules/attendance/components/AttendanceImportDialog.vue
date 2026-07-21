<script setup>
import Button from "primevue/button"
import Message from "primevue/message"
import ProgressBar from "primevue/progressbar"
import { computed, ref } from "vue"
import EnterpriseDialog from "@/shared/components/enterprise/EnterpriseDialog.vue"
import EnterpriseFormFooter from "@/shared/components/enterprise/EnterpriseFormFooter.vue"
const props=defineProps({visible:Boolean,importing:Boolean,progress:Number,result:Object})
const emit=defineEmits(["update:visible","file-change","template","import"])
const file=ref(null)
function changed(event){file.value=event.target.files?.[0]||null;emit('file-change',file.value)}
const errors=computed(()=>props.result?.errors||[])
const issues=computed(()=>props.result?.issues||[])
const listedProblems=computed(()=>[...errors.value,...issues.value])
function downloadErrors(){
    const escape=(value)=>`"${String(value??"").replaceAll('"','""')}"`
    const csv=["Row,Code,Employee No,Reason",...listedProblems.value.map(error=>`${escape(error.row)},${escape(error.code)},${escape(error.employeeCode)},${escape(error.message)}`)].join("\r\n")
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}))
    const link=document.createElement("a")
    link.href=url
    link.download="attendance-import-errors.csv"
    link.click()
    URL.revokeObjectURL(url)
}
</script>
<template><EnterpriseDialog :visible="visible" title="Import Attendance Records" width="46rem" :busy="importing" @update:visible="emit('update:visible',$event)"><div class="import-body"><div class="import-head"><span>Record Date and Employee No are required. Times use HHmm. Both times blank becomes ABSENT. An unknown Employee No is retained as Unmatched Attendance.</span><Button label="Download Sample" icon="pi pi-download" severity="secondary" outlined @click="emit('template')"/></div><input type="file" accept=".xlsx,.xls" @change="changed"><ProgressBar v-if="importing" :value="progress"/><Message v-if="result" :severity="listedProblems.length?'warn':'success'" :closable="false">Imported {{ result.successCount||0 }} of {{ result.totalRows||0 }}. Absent: {{ result.absentCount||0 }}. Missing in: {{ result.missingInCount||0 }}. Missing out: {{ result.missingOutCount||0 }}. Unmatched: {{ result.unmatchedCount||0 }}. Invalid: {{ result.errorCount||0 }}.</Message><section v-if="listedProblems.length" class="error-panel"><div class="error-head"><strong>Backend import results</strong><Button label="Download List" icon="pi pi-download" severity="secondary" text size="small" @click="downloadErrors"/></div><div class="error-list"><div v-for="(error,index) in listedProblems" :key="`${error.row}-${index}`" class="error-row"><strong>Row {{ error.row }}</strong><span>{{ error.message }}</span></div></div></section></div><template #footer><EnterpriseFormFooter save-label="Import" :saving="importing" :disabled="!file" @cancel="emit('update:visible',false)" @save="emit('import')"/></template></EnterpriseDialog></template>
<style scoped>.import-body{display:grid;gap:1rem}.import-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;color:var(--p-text-muted-color);font-size:.8rem}.error-panel{border:1px solid var(--p-orange-200);border-radius:.5rem;overflow:hidden}.error-head{display:flex;align-items:center;justify-content:space-between;padding:.45rem .65rem;background:var(--p-orange-50);font-size:.78rem}.error-list{max-height:14rem;overflow:auto}.error-row{display:grid;grid-template-columns:5rem minmax(0,1fr);gap:.65rem;padding:.45rem .65rem;border-top:1px solid var(--p-content-border-color);font-size:.76rem}.error-row span{overflow-wrap:anywhere}@media(max-width:640px){.import-head{align-items:stretch;flex-direction:column}.error-row{grid-template-columns:1fr}}
</style>
