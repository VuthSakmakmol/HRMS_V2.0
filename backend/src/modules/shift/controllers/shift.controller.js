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
    archiveShift,
    createShift,
    getShiftById,
    listShifts,
    lookupShifts,
    updateShift,
} from "../services/shift.service.js"
import {
    buildShiftExportWorkbook,
    buildShiftImportTemplateWorkbook,
    getExportShifts,
    importShiftsFromRows,
    parseShiftImportWorkbook,
} from "../services/shiftExcel.service.js"

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

export async function listShiftsController(req, res) {
    const result = await listShifts({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendList(req, res, result)
}

export async function lookupShiftsController(req, res) {
    const items = await lookupShifts({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: { items },
    })
}

export async function getShiftController(req, res) {
    const shift = await getShiftById({
        shiftId: req.validatedParams.shiftId,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: { shift },
    })
}

export async function createShiftController(req, res) {
    const shift = await createShift({
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.SHIFT",
        action: "CREATE",
        entityType: "Shift",
        entityId: shift.id,
        after: shift,
    })

    return sendSuccess(req, res, {
        statusCode: 201,
        data: { shift },
        messageKey: "messages.organization.shift.created",
    })
}

export async function updateShiftController(req, res) {
    const shiftId = req.validatedParams.shiftId
    const before = await getShiftById({
        shiftId,
        user: req.auth.user,
    })

    const shift = await updateShift({
        shiftId,
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.SHIFT",
        action: "UPDATE",
        entityType: "Shift",
        entityId: shift.id,
        before,
        after: shift,
    })

    return sendSuccess(req, res, {
        data: { shift },
        messageKey: "messages.organization.shift.updated",
    })
}

export async function archiveShiftController(req, res) {
    const shiftId = req.validatedParams.shiftId
    const before = await getShiftById({
        shiftId,
        user: req.auth.user,
    })

    const shift = await archiveShift({
        shiftId,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.SHIFT",
        action: "ARCHIVE",
        entityType: "Shift",
        entityId: shift.id,
        before,
        after: shift,
    })

    return sendSuccess(req, res, {
        data: { shift },
        messageKey: "messages.organization.shift.archived",
    })
}

export async function downloadShiftImportTemplateController(req, res) {
    const workbook = await buildShiftImportTemplateWorkbook()
    const buffer = await workbook.xlsx.writeBuffer()

    setExcelHeaders(res, "shift-import-template.xlsx")
    return res.status(200).send(Buffer.from(buffer))
}

export async function exportShiftsController(req, res) {
    const shifts = await getExportShifts({
        query: req.validatedQuery,
        user: req.auth.user,
    })
    const workbook = await buildShiftExportWorkbook({ shifts })
    const buffer = await workbook.xlsx.writeBuffer()

    setExcelHeaders(res, "shifts-export.xlsx")
    return res.status(200).send(Buffer.from(buffer))
}

async function processShiftImportJob({
    jobId,
    fileBuffer,
    user,
    req,
    workspace,
}) {
    try {
        updateImportJob(jobId, {
            status: "PROCESSING",
            phase: "READING_FILE",
            percent: 8,
            messageKey: "organization.shift.importPhaseReadingFile",
        })

        const { rows, errors } = await parseShiftImportWorkbook(fileBuffer)

        updateImportJob(jobId, {
            status: "PROCESSING",
            phase: "FILE_PARSED",
            percent: 18,
            processedRows: rows.length,
            totalRows: rows.length,
            messageKey: "organization.shift.importPhaseFileParsed",
        })

        const summary = await importShiftsFromRows({
            rows,
            parseErrors: errors,
            user,
            workspace,
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
            module: "ORGANIZATION.SHIFT",
            action: "IMPORT",
            entityType: "ShiftImport",
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

export async function startShiftImportJobController(req, res) {
    if (!req.file) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_SHIFT_IMPORT_FILE_REQUIRED",
            messageKey: "errors.organization.shiftImport.fileRequired",
            fields: {
                file: ["errors.organization.shiftImport.fileRequired"],
            },
        })
    }

    const { companyId, branchId } = req.validatedQuery

    if (!companyId || !branchId) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_SHIFT_WORKSPACE_REQUIRED",
            messageKey: "errors.organization.shift.workspaceRequired",
            fields: {
                companyId: ["errors.organization.shift.workspaceRequired"],
                branchId: ["errors.organization.shift.workspaceRequired"],
            },
        })
    }

    await listShifts({
        query: {
            ...req.validatedQuery,
            companyId,
            branchId,
            page: 1,
            limit: 1,
        },
        user: req.auth.user,
    })

    const job = createImportJob({
        module: "ORGANIZATION.SHIFT",
        ownerAccountId: req.auth.user.accountId,
        fileName: req.file.originalname,
    })

    updateImportJob(job.jobId, {
        percent: 5,
        phase: "UPLOADED",
        messageKey: "organization.shift.importPhaseUploaded",
    })

    const queuedJob = getImportJob({
        jobId: job.jobId,
        ownerAccountId: req.auth.user.accountId,
        module: "ORGANIZATION.SHIFT",
    })

    const fileBuffer = Buffer.from(req.file.buffer)
    const user = { ...req.auth.user }

    // Start after the 202 response is ready. The client polls the job endpoint.
    setImmediate(() => {
        void processShiftImportJob({
            jobId: job.jobId,
            fileBuffer,
            user,
            req,
            workspace: { companyId, branchId },
        })
    })

    return sendSuccess(req, res, {
        statusCode: 202,
        data: {
            job: queuedJob,
        },
        messageKey: "organization.shift.importStarted",
    })
}

export async function getShiftImportJobController(req, res) {
    const job = getImportJob({
        jobId: req.params.jobId,
        ownerAccountId: req.auth.user.accountId,
        module: "ORGANIZATION.SHIFT",
    })

    if (!job) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_SHIFT_IMPORT_JOB_NOT_FOUND",
            messageKey: "errors.organization.shiftImport.jobNotFound",
        })
    }

    return sendSuccess(req, res, {
        data: { job },
    })
}

// Backward-compatible endpoint. New frontend should use /import-jobs.
export async function importShiftsController(req, res) {
    return startShiftImportJobController(req, res)
}
