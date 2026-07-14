import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import { verificationPayloadSchema } from "../schemas/attendanceVerification.schema.js"
import { verifyAttendanceRange } from "../services/attendanceBatch.service.js"

const router = Router()

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

router.post(
    "/run",
    requirePermission("ATTENDANCE.VERIFICATION.RUN"),
    async (req, res, next) => {
        try {
            const payload = parseRequest(verificationPayloadSchema, req.body)
            const summary = await verifyAttendanceRange({
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { summary },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router
