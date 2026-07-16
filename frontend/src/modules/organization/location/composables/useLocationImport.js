import {
    computed,
    ref,
} from "vue"

import {
    startLocationImportJob,
    waitForLocationImportJob,
} from "../api/location.api.js"

export function useLocationImport(entity) {
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

    const canImport = computed(() => Boolean(file.value) && !importing.value)

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
        phaseMessageKey.value = "organization.location.importPhaseUploading"
        result.value = null
        error.value = null
        pollController = new AbortController()

        try {
            const job = await startLocationImportJob(
                entity.value,
                file.value,
                (event) => {
                    if (!event.total) {
                        return
                    }

                    progress.value = Math.min(
                        5,
                        Math.round((event.loaded * 5) / event.total),
                    )
                },
            )

            jobId.value = job.jobId
            applyJobProgress(job)

            const completedJob = await waitForLocationImportJob(
                entity.value,
                job.jobId,
                {
                    signal: pollController.signal,
                    onProgress: applyJobProgress,
                },
            )

            if (completedJob.status === "FAILED") {
                const importError = new Error(
                    completedJob.error?.message || "Location import failed.",
                )
                importError.messageKey = completedJob.error?.messageKey
                throw importError
            }

            result.value = completedJob.result
            progress.value = 100

            return {
                success: !completedJob.result?.errors?.length,
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
