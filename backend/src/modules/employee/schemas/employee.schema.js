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

const optionalDateSchema = z.preprocess(
    (value) => {
        if (value === "" || value === undefined || value === null) return null
        return value
    },
    z.coerce.date().nullable(),
)

const requiredDateSchema = z.coerce.date()

const adultDateSchema = optionalDateSchema.refine(
    (value) => {
        if (!value) return true

        const maximumBirthDate = new Date()
        maximumBirthDate.setHours(0, 0, 0, 0)
        maximumBirthDate.setFullYear(maximumBirthDate.getFullYear() - 18)

        return value <= maximumBirthDate
    },
    { message: "Employee must be at least 18 years old." },
)

const codeSchema = z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, "_").toUpperCase())
    .pipe(
        z.string().min(2).max(40).regex(/^[A-Z0-9_-]+$/, {
            message: "Code can contain uppercase letters, numbers, underscore, and dash only.",
        }),
    )

const optionalTextSchema = (max = 500) =>
    z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .pipe(z.string().max(max))
        .optional()

const emailSchema = z.preprocess(
    (value) => {
        if (value === "" || value === undefined || value === null) return ""
        return value
    },
    z.string().trim().email().max(180).or(z.literal("")),
)

const phoneSchema = z
    .string()
    .trim()
    .max(40)
    .regex(/^\d*$/, { message: "Phone number must contain digits only." })
    .optional()

const nationalitySchema = z
    .string()
    .trim()
    .max(120)
    .regex(/^[\p{L}\s'-]*$/u, {
        message: "Nationality must contain text only.",
    })
    .optional()

const optionalBooleanSchema = (defaultValue = false) =>
    z.preprocess(
        (value) => {
            if (value === undefined || value === null || value === "") return defaultValue
            if (typeof value === "boolean") return value

            const raw = String(value).trim().toUpperCase()
            if (["YES", "Y", "TRUE", "1", "ON"].includes(raw)) return true
            if (["NO", "N", "FALSE", "0", "OFF"].includes(raw)) return false

            return value
        },
        z.boolean(),
    )

const addressSchema = z.object({
    countryId: nullableObjectIdSchema.optional(),
    provinceId: nullableObjectIdSchema.optional(),
    districtId: nullableObjectIdSchema.optional(),
    communeId: nullableObjectIdSchema.optional(),
    villageId: nullableObjectIdSchema.optional(),
    detail: optionalTextSchema(500),
}).optional()

const documentsSchema = z.object({
    idCardNo: optionalTextSchema(80),
    idCardExpireDate: optionalDateSchema.optional(),
    nssfNo: optionalTextSchema(80),
    passportNo: optionalTextSchema(80),
    passportExpireDate: optionalDateSchema.optional(),
    visaExpireDate: optionalDateSchema.optional(),
    medicalCheckNo: optionalTextSchema(80),
    medicalCheckDate: optionalDateSchema.optional(),
    workingBookNo: optionalTextSchema(80),
}).optional()

const machineSkillsSchema = z.object({
    singleNeedle: z.coerce.number().int().min(0).max(999).optional(),
    overlock: z.coerce.number().int().min(0).max(999).optional(),
    coverstitch: z.coerce.number().int().min(0).max(999).optional(),
    totalMachines: z.coerce.number().int().min(0).max(999).optional(),
}).optional()

const employmentStatuses = [
    "WORKING",
    "RESIGNED",
    "TERMINATED",
    "ABANDONED",
    "PASSED_AWAY",
    "RETIRED",
]

export const employeeIdParamSchema = z.object({
    employeeId: objectIdSchema,
})

export const employeeListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional().default(""),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    departmentId: objectIdSchema.optional(),
    positionId: objectIdSchema.optional(),
    lineId: objectIdSchema.optional(),
    shiftId: objectIdSchema.optional(),
    employeeTypeId: objectIdSchema.optional(),
    employeeTypeChildId: objectIdSchema.optional(),
    exitReasonId: objectIdSchema.optional(),
    recruitmentChannelId: objectIdSchema.optional(),
    employmentStatus: z.enum(["ALL", ...employmentStatuses]).default("ALL"),
    recordStatus: z.enum(["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
})

export const employeeCreateSchema = z.object({
    employeeCode: codeSchema,
    profileImageUrl: optionalTextSchema(1000),

    khmerFirstName: optionalTextSchema(120),
    khmerLastName: optionalTextSchema(120),
    englishFirstName: optionalTextSchema(120),
    englishLastName: optionalTextSchema(120),
    displayName: optionalTextSchema(240),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).optional(),
    dateOfBirth: adultDateSchema.optional(),

    email: emailSchema.optional(),
    phoneNumber: phoneSchema,
    agentPhoneNumber: phoneSchema,
    agentPerson: optionalTextSchema(160),
    note: optionalTextSchema(1000),

    maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "UNKNOWN"]).optional(),
    spouseName: optionalTextSchema(160),
    spouseContactNumber: phoneSchema,

    education: optionalTextSchema(120),
    religion: optionalTextSchema(120),
    nationality: nationalitySchema,

    birthAddress: addressSchema,
    permanentAddress: addressSchema,

    companyId: objectIdSchema,
    branchId: objectIdSchema,
    departmentId: objectIdSchema,
    positionId: objectIdSchema,
    lineId: objectIdSchema,
    shiftId: objectIdSchema,

    joinDate: requiredDateSchema,
    employmentStatus: z.enum(employmentStatuses).optional(),
    resignDate: optionalDateSchema.optional(),
    resignReason: optionalTextSchema(240),
    exitReasonId: nullableObjectIdSchema.optional(),
    remark: optionalTextSchema(1000),

    documents: documentsSchema,
    sourceOfHiring: optionalTextSchema(160),
    recruitmentChannelId: nullableObjectIdSchema.optional(),
    introducerEmployeeId: nullableObjectIdSchema.optional(),
    employeeTypeId: nullableObjectIdSchema.optional(),
    employeeTypeChildId: nullableObjectIdSchema.optional(),
    machineSkills: machineSkillsSchema,
    approvalPolicyId: nullableObjectIdSchema.optional(),

    createAccount: optionalBooleanSchema(true).optional().default(true),
    defaultRoleId: nullableObjectIdSchema.optional(),

    recordStatus: z.enum(["ACTIVE", "INACTIVE"]).optional(),
})

export const employeeUpdateSchema = employeeCreateSchema
    .omit({ companyId: true, branchId: true })
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })

export const employeeImportQuerySchema = z.object({
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
})

export const employeeApprovalPreviewQuerySchema = z.object({
    moduleKey: z.string().trim().min(2).max(80).default("EMPLOYEE_CHANGE"),
    employeeId: objectIdSchema.optional(),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    departmentId: objectIdSchema.optional(),
    positionId: objectIdSchema.optional(),
    lineId: objectIdSchema.optional(),
})
