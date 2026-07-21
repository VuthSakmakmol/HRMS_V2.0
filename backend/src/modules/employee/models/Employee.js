import mongoose from "mongoose"

const { Schema } = mongoose

function normalizeCode(value) {
    if (typeof value !== "string") return value
    return value.trim().replace(/\s+/g, "_").toUpperCase()
}

function normalizeText(value) {
    if (typeof value !== "string") return value
    return value.trim().replace(/\s+/g, " ")
}

// Recruitment Channel is a separate setup module.
// This fallback keeps Employee populate working even when app startup order changes.
if (!mongoose.models.RecruitmentChannel) {
    const recruitmentChannelFallbackSchema = new Schema(
        {},
        {
            collection: "recruitment_channels",
            strict: false,
            versionKey: false,
        },
    )

    mongoose.model("RecruitmentChannel", recruitmentChannelFallbackSchema)
}

if (!mongoose.models.ExitReason) {
    const exitReasonFallbackSchema = new Schema(
        {},
        {
            collection: "exit_reasons",
            strict: false,
            versionKey: false,
        },
    )

    mongoose.model("ExitReason", exitReasonFallbackSchema)
}

const addressSchema = new Schema(
    {
        countryId: { type: Schema.Types.ObjectId, ref: "Country", default: null },
        provinceId: { type: Schema.Types.ObjectId, ref: "Province", default: null },
        districtId: { type: Schema.Types.ObjectId, ref: "District", default: null },
        communeId: { type: Schema.Types.ObjectId, ref: "Commune", default: null },
        villageId: { type: Schema.Types.ObjectId, ref: "Village", default: null },
        detail: { type: String, trim: true, maxlength: 500, set: normalizeText, default: "" },
    },
    { _id: false },
)

const documentSchema = new Schema(
    {
        idCardNo: { type: String, trim: true, maxlength: 80, set: normalizeText, default: "" },
        idCardExpireDate: { type: Date, default: null },
        nssfNo: { type: String, trim: true, maxlength: 80, set: normalizeText, default: "" },
        passportNo: { type: String, trim: true, maxlength: 80, set: normalizeText, default: "" },
        passportExpireDate: { type: Date, default: null },
        visaExpireDate: { type: Date, default: null },
        medicalCheckNo: { type: String, trim: true, maxlength: 80, set: normalizeText, default: "" },
        medicalCheckDate: { type: Date, default: null },
        workingBookNo: { type: String, trim: true, maxlength: 80, set: normalizeText, default: "" },
    },
    { _id: false },
)

const machineSkillsSchema = new Schema(
    {
        singleNeedle: { type: Number, min: 0, max: 999, default: 0 },
        overlock: { type: Number, min: 0, max: 999, default: 0 },
        coverstitch: { type: Number, min: 0, max: 999, default: 0 },
        totalMachines: { type: Number, min: 0, max: 999, default: 0 },
    },
    { _id: false },
)

const employeeSchema = new Schema(
    {
        employeeCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 2,
            maxlength: 40,
            match: /^[A-Z0-9_-]+$/,
            set: normalizeCode,
        },

        profileImageUrl: { type: String, trim: true, maxlength: 1000, default: "" },

        khmerFirstName: { type: String, trim: true, maxlength: 120, set: normalizeText, default: "" },
        khmerLastName: { type: String, trim: true, maxlength: 120, set: normalizeText, default: "" },
        englishFirstName: { type: String, trim: true, maxlength: 120, set: normalizeText, default: "" },
        englishLastName: { type: String, trim: true, maxlength: 120, set: normalizeText, default: "" },
        displayName: { type: String, trim: true, maxlength: 240, set: normalizeText, default: "" },

        gender: {
            type: String,
            enum: ["MALE", "FEMALE", "OTHER", "UNKNOWN"],
            default: "UNKNOWN",
        },
        dateOfBirth: { type: Date, default: null },

        email: { type: String, trim: true, lowercase: true, maxlength: 180, default: "" },
        phoneNumber: { type: String, trim: true, maxlength: 40, match: /^\d*$/, default: "" },
        agentPhoneNumber: { type: String, trim: true, maxlength: 40, match: /^\d*$/, default: "" },
        agentPerson: { type: String, trim: true, maxlength: 160, set: normalizeText, default: "" },
        note: { type: String, trim: true, maxlength: 1000, set: normalizeText, default: "" },

        maritalStatus: {
            type: String,
            enum: ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "UNKNOWN"],
            default: "UNKNOWN",
        },
        spouseName: { type: String, trim: true, maxlength: 160, set: normalizeText, default: "" },
        spouseContactNumber: { type: String, trim: true, maxlength: 40, match: /^\d*$/, default: "" },

        education: { type: String, trim: true, maxlength: 120, set: normalizeText, default: "" },
        religion: { type: String, trim: true, maxlength: 120, set: normalizeText, default: "" },
        nationality: { type: String, trim: true, maxlength: 120, match: /^[\p{L}\s'-]*$/u, set: normalizeText, default: "" },

        birthAddress: { type: addressSchema, default: () => ({}) },
        permanentAddress: { type: addressSchema, default: () => ({}) },

        companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
        branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
        departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
        positionId: { type: Schema.Types.ObjectId, ref: "Position", required: true },
        lineId: { type: Schema.Types.ObjectId, ref: "Line", required: true },
        shiftId: { type: Schema.Types.ObjectId, ref: "Shift", required: true },

        joinDate: { type: Date, required: true },
        employmentStatus: {
            type: String,
            enum: ["WORKING", "RESIGNED", "TERMINATED", "ABANDONED", "PASSED_AWAY", "RETIRED"],
            default: "WORKING",
            required: true,
        },
        resignDate: { type: Date, default: null },
        resignReason: { type: String, trim: true, maxlength: 240, set: normalizeText, default: "" },
        exitReasonId: {
            type: Schema.Types.ObjectId,
            ref: "ExitReason",
            default: null,
        },
        remark: { type: String, trim: true, maxlength: 1000, set: normalizeText, default: "" },

        documents: { type: documentSchema, default: () => ({}) },

        sourceOfHiring: { type: String, trim: true, maxlength: 160, set: normalizeText, default: "" },
        recruitmentChannelId: {
            type: Schema.Types.ObjectId,
            ref: "RecruitmentChannel",
            default: null,
        },
        introducerEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
        employeeTypeId: {
            type: Schema.Types.ObjectId,
            ref: "EmployeeType",
            default: null,
        },
        employeeTypeChildId: {
            type: Schema.Types.ObjectId,
            default: null,
        },
        employeeTypeChildCode: {
            type: String,
            trim: true,
            maxlength: 30,
            match: /^[A-Z0-9_-]*$/,
            set: normalizeCode,
            default: "",
        },
        employeeTypeChildName: {
            type: String,
            trim: true,
            maxlength: 120,
            set: normalizeText,
            default: "",
        },
        employeeTypeReviewRequired: {
            type: Boolean,
            default: false,
            index: true,
        },
        employeeTypeReviewReason: {
            type: String,
            enum: ["", "POSITION_UNASSIGNED", "ASSIGNMENT_AMBIGUOUS"],
            default: "",
        },

        machineSkills: { type: machineSkillsSchema, default: () => ({}) },

        approvalPolicyId: { type: Schema.Types.ObjectId, ref: "ApprovalPolicy", default: null },

        recordStatus: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
            default: "ACTIVE",
            required: true,
        },

        createdByAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
        updatedByAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    },
    {
        collection: "employees",
        timestamps: true,
        versionKey: false,
    },
)

employeeSchema.index({ employeeCode: 1 }, { unique: true, name: "uq_employee_code" })
employeeSchema.index({ companyId: 1, branchId: 1, departmentId: 1, positionId: 1, lineId: 1, recordStatus: 1 }, { name: "idx_employee_assignment_status" })
employeeSchema.index({ employmentStatus: 1, recordStatus: 1 }, { name: "idx_employee_employment_status" })
employeeSchema.index({ employeeTypeId: 1, recordStatus: 1 }, { name: "idx_employee_type_status" })
employeeSchema.index({ recruitmentChannelId: 1, joinDate: 1, recordStatus: 1 }, { name: "idx_employee_recruitment_channel_join_status" })
employeeSchema.index({ exitReasonId: 1, resignDate: 1, employmentStatus: 1, recordStatus: 1 }, { name: "idx_employee_exit_reason_status" })
employeeSchema.index({ employeeTypeId: 1, employeeTypeChildId: 1, recordStatus: 1 }, { name: "idx_employee_type_child_status" })
employeeSchema.index({ joinDate: 1, resignDate: 1, employmentStatus: 1, recordStatus: 1 }, { name: "idx_employee_report_active_dates" })
employeeSchema.index({ englishFirstName: "text", englishLastName: "text", khmerFirstName: "text", khmerLastName: "text", employeeCode: "text", phoneNumber: "text" }, { name: "idx_employee_search_text" })

employeeSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        return returnedObject
    },
})

const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema)

export default Employee
