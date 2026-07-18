
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

const requiredDateSchema = z.coerce.date()
const optionalDateSchema = z.preprocess(
    (value) => {
        if (value === "" || value === undefined || value === null) return null
        return value
    },
    z.coerce.date().nullable(),
)

const movementTypes = [
    "NEW_HIRE",
    "REJOIN",
    "RESIGN",
    "TERMINATE",
    "ABANDON",
    "PASSED_AWAY",
    "RETIRE",
    "TRANSFER",
    "DEPARTMENT_CHANGE",
    "POSITION_CHANGE",
    "LINE_CHANGE",
    "SHIFT_CHANGE",
    "EMPLOYEE_TYPE_CHANGE",
    "STATUS_CHANGE",
    "OTHER",
]

const snapshotSchema = z
    .object({
        companyId: nullableObjectIdSchema.optional(),
        branchId: nullableObjectIdSchema.optional(),
        departmentId: nullableObjectIdSchema.optional(),
        positionId: nullableObjectIdSchema.optional(),
        lineId: nullableObjectIdSchema.optional(),
        shiftId: nullableObjectIdSchema.optional(),
        employeeTypeId: nullableObjectIdSchema.optional(),
        employeeTypeChildId: nullableObjectIdSchema.optional(),
        employeeTypeChildCode: optionalTextSchema(30),
        employeeTypeChildName: optionalTextSchema(120),
        employmentStatus: optionalTextSchema(40),
    })
    .optional()

export const employeeMovementIdParamSchema = z.object({
    movementId: objectIdSchema,
})

export const employeeMovementListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(120).optional().default(""),
    employeeId: objectIdSchema.optional(),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    departmentId: objectIdSchema.optional(),
    positionId: objectIdSchema.optional(),
    lineId: objectIdSchema.optional(),
    shiftId: objectIdSchema.optional(),
    employeeTypeId: objectIdSchema.optional(),
    employeeTypeChildId: objectIdSchema.optional(),
    movementType: z.enum(["ALL", ...movementTypes]).default("ALL"),
    source: z.enum(["ALL", "MANUAL", "EMPLOYEE_PROFILE", "IMPORT"]).default("ALL"),
    status: z.enum(["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
    fromDate: optionalDateSchema.optional(),
    toDate: optionalDateSchema.optional(),
})

export const employeeMovementCreateSchema = z.object({
    employeeId: objectIdSchema,
    movementType: z.enum(movementTypes),
    effectiveDate: requiredDateSchema,
    from: snapshotSchema,
    to: snapshotSchema,
    reason: optionalTextSchema(500),
    source: z.enum(["MANUAL", "EMPLOYEE_PROFILE", "IMPORT"]).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
})

export const employeeMovementUpdateSchema = z
    .object({
        movementType: z.enum(movementTypes).optional(),
        effectiveDate: requiredDateSchema.optional(),
        from: snapshotSchema,
        to: snapshotSchema,
        reason: optionalTextSchema(500),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })
