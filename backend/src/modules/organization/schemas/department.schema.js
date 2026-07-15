import { z } from "zod"

const DEPARTMENT_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"]
const DEPARTMENT_UPDATE_STATUSES = ["ACTIVE", "INACTIVE"]
const DEPARTMENT_SORT_FIELDS = [
    "code",
    "name",
    "status",
    "createdAt",
    "updatedAt",
]

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "errors.invalidId",
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
            .min(2, "errors.validationFailed")
            .max(30, "errors.validationFailed")
            .regex(/^[A-Z0-9_-]+$/, {
                message: "errors.validationFailed",
            }),
    )

const normalizedTextSchema = (min, max) =>
    z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .pipe(
            z
                .string()
                .min(min, "errors.validationFailed")
                .max(max, "errors.validationFailed"),
        )

const optionalTextSchema = (max) =>
    z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .pipe(z.string().max(max, "errors.validationFailed"))
        .optional()

export const departmentIdParamSchema = z.object({
    departmentId: objectIdSchema,
})

export const departmentListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    status: z.enum(["ALL", ...DEPARTMENT_STATUSES]).default("ALL"),
    search: z.string().trim().max(120).optional().default(""),
    sortBy: z.enum(DEPARTMENT_SORT_FIELDS).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
})

export const departmentCreateSchema = z.object({
    companyId: objectIdSchema,
    branchId: objectIdSchema,
    parentDepartmentId: nullableObjectIdSchema.optional(),
    code: normalizedCodeSchema,
    name: normalizedTextSchema(2, 160),
    description: optionalTextSchema(500),
    status: z.enum(DEPARTMENT_UPDATE_STATUSES).optional(),
})

export const departmentUpdateSchema = z
    .object({
        parentDepartmentId: nullableObjectIdSchema.optional(),
        code: normalizedCodeSchema.optional(),
        name: normalizedTextSchema(2, 160).optional(),
            description: optionalTextSchema(500),
        status: z.enum(DEPARTMENT_UPDATE_STATUSES).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "errors.validationFailed",
    })
