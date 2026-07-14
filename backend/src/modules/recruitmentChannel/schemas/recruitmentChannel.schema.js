import { z } from "zod"

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid MongoDB ObjectId.",
})

const optionalObjectIdSchema = z
    .union([objectIdSchema, z.literal(""), z.null()])
    .optional()
    .transform((value) => value || null)

const normalizedCodeSchema = z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, "_").toUpperCase())
    .pipe(
        z
            .string()
            .min(2)
            .max(40)
            .regex(/^[A-Z0-9_-]+$/, {
                message: "Code can contain uppercase letters, numbers, underscore, and dash only.",
            }),
    )

const textSchema = (min, max) =>
    z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .pipe(z.string().min(min).max(max))

const optionalTextSchema = (max) =>
    z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .pipe(z.string().max(max))
        .optional()
        .default("")

export const recruitmentChannelIdParamSchema = z.object({
    recruitmentChannelId: objectIdSchema,
})

export const recruitmentChannelListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    status: z.enum(["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("ALL"),
    search: z.string().trim().max(120).optional().default(""),
})

export const recruitmentChannelCreateSchema = z.object({
    companyId: optionalObjectIdSchema,
    branchId: optionalObjectIdSchema,
    code: normalizedCodeSchema,
    name: textSchema(2, 160),
    shortName: optionalTextSchema(80),
    targetMonthly: z.coerce.number().min(0).max(999999).optional().default(0),
    sortOrder: z.coerce.number().int().min(0).max(999999).optional().default(0),
    description: optionalTextSchema(500),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
})

export const recruitmentChannelUpdateSchema = z
    .object({
        companyId: optionalObjectIdSchema,
        branchId: optionalObjectIdSchema,
        code: normalizedCodeSchema.optional(),
        name: textSchema(2, 160).optional(),
        shortName: optionalTextSchema(80),
        targetMonthly: z.coerce.number().min(0).max(999999).optional(),
        sortOrder: z.coerce.number().int().min(0).max(999999).optional(),
        description: optionalTextSchema(500),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })
