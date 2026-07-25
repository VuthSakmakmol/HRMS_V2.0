import { z } from "zod"

const objectId = z.string().regex(/^[a-f\d]{24}$/i)

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

export const attendancePayrollRunResultSchema = z.object({
    companyId: objectId,
    branchId: objectId,
    claimToken: z.string().uuid(),
    success: z.boolean(),
    importedFile: z.string().trim().max(255).default(""),
    error: z.string().trim().max(4000).default(""),
})
