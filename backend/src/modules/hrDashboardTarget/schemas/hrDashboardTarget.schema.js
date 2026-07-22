import { z } from "zod"

const objectIdRegex = /^[0-9a-fA-F]{24}$/

const objectIdSchema = z
    .string()
    .trim()
    .regex(objectIdRegex, "Invalid MongoDB ObjectId.")

function optionalObjectIdSchema() {
    return z
        .any()
        .optional()
        .transform((value, context) => {
            if (value === undefined || value === null || value === "") {
                return undefined
            }

            const text = String(value).trim()

            if (!objectIdRegex.test(text)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Invalid MongoDB ObjectId.",
                })
                return z.NEVER
            }

            return text
        })
}

function nullableObjectIdSchema() {
    return z
        .any()
        .optional()
        .transform((value, context) => {
            if (value === undefined || value === null || value === "") {
                return null
            }

            const text = String(value).trim()

            if (!objectIdRegex.test(text)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Invalid MongoDB ObjectId.",
                })
                return z.NEVER
            }

            return text
        })
}

function integerFromQuery(defaultValue, min, max) {
    return z
        .any()
        .optional()
        .transform((value, context) => {
            if (value === undefined || value === null || value === "") {
                return defaultValue
            }

            const number = Number(value)

            if (!Number.isInteger(number) || number < min || number > max) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Expected integer from ${min} to ${max}.`,
                })
                return z.NEVER
            }

            return number
        })
}

function optionalIntegerFromQuery(min, max) {
    return z
        .any()
        .optional()
        .transform((value, context) => {
            if (value === undefined || value === null || value === "") {
                return undefined
            }

            const number = Number(value)

            if (!Number.isInteger(number) || number < min || number > max) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Expected integer from ${min} to ${max}.`,
                })
                return z.NEVER
            }

            return number
        })
}

function optionalText(max = 120) {
    return z
        .any()
        .optional()
        .transform((value) => String(value || "").trim())
        .pipe(z.string().max(max))
}

function optionalEnumFromQuery(values) {
    return z
        .any()
        .optional()
        .transform((value, context) => {
            if (value === undefined || value === null || value === "") {
                return undefined
            }

            const text = String(value).trim().toUpperCase()

            if (!values.includes(text)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Invalid value.",
                })
                return z.NEVER
            }

            return text
        })
}

const statusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"])
const listStatusSchema = z.enum(["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"])
const metricSchema = z.enum(["ABSENCE_RATE", "TURNOVER_RATE"])

export const hrDashboardTargetListQuerySchema = z.object({
    page: integerFromQuery(1, 1, 100000),
    limit: integerFromQuery(10, 1, 100),
    search: optionalText(120),
    status: optionalEnumFromQuery(["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"])
        .default("ACTIVE"),
    metric: optionalEnumFromQuery(["ABSENCE_RATE", "TURNOVER_RATE"]),
    companyId: optionalObjectIdSchema(),
    branchId: optionalObjectIdSchema(),
    year: optionalIntegerFromQuery(2000, 2100),
    month: optionalIntegerFromQuery(0, 12),
    employeeTypeId: optionalObjectIdSchema(),
})

export const hrDashboardTargetCreateSchema = z.object({
    companyId: objectIdSchema,
    branchId: objectIdSchema,
    metric: metricSchema,
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(0).max(12).default(0),
    employeeTypeId: objectIdSchema,
    targetRate: z.coerce.number().min(0).max(100),
    remark: z.string().trim().max(500).optional().default(""),
    status: statusSchema.optional().default("ACTIVE"),
})

export const hrDashboardTargetUpdateSchema = hrDashboardTargetCreateSchema.partial()

export const hrDashboardTargetIdParamSchema = z.object({
    targetId: objectIdSchema,
})

export const hrDashboardTargetLookupQuerySchema = z.object({
    companyId: objectIdSchema,
    branchId: objectIdSchema,
})
