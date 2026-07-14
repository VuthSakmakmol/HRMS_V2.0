import { Router } from "express"
import multer from "multer"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"

import {
    employeeApprovalPreviewQuerySchema,
    employeeCreateSchema,
    employeeIdParamSchema,
    employeeImportQuerySchema,
    employeeListQuerySchema,
    employeeUpdateSchema,
} from "../schemas/employee.schema.js"

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

const router = Router()

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
})

const PERMISSIONS = Object.freeze({
    VIEW: "EMPLOYEE.PROFILE.VIEW",
    CREATE: "EMPLOYEE.PROFILE.CREATE",
    UPDATE: "EMPLOYEE.PROFILE.UPDATE",
    ARCHIVE: "EMPLOYEE.PROFILE.ARCHIVE",
    IMPORT: "EMPLOYEE.PROFILE.IMPORT",
    EXPORT: "EMPLOYEE.PROFILE.EXPORT",
})

function parseRequest(schema, value) {
    const parsed = schema.safeParse(value)
    if (!parsed.success) {
        throw new AppError({
            statusCode: 422,
            code: "VALIDATION_FAILED",
            messageKey: "errors.validationFailed",
            fields: parsed.error.flatten().fieldErrors,
        })
    }
    return parsed.data
}

router.use(requireAuthentication)

router.get("/", requirePermission(PERMISSIONS.VIEW), async (req, res, next) => {
    try {
        const query = parseRequest(employeeListQuerySchema, req.query)
        const result = await listEmployees({ query, user: req.auth.user })
        res.status(200).json({ success: true, data: result })
    } catch (error) { next(error) }
})

router.post("/", requirePermission(PERMISSIONS.CREATE), async (req, res, next) => {
    try {
        const payload = parseRequest(employeeCreateSchema, req.body)
        const employee = await createEmployee({ payload, user: req.auth.user })
        res.status(201).json({ success: true, data: { employee } })
    } catch (error) { next(error) }
})

router.get("/approval-preview", requirePermission(PERMISSIONS.VIEW), async (req, res, next) => {
    try {
        const query = parseRequest(employeeApprovalPreviewQuerySchema, req.query)
        const preview = await getEmployeeApprovalPreview({ query, user: req.auth.user })
        res.status(200).json({ success: true, data: { preview } })
    } catch (error) { next(error) }
})

router.get("/import-template", requirePermission(PERMISSIONS.IMPORT), async (req, res, next) => {
    try {
        const workbook = await buildEmployeeImportTemplateWorkbook()
        const buffer = await workbook.xlsx.writeBuffer()
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res.setHeader("Content-Disposition", 'attachment; filename="employee-import-template.xlsx"')
        res.status(200).send(Buffer.from(buffer))
    } catch (error) { next(error) }
})

router.get("/export", requirePermission(PERMISSIONS.EXPORT), async (req, res, next) => {
    try {
        const query = parseRequest(employeeListQuerySchema, req.query)
        const employees = await getExportEmployees({ query, user: req.auth.user })
        const workbook = await buildEmployeeExportWorkbook({ employees })
        const buffer = await workbook.xlsx.writeBuffer()
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res.setHeader("Content-Disposition", 'attachment; filename="employees-export.xlsx"')
        res.status(200).send(Buffer.from(buffer))
    } catch (error) { next(error) }
})

router.post("/import", requirePermission(PERMISSIONS.IMPORT), upload.single("file"), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new AppError({ statusCode: 422, code: "EMPLOYEE_IMPORT_FILE_REQUIRED", messageKey: "errors.employee.import.fileRequired" })
        }
        const context = parseRequest(employeeImportQuerySchema, req.query)
        const { rows, errors } = await parseEmployeeImportWorkbook(req.file.buffer)
        const summary = await importEmployeesFromRows({ rows, parseErrors: errors, context, user: req.auth.user })
        res.status(summary.errors.length > 0 ? 207 : 200).json({
            success: summary.errors.length === 0,
            data: { summary },
            error: summary.errors.length > 0 ? { code: "EMPLOYEE_IMPORT_HAS_ERRORS", messageKey: "errors.employee.import.hasErrors" } : undefined,
        })
    } catch (error) { next(error) }
})

router.get("/:employeeId", requirePermission(PERMISSIONS.VIEW), async (req, res, next) => {
    try {
        const { employeeId } = parseRequest(employeeIdParamSchema, req.params)
        const employee = await getEmployeeById({ employeeId, user: req.auth.user })
        res.status(200).json({ success: true, data: { employee } })
    } catch (error) { next(error) }
})

router.patch("/:employeeId", requirePermission(PERMISSIONS.UPDATE), async (req, res, next) => {
    try {
        const { employeeId } = parseRequest(employeeIdParamSchema, req.params)
        const payload = parseRequest(employeeUpdateSchema, req.body)
        const employee = await updateEmployee({ employeeId, payload, user: req.auth.user })
        res.status(200).json({ success: true, data: { employee } })
    } catch (error) { next(error) }
})

router.patch("/:employeeId/archive", requirePermission(PERMISSIONS.ARCHIVE), async (req, res, next) => {
    try {
        const { employeeId } = parseRequest(employeeIdParamSchema, req.params)
        const employee = await archiveEmployee({ employeeId, user: req.auth.user })
        res.status(200).json({ success: true, data: { employee } })
    } catch (error) { next(error) }
})

export default router
