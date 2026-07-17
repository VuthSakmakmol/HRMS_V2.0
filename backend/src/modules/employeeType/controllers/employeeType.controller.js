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
    archiveEmployeeType,
    createEmployeeType,
    getEmployeeTypeById,
    listEmployeeTypes,
    listEmployeeTypeDashboardCategories,
    updateEmployeeType,
} from "../services/employeeType.service.js"
import {
    buildEmployeeTypeExportWorkbook,
    buildEmployeeTypeImportTemplateWorkbook,
    getExportEmployeeTypes,
    importEmployeeTypesFromRows,
    parseEmployeeTypeImportWorkbook,
} from "../services/employeeTypeExcel.service.js"

const MODULE = "ORGANIZATION.EMPLOYEE_TYPE"

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

export async function listEmployeeTypeDashboardCategoriesController(req, res) {
    const items = await listEmployeeTypeDashboardCategories({ user: req.auth.user })
    return sendSuccess(req, res, { data: { items } })
}

export async function listEmployeeTypesController(req, res) {
    const result = await listEmployeeTypes({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendList(req, res, result)
}

export async function getEmployeeTypeController(req, res) {
    const employeeType = await getEmployeeTypeById({
        employeeTypeId: req.validatedParams.employeeTypeId,
        user: req.auth.user,
    })

    return sendSuccess(req, res, { data: { employeeType } })
}

export async function createEmployeeTypeController(req, res) {
    const employeeType = await createEmployeeType({
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: MODULE,
        action: "CREATE",
        entityType: "EmployeeType",
        entityId: employeeType.id,
        after: employeeType,
    })

    return sendSuccess(req, res, {
        statusCode: 201,
        data: { employeeType },
        messageKey: "messages.organization.employeeType.created",
    })
}

export async function updateEmployeeTypeController(req, res) {
    const employeeTypeId = req.validatedParams.employeeTypeId
    const before = await getEmployeeTypeById({ employeeTypeId, user: req.auth.user })
    const employeeType = await updateEmployeeType({
        employeeTypeId,
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: MODULE,
        action: "UPDATE",
        entityType: "EmployeeType",
        entityId: employeeType.id,
        before,
        after: employeeType,
    })

    return sendSuccess(req, res, {
        data: { employeeType },
        messageKey: "messages.organization.employeeType.updated",
    })
}

export async function archiveEmployeeTypeController(req, res) {
    const employeeTypeId = req.validatedParams.employeeTypeId
    const before = await getEmployeeTypeById({ employeeTypeId, user: req.auth.user })
    const employeeType = await archiveEmployeeType({ employeeTypeId, user: req.auth.user })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: MODULE,
        action: "ARCHIVE",
        entityType: "EmployeeType",
        entityId: employeeType.id,
        before,
        after: employeeType,
    })

    return sendSuccess(req, res, {
        data: { employeeType },
        messageKey: "messages.organization.employeeType.archived",
    })
}

export async function downloadEmployeeTypeImportTemplateController(req, res) {
    const workbook = await buildEmployeeTypeImportTemplateWorkbook()
    const buffer = await workbook.xlsx.writeBuffer()
    setExcelHeaders(res, "employee-type-import-template.xlsx")
    return res.status(200).send(Buffer.from(buffer))
}

export async function exportEmployeeTypesController(req, res) {
    const employeeTypes = await getExportEmployeeTypes({
        query: req.validatedQuery,
        user: req.auth.user,
    })
    const workbook = await buildEmployeeTypeExportWorkbook({ employeeTypes })
    const buffer = await workbook.xlsx.writeBuffer()
    setExcelHeaders(res, "employee-types-export.xlsx")
    return res.status(200).send(Buffer.from(buffer))
}

async function processEmployeeTypeImportJob({ jobId, fileBuffer, user, req }) {
    try {
        updateImportJob(jobId, {
            status: "PROCESSING",
            phase: "READING_FILE",
            percent: 8,
            messageKey: "organization.employeeType.importPhaseReadingFile",
        })
        const { rows, errors } = await parseEmployeeTypeImportWorkbook(fileBuffer)
        updateImportJob(jobId, {
            status: "PROCESSING",
            phase: "FILE_PARSED",
            percent: 18,
            processedRows: 0,
            totalRows: rows.length,
            messageKey: "organization.employeeType.importPhaseFileParsed",
        })
        const summary = await importEmployeeTypesFromRows({
            rows,
            parseErrors: errors,
            user,
            onProgress(progress) {
                updateImportJob(jobId, {
                    status: "PROCESSING",
                    messageKey: "organization.employeeType.importPhaseProcessing",
                    ...progress,
                })
            },
        })
        await writeAuditLog({
            req,
            user,
            module: MODULE,
            action: "IMPORT",
            entityType: "EmployeeTypeImport",
            after: summary,
        })
        completeImportJob(jobId, summary)
        updateImportJob(jobId, {
            messageKey: "organization.employeeType.importPhaseCompleted",
        })
    } catch (error) {
        failImportJob(jobId, error)
        updateImportJob(jobId, {
            messageKey: "organization.employeeType.importPhaseFailed",
        })
    }
}

export async function startEmployeeTypeImportJobController(req, res) {
    if (!req.file) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_EMPLOYEE_TYPE_IMPORT_FILE_REQUIRED",
            messageKey: "errors.organization.employeeTypeImport.fileRequired",
            fields: { file: ["errors.organization.employeeTypeImport.fileRequired"] },
        })
    }

    const job = createImportJob({
        module: MODULE,
        ownerAccountId: req.auth.user.accountId,
        fileName: req.file.originalname,
    })
    updateImportJob(job.jobId, {
        percent: 5,
        phase: "UPLOADED",
        messageKey: "organization.employeeType.importPhaseUploaded",
    })
    const queuedJob = getImportJob({
        jobId: job.jobId,
        ownerAccountId: req.auth.user.accountId,
        module: MODULE,
    })
    const fileBuffer = Buffer.from(req.file.buffer)
    const user = { ...req.auth.user }
    setImmediate(() => {
        void processEmployeeTypeImportJob({
            jobId: job.jobId,
            fileBuffer,
            user,
            req,
        })
    })

    return sendSuccess(req, res, {
        statusCode: 202,
        data: { job: queuedJob },
        messageKey: "organization.employeeType.importStarted",
    })
}

export async function getEmployeeTypeImportJobController(req, res) {
    const job = getImportJob({
        jobId: req.params.jobId,
        ownerAccountId: req.auth.user.accountId,
        module: MODULE,
    })
    if (!job) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_EMPLOYEE_TYPE_IMPORT_JOB_NOT_FOUND",
            messageKey: "organization.employeeType.importJobNotFound",
        })
    }
    return sendSuccess(req, res, { data: { job } })
}

export async function importEmployeeTypesController(req, res) {
    return startEmployeeTypeImportJobController(req, res)
}
