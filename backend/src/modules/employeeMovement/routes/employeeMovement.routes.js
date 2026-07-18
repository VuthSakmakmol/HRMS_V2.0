
import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    employeeMovementIdParamSchema,
    employeeMovementListQuerySchema,
} from "../schemas/employeeMovement.schema.js"
import {
    getEmployeeMovementById,
    listEmployeeMovements,
} from "../services/employeeMovement.service.js"
import {
    buildEmployeeMovementExportWorkbook,
    getExportEmployeeMovements,
} from "../services/employeeMovementExcel.service.js"

const router = Router()

const MOVEMENT_PERMISSIONS = Object.freeze({
    VIEW: "EMPLOYEE.MOVEMENT.VIEW",
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

router.get("/:movementId", requirePermission(MOVEMENT_PERMISSIONS.VIEW), async (req, res, next) => {
    try {
        const { movementId } = parseRequest(employeeMovementIdParamSchema, req.params)
        const movement = await getEmployeeMovementById({ movementId, user: req.auth.user })
        res.status(200).json({ success: true, data: { movement } })
    } catch (error) {
        next(error)
    }
})

export default router
