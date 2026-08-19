import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    excomLookupQuerySchema,
    excomQuerySchema,
} from "../schemas/excom.schema.js"
import {
    getExcom,
    getExcomLookups,
} from "../services/excom.service.js"

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
router.use(requirePermission("REPORT.HR_ANALYTICS.VIEW"))

router.get("/lookups", async (req, res, next) => {
    try {
        const query = parseRequest(excomLookupQuerySchema, req.query)
        const lookups = await getExcomLookups({ query })

        res.status(200).json({
            success: true,
            data: {
                lookups,
            },
        })
    } catch (error) {
        next(error)
    }
})

router.get("/", async (req, res, next) => {
    const startedAt = process.hrtime.bigint()

    try {
        const query = parseRequest(excomQuerySchema, req.query)
        const dashboard = await getExcom({ query })
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000

        // Visible in Chrome DevTools > Network. This makes it easy to verify
        // the <1s dashboard target without adding debug UI to production pages.
        res.setHeader("Server-Timing", `excom;dur=${durationMs.toFixed(1)}`)
        res.setHeader("X-Excom-Server-Ms", durationMs.toFixed(1))
        res.status(200).json({
            success: true,
            data: {
                dashboard,
            },
        })
    } catch (error) {
        next(error)
    }
})

export default router
