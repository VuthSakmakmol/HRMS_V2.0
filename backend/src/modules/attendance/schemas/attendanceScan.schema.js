import { z } from "zod"

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const rawScanListQuerySchema = z
    .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(500).default(50),
        search: z.string().trim().max(100).optional().default(""),
        dateFrom: dateSchema,
        dateTo: dateSchema,
        companyId: objectIdSchema.optional(),
        branchId: objectIdSchema.optional(),
        departmentId: objectIdSchema.optional(),
        positionId: objectIdSchema.optional(),
        lineId: objectIdSchema.optional(),
        employeeTypeId: objectIdSchema.optional(),
    })
    .refine((value) => value.dateFrom <= value.dateTo, {
        path: ["dateTo"],
        message: "Date to must be on or after date from.",
    })
