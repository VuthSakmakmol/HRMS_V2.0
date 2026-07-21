import { z } from "zod"

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i)

export const attendancePolicyListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(120).default(""),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    status: z.enum(["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("ALL"),
})

export const attendancePolicyPayloadSchema = z.object({
    companyId: objectIdSchema,
    branchId: objectIdSchema,
    name: z.string().trim().min(2).max(160),
    code: z.string().trim().min(2).max(40),
    graceInMinutes: z.coerce.number().int().min(0).max(240).default(0),
    graceOutMinutes: z.coerce.number().int().min(0).max(240).default(0),
    minimumWorkedMinutes: z.coerce.number().int().min(0).max(1440).default(0),
    lateRoundUnitMinutes: z.coerce.number().int().min(1).max(240).default(1),
    lateRoundMethod: z.enum(["FLOOR", "CEIL", "NEAREST"]).default("CEIL"),
    earlyLeaveRoundUnitMinutes: z.coerce.number().int().min(1).max(240).default(1),
    earlyLeaveRoundMethod: z.enum(["FLOOR", "CEIL", "NEAREST"]).default("CEIL"),
    autoGenerateAbsent: z.boolean().default(true),
    treatSundayAsRestDay: z.boolean().default(true),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).refine(
    (value) => !value.effectiveFrom || !value.effectiveTo || value.effectiveFrom <= value.effectiveTo,
    { path: ["effectiveTo"], message: "Effective to must be on or after effective from." },
)

export const attendancePolicyIdParamSchema = z.object({
    policyId: objectIdSchema,
})
