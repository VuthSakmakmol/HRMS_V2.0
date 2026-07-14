import { z } from "zod"

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid MongoDB ObjectId.",
})

const nullableObjectIdSchema = z.preprocess(
    (value) => {
        if (value === "" || value === undefined || value === null) {
            return null
        }

        return value
    },
    objectIdSchema.nullable(),
)

const codeSchema = z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, "_").toUpperCase())
    .pipe(z.string().min(2).max(100).regex(/^[A-Z0-9_.-]+$/))

const optionalCodeSchema = z.preprocess(
    (value) => {
        if (value === "" || value === undefined || value === null) {
            return undefined
        }

        return value
    },
    codeSchema.optional(),
)

const statusQuerySchema = z
    .enum(["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"])
    .default("ACTIVE")

const genericObjectSchema = z
    .record(z.string(), z.any())
    .optional()
    .default({})

const resolverSchema = z.object({
    resolverKey: codeSchema,
    resolverConfig: genericObjectSchema,
})

const policyScopeSchema = z.object({
    companyId: objectIdSchema,
    branchId: nullableObjectIdSchema.optional(),
    departmentId: nullableObjectIdSchema.optional(),
    lineId: nullableObjectIdSchema.optional(),
    positionId: nullableObjectIdSchema.optional(),
    employeeId: nullableObjectIdSchema.optional(),
})

const policyStepSchema = z.object({
    stepCode: codeSchema,
    stepName: z.string().trim().min(2).max(160),
    sequence: z.coerce.number().int().min(1).max(100),
    approvalMode: optionalCodeSchema.default("ALL"),
    assignmentMode: optionalCodeSchema.default("FIRST"),
    resolverKey: codeSchema,
    resolverConfig: genericObjectSchema,
    fallbackResolvers: z.array(resolverSchema).optional().default([]),
    allowSelfApproval: z.coerce.boolean().optional().default(false),
    isRequired: z.coerce.boolean().optional().default(true),
    canReject: z.coerce.boolean().optional().default(true),
    canReturn: z.coerce.boolean().optional().default(false),
    description: z.string().trim().max(500).optional().default(""),
})

export const idParamSchema = z.object({
    id: objectIdSchema,
})

export const moduleIdParamSchema = z.object({
    moduleId: objectIdSchema,
})

export const policyIdParamSchema = z.object({
    policyId: objectIdSchema,
})

export const requestIdParamSchema = z.object({
    requestId: objectIdSchema,
})

export const taskParamSchema = z.object({
    requestId: objectIdSchema,
    taskId: objectIdSchema,
})

export const approvalModuleListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional().default(""),
    status: statusQuerySchema,
})

export const approvalModuleCreateSchema = z.object({
    moduleKey: codeSchema,
    name: z.string().trim().min(2).max(180),
    defaultActionKey: optionalCodeSchema.default("REQUEST"),
    description: z.string().trim().max(500).optional().default(""),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
})

export const approvalModuleUpdateSchema = approvalModuleCreateSchema
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })

export const approvalPolicyListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional().default(""),
    moduleKey: optionalCodeSchema,
    actionKey: optionalCodeSchema,
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    status: statusQuerySchema,
})

export const approvalPolicyCreateSchema = z.object({
    moduleKey: codeSchema,
    actionKey: optionalCodeSchema.default("REQUEST"),
    code: codeSchema,
    name: z.string().trim().min(2).max(180),
    scope: policyScopeSchema,
    conditions: genericObjectSchema,
    priority: z.coerce.number().int().min(0).max(9999).optional().default(100),
    steps: z.array(policyStepSchema).min(1),
    description: z.string().trim().max(500).optional().default(""),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
    effectiveFrom: z.coerce.date().nullable().optional(),
    effectiveTo: z.coerce.date().nullable().optional(),
})

export const approvalPolicyUpdateSchema = approvalPolicyCreateSchema
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })

export const approvalResolvePreviewQuerySchema = z.object({
    moduleKey: codeSchema.default("EMPLOYEE_CHANGE"),
    actionKey: optionalCodeSchema.default("REQUEST"),
    employeeId: objectIdSchema.optional(),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    departmentId: objectIdSchema.optional(),
    positionId: objectIdSchema.optional(),
    lineId: objectIdSchema.optional(),
    amount: z.coerce.number().optional(),
})

export const approvalResolvePreviewBodySchema = z.object({
    moduleKey: codeSchema,
    actionKey: optionalCodeSchema.default("REQUEST"),
    assignment: z.object({
        employeeId: nullableObjectIdSchema.optional(),
        companyId: objectIdSchema,
        branchId: nullableObjectIdSchema.optional(),
        departmentId: nullableObjectIdSchema.optional(),
        positionId: nullableObjectIdSchema.optional(),
        lineId: nullableObjectIdSchema.optional(),
    }),
    context: genericObjectSchema,
})

export const approvalRequestStartSchema = z.object({
    moduleKey: codeSchema,
    actionKey: optionalCodeSchema.default("REQUEST"),
    subjectType: codeSchema,
    subjectId: objectIdSchema,
    title: z.string().trim().max(240).optional().default(""),
    requesterEmployeeId: nullableObjectIdSchema.optional(),
    assignment: z.object({
        companyId: objectIdSchema,
        branchId: nullableObjectIdSchema.optional(),
        departmentId: nullableObjectIdSchema.optional(),
        positionId: nullableObjectIdSchema.optional(),
        lineId: nullableObjectIdSchema.optional(),
        employeeId: nullableObjectIdSchema.optional(),
    }),
    context: genericObjectSchema,
    metadata: genericObjectSchema,
    allowMissingOptionalApprovers: z.coerce.boolean().optional().default(true),
})

export const approvalRequestListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    moduleKey: optionalCodeSchema,
    actionKey: optionalCodeSchema,
    status: z
        .enum(["ALL", "DRAFT", "PENDING", "APPROVED", "REJECTED", "RETURNED", "CANCELED", "FAILED"])
        .default("ALL"),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    search: z.string().trim().max(120).optional().default(""),
})

export const approvalInboxQuerySchema = z.object({
    employeeId: objectIdSchema,
    status: z.enum(["PENDING", "WAITING", "APPROVED", "REJECTED", "RETURNED", "ALL"]).default("PENDING"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const approvalTaskDecisionSchema = z.object({
    decision: z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, "_").toUpperCase())
        .pipe(z.enum(["APPROVE", "REJECT", "RETURN"])),
    actorEmployeeId: objectIdSchema,
    note: z.string().trim().max(1000).optional().default(""),
})

export const approvalTaskReassignSchema = z.object({
    toEmployeeId: objectIdSchema,
    reason: z.string().trim().min(2).max(1000),
})
