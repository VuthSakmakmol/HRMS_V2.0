import {
    computed,
    ref,
} from "vue"

import {
    startEmployeeTypeImportJob,
    waitForEmployeeTypeImportJob,
} from "../api/employeeType.api.js"

export function useEmployeeTypeImport() {
    const file = ref(null)
    const importing = ref(false)
    const progress = ref(0)
    const phase = ref("IDLE")
    const phaseMessageKey = ref("")
    const processedRows = ref(0)
    const totalRows = ref(0)
    const result = ref(null)
    const error = ref(null)
    const jobId = ref(null)

    let pollController = null

    const canImport = computed(() => {
        return Boolean(file.value) && !importing.value
    })

    function reset() {
        pollController?.abort()
        pollController = null

        file.value = null
        importing.value = false
        progress.value = 0
        phase.value = "IDLE"
        phaseMessageKey.value = ""
        processedRows.value = 0
        totalRows.value = 0
        result.value = null
        error.value = null
        jobId.value = null
    }

    function setFile(nextFile) {
        file.value = nextFile ?? null
        progress.value = 0
        phase.value = "IDLE"
        phaseMessageKey.value = ""
        processedRows.value = 0
        totalRows.value = 0
        result.value = null
        error.value = null
        jobId.value = null
    }

    function applyJobProgress(job) {
        progress.value = Number(job?.percent ?? 0)
        phase.value = job?.phase ?? "PROCESSING"
        phaseMessageKey.value = job?.messageKey ?? ""
        processedRows.value = Number(job?.processedRows ?? 0)
        totalRows.value = Number(job?.totalRows ?? 0)
    }

    async function submit() {
        if (!file.value || importing.value) {
            return null
        }

        importing.value = true
        progress.value = 0
        phase.value = "UPLOADING"
        phaseMessageKey.value = "organization.employeeType.importPhaseUploading"
        processedRows.value = 0
        totalRows.value = 0
        result.value = null
        error.value = null

        pollController = new AbortController()

        try {
            const job = await startEmployeeTypeImportJob(
                file.value,
                (event) => {
                    if (!event.total) {
                        return
                    }

                    // File transfer is only the first 5% of the complete job.
                    const uploadPercent = Math.round(
                        (event.loaded * 5) / event.total,
                    )

                    progress.value = Math.max(
                        progress.value,
                        Math.min(5, uploadPercent),
                    )
                },
            )

            jobId.value = job.jobId
            applyJobProgress(job)

            const completedJob = await waitForEmployeeTypeImportJob(
                job.jobId,
                {
                    signal: pollController.signal,
                    onProgress: applyJobProgress,
                },
            )

            if (completedJob.status === "FAILED") {
                const importError = new Error(
                    completedJob.error?.message || "EmployeeType import failed.",
                )

                importError.code = completedJob.error?.code
                importError.messageKey = completedJob.error?.messageKey
                throw importError
            }

            result.value = completedJob.result
            progress.value = 100

            return {
                success:
                    Array.isArray(completedJob.result?.errors) &&
                    completedJob.result.errors.length === 0,
                summary: completedJob.result,
                job: completedJob,
            }
        } catch (caught) {
            if (caught?.name !== "AbortError") {
                error.value = caught
            }

            throw caught
        } finally {
            importing.value = false
            pollController = null
        }
    }

    return {
        file,
        importing,
        progress,
        phase,
        phaseMessageKey,
        processedRows,
        totalRows,
        result,
        error,
        jobId,
        canImport,
        reset,
        setFile,
        submit,
    }
}
