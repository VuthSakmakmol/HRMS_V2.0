
import multer from "multer"
import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    employeeMovementCreateSchema,
    employeeMovementIdParamSchema,
    employeeMovementListQuerySchema,
    employeeMovementUpdateSchema,
} from "../schemas/employeeMovement.schema.js"
import {
    archiveEmployeeMovement,
    createEmployeeMovement,
    getEmployeeMovementById,
    listEmployeeMovements,
    updateEmployeeMovement,
} from "../services/employeeMovement.service.js"
import {
    buildEmployeeMovementExportWorkbook,
    buildEmployeeMovementImportTemplateWorkbook,
    getExportEmployeeMovements,
    importEmployeeMovementsFromRows,
    parseEmployeeMovementImportWorkbook,
} from "../services/employeeMovementExcel.service.js"

const router = Router()

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
})

const MOVEMENT_PERMISSIONS = Object.freeze({
    VIEW: "EMPLOYEE.MOVEMENT.VIEW",
    CREATE: "EMPLOYEE.MOVEMENT.CREATE",
    UPDATE: "EMPLOYEE.MOVEMENT.UPDATE",
    ARCHIVE: "EMPLOYEE.MOVEMENT.ARCHIVE",
    IMPORT: "EMPLOYEE.MOVEMENT.IMPORT",
    EXPORT: "EMPLOYEE.MOVEMENT.EXPORT",
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

router.get("/", requirePermission(MOVEMENT_PERMISSIONS.VIEW), async (req, res, next) => {
    try {
        const query = parseRequest(employeeMovementListQuerySchema, req.query)
        const result = await listEmployeeMovements({ query, user: req.auth.user })
        res.status(200).json({ success: true, data: result })
    } catch (error) {
        next(error)
    }
})

router.post("/", requirePermission(MOVEMENT_PERMISSIONS.CREATE), async (req, res, next) => {
    try {
        const payload = parseRequest(employeeMovementCreateSchema, req.body)
        const movement = await createEmployeeMovement({ payload, user: req.auth.user })
        res.status(201).json({ success: true, data: { movement } })
    } catch (error) {
        next(error)
    }
})

router.get("/import-template", requirePermission(MOVEMENT_PERMISSIONS.VIEW), async (req, res, next) => {
    try {
        const workbook = await buildEmployeeMovementImportTemplateWorkbook()
        const buffer = await workbook.xlsx.writeBuffer()
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res.setHeader("Content-Disposition", 'attachment; filename="employee-movement-import-template.xlsx"')
        res.status(200).send(Buffer.from(buffer))
    } catch (error) {
        next(error)
    }
})

router.get("/export", requirePermission(MOVEMENT_PERMISSIONS.EXPORT), async (req, res, next) => {
    try {
        const query = parseRequest(employeeMovementListQuerySchema, req.query)
        const movements = await getExportEmployeeMovements({ query, user: req.auth.user })
        const workbook = await buildEmployeeMovementExportWorkbook({ movements })
        const buffer = await workbook.xlsx.writeBuffer()
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res.setHeader("Content-Disposition", 'attachment; filename="employee-movements-export.xlsx"')
        res.status(200).send(Buffer.from(buffer))
    } catch (error) {
        next(error)
    }
})

router.post("/import", requirePermission(MOVEMENT_PERMISSIONS.IMPORT), upload.single("file"), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new AppError({ statusCode: 422, code: "EMPLOYEE_MOVEMENT_IMPORT_FILE_REQUIRED", messageKey: "errors.employee.movementImport.fileRequired" })
        }
        const { rows, errors } = await parseEmployeeMovementImportWorkbook(req.file.buffer)
        const summary = await importEmployeeMovementsFromRows({ rows, parseErrors: errors, user: req.auth.user })
        res.status(summary.errors.length ? 207 : 200).json({
            success: summary.errors.length === 0,
            data: { summary },
            error: summary.errors.length ? { code: "EMPLOYEE_MOVEMENT_IMPORT_HAS_ERRORS", messageKey: "errors.employee.movementImport.hasErrors" } : undefined,
        })
    } catch (error) {
        next(error)
    }
})

router.get("/:movementId", requirePermission(MOVEMENT_PERMISSIONS.VIEW), async (req, res, next) => {
    try {
        const { movementId } = parseRequest(employeeMovementIdParamSchema, req.params)
        const movement = await getEmployeeMovementById({ movementId, user: req.auth.user })
        res.status(200).json({ success: true, data: { movement } })
    } catch (error) {
        next(error)
    }
})

router.patch("/:movementId", requirePermission(MOVEMENT_PERMISSIONS.UPDATE), async (req, res, next) => {
    try {
        const { movementId } = parseRequest(employeeMovementIdParamSchema, req.params)
        const payload = parseRequest(employeeMovementUpdateSchema, req.body)
        const movement = await updateEmployeeMovement({ movementId, payload, user: req.auth.user })
        res.status(200).json({ success: true, data: { movement } })
    } catch (error) {
        next(error)
    }
})

router.patch("/:movementId/archive", requirePermission(MOVEMENT_PERMISSIONS.ARCHIVE), async (req, res, next) => {
    try {
        const { movementId } = parseRequest(employeeMovementIdParamSchema, req.params)
        const movement = await archiveEmployeeMovement({ movementId, user: req.auth.user })
        res.status(200).json({ success: true, data: { movement } })
    } catch (error) {
        next(error)
    }
})

export default router
