import { AppError } from "../errors/AppError.js"
import { env } from "../../config/env.js"

export function errorHandler(error, req, res, next) {
    const isOperationalError = error instanceof AppError

    const statusCode = isOperationalError ? error.statusCode : 500
    const code = isOperationalError ? error.code : "INTERNAL_ERROR"
    const messageKey = isOperationalError ? error.messageKey : "errors.internal"

    console.error(`[api][${req.requestId}]`, error)

    const response = {
        success: false,
        error: {
            code,
            messageKey,
            fields: isOperationalError ? error.fields : undefined,
            requestId: req.requestId,
            details: isOperationalError ? error.details : undefined,
        },
    }

    if (env.NODE_ENV === "development" && !isOperationalError) {
        response.error.debugMessage = error.message
    }

    res.status(statusCode).json(response)
}