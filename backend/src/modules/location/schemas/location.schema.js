import { z } from "zod"

export const LOCATION_ENTITIES = Object.freeze([
    "countries",
    "provinces",
    "districts",
    "communes",
    "villages",
])

const LOCATION_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"]
const LOCATION_UPDATE_STATUSES = ["ACTIVE", "INACTIVE"]

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
            .min(1)
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

const baseCreateFields = {
    code: normalizedCodeSchema,
    name: normalizedTextSchema(2, 160),
    description: optionalTextSchema(500),
    status: z.enum(LOCATION_UPDATE_STATUSES).optional(),
}

const baseUpdateFields = {
    code: normalizedCodeSchema.optional(),
    name: normalizedTextSchema(2, 160).optional(),
    description: optionalTextSchema(500),
    status: z.enum(LOCATION_UPDATE_STATUSES).optional(),
}

export const locationEntityParamSchema = z.object({
    entity: z.enum(LOCATION_ENTITIES),
})

export const locationIdParamSchema = z.object({
    entity: z.enum(LOCATION_ENTITIES),
    locationId: objectIdSchema,
})

export const locationListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["ALL", ...LOCATION_STATUSES]).default("ALL"),
    search: z.string().trim().max(120).optional().default(""),
    countryId: objectIdSchema.optional(),
    provinceId: objectIdSchema.optional(),
    districtId: objectIdSchema.optional(),
    communeId: objectIdSchema.optional(),
})

export const countryCreateSchema = z.object({
    code: normalizedCodeSchema,
    name: normalizedTextSchema(2, 160),
    nationality: optionalTextSchema(120),
    phoneCode: z.string().trim().max(20).optional(),
    description: optionalTextSchema(500),
    status: z.enum(LOCATION_UPDATE_STATUSES).optional(),
})

export const countryUpdateSchema = z
    .object({
        code: normalizedCodeSchema.optional(),
        name: normalizedTextSchema(2, 160).optional(),
        nationality: optionalTextSchema(120),
        phoneCode: z.string().trim().max(20).optional(),
        description: optionalTextSchema(500),
        status: z.enum(LOCATION_UPDATE_STATUSES).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })

export const provinceCreateSchema = z.object({
    countryId: objectIdSchema,
    ...baseCreateFields,
})

export const provinceUpdateSchema = z
    .object({
        countryId: objectIdSchema.optional(),
        ...baseUpdateFields,
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })

export const districtCreateSchema = z.object({
    countryId: objectIdSchema,
    provinceId: objectIdSchema,
    ...baseCreateFields,
})

export const districtUpdateSchema = z
    .object({
        countryId: objectIdSchema.optional(),
        provinceId: objectIdSchema.optional(),
        ...baseUpdateFields,
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })

export const communeCreateSchema = z.object({
    countryId: objectIdSchema,
    provinceId: objectIdSchema,
    districtId: objectIdSchema,
    ...baseCreateFields,
})

export const communeUpdateSchema = z
    .object({
        countryId: objectIdSchema.optional(),
        provinceId: objectIdSchema.optional(),
        districtId: objectIdSchema.optional(),
        ...baseUpdateFields,
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })

export const villageCreateSchema = z.object({
    countryId: objectIdSchema,
    provinceId: objectIdSchema,
    districtId: objectIdSchema,
    communeId: objectIdSchema,
    ...baseCreateFields,
})

export const villageUpdateSchema = z
    .object({
        countryId: objectIdSchema.optional(),
        provinceId: objectIdSchema.optional(),
        districtId: objectIdSchema.optional(),
        communeId: objectIdSchema.optional(),
        ...baseUpdateFields,
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })

export function getLocationCreateSchema(entity) {
    return {
        countries: countryCreateSchema,
        provinces: provinceCreateSchema,
        districts: districtCreateSchema,
        communes: communeCreateSchema,
        villages: villageCreateSchema,
    }[entity]
}

export function getLocationUpdateSchema(entity) {
    return {
        countries: countryUpdateSchema,
        provinces: provinceUpdateSchema,
        districts: districtUpdateSchema,
        communes: communeUpdateSchema,
        villages: villageUpdateSchema,
    }[entity]
}
