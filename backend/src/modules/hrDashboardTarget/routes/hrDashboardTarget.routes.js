import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    hrDashboardTargetCreateSchema,
    hrDashboardTargetIdParamSchema,
    hrDashboardTargetListQuerySchema,
    hrDashboardTargetUpdateSchema,
} from "../schemas/hrDashboardTarget.schema.js"
import {
    archiveHrDashboardTarget,
    createHrDashboardTarget,
    getHrDashboardTargetById,
    listHrDashboardTargets,
    updateHrDashboardTarget,
} from "../services/hrDashboardTarget.service.js"

const router = Router()

const HR_DASHBOARD_TARGET_PERMISSIONS = Object.freeze({
    VIEW: "REPORT.HR_DASHBOARD_TARGET.VIEW",
    CREATE: "REPORT.HR_DASHBOARD_TARGET.CREATE",
    UPDATE: "REPORT.HR_DASHBOARD_TARGET.UPDATE",
    ARCHIVE: "REPORT.HR_DASHBOARD_TARGET.ARCHIVE",
})

function normalizeEmptyValues(value) {
    if (!value || typeof value !== "object") return value

    const normalized = {}

    for (const [key, item] of Object.entries(value)) {
        if (item === "" || item === null || item === undefined) continue
        normalized[key] = item
    }

    return normalized
}

function parseRequest(schema, value) {
    const parsed = schema.safeParse(normalizeEmptyValues(value))

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
    requirePermission(HR_DASHBOARD_TARGET_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(hrDashboardTargetListQuerySchema, req.query)
            const result = await listHrDashboardTargets({
                query,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: result,
            })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/",
    requirePermission(HR_DASHBOARD_TARGET_PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(hrDashboardTargetCreateSchema, req.body)
            const target = await createHrDashboardTarget({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({
                success: true,
                data: { target },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:targetId",
    requirePermission(HR_DASHBOARD_TARGET_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const { targetId } = parseRequest(hrDashboardTargetIdParamSchema, req.params)
            const target = await getHrDashboardTargetById({
                targetId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { target },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:targetId",
    requirePermission(HR_DASHBOARD_TARGET_PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const { targetId } = parseRequest(hrDashboardTargetIdParamSchema, req.params)
            const payload = parseRequest(hrDashboardTargetUpdateSchema, req.body)
            const target = await updateHrDashboardTarget({
                targetId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { target },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:targetId/archive",
    requirePermission(HR_DASHBOARD_TARGET_PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const { targetId } = parseRequest(hrDashboardTargetIdParamSchema, req.params)
            const target = await archiveHrDashboardTarget({
                targetId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { target },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router
