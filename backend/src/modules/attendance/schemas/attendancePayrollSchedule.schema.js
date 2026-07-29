import { z } from "zod"

const objectId = z.string().regex(/^[a-f\d]{24}$/i)
const reportDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const attendancePayrollScheduleQuerySchema = z.object({
    companyId: objectId,
    branchId: objectId,
})

export const attendancePayrollScheduleSaveSchema = z.object({
    companyId: objectId,
    branchId: objectId,
    enabled: z.boolean(),
    runTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timeZone: z.literal("Asia/Phnom_Penh").default("Asia/Phnom_Penh"),
})

export const attendancePayrollRunRequestSchema =
    attendancePayrollScheduleQuerySchema.extend({
        reportDate,
    })

export const attendancePayrollRunResultSchema = z.object({
    companyId: objectId,
    branchId: objectId,
    claimToken: z.string().uuid(),
    outcome: z.enum(["SUCCESS", "FAILED", "CANCELLED"]),
    importedFile: z.string().trim().max(255).default(""),
    reportDate: reportDate.nullish(),
    rowCount: z.number().int().min(0).default(0),
    error: z.string().trim().max(4000).default(""),
}).superRefine((value, context) => {
    if (value.outcome === "SUCCESS" && !value.reportDate) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["reportDate"],
            message: "Report date is required for a successful import.",
        })
    }
})

export const attendancePayrollRunStatusSchema =
    attendancePayrollScheduleQuerySchema.extend({
        claimToken: z.string().uuid(),
    })

export const attendancePayrollRunProgressSchema =
    attendancePayrollRunStatusSchema.extend({
        percent: z.number().int().min(0).max(100),
        phase: z.string().trim().min(1).max(80),
        detail: z.string().trim().max(500).default(""),
    })
