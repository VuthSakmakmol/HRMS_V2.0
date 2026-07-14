import { z } from "zod"

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const verificationPayloadSchema = z
    .object({
        dateFrom: dateSchema,
        dateTo: dateSchema,
        companyId: objectIdSchema.optional(),
        branchId: objectIdSchema.optional(),
        departmentId: objectIdSchema.optional(),
        positionId: objectIdSchema.optional(),
        lineId: objectIdSchema.optional(),
        employeeTypeId: objectIdSchema.optional(),
        overwriteCorrected: z.boolean().default(false),
    })
    .refine((value) => value.dateFrom <= value.dateTo, {
        path: ["dateTo"],
        message: "Date to must be on or after date from.",
    })
