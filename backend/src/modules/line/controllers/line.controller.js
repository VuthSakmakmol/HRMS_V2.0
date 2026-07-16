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
    archiveLine,
    createLine,
    getLineById,
    listLines,
    updateLine,
} from "../services/line.service.js"
import {
    buildLineExportWorkbook,
    buildLineImportTemplateWorkbook,
    getExportLines,
    importLinesFromRows,
    parseLineImportWorkbook,
} from "../services/lineExcel.service.js"

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

export async function listLinesController(req, res) {
    const result = await listLines({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendList(req, res, result)
}

export async function getLineController(req, res) {
    const line = await getLineById({
        lineId: req.validatedParams.lineId,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: { line },
    })
}

export async function createLineController(req, res) {
    const line = await createLine({
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.LINE",
        action: "CREATE",
        entityType: "Line",
        entityId: line.id,
        after: line,
    })

    return sendSuccess(req, res, {
        statusCode: 201,
        data: { line },
        messageKey: "messages.organization.line.created",
    })
}

export async function updateLineController(req, res) {
    const lineId = req.validatedParams.lineId
    const before = await getLineById({
        lineId,
        user: req.auth.user,
    })

    const line = await updateLine({
        lineId,
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.LINE",
        action: "UPDATE",
        entityType: "Line",
        entityId: line.id,
        before,
        after: line,
    })

    return sendSuccess(req, res, {
        data: { line },
        messageKey: "messages.organization.line.updated",
    })
}

export async function archiveLineController(req, res) {
    const lineId = req.validatedParams.lineId
    const before = await getLineById({
        lineId,
        user: req.auth.user,
    })

    const line = await archiveLine({
        lineId,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.LINE",
        action: "ARCHIVE",
        entityType: "Line",
        entityId: line.id,
        before,
        after: line,
    })

    return sendSuccess(req, res, {
        data: { line },
        messageKey: "messages.organization.line.archived",
    })
}

export async function downloadLineImportTemplateController(req, res) {
    const workbook = await buildLineImportTemplateWorkbook()
    const buffer = await workbook.xlsx.writeBuffer()

    setExcelHeaders(res, "line-import-template.xlsx")
    return res.status(200).send(Buffer.from(buffer))
}

export async function exportLinesController(req, res) {
    const lines = await getExportLines({
        query: req.validatedQuery,
        user: req.auth.user,
    })
    const workbook = await buildLineExportWorkbook({ lines })
    const buffer = await workbook.xlsx.writeBuffer()

    setExcelHeaders(res, "lines-export.xlsx")
    return res.status(200).send(Buffer.from(buffer))
}

async function processLineImportJob({
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
            messageKey: "organization.line.importPhaseReadingFile",
        })

        const { rows, errors } = await parseLineImportWorkbook(fileBuffer)

        updateImportJob(jobId, {
            status: "PROCESSING",
            phase: "FILE_PARSED",
            percent: 18,
            processedRows: rows.length,
            totalRows: rows.length,
            messageKey: "organization.line.importPhaseFileParsed",
        })

        const summary = await importLinesFromRows({
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
            module: "ORGANIZATION.LINE",
            action: "IMPORT",
            entityType: "LineImport",
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

export async function startLineImportJobController(req, res) {
    if (!req.file) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_LINE_IMPORT_FILE_REQUIRED",
            messageKey: "errors.organization.lineImport.fileRequired",
            fields: {
                file: ["errors.organization.lineImport.fileRequired"],
            },
        })
    }

    const job = createImportJob({
        module: "ORGANIZATION.LINE",
        ownerAccountId: req.auth.user.accountId,
        fileName: req.file.originalname,
    })

    updateImportJob(job.jobId, {
        percent: 5,
        phase: "UPLOADED",
        messageKey: "organization.line.importPhaseUploaded",
    })

    const queuedJob = getImportJob({
        jobId: job.jobId,
        ownerAccountId: req.auth.user.accountId,
        module: "ORGANIZATION.LINE",
    })

    const fileBuffer = Buffer.from(req.file.buffer)
    const user = { ...req.auth.user }

    // Start after the 202 response is ready. The client polls the job endpoint.
    setImmediate(() => {
        void processLineImportJob({
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
        messageKey: "organization.line.importStarted",
    })
}

export async function getLineImportJobController(req, res) {
    const job = getImportJob({
        jobId: req.params.jobId,
        ownerAccountId: req.auth.user.accountId,
        module: "ORGANIZATION.LINE",
    })

    if (!job) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_LINE_IMPORT_JOB_NOT_FOUND",
            messageKey: "errors.organization.lineImport.jobNotFound",
        })
    }

    return sendSuccess(req, res, {
        data: { job },
    })
}

// Backward-compatible endpoint. New frontend should use /import-jobs.
export async function importLinesController(req, res) {
    return startLineImportJobController(req, res)
}
