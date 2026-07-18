import { AppError } from "../../../shared/errors/AppError.js"
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
    if (!req.file) {
        throw new AppError({ statusCode: 422, code: "EMPLOYEE_IMPORT_FILE_REQUIRED", messageKey: "errors.employee.profile.importFileRequired", fields: { file: ["errors.employee.profile.importFileRequired"] } })
    }
    const { rows, errors } = await parseEmployeeImportWorkbook(req.file.buffer)
    const summary = await importEmployeesFromRows({ rows, parseErrors: errors, context: req.validatedQuery, user: req.auth.user })
    await writeAuditLog({ req, user: req.auth.user, module: "EMPLOYEE.PROFILE", action: "IMPORT", entityType: "EmployeeImport", after: summary })

    const storedCount =
        Number(summary.created ?? 0) +
        Number(summary.updated ?? 0)
    const errorCount = Array.isArray(summary.errors)
        ? summary.errors.length
        : 0

    if (errorCount > 0 && storedCount === 0) {
        throw new AppError({
            statusCode: 422,
            code: "EMPLOYEE_IMPORT_VALIDATION_FAILED",
            messageKey: "errors.employee.import.validationFailed",
            fields: Object.fromEntries(
                summary.errors.map((item, index) => [
                    `row${item.rowNumber ?? index + 1}.${item.field || "employee"}`,
                    [item.messageKey || "errors.employee.import.invalidRow"],
                ]),
            ),
            details: {
                importSummary: summary,
            },
        })
    }

    return sendSuccess(req, res, { data: { summary }, messageKey: "messages.employee.profile.imported" })
}
