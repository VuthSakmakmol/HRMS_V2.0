import { z } from "zod"

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid MongoDB ObjectId.",
})

function startOfCurrentYear() {
    return `${new Date().getFullYear()}-01-01`
}

function endOfCurrentYear() {
    return `${new Date().getFullYear()}-12-31`
}

const dateStringSchema = z.string().date()

const employeeTypeFilterKeyValueSchema = z
    .string()
    .trim()
    .max(140)
    .regex(/^(TYPE|CHILD):[0-9a-fA-F]{24}(:[A-Z0-9_-]{2,30})?$/, {
        message: "Invalid employee type filter key.",
    })

const employeeTypeFilterKeySchema = employeeTypeFilterKeyValueSchema.optional()

const employeeTypeFilterKeysSchema = z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined

    const values = Array.isArray(value) ? value : String(value).split(",")

    return [...new Set(
        values
            .flatMap((item) => String(item).split(","))
            .map((item) => item.trim())
            .filter(Boolean),
    )]
}, z.array(employeeTypeFilterKeyValueSchema).min(1).max(20).optional())

const employeeTypeChildCodeSchema = z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, "_").toUpperCase())
    .pipe(z.string().min(2).max(30).regex(/^[A-Z0-9_-]+$/))
    .optional()

export const excomQuerySchema = z
    .object({
        startDate: dateStringSchema.default(startOfCurrentYear()),
        endDate: dateStringSchema.default(endOfCurrentYear()),
        companyId: objectIdSchema.optional(),
        branchId: objectIdSchema.optional(),
        departmentId: objectIdSchema.optional(),
        positionId: objectIdSchema.optional(),
        lineId: objectIdSchema.optional(),
        shiftId: objectIdSchema.optional(),
        employeeTypeId: objectIdSchema.optional(),
        exitReasonId: objectIdSchema.optional(),
        employeeTypeChildCode: employeeTypeChildCodeSchema,
        employeeTypeFilterKey: employeeTypeFilterKeySchema,
        employeeTypeFilterKeys: employeeTypeFilterKeysSchema,
        forceRefresh: z
            .enum(["true", "false"])
            .transform((value) => value === "true")
            .optional(),
    })
    .superRefine((value, context) => {
        const startDate = new Date(`${value.startDate}T00:00:00.000Z`)
        const endDate = new Date(`${value.endDate}T23:59:59.999Z`)

        if (endDate < startDate) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["endDate"],
                message: "End date must be on or after start date.",
            })
        }

        const maximumEndDate = new Date(startDate)
        maximumEndDate.setUTCFullYear(maximumEndDate.getUTCFullYear() + 5)

        if (endDate > maximumEndDate) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["endDate"],
                message: "Dashboard date range cannot exceed five years.",
            })
        }
    })

export const excomLookupQuerySchema = z.object({
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    departmentId: objectIdSchema.optional(),
})
