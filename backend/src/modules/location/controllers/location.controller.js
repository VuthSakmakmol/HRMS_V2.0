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
    archiveLocation,
    createLocation,
    getLocationById,
    listLocations,
    lookupLocations,
    updateLocation,
} from "../services/location.service.js"
import {
    buildLocationExportWorkbook,
    buildLocationImportTemplateWorkbook,
    getExportLocations,
    getLocationExportFilename,
    getLocationImportFilename,
    importLocationsFromRows,
    parseLocationImportWorkbook,
} from "../services/locationExcel.service.js"

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

function moduleName(entity) {
    return `ORGANIZATION.LOCATION.${String(entity).toUpperCase()}`
}

function entityType(entity) {
    return String(entity).replace(/s$/, "").replace(/^./, (value) => value.toUpperCase())
}

export async function listLocationsController(req, res) {
    const result = await listLocations({
        entity: req.validatedParams.entity,
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendList(req, res, result)
}

export async function lookupLocationsController(req, res) {
    const items = await lookupLocations({
        entity: req.validatedParams.entity,
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: { items },
    })
}

export async function getLocationController(req, res) {
    const location = await getLocationById({
        entity: req.validatedParams.entity,
        locationId: req.validatedParams.locationId,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: { location },
    })
}

export async function createLocationController(req, res) {
    const { entity } = req.validatedParams
    const location = await createLocation({
        entity,
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: moduleName(entity),
        action: "CREATE",
        entityType: entityType(entity),
        entityId: location.id,
        after: location,
    })

    return sendSuccess(req, res, {
        statusCode: 201,
        data: { location },
        messageKey: "messages.organization.location.created",
    })
}

export async function updateLocationController(req, res) {
    const { entity, locationId } = req.validatedParams
    const before = await getLocationById({
        entity,
        locationId,
        user: req.auth.user,
    })
    const location = await updateLocation({
        entity,
        locationId,
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: moduleName(entity),
        action: "UPDATE",
        entityType: entityType(entity),
        entityId: location.id,
        before,
        after: location,
    })

    return sendSuccess(req, res, {
        data: { location },
        messageKey: "messages.organization.location.updated",
    })
}

export async function archiveLocationController(req, res) {
    const { entity, locationId } = req.validatedParams
    const before = await getLocationById({
        entity,
        locationId,
        user: req.auth.user,
    })
    const location = await archiveLocation({
        entity,
        locationId,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: moduleName(entity),
        action: "ARCHIVE",
        entityType: entityType(entity),
        entityId: location.id,
        before,
        after: location,
    })

    return sendSuccess(req, res, {
        data: { location },
        messageKey: "messages.organization.location.archived",
    })
}

export async function downloadLocationImportTemplateController(req, res) {
    const { entity } = req.validatedParams
    const workbook = await buildLocationImportTemplateWorkbook({ entity })
    const buffer = await workbook.xlsx.writeBuffer()

    setExcelHeaders(res, getLocationImportFilename(entity))
    return res.status(200).send(Buffer.from(buffer))
}

export async function exportLocationsController(req, res) {
    const { entity } = req.validatedParams
    const items = await getExportLocations({
        entity,
        query: req.validatedQuery,
        user: req.auth.user,
    })
    const workbook = await buildLocationExportWorkbook({ entity, items })
    const buffer = await workbook.xlsx.writeBuffer()

    setExcelHeaders(res, getLocationExportFilename(entity))
    return res.status(200).send(Buffer.from(buffer))
}

async function processLocationImportJob({ jobId, entity, fileBuffer, user, req }) {
    try {
        updateImportJob(jobId, {
            status: "PROCESSING",
            phase: "READING_FILE",
            percent: 8,
            messageKey: "organization.location.importPhaseReadingFile",
        })

        const { rows, errors } = await parseLocationImportWorkbook(fileBuffer, entity)

        updateImportJob(jobId, {
            status: "PROCESSING",
            phase: "FILE_PARSED",
            percent: 18,
            processedRows: 0,
            totalRows: rows.length,
            messageKey: "organization.location.importPhaseFileParsed",
        })

        const summary = await importLocationsFromRows({
            entity,
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
            module: moduleName(entity),
            action: "IMPORT",
            entityType: `${entityType(entity)}Import`,
            after: summary,
        })

        completeImportJob(jobId, summary)
    } catch (error) {
        failImportJob(jobId, error)
    }
}

export async function startLocationImportJobController(req, res) {
    if (!req.file) {
        throw new AppError({
            statusCode: 422,
            code: "LOCATION_IMPORT_FILE_REQUIRED",
            messageKey: "errors.location.import.fileRequired",
            fields: {
                file: ["errors.location.import.fileRequired"],
            },
        })
    }

    const { entity } = req.validatedParams
    const job = createImportJob({
        module: moduleName(entity),
        ownerAccountId: req.auth.user.accountId,
        fileName: req.file.originalname,
    })

    updateImportJob(job.jobId, {
        percent: 5,
        phase: "UPLOADED",
        messageKey: "organization.location.importPhaseUploaded",
    })

    const queuedJob = getImportJob({
        jobId: job.jobId,
        ownerAccountId: req.auth.user.accountId,
        module: moduleName(entity),
    })

    const fileBuffer = Buffer.from(req.file.buffer)
    const user = { ...req.auth.user }

    setImmediate(() => {
        void processLocationImportJob({
            jobId: job.jobId,
            entity,
            fileBuffer,
            user,
            req,
        })
    })

    return sendSuccess(req, res, {
        statusCode: 202,
        data: { job: queuedJob },
        messageKey: "organization.location.importStarted",
    })
}

export async function getLocationImportJobController(req, res) {
    const { entity } = req.validatedParams
    const job = getImportJob({
        jobId: req.params.jobId,
        ownerAccountId: req.auth.user.accountId,
        module: moduleName(entity),
    })

    if (!job) {
        throw new AppError({
            statusCode: 404,
            code: "LOCATION_IMPORT_JOB_NOT_FOUND",
            messageKey: "errors.location.import.jobNotFound",
        })
    }

    return sendSuccess(req, res, {
        data: { job },
    })
}

export async function importLocationsController(req, res) {
    return startLocationImportJobController(req, res)
}
