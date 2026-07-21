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
    archiveEmployee,
    createEmployee,
    getEmployeeApprovalPreview,
    getEmployeeById,
    listEmployees,
    updateEmployee,
} from "../services/employee.service.js"
import {
    buildEmployeeExportWorkbook,
    buildEmployeeImportTemplateWorkbook,
    getExportEmployees,
    importEmployeesFromRows,
    parseEmployeeImportWorkbook,
} from "../services/employeeExcel.service.js"

function setExcelHeaders(res, filename) {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
}

export async function listEmployeesController(req, res) {
    const result = await listEmployees({ query: req.validatedQuery, user: req.auth.user })
    return sendList(req, res, result)
}

export async function getEmployeeController(req, res) {
    const employee = await getEmployeeById({ employeeId: req.validatedParams.employeeId, user: req.auth.user })
    return sendSuccess(req, res, { data: { employee } })
}

export async function createEmployeeController(req, res) {
    const employee = await createEmployee({ payload: req.validatedBody, user: req.auth.user })
    await writeAuditLog({ req, user: req.auth.user, module: "EMPLOYEE.PROFILE", action: "CREATE", entityType: "Employee", entityId: employee.id, after: employee })
    return sendSuccess(req, res, { statusCode: 201, data: { employee }, messageKey: "messages.employee.profile.created" })
}

export async function updateEmployeeController(req, res) {
    const employeeId = req.validatedParams.employeeId
    const before = await getEmployeeById({ employeeId, user: req.auth.user })
    const employee = await updateEmployee({ employeeId, payload: req.validatedBody, user: req.auth.user })
    await writeAuditLog({ req, user: req.auth.user, module: "EMPLOYEE.PROFILE", action: "UPDATE", entityType: "Employee", entityId: employee.id, before, after: employee })
    return sendSuccess(req, res, { data: { employee }, messageKey: "messages.employee.profile.updated" })
}

export async function archiveEmployeeController(req, res) {
    const employeeId = req.validatedParams.employeeId
    const before = await getEmployeeById({ employeeId, user: req.auth.user })
    const employee = await archiveEmployee({ employeeId, user: req.auth.user })
    await writeAuditLog({ req, user: req.auth.user, module: "EMPLOYEE.PROFILE", action: "ARCHIVE", entityType: "Employee", entityId: employee.id, before, after: employee })
    return sendSuccess(req, res, { data: { employee }, messageKey: "messages.employee.profile.archived" })
}

export async function getEmployeeApprovalPreviewController(req, res) {
    const preview = await getEmployeeApprovalPreview({ query: req.validatedQuery, user: req.auth.user })
    return sendSuccess(req, res, { data: { preview } })
}

export async function downloadEmployeeImportTemplateController(req, res) {
    const workbook = await buildEmployeeImportTemplateWorkbook()
    const buffer = await workbook.xlsx.writeBuffer()
    setExcelHeaders(res, "employee-import-template.xlsx")
    return res.status(200).send(Buffer.from(buffer))
}

export async function exportEmployeesController(req, res) {
    const employees = await getExportEmployees({ query: req.validatedQuery, user: req.auth.user })
    const workbook = await buildEmployeeExportWorkbook({ employees })
    const buffer = await workbook.xlsx.writeBuffer()
    setExcelHeaders(res, "employees-export.xlsx")
    return res.status(200).send(Buffer.from(buffer))
}

export async function importEmployeesController(req, res) {
    return startEmployeeImportJobController(req, res)
}

const EMPLOYEE_IMPORT_MODULE = "EMPLOYEE.PROFILE"

async function processEmployeeImportJob({ jobId, fileBuffer, context, user, req }) {
    try {
        updateImportJob(jobId, { status: "PROCESSING", phase: "READING_FILE", percent: 8, messageKey: "errors.employee.import.phaseReading" })
        const { rows, errors } = await parseEmployeeImportWorkbook(fileBuffer)
        updateImportJob(jobId, { status: "PROCESSING", phase: "VALIDATING", percent: 18, processedRows: 0, totalRows: rows.length, messageKey: "errors.employee.import.phaseValidating" })
        const summary = await importEmployeesFromRows({
            rows,
            parseErrors: errors,
            context,
            user,
            onProgress(progress) {
                updateImportJob(jobId, {
                    status: "PROCESSING",
                    messageKey: progress.phase === "SAVING_ROWS" ? "errors.employee.import.phaseSaving" : "errors.employee.import.phaseResolving",
                    ...progress,
                })
            },
        })
        await writeAuditLog({ req, user, module: EMPLOYEE_IMPORT_MODULE, action: "IMPORT", entityType: "EmployeeImport", after: summary })
        completeImportJob(jobId, summary)
        updateImportJob(jobId, { messageKey: "errors.employee.import.phaseCompleted" })
    } catch (error) {
        failImportJob(jobId, error)
        updateImportJob(jobId, { messageKey: "errors.employee.import.phaseFailed" })
    }
}

export async function startEmployeeImportJobController(req, res) {
    if (!req.file) {
        throw new AppError({ statusCode: 422, code: "EMPLOYEE_IMPORT_FILE_REQUIRED", messageKey: "errors.employee.profile.importFileRequired", fields: { file: ["errors.employee.profile.importFileRequired"] } })
    }
    const job = createImportJob({ module: EMPLOYEE_IMPORT_MODULE, ownerAccountId: req.auth.user.accountId, fileName: req.file.originalname })
    updateImportJob(job.jobId, { percent: 5, phase: "UPLOADED", messageKey: "errors.employee.import.phaseUploaded" })
    const queuedJob = getImportJob({ jobId: job.jobId, ownerAccountId: req.auth.user.accountId, module: EMPLOYEE_IMPORT_MODULE })
    const fileBuffer = Buffer.from(req.file.buffer)
    const context = { ...req.validatedQuery }
    const user = { ...req.auth.user }
    setImmediate(() => void processEmployeeImportJob({ jobId: job.jobId, fileBuffer, context, user, req }))
    return sendSuccess(req, res, { statusCode: 202, data: { job: queuedJob }, messageKey: "errors.employee.import.started" })
}

export async function getEmployeeImportJobController(req, res) {
    const job = getImportJob({ jobId: req.params.jobId, ownerAccountId: req.auth.user.accountId, module: EMPLOYEE_IMPORT_MODULE })
    if (!job) throw new AppError({ statusCode: 404, code: "EMPLOYEE_IMPORT_JOB_NOT_FOUND", messageKey: "errors.employee.import.jobNotFound" })
    return sendSuccess(req, res, { data: { job } })
}
