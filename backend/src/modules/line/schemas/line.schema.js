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

const optionalObjectIdSchema = z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    objectIdSchema.optional(),
)

const positionIdsSchema = z
    .array(objectIdSchema)
    .min(1, "At least one Position is required.")
    .max(100)
    .transform((values) => [...new Set(values)])

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

function normalizeLegacyPositionPayload(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value
    if (
        (!Array.isArray(value.positionIds) || value.positionIds.length === 0) &&
        typeof value.positionId === "string" &&
        value.positionId.trim()
    ) {
        return {
            ...value,
            positionIds: [value.positionId],
        }
    }
    return value
}

export const lineIdParamSchema = z.object({
    lineId: objectIdSchema,
})

export const lineListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    companyId: optionalObjectIdSchema,
    branchId: optionalObjectIdSchema,
    departmentId: optionalObjectIdSchema,
    // The list filter is intentionally singular: select one Position and show
    // every Line that supports that Position.
    positionId: optionalObjectIdSchema,
    status: z.enum(["ALL", ...LINE_STATUSES]).default("ALL"),
    search: z.string().trim().max(120).optional().default(""),
    sortBy: z.enum(LINE_SORT_FIELDS).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
})

export const lineCreateSchema = z.preprocess(
    normalizeLegacyPositionPayload,
    z.object({
        companyId: objectIdSchema,
        branchId: objectIdSchema,
        positionIds: positionIdsSchema,
        code: codeSchema,
        name: textSchema(2, 160),
        description: optionalTextSchema(500),
        status: z.enum(LINE_MUTATION_STATUSES).default("ACTIVE"),
    }),
)

export const lineUpdateSchema = z.preprocess(
    normalizeLegacyPositionPayload,
    z
        .object({
            positionIds: positionIdsSchema.optional(),
            code: codeSchema.optional(),
            name: textSchema(2, 160).optional(),
            description: optionalTextSchema(500),
            status: z.enum(LINE_MUTATION_STATUSES).optional(),
        })
        .refine((value) => Object.keys(value).length > 0, {
            message: "At least one field is required.",
        }),
)
