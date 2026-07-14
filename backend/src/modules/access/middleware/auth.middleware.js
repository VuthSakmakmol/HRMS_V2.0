import jwt from "jsonwebtoken"

import { env } from "../../../config/env.js"
import { AppError } from "../../../shared/errors/AppError.js"

import {
    buildAuthUser,
    getAuthenticatedAccount,
} from "../services/auth.service.js"

function getBearerToken(req) {
    const authorization = req.get("authorization")

    if (!authorization) {
        return null
    }

    const match = authorization.match(/^Bearer\s+(.+)$/i)

    return match?.[1]?.trim() || null
}

function permissionDenied() {
    return new AppError({
        statusCode: 403,
        code: "ACCESS_PERMISSION_DENIED",
        messageKey: "errors.permissionDenied",
    })
}

export async function requireAuthentication(req, res, next) {
    try {
        const token = getBearerToken(req)

        if (!token) {
            throw new AppError({
                statusCode: 401,
                code: "AUTH_TOKEN_REQUIRED",
                messageKey: "errors.authTokenRequired",
            })
        }

        let tokenPayload

        try {
            tokenPayload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
                algorithms: ["HS256"],
            })
        } catch {
            throw new AppError({
                statusCode: 401,
                code: "AUTH_TOKEN_INVALID",
                messageKey: "errors.authTokenInvalid",
            })
        }

        const account = await getAuthenticatedAccount(tokenPayload)

        req.auth = {
            account,
            user: await buildAuthUser(account),
        }

        next()
    } catch (error) {
        next(error)
    }
}

export function requirePermission(permissionCode) {
    return requireAnyPermission(permissionCode)
}

export function requireAnyPermission(...permissionCodes) {
    const requiredCodes = permissionCodes.flat().filter(Boolean)

    return (req, res, next) => {
        const user = req.auth?.user

        if (!user) {
            return next(
                new AppError({
                    statusCode: 401,
                    code: "AUTH_TOKEN_REQUIRED",
                    messageKey: "errors.authTokenRequired",
                }),
            )
        }

        const granted = new Set(user.effectivePermissionCodes || [])
        const hasAccess =
            user.isRootAdmin ||
            requiredCodes.some((permissionCode) => granted.has(permissionCode))

        if (!hasAccess) {
            return next(permissionDenied())
        }

        next()
    }
}
