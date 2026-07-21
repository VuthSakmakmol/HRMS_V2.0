import { z } from "zod"

const LINE_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"]
const LINE_MUTATION_STATUSES = ["ACTIVE", "INACTIVE"]
const LINE_SORT_FIELDS = [
    "code",
    "name",
    "status",
    "createdAt",
    "updatedAt",
]

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

const codeSchema = z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, "_").toUpperCase())
    .pipe(
        z
            .string()
            .min(2)
            .max(30)
            .regex(/^[A-Z0-9_-]+$/),
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
    limit: z.coerce.number().int().min(1).max(100).default(10),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    status: z.enum(["ALL", ...LINE_STATUSES]).default("ALL"),
    search: z.string().trim().max(120).optional().default(""),
    sortBy: z.enum(LINE_SORT_FIELDS).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
})

export const lineCreateSchema = z.object({
    companyId: objectIdSchema,
    branchId: objectIdSchema,
    code: codeSchema,
    name: textSchema(2, 160),
    description: optionalTextSchema(500),
    status: z.enum(LINE_MUTATION_STATUSES).default("ACTIVE"),
})

export const lineUpdateSchema = z
    .object({
        code: codeSchema.optional(),
        name: textSchema(2, 160).optional(),
        description: optionalTextSchema(500),
        status: z.enum(LINE_MUTATION_STATUSES).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })
