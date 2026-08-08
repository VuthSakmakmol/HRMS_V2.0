import { z } from "zod"

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "errors.organization.recruitmentChannel.invalidId",
})

const nullableObjectIdSchema = z
    .union([objectIdSchema, z.literal(""), z.null()])
    .transform((value) => value || null)

const optionalObjectIdSchema = nullableObjectIdSchema.optional()

const normalizedCodeSchema = z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, "_").toUpperCase())
    .pipe(
        z
            .string()
            .min(2, "errors.organization.recruitmentChannel.codeRequired")
            .max(40, "errors.organization.recruitmentChannel.codeTooLong")
            .regex(/^[A-Z0-9_-]+$/, {
                message: "errors.organization.recruitmentChannel.codeInvalid",
            }),
    )

const requiredTextSchema = (min, max, requiredMessageKey, tooLongMessageKey) =>
    z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .pipe(
            z
                .string()
                .min(min, requiredMessageKey)
                .max(max, tooLongMessageKey),
        )

const optionalTextCreateSchema = (max, tooLongMessageKey) =>
    z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .pipe(z.string().max(max, tooLongMessageKey))
        .optional()
        .default("")

const optionalTextUpdateSchema = (max, tooLongMessageKey) =>
    z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .pipe(z.string().max(max, tooLongMessageKey))
        .optional()

export const recruitmentChannelIdParamSchema = z.object({
    recruitmentChannelId: objectIdSchema,
})

export const recruitmentChannelListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    status: z.enum(["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("ALL"),
    search: z.string().trim().max(120).optional().default(""),
})

export const recruitmentChannelCreateSchema = z
    .object({
        companyId: optionalObjectIdSchema,
        branchId: optionalObjectIdSchema,
        code: normalizedCodeSchema,
        name: requiredTextSchema(
            2,
            160,
            "errors.organization.recruitmentChannel.nameRequired",
            "errors.organization.recruitmentChannel.nameTooLong",
        ),
        shortName: optionalTextCreateSchema(
            80,
            "errors.organization.recruitmentChannel.shortNameTooLong",
        ),
        targetMonthly: z.coerce
            .number()
            .min(0, "errors.organization.recruitmentChannel.targetMonthlyInvalid")
            .max(999999, "errors.organization.recruitmentChannel.targetMonthlyInvalid")
            .optional()
            .default(0),
        sortOrder: z.coerce
            .number()
            .int("errors.organization.recruitmentChannel.sortOrderInvalid")
            .min(0, "errors.organization.recruitmentChannel.sortOrderInvalid")
            .max(999999, "errors.organization.recruitmentChannel.sortOrderInvalid")
            .optional()
            .default(0),
        description: optionalTextCreateSchema(
            500,
            "errors.organization.recruitmentChannel.descriptionTooLong",
        ),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
    })
    .superRefine((value, context) => {
        if (value.branchId && !value.companyId) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["companyId"],
                message: "errors.organization.recruitmentChannel.companyRequiredForBranch",
            })
        }
    })

export const recruitmentChannelUpdateSchema = z
    .object({
        companyId: optionalObjectIdSchema,
        branchId: optionalObjectIdSchema,
        code: normalizedCodeSchema.optional(),
        name: requiredTextSchema(
            2,
            160,
            "errors.organization.recruitmentChannel.nameRequired",
            "errors.organization.recruitmentChannel.nameTooLong",
        ).optional(),
        shortName: optionalTextUpdateSchema(
            80,
            "errors.organization.recruitmentChannel.shortNameTooLong",
        ),
        targetMonthly: z.coerce
            .number()
            .min(0, "errors.organization.recruitmentChannel.targetMonthlyInvalid")
            .max(999999, "errors.organization.recruitmentChannel.targetMonthlyInvalid")
            .optional(),
        sortOrder: z.coerce
            .number()
            .int("errors.organization.recruitmentChannel.sortOrderInvalid")
            .min(0, "errors.organization.recruitmentChannel.sortOrderInvalid")
            .max(999999, "errors.organization.recruitmentChannel.sortOrderInvalid")
            .optional(),
        description: optionalTextUpdateSchema(
            500,
            "errors.organization.recruitmentChannel.descriptionTooLong",
        ),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "errors.organization.recruitmentChannel.updateRequired",
    })
