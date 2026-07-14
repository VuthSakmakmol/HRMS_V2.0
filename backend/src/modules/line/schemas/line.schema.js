import { z } from "zod"

const LINE_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"]
const LINE_MUTATION_STATUSES = ["ACTIVE", "INACTIVE"]

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid MongoDB ObjectId.",
})

const nullableObjectIdSchema = z.preprocess(
    (value) => {
        if (value === "" || value === undefined) {
            return null
        }

        return value
    },
    objectIdSchema.nullable(),
)

const objectIdArraySchema = z.preprocess(
    (value) => {
        if (value === "" || value === null || value === undefined) {
            return []
        }

        return value
    },
    z.array(objectIdSchema).default([]),
)

const codeSchema = z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, "_").toUpperCase())
    .pipe(
        z
            .string()
            .min(2)
            .max(30)
            .regex(/^[A-Z0-9_-]+$/, {
                message:
                    "Code can contain uppercase letters, numbers, underscore, and dash only.",
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

export const lineIdParamSchema = z.object({
    lineId: objectIdSchema,
})

export const lineListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    departmentId: objectIdSchema.optional(),
    positionId: objectIdSchema.optional(),
    status: z.enum(["ALL", ...LINE_STATUSES]).default("ALL"),
    search: z.string().trim().max(120).optional().default(""),
})

export const lineCreateSchema = z.object({
    companyId: objectIdSchema,
    branchId: objectIdSchema,
    departmentId: objectIdSchema,
    code: codeSchema,
    name: textSchema(2, 160),
    shortName: optionalTextSchema(80),
    allowedPositionIds: objectIdArraySchema.optional(),
    leaderPositionId: nullableObjectIdSchema.optional(),
    description: optionalTextSchema(500),
    status: z.enum(LINE_MUTATION_STATUSES).optional(),
})

export const lineUpdateSchema = z
    .object({
        code: codeSchema.optional(),
        name: textSchema(2, 160).optional(),
        shortName: optionalTextSchema(80),
        allowedPositionIds: objectIdArraySchema.optional(),
        leaderPositionId: nullableObjectIdSchema.optional(),
        description: optionalTextSchema(500),
        status: z.enum(LINE_MUTATION_STATUSES).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })