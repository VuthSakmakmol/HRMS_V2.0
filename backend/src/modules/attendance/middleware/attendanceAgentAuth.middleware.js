import crypto from "node:crypto"

import { env } from "../../../config/env.js"
import { AppError } from "../../../shared/errors/AppError.js"

function safeEqual(left, right) {
    const leftBuffer = Buffer.from(String(left || ""), "utf8")
    const rightBuffer = Buffer.from(String(right || ""), "utf8")

    if (leftBuffer.length !== rightBuffer.length) {
        return false
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function requireAttendanceAgent(req, res, next) {
    const configuredToken = env.ATTENDANCE_AGENT_TOKEN

    if (!configuredToken) {
        return next(
            new AppError({
                statusCode: 503,
                code: "ATTENDANCE_AGENT_NOT_CONFIGURED",
                messageKey: "errors.attendance.agentNotConfigured",
            }),
        )
    }

    const authorization = String(req.headers.authorization || "")
    const suppliedToken = authorization.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : ""

    if (!safeEqual(suppliedToken, configuredToken)) {
        return next(
            new AppError({
                statusCode: 401,
                code: "ATTENDANCE_AGENT_UNAUTHORIZED",
                messageKey: "errors.auth.invalidToken",
            }),
        )
    }

    req.attendanceAgent = {
        name: String(req.headers["x-attendance-agent"] || "attendance-agent")
            .trim()
            .slice(0, 120),
    }

    return next()
}
