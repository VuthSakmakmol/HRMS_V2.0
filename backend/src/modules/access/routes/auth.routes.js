import { Router } from "express"
import { z } from "zod"

import { AppError } from "../../../shared/errors/AppError.js"
import { requireAuthentication } from "../middleware/auth.middleware.js"
import {
    buildAuthUser,
    loginWithPassword,
} from "../services/auth.service.js"

const router = Router()

const loginSchema = z.object({
    loginId: z.string().trim().min(3).max(120),

    password: z.string().min(1).max(128),
})

router.post("/login", async (req, res, next) => {
    try {
        const parsedBody = loginSchema.safeParse(req.body)

        if (!parsedBody.success) {
            throw new AppError({
                statusCode: 422,
                code: "VALIDATION_FAILED",
                messageKey: "errors.validationFailed",
                fields: parsedBody.error.flatten().fieldErrors,
            })
        }

        const loginResult = await loginWithPassword(parsedBody.data)

        res.status(200).json({
            success: true,
            data: loginResult,
        })
    } catch (error) {
        next(error)
    }
})

router.get("/me", requireAuthentication, async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            data: {
                user: req.auth.user,
            },
        })
    } catch (error) {
        next(error)
    }
})

export default router