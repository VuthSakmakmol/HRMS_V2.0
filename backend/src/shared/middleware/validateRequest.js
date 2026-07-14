import { AppError } from "../errors/AppError.js"

function flattenZodFields(error) {
    const flattened = error.flatten()

    return Object.fromEntries(
        Object.entries(flattened.fieldErrors).filter(
            ([, messages]) => Array.isArray(messages) && messages.length > 0,
        ),
    )
}

export function validateRequest({ params, query, body } = {}) {
    return function requestValidationMiddleware(req, res, next) {
        try {
            if (params) {
                req.validatedParams = parseSchema(params, req.params)
            }

            if (query) {
                req.validatedQuery = parseSchema(query, req.query)
            }

            if (body) {
                req.validatedBody = parseSchema(body, req.body)
            }

            next()
        } catch (error) {
            next(error)
        }
    }
}

function parseSchema(schema, value) {
    const result = schema.safeParse(value)

    if (result.success) {
        return result.data
    }

    throw new AppError({
        statusCode: 422,
        code: "VALIDATION_FAILED",
        messageKey: "errors.validationFailed",
        fields: flattenZodFields(result.error),
        details: result.error.issues,
    })
}
