import { Router } from "express"

import { requireAuthentication, requirePermission } from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"

import {
    exitReasonCreateSchema,
    exitReasonIdParamSchema,
    exitReasonListQuerySchema,
    exitReasonLookupQuerySchema,
    exitReasonUpdateSchema,
} from "../schemas/exitReason.schema.js"

import {
    archiveExitReason,
    createExitReason,
    getExitReasonById,
    listExitReasons,
    lookupExitReasons,
    updateExitReason,
} from "../services/exitReason.service.js"

const router = Router()

const EXIT_REASON_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.EXIT_REASON.VIEW",
    CREATE: "ORGANIZATION.EXIT_REASON.CREATE",
    UPDATE: "ORGANIZATION.EXIT_REASON.UPDATE",
    ARCHIVE: "ORGANIZATION.EXIT_REASON.ARCHIVE",
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
    "/",
    requirePermission(EXIT_REASON_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(exitReasonListQuerySchema, req.query)
            const result = await listExitReasons({ query, user: req.auth.user })

            res.status(200).json({ success: true, data: result })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/lookup",
    requirePermission(EXIT_REASON_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(exitReasonLookupQuerySchema, req.query)
            const result = await lookupExitReasons({ query, user: req.auth.user })

            res.status(200).json({ success: true, data: result })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/",
    requirePermission(EXIT_REASON_PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(exitReasonCreateSchema, req.body)
            const exitReason = await createExitReason({ payload, user: req.auth.user })

            res.status(201).json({
                success: true,
                data: { exitReason },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:exitReasonId",
    requirePermission(EXIT_REASON_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const params = parseRequest(exitReasonIdParamSchema, req.params)
            const exitReason = await getExitReasonById({
                exitReasonId: params.exitReasonId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { exitReason },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:exitReasonId",
    requirePermission(EXIT_REASON_PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const params = parseRequest(exitReasonIdParamSchema, req.params)
            const payload = parseRequest(exitReasonUpdateSchema, req.body)
            const exitReason = await updateExitReason({
                exitReasonId: params.exitReasonId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { exitReason },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:exitReasonId/archive",
    requirePermission(EXIT_REASON_PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const params = parseRequest(exitReasonIdParamSchema, req.params)
            const exitReason = await archiveExitReason({
                exitReasonId: params.exitReasonId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { exitReason },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router
