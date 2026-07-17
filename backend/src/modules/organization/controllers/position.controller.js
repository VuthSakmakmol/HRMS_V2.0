import { AppError } from "../../../shared/errors/AppError.js"
import {
    completeImportJob,
    createImportJob,
    failImportJob,
    getImportJob,
    updateImportJob,
} from "../../../shared/import/importJob.service.js"
import { sendList, sendSuccess } from "../../../shared/http/response.js"
import { writeAuditLog } from "../../audit/services/audit.service.js"
import {
    archivePosition,
    createPosition,
    getPositionById,
    listPositions,
    lookupPositions,
    updatePosition,
} from "../services/position.service.js"
import {
    buildPositionExportWorkbook,
    buildPositionImportTemplateWorkbook,
    getExportPositions,
    importPositionsFromRows,
    parsePositionImportWorkbook,
} from "../services/positionExcel.service.js"

function setExcelHeaders(res, filename) {
    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
    )
}

export async function listPositionsController(req, res) {
    const result = await listPositions({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendList(req, res, result)
}

export async function lookupPositionsController(req, res) {
    const result = await lookupPositions({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: {
            items: result.items,
            pagination: result.pagination,
        },
    })
}

export async function getPositionController(req, res) {
    const position = await getPositionById({
        positionId: req.validatedParams.positionId,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: { position },
    })
}

export async function createPositionController(req, res) {
    const position = await createPosition({
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.POSITION",
        action: "CREATE",
        entityType: "Position",
        entityId: position.id,
        after: position,
    })

    return sendSuccess(req, res, {
        statusCode: 201,
        data: { position },
        messageKey: "messages.organization.position.created",
    })
}

export async function updatePositionController(req, res) {
    const positionId = req.validatedParams.positionId
    const before = await getPositionById({
        positionId,
        user: req.auth.user,
    })

    const position = await updatePosition({
        positionId,
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.POSITION",
        action: "UPDATE",
        entityType: "Position",
        entityId: position.id,
        before,
        after: position,
    })

    return sendSuccess(req, res, {
        data: { position },
        messageKey: "messages.organization.position.updated",
    })
}

export async function archivePositionController(req, res) {
    const positionId = req.validatedParams.positionId
    const before = await getPositionById({
        positionId,
        user: req.auth.user,
    })

    const position = await archivePosition({
        positionId,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.POSITION",
        action: "ARCHIVE",
        entityType: "Position",
        entityId: position.id,
        before,
        after: position,
    })

    return sendSuccess(req, res, {
        data: { position },
        messageKey: "messages.organization.position.archived",
    })
}

export async function downloadPositionImportTemplateController(req, res) {
    const workbook = await buildPositionImportTemplateWorkbook()
    const buffer = await workbook.xlsx.writeBuffer()

    setExcelHeaders(res, "position-import-template.xlsx")
    return res.status(200).send(Buffer.from(buffer))
}

export async function exportPositionsController(req, res) {
    const positions = await getExportPositions({
        query: req.validatedQuery,
        user: req.auth.user,
    })
    const workbook = await buildPositionExportWorkbook({ positions })
    const buffer = await workbook.xlsx.writeBuffer()

    setExcelHeaders(res, "positions-export.xlsx")
    return res.status(200).send(Buffer.from(buffer))
}

async function processPositionImportJob({
    jobId,
    fileBuffer,
    user,
    req,
}) {
    try {
        updateImportJob(jobId, {
            status: "PROCESSING",
            phase: "READING_FILE",
            percent: 8,
            messageKey: "organization.position.importPhaseReadingFile",
        })

        const { rows, errors } = await parsePositionImportWorkbook(fileBuffer)

        updateImportJob(jobId, {
            status: "PROCESSING",
            phase: "FILE_PARSED",
            percent: 18,
            processedRows: rows.length,
            totalRows: rows.length,
            messageKey: "organization.position.importPhaseFileParsed",
        })

        const summary = await importPositionsFromRows({
            rows,
            parseErrors: errors,
            user,
            onProgress(progress) {
                updateImportJob(jobId, {
                    status: "PROCESSING",
                    ...progress,
                })
            },
        })

        await writeAuditLog({
            req,
            user,
            module: "ORGANIZATION.POSITION",
            action: "IMPORT",
            entityType: "PositionImport",
            after: {
                total: summary.totalRows,
                created: summary.created,
                updated: summary.updated,
                skipped: summary.skipped,
                errorCount: summary.errors?.length || 0,
                atomic: true,
            },
        })

        completeImportJob(jobId, summary)
    } catch (error) {
        failImportJob(jobId, error)
    }
}

export async function startPositionImportJobController(req, res) {
    if (!req.file) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_POSITION_IMPORT_FILE_REQUIRED",
            messageKey: "errors.organization.positionImport.fileRequired",
            fields: {
                file: ["errors.organization.positionImport.fileRequired"],
            },
        })
    }

    const job = createImportJob({
        module: "ORGANIZATION.POSITION",
        ownerAccountId: req.auth.user.accountId,
        fileName: req.file.originalname,
    })

    updateImportJob(job.jobId, {
        percent: 5,
        phase: "UPLOADED",
        messageKey: "organization.position.importPhaseUploaded",
    })

    const queuedJob = getImportJob({
        jobId: job.jobId,
        ownerAccountId: req.auth.user.accountId,
        module: "ORGANIZATION.POSITION",
    })

    const fileBuffer = Buffer.from(req.file.buffer)
    const user = { ...req.auth.user }

    // Start after the 202 response is ready. The client polls the job endpoint.
    setImmediate(() => {
        void processPositionImportJob({
            jobId: job.jobId,
            fileBuffer,
            user,
            req,
        })
    })

    return sendSuccess(req, res, {
        statusCode: 202,
        data: {
            job: queuedJob,
        },
        messageKey: "organization.position.importStarted",
    })
}

export async function getPositionImportJobController(req, res) {
    const job = getImportJob({
        jobId: req.params.jobId,
        ownerAccountId: req.auth.user.accountId,
        module: "ORGANIZATION.POSITION",
    })

    if (!job) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_POSITION_IMPORT_JOB_NOT_FOUND",
            messageKey: "errors.organization.positionImport.jobNotFound",
        })
    }

    return sendSuccess(req, res, {
        data: { job },
    })
}

// Backward-compatible endpoint. New frontend should use /import-jobs.
export async function importPositionsController(req, res) {
    return startPositionImportJobController(req, res)
}
