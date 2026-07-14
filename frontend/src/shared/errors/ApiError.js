export class ApiError extends Error {
    constructor({ message, code, messageKey, fields, requestId, status, cause }) {
        super(message || messageKey || "Request failed", { cause })
        this.name = "ApiError"
        this.code = code || "REQUEST_FAILED"
        this.messageKey = messageKey || "errors.requestFailed"
        this.fields = fields || {}
        this.requestId = requestId || null
        this.status = status || 0
    }
}

export function toApiError(error) {
    if (error instanceof ApiError) {
        return error
    }

    const payload = error?.response?.data?.error || {}

    return new ApiError({
        message: payload.debugMessage || error?.message,
        code: payload.code,
        messageKey: payload.messageKey,
        fields: payload.fields,
        requestId: payload.requestId || error?.response?.headers?.["x-request-id"],
        status: error?.response?.status,
        cause: error,
    })
}
