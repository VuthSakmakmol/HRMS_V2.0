export class AppError extends Error {
    constructor({
        statusCode = 500,
        code = "INTERNAL_ERROR",
        messageKey = "errors.internal",
        fields = undefined,
        details = undefined,
    } = {}) {
        super(messageKey)

        this.name = "AppError"
        this.statusCode = statusCode
        this.code = code
        this.messageKey = messageKey
        this.fields = fields
        this.details = details
    }
}