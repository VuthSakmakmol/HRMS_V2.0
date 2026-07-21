export class ApiError extends Error {
    constructor({ message, code, messageKey, fields, details, requestId, status, cause }) {
        super(message || messageKey || "Request failed", { cause })
        this.name = "ApiError"
        this.code = code || "REQUEST_FAILED"
        this.messageKey = messageKey || "errors.requestFailed"
        this.fields = fields || {}
        this.details = details
        this.requestId = requestId || null
        this.status = status || 0
    }
}

export function toApiError(error) {
    if (error instanceof ApiError) {
        return error
    }

    // Request cancellation is expected when a lookup is replaced or its
    // component is unmounted. Keep the original cancellation so callers can
    // quietly ignore it instead of reporting a false API failure.
    if (
        error?.name === "CanceledError" ||
        error?.name === "AbortError" ||
        error?.code === "ERR_CANCELED"
    ) {
        return error
    }

    const payload = error?.response?.data?.error || {}

    return new ApiError({
        message: payload.debugMessage || error?.message,
        code: payload.code,
        messageKey: payload.messageKey,
        fields: payload.fields,
        details: payload.details,
        requestId: payload.requestId || error?.response?.headers?.["x-request-id"],
        status: error?.response?.status,
        cause: error,
    })
}
