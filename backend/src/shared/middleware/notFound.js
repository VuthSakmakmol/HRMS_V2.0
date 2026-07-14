import { AppError } from "../errors/AppError.js"

export function notFound(req, res, next) {
    next(
        new AppError({
            statusCode: 404,
            code: "ROUTE_NOT_FOUND",
            messageKey: "errors.routeNotFound",
        }),
    )
}