import { z } from "zod"

const POSITION_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"]
const POSITION_UPDATE_STATUSES = ["ACTIVE", "INACTIVE"]

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

const normalizedCodeSchema = z
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

const normalizedTextSchema = (min, max) =>
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

export const positionIdParamSchema = z.object({
    positionId: objectIdSchema,
})

export const positionListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    departmentId: objectIdSchema.optional(),
    status: z.enum(["ALL", ...POSITION_STATUSES]).default("ALL"),
    search: z.string().trim().max(120).optional().default(""),
    sortBy: z
        .enum(["code", "title", "shortName", "level", "status", "createdAt", "updatedAt"])
        .default("level"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
})

export const positionCreateSchema = z.object({
    companyId: objectIdSchema,
    branchId: objectIdSchema,
    departmentId: objectIdSchema,
    reportsToPositionId: nullableObjectIdSchema.optional(),
    code: normalizedCodeSchema,
    title: normalizedTextSchema(2, 160),
    shortName: optionalTextSchema(80),
    level: z.coerce.number().int().min(0).max(99).optional(),
    isManager: z.coerce.boolean().optional(),
    description: optionalTextSchema(500),
    status: z.enum(POSITION_UPDATE_STATUSES).optional(),
})

export const positionUpdateSchema = z
    .object({
        reportsToPositionId: nullableObjectIdSchema.optional(),
        code: normalizedCodeSchema.optional(),
        title: normalizedTextSchema(2, 160).optional(),
        shortName: optionalTextSchema(80),
        level: z.coerce.number().int().min(0).max(99).optional(),
        isManager: z.coerce.boolean().optional(),
        description: optionalTextSchema(500),
        status: z.enum(POSITION_UPDATE_STATUSES).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })