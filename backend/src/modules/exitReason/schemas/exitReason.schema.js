import { z } from "zod"

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "errors.organization.exitReason.invalidId",
})

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
        z
            .string()
            .min(2, { message: "errors.organization.exitReason.codeRequired" })
            .max(40, { message: "errors.organization.exitReason.codeTooLong" })
            .regex(/^[A-Z0-9_-]+$/, {
                message: "errors.organization.exitReason.codeInvalid",
            }),
    )

const nameSchema = z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(
        z
            .string()
            .min(2, { message: "errors.organization.exitReason.nameRequired" })
            .max(180, { message: "errors.organization.exitReason.nameTooLong" }),
    )

const descriptionSchema = z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(
        z
            .string()
            .max(800, { message: "errors.organization.exitReason.descriptionTooLong" }),
    )

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
    name: nameSchema,
    description: descriptionSchema.optional().default(""),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
})

export const exitReasonUpdateSchema = exitReasonCreateSchema
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
        message: "errors.organization.exitReason.updateRequired",
    })
