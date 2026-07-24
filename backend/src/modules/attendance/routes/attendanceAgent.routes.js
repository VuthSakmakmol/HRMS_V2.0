import { Router } from "express"

import { AppError } from "../../../shared/errors/AppError.js"
import { requireAttendanceAgent } from "../middleware/attendanceAgentAuth.middleware.js"
import { attendanceAgentSyncSchema } from "../schemas/attendanceAgent.schema.js"
import { syncAgentScans } from "../services/attendanceAgent.service.js"

const router = Router()

router.use(requireAttendanceAgent)

router.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            ready: true,
            agent: req.attendanceAgent.name,
            serverTime: new Date().toISOString(),
        },
    })
})

router.post("/sync", async (req, res, next) => {
    try {
        const parsed = attendanceAgentSyncSchema.safeParse(req.body)

        if (!parsed.success) {
            throw new AppError({
                statusCode: 422,
                code: "ATTENDANCE_AGENT_VALIDATION_FAILED",
                messageKey: "errors.validationFailed",
                fields: parsed.error.flatten().fieldErrors,
            })
        }

        const summary = await syncAgentScans({ payload: parsed.data })

        res.status(200).json({
            success: true,
            data: { summary },
        })
    } catch (error) {
        next(error)
    }
})

export default router
