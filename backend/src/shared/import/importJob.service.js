import crypto from "node:crypto"

const JOB_TTL_MS = 30 * 60 * 1000
const jobs = new Map()

function nowIso() {
    return new Date().toISOString()
}

function clampPercent(value) {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
}

function pruneExpiredJobs() {
    const cutoff = Date.now() - JOB_TTL_MS

    for (const [jobId, job] of jobs.entries()) {
        const timestamp = new Date(job.updatedAt).getTime()

        if (timestamp < cutoff) {
            jobs.delete(jobId)
        }
    }
}

export function createImportJob({ module, ownerAccountId, fileName }) {
    pruneExpiredJobs()

    const jobId = crypto.randomUUID()
    const timestamp = nowIso()

    const job = {
        jobId,
        module,
        ownerAccountId: String(ownerAccountId),
        fileName,
        status: "QUEUED",
        percent: 0,
        phase: "QUEUED",
        processedRows: 0,
        totalRows: 0,
        messageKey: "organization.position.importPhaseQueued",
        result: null,
        error: null,
        createdAt: timestamp,
        updatedAt: timestamp,
    }

    jobs.set(jobId, job)

    return { ...job }
}

export function updateImportJob(jobId, patch = {}) {
    const job = jobs.get(jobId)

    if (!job) {
        return null
    }

    const next = {
        ...job,
        ...patch,
        percent:
            patch.percent === undefined
                ? job.percent
                : clampPercent(patch.percent),
        updatedAt: nowIso(),
    }

    jobs.set(jobId, next)

    return { ...next }
}

export function completeImportJob(jobId, result) {
    return updateImportJob(jobId, {
        status: "COMPLETED",
        phase: "COMPLETED",
        percent: 100,
        processedRows: Number(result?.totalRows ?? result?.total ?? 0),
        totalRows: Number(result?.totalRows ?? result?.total ?? 0),
        messageKey: "organization.position.importPhaseCompleted",
        result,
        error: null,
    })
}

export function failImportJob(jobId, error) {
    return updateImportJob(jobId, {
        status: "FAILED",
        phase: "FAILED",
        messageKey: "organization.position.importPhaseFailed",
        error: {
            code: error?.code || "POSITION_IMPORT_FAILED",
            messageKey:
                error?.messageKey || "organization.position.importFailed",
            message: error?.message || "Position import failed.",
        },
    })
}

export function getImportJob({ jobId, ownerAccountId, module }) {
    pruneExpiredJobs()

    const job = jobs.get(jobId)

    if (!job) {
        return null
    }

    if (module && job.module !== module) {
        return null
    }

    if (String(job.ownerAccountId) !== String(ownerAccountId)) {
        return null
    }

    return { ...job }
}
