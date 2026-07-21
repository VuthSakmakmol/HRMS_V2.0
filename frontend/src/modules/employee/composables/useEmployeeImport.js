import { computed, ref } from "vue"

import {
    startEmployeeImportJob,
    waitForEmployeeImportJob,
} from "../api/employee.api.js"

export function useEmployeeImport() {
    const visible = ref(false)
    const file = ref(null)
    const importing = ref(false)
    const progress = ref(0)
    const result = ref(null)
    const phase = ref("IDLE")
    const phaseMessageKey = ref("")
    const processedRows = ref(0)
    const totalRows = ref(0)
    let pollController = null

    const canImport = computed(() =>
        Boolean(file.value) && !importing.value,
    )

    function open() {
        pollController?.abort()
        file.value = null
        progress.value = 0
        result.value = null
        phase.value = "IDLE"
        phaseMessageKey.value = ""
        processedRows.value = 0
        totalRows.value = 0
        visible.value = true
    }

    function setFile(nextFile) {
        file.value = nextFile
        result.value = null
        progress.value = 0
        phase.value = "IDLE"
        phaseMessageKey.value = ""
        processedRows.value = 0
        totalRows.value = 0
    }

    function applyJob(job) {
        progress.value = Number(job?.percent ?? 0)
        phase.value = job?.phase || "PROCESSING"
        phaseMessageKey.value = job?.messageKey || ""
        processedRows.value = Number(job?.processedRows ?? 0)
        totalRows.value = Number(job?.totalRows ?? 0)
    }

    async function submit(params = {}) {
        if (!canImport.value) {
            return null
        }

        importing.value = true
        result.value = null
        phase.value = "UPLOADING"
        phaseMessageKey.value = "errors.employee.import.phaseUploading"
        pollController = new AbortController()

        try {
            const job = await startEmployeeImportJob(
                file.value,
                params,
                (event) => {
                    if (event.total) progress.value = Math.min(5, Math.round((event.loaded * 5) / event.total))
                },
            )
            applyJob(job)
            const completedJob = await waitForEmployeeImportJob(job.jobId, {
                signal: pollController.signal,
                onProgress: applyJob,
            })
            if (completedJob.status === "FAILED") {
                const error = new Error(completedJob.error?.message || "Employee import failed.")
                error.code = completedJob.error?.code
                error.messageKey = completedJob.error?.messageKey
                throw error
            }
            result.value = completedJob.result
            progress.value = 100
            return result.value
        } catch (error) {
            if (error.importSummary) {
                result.value = error.importSummary
            }

            throw error
        } finally {
            importing.value = false
        }
    }

    return {
        visible,
        file,
        importing,
        progress,
        result,
        phase,
        phaseMessageKey,
        processedRows,
        totalRows,
        canImport,
        open,
        setFile,
        submit,
    }
}
