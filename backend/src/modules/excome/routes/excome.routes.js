import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    excomeLookupQuerySchema,
    excomeQuerySchema,
} from "../schemas/excome.schema.js"
import {
    getExcome,
    getExcomeLookups,
} from "../services/excome.service.js"

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
        const query = parseRequest(excomeLookupQuerySchema, req.query)
        const lookups = await getExcomeLookups({ query })

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
    try {
        const query = parseRequest(excomeQuerySchema, req.query)
        const dashboard = await getExcome({ query })

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
