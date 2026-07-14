import { z } from "zod"

const SHIFT_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"]
const SHIFT_MUTATION_STATUSES = ["ACTIVE", "INACTIVE"]

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid MongoDB ObjectId.",
})

const timeSchema = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "Time must use HH:mm format.",
})

const optionalTimeSchema = z.preprocess(
    (value) => {
        if (value === "" || value === undefined || value === null) {
            return ""
        }

        return value
    },
    z
        .string()
        .trim()
        .regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/, {
            message: "Time must use HH:mm format.",
        }),
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

export const shiftIdParamSchema = z.object({
    shiftId: objectIdSchema,
})

export const shiftListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    status: z.enum(["ALL", ...SHIFT_STATUSES]).default("ALL"),
    search: z.string().trim().max(120).optional().default(""),
})

export const shiftCreateSchema = z
    .object({
        companyId: objectIdSchema,
        branchId: objectIdSchema,
        code: codeSchema,
        name: textSchema(2, 160),
        shortName: optionalTextSchema(80),
        startTime: timeSchema,
        endTime: timeSchema,
        breakStartTime: optionalTimeSchema.optional(),
        breakEndTime: optionalTimeSchema.optional(),
        graceInMinutes: z.coerce.number().int().min(0).max(240).optional(),
        graceOutMinutes: z.coerce.number().int().min(0).max(240).optional(),
        description: optionalTextSchema(500),
        status: z.enum(SHIFT_MUTATION_STATUSES).optional(),
    })
    .superRefine((value, context) => {
        const hasBreakStart = Boolean(value.breakStartTime)
        const hasBreakEnd = Boolean(value.breakEndTime)

        if (hasBreakStart !== hasBreakEnd) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["breakStartTime"],
                message:
                    "Break start time and break end time must be filled together.",
            })

            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["breakEndTime"],
                message:
                    "Break start time and break end time must be filled together.",
            })
        }
    })

export const shiftUpdateSchema = z
    .object({
        code: codeSchema.optional(),
        name: textSchema(2, 160).optional(),
        shortName: optionalTextSchema(80),
        startTime: timeSchema.optional(),
        endTime: timeSchema.optional(),
        breakStartTime: optionalTimeSchema.optional(),
        breakEndTime: optionalTimeSchema.optional(),
        graceInMinutes: z.coerce.number().int().min(0).max(240).optional(),
        graceOutMinutes: z.coerce.number().int().min(0).max(240).optional(),
        description: optionalTextSchema(500),
        status: z.enum(SHIFT_MUTATION_STATUSES).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })
    .superRefine((value, context) => {
        const hasBreakStart = Boolean(value.breakStartTime)
        const hasBreakEnd = Boolean(value.breakEndTime)

        if (hasBreakStart !== hasBreakEnd) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["breakStartTime"],
                message:
                    "Break start time and break end time must be filled together.",
            })

            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["breakEndTime"],
                message:
                    "Break start time and break end time must be filled together.",
            })
        }
    })