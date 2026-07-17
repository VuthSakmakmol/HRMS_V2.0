import { z } from "zod"

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid MongoDB ObjectId.",
})

const optionalObjectIdSchema = z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
        return undefined
    }

    return value
}, objectIdSchema.optional())

const dateKeySchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Date must use YYYY-MM-DD format.",
})

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

export const CALENDAR_DAY_TYPES = [
    "WORKING_DAY",
    "WEEKEND",
    "HOLIDAY",
    "SPECIAL_WORKING_DAY",
    "COMPANY_EVENT",
    "CLOSED_DAY",
]

export const CALENDAR_SCOPE_LEVELS = ["GLOBAL", "COMPANY", "BRANCH"]
export const CALENDAR_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"]
export const CALENDAR_MUTATION_STATUSES = ["ACTIVE", "INACTIVE"]

export const calendarDayIdParamSchema = z.object({
    calendarDayId: objectIdSchema,
})

export const calendarDayListQuerySchema = z
    .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
        startDate: dateKeySchema.optional(),
        endDate: dateKeySchema.optional(),
        companyId: optionalObjectIdSchema,
        branchId: optionalObjectIdSchema,
        scopeLevel: z.enum(["ALL", ...CALENDAR_SCOPE_LEVELS]).default("ALL"),
        dayType: z.enum(["ALL", ...CALENDAR_DAY_TYPES]).default("ALL"),
        status: z.enum(["ALL", ...CALENDAR_STATUSES]).default("ALL"),
        search: z.string().trim().max(120).optional().default(""),
        sortBy: z.enum(["dateKey", "name", "dayType", "scopeLevel", "status", "updatedAt"]).default("dateKey"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
    })
    .superRefine((value, context) => {
        if (value.startDate && value.endDate && value.startDate > value.endDate) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["endDate"],
                message: "End date must be after start date.",
            })
        }
    })

export const calendarDayCreateSchema = z
    .object({
        scopeLevel: z.enum(CALENDAR_SCOPE_LEVELS).default("GLOBAL"),
        companyId: optionalObjectIdSchema,
        branchId: optionalObjectIdSchema,
        dateKey: dateKeySchema,
        dayType: z.enum(CALENDAR_DAY_TYPES),
        name: textSchema(2, 160),
        holidayCategory: optionalTextSchema(80),
        isPaidHoliday: z.coerce.boolean().optional(),
        description: optionalTextSchema(500),
        status: z.enum(CALENDAR_MUTATION_STATUSES).optional(),
    })
    .superRefine((value, context) => {
        if (value.scopeLevel === "GLOBAL" && (value.companyId || value.branchId)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["scopeLevel"],
                message: "Global calendar cannot have company or branch.",
            })
        }

        if (value.scopeLevel === "COMPANY" && !value.companyId) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["companyId"],
                message: "Company calendar requires company.",
            })
        }

        if (value.scopeLevel === "COMPANY" && value.branchId) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["branchId"],
                message: "Company calendar cannot have branch.",
            })
        }

        if (value.scopeLevel === "BRANCH" && (!value.companyId || !value.branchId)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["branchId"],
                message: "Branch calendar requires company and branch.",
            })
        }
    })

export const calendarDayUpdateSchema = z
    .object({
        dayType: z.enum(CALENDAR_DAY_TYPES).optional(),
        name: textSchema(2, 160).optional(),
        holidayCategory: optionalTextSchema(80),
        isPaidHoliday: z.coerce.boolean().optional(),
        description: optionalTextSchema(500),
        status: z.enum(CALENDAR_MUTATION_STATUSES).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })

export const calendarResolveDayQuerySchema = z.object({
    date: dateKeySchema,
    companyId: optionalObjectIdSchema,
    branchId: optionalObjectIdSchema,
})

export const calendarResolveRangeQuerySchema = z
    .object({
        startDate: dateKeySchema,
        endDate: dateKeySchema,
        companyId: optionalObjectIdSchema,
        branchId: optionalObjectIdSchema,
    })
    .superRefine((value, context) => {
        if (value.startDate > value.endDate) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["endDate"],
                message: "End date must be after start date.",
            })
        }
    })
