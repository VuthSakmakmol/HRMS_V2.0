import { z } from "zod"

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid MongoDB ObjectId.",
})

const nullableObjectIdSchema = z.preprocess(
    (value) => {
        if (value === "" || value === undefined || value === null) return null
        return value
    },
    objectIdSchema.nullable(),
)

const optionalObjectIdQuerySchema = z.preprocess(
    (value) => {
        if (value === "" || value === undefined || value === null) return undefined
        return value
    },
    objectIdSchema.optional(),
)

const codeSchema = z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, "_").toUpperCase())
    .pipe(
        z.string().min(2).max(40).regex(/^[A-Z0-9_-]+$/, {
            message: "Code can contain uppercase letters, numbers, underscore, and dash only.",
        }),
    )

const textSchema = (min = 0, max = 500) =>
    z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .pipe(min > 0 ? z.string().min(min).max(max) : z.string().max(max))

export const exitReasonIdParamSchema = z.object({
    exitReasonId: objectIdSchema,
})

export const exitReasonListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(120).optional().default(""),
    companyId: optionalObjectIdQuerySchema,
    branchId: optionalObjectIdQuerySchema,
    status: z.enum(["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
})

export const exitReasonLookupQuerySchema = z.object({
    companyId: optionalObjectIdQuerySchema,
    branchId: optionalObjectIdQuerySchema,
    status: z.enum(["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
})

export const exitReasonCreateSchema = z.object({
    companyId: objectIdSchema,
    branchId: objectIdSchema,
    code: codeSchema,
    name: textSchema(2, 180),
    description: textSchema(0, 800).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
})

export const exitReasonUpdateSchema = exitReasonCreateSchema
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })
