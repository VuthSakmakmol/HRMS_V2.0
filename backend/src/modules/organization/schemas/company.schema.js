import { z } from "zod"

const COMPANY_STATUSES = ["ACTIVE", "SUSPENDED", "ARCHIVED"]
const COMPANY_UPDATE_STATUSES = ["ACTIVE", "SUSPENDED"]
const LOCALES = ["en-US", "km-KH"]
const COMPANY_SORT_FIELDS = [
    "code",
    "legalName",
    "displayName",
    "status",
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
        website: z.string().trim().max(250).optional(),
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

const settingsSchema = z
    .object({
        defaultLocale: z.enum(LOCALES).optional(),
        timezone: z.string().trim().min(1).max(80).optional(),
        currencyCode: z.string().trim().toUpperCase().length(3).optional(),
        weekStartsOn: z.coerce.number().int().min(0).max(6).optional(),
    })
    .optional()

export const companyIdParamSchema = z.object({
    companyId: objectIdSchema,
})

export const companyListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["ALL", ...COMPANY_STATUSES]).default("ALL"),
    search: z.string().trim().max(120).optional().default(""),
    sortBy: z.enum(COMPANY_SORT_FIELDS).default("displayName"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
})

export const companyCreateSchema = z.object({
    code: normalizedCodeSchema,
    legalName: normalizedTextSchema(2, 200),
    displayName: normalizedTextSchema(2, 120),
    registrationNumber: optionalTextSchema(100),
    taxNumber: optionalTextSchema(100),
    status: z.enum(COMPANY_UPDATE_STATUSES).optional(),
    settings: settingsSchema,
    contact: contactSchema,
    address: addressSchema,
})

export const companyUpdateSchema = z
    .object({
        code: normalizedCodeSchema.optional(),
        legalName: normalizedTextSchema(2, 200).optional(),
        displayName: normalizedTextSchema(2, 120).optional(),
        registrationNumber: optionalTextSchema(100),
        taxNumber: optionalTextSchema(100),
        status: z.enum(COMPANY_UPDATE_STATUSES).optional(),
        settings: settingsSchema,
        contact: contactSchema,
        address: addressSchema,
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })
