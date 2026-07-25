import { Router } from "express"

import { AppError } from "../../../shared/errors/AppError.js"
import { requireAttendanceAgent } from "../middleware/attendanceAgentAuth.middleware.js"
import {
    attendancePayrollRunResultSchema,
    attendancePayrollScheduleQuerySchema,
} from "../schemas/attendancePayrollSchedule.schema.js"
import {
    claimDuePayrollRun,
    finishPayrollRun,
} from "../services/attendancePayrollSchedule.service.js"

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

router.get("/payroll-schedule/claim", async (req, res, next) => {
    try {
        const parsed =
            attendancePayrollScheduleQuerySchema.safeParse(req.query)

        if (!parsed.success) {
            throw new AppError({
                statusCode: 422,
                code: "ATTENDANCE_PAYROLL_SCHEDULE_VALIDATION_FAILED",
                messageKey: "errors.validationFailed",
                fields: parsed.error.flatten().fieldErrors,
            })
        }

        const result = await claimDuePayrollRun(parsed.data)

        res.status(200).json({
            success: true,
            data: result,
        })
    } catch (error) {
        next(error)
    }
})

router.post("/payroll-schedule/result", async (req, res, next) => {
    try {
        const parsed =
            attendancePayrollRunResultSchema.safeParse(req.body)

        if (!parsed.success) {
            throw new AppError({
                statusCode: 422,
                code: "ATTENDANCE_PAYROLL_RESULT_VALIDATION_FAILED",
                messageKey: "errors.validationFailed",
                fields: parsed.error.flatten().fieldErrors,
            })
        }

        const schedule = await finishPayrollRun(parsed.data)

        res.status(200).json({
            success: true,
            data: {
                schedule,
            },
        })
    } catch (error) {
        next(error)
    }
})

export default router