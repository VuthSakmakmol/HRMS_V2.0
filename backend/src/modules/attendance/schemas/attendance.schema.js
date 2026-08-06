import { z } from "zod"

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i)
const optionalObjectIdSchema = z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    objectIdSchema.optional(),
)
const dateSchema = z.coerce.date()

export const attendanceListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(120).default(""),
    dateFrom: dateSchema,
    dateTo: dateSchema,
    status: z
        .enum([
            "ALL",
            "PRESENT",
            "LATE",
            "EARLY_LEAVE",
            "LATE_AND_EARLY_LEAVE",
            "MISSING_IN",
            "MISSING_OUT",
            "ABSENT",
            "REST_DAY",
            "HOLIDAY",
        ])
        .default("ALL"),
    leaveCode: z.enum(["ALL", "BLANK", "AL", "ML", "SL", "UL"]).default("ALL"),
    companyId: optionalObjectIdSchema,
    branchId: optionalObjectIdSchema,
    departmentId: optionalObjectIdSchema,
    positionId: optionalObjectIdSchema,
    lineId: optionalObjectIdSchema,
    shiftId: optionalObjectIdSchema,
    employeeTypeId: optionalObjectIdSchema,
    employeeTypeChildId: optionalObjectIdSchema,
    employmentStatus: z.enum(["ALL", "WORKING", "MATERNITY_LEAVE", "RESIGNED", "TERMINATED", "ABANDONED", "PASSED_AWAY", "RETIRED"]).default("ALL"),
    scanCondition: z.enum(["ALL", "COMPLETE", "HAS_ANY", "MISSING_BOTH", "MISSING_IN", "MISSING_OUT", "TIME1_ONLY", "TIME2_ONLY"]).default("ALL"),
    source: z.enum(["ALL", "MANUAL", "EXCEL_IMPORT", "MACHINE_SYNC"]).default("ALL"),
    lockStatus: z.enum(["ALL", "OPEN", "HR_VERIFIED", "PAYROLL_LOCKED", "FINALIZED"]).default("ALL"),
    lateCondition: z.enum(["ALL", "LATE", "NOT_LATE"]).default("ALL"),
    earlyLeaveCondition: z.enum(["ALL", "EARLY", "NOT_EARLY"]).default("ALL"),
    verificationStatus: z.enum(["ALL", "VERIFIED", "NEEDS_REVIEW", "CORRECTED"]).default("ALL"),
    issueCode: z.string().trim().max(80).optional(),
}).refine((value) => value.dateFrom <= value.dateTo, { path: ["dateTo"], message: "Date to must be on or after date from." })

export const attendanceUpsertSchema = z.object({
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    employeeCode: z.string().trim().min(1).max(40),
    attendanceDate: dateSchema,
    firstInAt: z.coerce.date().nullable().optional(),
    lastOutAt: z.coerce.date().nullable().optional(),
    leaveCode: z.enum(["AL", "ML", "SL", "UL"]).nullable().optional(),
    note: z.string().trim().max(1000).default(""),
})

export const attendanceIdParamSchema = z.object({
    attendanceId: objectIdSchema,
})

export const attendanceImportIssueListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(120).default(""),
    companyId: optionalObjectIdSchema,
    branchId: optionalObjectIdSchema,
    dateFrom: dateSchema.optional(),
    dateTo: dateSchema.optional(),
    status: z.enum(["NO_EMPLOYEE_MATCH", "RESOLVED", "ARCHIVED", "ALL"])
        .default("NO_EMPLOYEE_MATCH"),
}).refine(
    (value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
    {
        path: ["dateTo"],
        message: "Date to must be on or after date from.",
    },
)

export const attendanceEmployeeStatusSyncSchema = z.object({
    companyId: objectIdSchema,
    branchId: objectIdSchema,
    reportDate: dateSchema,
    rows: z.array(
        z.object({
            employeeCode: z.string().trim().min(1).max(40),
            lineNo: z.string().trim().min(1).max(160),
        }),
    ).max(20_000),
})
