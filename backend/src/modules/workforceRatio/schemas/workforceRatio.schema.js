import { z } from "zod"

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "errors.report.workforceRatio.invalidId",
})

const employeeTypeIdsSchema = z
    .array(objectIdSchema)
    .min(1, { message: "errors.report.workforceRatio.employeeTypeRequired" })
    .transform((values) => [...new Set(values)])

const budgetYearSchema = z.coerce
    .number()
    .int({ message: "errors.report.workforceRatio.budgetYearInvalid" })
    .min(2000, { message: "errors.report.workforceRatio.budgetYearInvalid" })
    .max(2100, { message: "errors.report.workforceRatio.budgetYearInvalid" })

const budgetRatioSchema = z.coerce
    .number()
    .positive({ message: "errors.report.workforceRatio.budgetRatioInvalid" })
    .max(100, { message: "errors.report.workforceRatio.budgetRatioInvalid" })

export const workforceRatioIdParamSchema = z.object({
    workforceRatioId: objectIdSchema,
})

export const workforceRatioScopeQuerySchema = z.object({
    companyId: objectIdSchema,
    branchId: objectIdSchema,
})

export const workforceRatioCreateSchema = z
    .object({
        companyId: objectIdSchema,
        branchId: objectIdSchema,
        directEmployeeTypeIds: employeeTypeIdsSchema,
        indirectEmployeeTypeIds: employeeTypeIdsSchema,
        budgetYear: budgetYearSchema,
        budgetRatio: budgetRatioSchema,
        status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
    })
    .superRefine((value, ctx) => {
        const directIds = new Set(value.directEmployeeTypeIds)
        const overlap = value.indirectEmployeeTypeIds.filter((id) => directIds.has(id))

        if (overlap.length > 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["indirectEmployeeTypeIds"],
                message: "errors.report.workforceRatio.employeeTypeOverlap",
            })
        }
    })

export const workforceRatioUpdateSchema = z
    .object({
        directEmployeeTypeIds: employeeTypeIdsSchema.optional(),
        indirectEmployeeTypeIds: employeeTypeIdsSchema.optional(),
        budgetYear: budgetYearSchema.optional(),
        budgetRatio: budgetRatioSchema.optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "errors.report.workforceRatio.updateRequired",
    })
    .superRefine((value, ctx) => {
        if (!value.directEmployeeTypeIds || !value.indirectEmployeeTypeIds) return

        const directIds = new Set(value.directEmployeeTypeIds)
        const overlap = value.indirectEmployeeTypeIds.filter((id) => directIds.has(id))

        if (overlap.length > 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["indirectEmployeeTypeIds"],
                message: "errors.report.workforceRatio.employeeTypeOverlap",
            })
        }
    })
