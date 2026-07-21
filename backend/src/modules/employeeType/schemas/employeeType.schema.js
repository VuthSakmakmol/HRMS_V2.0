import { z } from "zod"

const EMPLOYEE_TYPE_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"]
const EMPLOYEE_TYPE_UPDATE_STATUSES = ["ACTIVE", "INACTIVE"]
const POSITION_ASSIGNMENT_MODES = ["ALL_POSITIONS", "SPECIFIC_POSITIONS"]

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid MongoDB ObjectId.",
})

const normalizedCodeSchema = z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, "_").toUpperCase())
    .pipe(
        z
            .string()
            .min(2)
            .max(30)
            .regex(/^[A-Z0-9_-]+$/, {
                message:
                    "Code can contain uppercase letters, numbers, underscore, and dash only.",
            }),
    )

const normalizedTextSchema = (min, max) =>
    z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .pipe(z.string().min(min).max(max))

const optionalTextSchema = (max) =>
    z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .pipe(z.string().max(max))
        .optional()

const positionIdsSchema = z.array(objectIdSchema).max(500).optional().default([])
const updatePositionIdsSchema = z.array(objectIdSchema).max(500).optional()

function normalizePositionAssignmentMode(value) {
    if (!value) {
        return "SPECIFIC_POSITIONS"
    }

    const normalized = String(value).trim().replace(/\s+/g, "_").toUpperCase()

    if (normalized === "ALL" || normalized === "ALL_POSITION") {
        return "ALL_POSITIONS"
    }

    if (normalized === "SPECIFIC" || normalized === "POSITION") {
        return "SPECIFIC_POSITIONS"
    }

    return normalized
}

const positionAssignmentModeSchema = z
    .string()
    .optional()
    .transform(normalizePositionAssignmentMode)
    .pipe(z.enum(POSITION_ASSIGNMENT_MODES))

const dashboardCategorySchema = z
    .string()
    .trim()
    .min(2)
    .max(80)
    .transform((value) =>
        value
            .replace(/[\s-]+/g, "_")
            .replace(/[^A-Za-z0-9_]/g, "")
            .toUpperCase(),
    )

const employeeTypeChildSchema = z.object({
    code: normalizedCodeSchema.optional(),
    name: normalizedTextSchema(2, 120),
    dashboardCategory: dashboardCategorySchema,
    positionAssignmentMode: positionAssignmentModeSchema.default(
        "SPECIFIC_POSITIONS",
    ),
    positionIds: positionIdsSchema,
})

function normalizeChildren(children = []) {
    return children.map((child) => ({
        ...child,
        code:
            child.code ||
            child.name
                .trim()
                .replace(/\s+/g, "_")
                .toUpperCase()
                .replace(/[^A-Z0-9_-]/g, ""),
        dashboardCategory: child.dashboardCategory,
        positionAssignmentMode:
            child.positionAssignmentMode || "SPECIFIC_POSITIONS",
        positionIds: [...new Set(child.positionIds || [])],
    }))
}

function validateAssignmentMode(payload, context) {
    const children = payload.children || []
    const positionIds = payload.positionIds || []
    const hasChildren = children.length > 0
    const hasDirectPositions = positionIds.length > 0
    const parentMode = payload.positionAssignmentMode || "SPECIFIC_POSITIONS"

    if (hasChildren && hasDirectPositions) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["positionIds"],
            message:
                "Use parent positions or child groups, not both on the same employee type.",
        })
    }

    if (!hasChildren && parentMode === "SPECIFIC_POSITIONS" && !hasDirectPositions) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["positionIds"],
            message:
                "Choose at least one allowed position or change position assignment to all positions.",
        })
    }

    if (hasChildren) {
        const allPositionChildIndexes = children
            .map((child, index) => ({ child, index }))
            .filter(({ child }) => child.positionAssignmentMode === "ALL_POSITIONS")

        if (allPositionChildIndexes.length > 0 && children.length > 1) {
            for (const { index } of allPositionChildIndexes) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["children", index, "positionAssignmentMode"],
                    message:
                        "A child group can use all positions only when it is the only child group. Use specific positions for multiple child groups.",
                })
            }
        }
    }

    const childCodeSet = new Set()
    const positionSet = new Set()

    for (const positionId of positionIds) {
        if (positionSet.has(positionId)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["positionIds"],
                message: "Duplicate position selected.",
            })
            break
        }

        positionSet.add(positionId)
    }

    for (const [index, child] of children.entries()) {
        if (childCodeSet.has(child.code)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["children", index, "code"],
                message: "Duplicate child code in the same employee type.",
            })
        }

        childCodeSet.add(child.code)

        if (
            child.positionAssignmentMode === "SPECIFIC_POSITIONS" &&
            (!child.positionIds || child.positionIds.length === 0)
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["children", index, "positionIds"],
                message:
                    "Choose at least one allowed position or change child assignment to all positions.",
            })
        }

        for (const positionId of child.positionIds || []) {
            if (positionSet.has(positionId)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["children", index, "positionIds"],
                    message: "Duplicate position selected.",
                })
                break
            }

            positionSet.add(positionId)
        }
    }
}

function validateUpdateAssignmentMode(payload, context) {
    if (
        payload.positionIds === undefined &&
        payload.children === undefined &&
        payload.positionAssignmentMode === undefined
    ) {
        return
    }

    validateAssignmentMode(payload, context)
}

export const employeeTypeIdParamSchema = z.object({
    employeeTypeId: objectIdSchema,
})

export const employeeTypeListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    departmentId: objectIdSchema.optional(),
    positionId: objectIdSchema.optional(),
    dashboardCategory: z.string().trim().max(80).optional().default("ALL"),
    status: z.enum(["ALL", ...EMPLOYEE_TYPE_STATUSES]).default("ALL"),
    search: z.string().trim().max(120).optional().default(""),
})

export const employeeTypeCreateSchema = z
    .object({
        companyId: objectIdSchema,
        branchId: objectIdSchema,
        code: normalizedCodeSchema,
        name: normalizedTextSchema(2, 160),
        dashboardCategory: dashboardCategorySchema,
        positionAssignmentMode: positionAssignmentModeSchema.default(
            "SPECIFIC_POSITIONS",
        ),
        positionIds: positionIdsSchema,
        children: z
            .array(employeeTypeChildSchema)
            .max(30)
            .optional()
            .default([])
            .transform(normalizeChildren),
        description: optionalTextSchema(500),
        status: z.enum(EMPLOYEE_TYPE_UPDATE_STATUSES).optional(),
    })
    .superRefine(validateAssignmentMode)

export const employeeTypeUpdateSchema = z
    .object({
        companyId: objectIdSchema.optional(),
        branchId: objectIdSchema.optional(),
        code: normalizedCodeSchema.optional(),
        name: normalizedTextSchema(2, 160).optional(),
        dashboardCategory: dashboardCategorySchema.optional(),
        positionAssignmentMode: positionAssignmentModeSchema.optional(),
        positionIds: updatePositionIdsSchema,
        children: z
            .array(employeeTypeChildSchema)
            .max(30)
            .optional()
            .transform((value) =>
                value === undefined ? undefined : normalizeChildren(value),
            ),
        description: optionalTextSchema(500),
        status: z.enum(EMPLOYEE_TYPE_UPDATE_STATUSES).optional(),
        confirmEmployeeReconciliation: z.boolean().optional().default(false),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })
    .superRefine(validateUpdateAssignmentMode)
