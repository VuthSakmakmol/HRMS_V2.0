import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"

import {
    workforceRatioCreateSchema,
    workforceRatioIdParamSchema,
    workforceRatioScopeQuerySchema,
    workforceRatioUpdateSchema,
} from "../schemas/workforceRatio.schema.js"
import {
    archiveWorkforceRatioSetup,
    createWorkforceRatioSetup,
    getCurrentWorkforceRatioSetup,
    lookupWorkforceRatioEmployeeTypes,
    updateWorkforceRatioSetup,
} from "../services/workforceRatio.service.js"

const router = Router()

const PERMISSIONS = Object.freeze({
    VIEW: "REPORT.WORKFORCE_RATIO.VIEW",
    CREATE: "REPORT.WORKFORCE_RATIO.CREATE",
    UPDATE: "REPORT.WORKFORCE_RATIO.UPDATE",
    ARCHIVE: "REPORT.WORKFORCE_RATIO.ARCHIVE",
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

router.get(
    "/current",
    requirePermission(PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(workforceRatioScopeQuerySchema, req.query)
            const result = await getCurrentWorkforceRatioSetup({
                query,
                user: req.auth.user,
            })

            res.status(200).json({ success: true, data: result })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/employee-types",
    requirePermission(PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(workforceRatioScopeQuerySchema, req.query)
            const result = await lookupWorkforceRatioEmployeeTypes({
                query,
                user: req.auth.user,
            })

            res.status(200).json({ success: true, data: result })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/",
    requirePermission(PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(workforceRatioCreateSchema, req.body)
            const setup = await createWorkforceRatioSetup({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({
                success: true,
                data: { setup },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:workforceRatioId",
    requirePermission(PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const params = parseRequest(workforceRatioIdParamSchema, req.params)
            const payload = parseRequest(workforceRatioUpdateSchema, req.body)
            const setup = await updateWorkforceRatioSetup({
                workforceRatioId: params.workforceRatioId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { setup },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:workforceRatioId/archive",
    requirePermission(PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const params = parseRequest(workforceRatioIdParamSchema, req.params)
            const setup = await archiveWorkforceRatioSetup({
                workforceRatioId: params.workforceRatioId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { setup },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router
