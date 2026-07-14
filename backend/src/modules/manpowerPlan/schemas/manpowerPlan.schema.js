import { z } from "zod"

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid MongoDB ObjectId.",
})

const nullableObjectIdSchema = z.preprocess(
    (value) => {
        if (value === "" || value === undefined || value === null) return null
        return value
    },
    objectIdSchema.nullable(),
)

const optionalTextSchema = (max = 500) =>
    z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .pipe(z.string().max(max))
        .optional()

const yearSchema = z.coerce.number().int().min(2000).max(2100)
const monthSchema = z.coerce.number().int().min(1).max(12)
const targetSchema = z.coerce.number().int().min(0).max(1000000)

export const manpowerPlanIdParamSchema = z.object({
    manpowerPlanId: objectIdSchema,
})

export const manpowerPlanListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional().default(""),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    year: yearSchema.optional(),
    month: monthSchema.optional(),
    departmentId: objectIdSchema.optional(),
    positionId: objectIdSchema.optional(),
    lineId: objectIdSchema.optional(),
    shiftId: objectIdSchema.optional(),
    employeeTypeId: objectIdSchema.optional(),
    employeeTypeChildId: objectIdSchema.optional(),
    status: z.enum(["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
})

export const manpowerPlanCreateSchema = z.object({
    companyId: objectIdSchema,
    branchId: objectIdSchema,
    year: yearSchema,
    month: monthSchema,
    departmentId: nullableObjectIdSchema.optional(),
    positionId: nullableObjectIdSchema.optional(),
    lineId: nullableObjectIdSchema.optional(),
    shiftId: nullableObjectIdSchema.optional(),
    employeeTypeId: nullableObjectIdSchema.optional(),
    employeeTypeChildId: nullableObjectIdSchema.optional(),
    employeeTypeChildCode: optionalTextSchema(30),
    employeeTypeChildName: optionalTextSchema(120),
    targetBudget: targetSchema.default(0),
    targetRoadmap: targetSchema.default(0),
    remark: optionalTextSchema(500),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
})

export const manpowerPlanUpdateSchema = manpowerPlanCreateSchema
    .omit({ companyId: true, branchId: true })
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })

export const manpowerPlanGridQuerySchema = z.object({
    companyId: objectIdSchema,
    branchId: objectIdSchema,
    year: yearSchema,
    month: monthSchema,
    employeeTypeId: objectIdSchema.optional(),
    employeeTypeChildId: objectIdSchema.optional(),
})

const manpowerPlanBatchRowSchema = z.object({
    id: objectIdSchema.optional(),
    departmentId: objectIdSchema,
    positionId: objectIdSchema,
    lineId: nullableObjectIdSchema.optional(),
    shiftId: nullableObjectIdSchema.optional(),
    employeeTypeId: nullableObjectIdSchema.optional(),
    employeeTypeChildId: nullableObjectIdSchema.optional(),
    employeeTypeChildCode: optionalTextSchema(30),
    employeeTypeChildName: optionalTextSchema(120),
    targetBudget: targetSchema.default(0),
    targetRoadmap: targetSchema.default(0),
    remark: optionalTextSchema(500),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    archive: z.coerce.boolean().optional().default(false),
})

export const manpowerPlanBatchSaveSchema = z.object({
    companyId: objectIdSchema,
    branchId: objectIdSchema,
    year: yearSchema,
    month: monthSchema,
    rows: z.array(manpowerPlanBatchRowSchema).min(1).max(5000),
})
