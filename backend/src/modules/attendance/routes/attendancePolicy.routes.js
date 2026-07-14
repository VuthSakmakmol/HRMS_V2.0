import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    attendancePolicyIdParamSchema,
    attendancePolicyListQuerySchema,
    attendancePolicyPayloadSchema,
} from "../schemas/attendancePolicy.schema.js"
import {
    createAttendancePolicy,
    listAttendancePolicies,
    updateAttendancePolicy,
} from "../services/attendancePolicy.service.js"

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

router.get(
    "/",
    requirePermission("ATTENDANCE.POLICY.VIEW"),
    async (req, res, next) => {
        try {
            const query = parseRequest(attendancePolicyListQuerySchema, req.query)
            const items = await listAttendancePolicies({ query })
            res.status(200).json({ success: true, data: { items } })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/",
    requirePermission("ATTENDANCE.POLICY.CREATE"),
    async (req, res, next) => {
        try {
            const payload = parseRequest(attendancePolicyPayloadSchema, req.body)
            const policy = await createAttendancePolicy({
                payload,
                user: req.auth.user,
            })
            res.status(201).json({ success: true, data: { policy } })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:policyId",
    requirePermission("ATTENDANCE.POLICY.UPDATE"),
    async (req, res, next) => {
        try {
            const { policyId } = parseRequest(
                attendancePolicyIdParamSchema,
                req.params,
            )
            const payload = parseRequest(attendancePolicyPayloadSchema, req.body)
            const policy = await updateAttendancePolicy({
                policyId,
                payload,
                user: req.auth.user,
            })
            res.status(200).json({ success: true, data: { policy } })
        } catch (error) {
            next(error)
        }
    },
)

export default router
