import { z } from "zod"

const BRANCH_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"]
const BRANCH_UPDATE_STATUSES = ["ACTIVE", "INACTIVE"]
const BRANCH_SORT_FIELDS = [
    "code",
    "name",
    "shortName",
    "status",
    "isHeadOffice",
    "createdAt",
    "updatedAt",
]

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid MongoDB ObjectId.",
})

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

const emptyableEmailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .refine(
        (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        {
            message: "Invalid email address.",
        },
    )
    .optional()

const contactSchema = z
    .object({
        email: emptyableEmailSchema,
        phone: optionalTextSchema(40),
    })
    .optional()

const addressSchema = z
    .object({
        addressLine1: optionalTextSchema(200),
        addressLine2: optionalTextSchema(200),
        city: optionalTextSchema(100),
        stateProvince: optionalTextSchema(100),
        postalCode: optionalTextSchema(30),
        countryCode: z
            .string()
            .trim()
            .toUpperCase()
            .length(2)
            .optional(),
    })
    .optional()

export const branchIdParamSchema = z.object({
    branchId: objectIdSchema,
})

export const branchListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    companyId: objectIdSchema.optional(),
    status: z.enum(["ALL", ...BRANCH_STATUSES]).default("ALL"),
    search: z.string().trim().max(120).optional().default(""),
    sortBy: z.enum(BRANCH_SORT_FIELDS).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
})

export const branchCreateSchema = z.object({
    companyId: objectIdSchema,
    code: normalizedCodeSchema,
    name: normalizedTextSchema(2, 160),
    shortName: optionalTextSchema(60),
    status: z.enum(BRANCH_UPDATE_STATUSES).optional(),
    isHeadOffice: z.coerce.boolean().optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
    contact: contactSchema,
    address: addressSchema,
})

export const branchUpdateSchema = z
    .object({
        code: normalizedCodeSchema.optional(),
        name: normalizedTextSchema(2, 160).optional(),
        shortName: optionalTextSchema(60),
        status: z.enum(BRANCH_UPDATE_STATUSES).optional(),
        isHeadOffice: z.coerce.boolean().optional(),
        timezone: z.string().trim().min(1).max(80).optional(),
        contact: contactSchema,
        address: addressSchema,
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })