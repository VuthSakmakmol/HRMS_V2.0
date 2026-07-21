import mongoose from "mongoose"

const { Schema } = mongoose

const attendancePolicySchema = new Schema(
    {
        companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
        branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
        name: { type: String, required: true, trim: true, maxlength: 160 },
        code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
        graceInMinutes: { type: Number, min: 0, max: 240, default: 0 },
        graceOutMinutes: { type: Number, min: 0, max: 240, default: 0 },
        minimumWorkedMinutes: { type: Number, min: 0, max: 1440, default: 0 },
        lateRoundUnitMinutes: { type: Number, min: 1, max: 240, default: 1 },
        lateRoundMethod: { type: String, enum: ["FLOOR", "CEIL", "NEAREST"], default: "CEIL" },
        earlyLeaveRoundUnitMinutes: { type: Number, min: 1, max: 240, default: 1 },
        earlyLeaveRoundMethod: { type: String, enum: ["FLOOR", "CEIL", "NEAREST"], default: "CEIL" },
        autoGenerateAbsent: { type: Boolean, default: true },
        treatSundayAsRestDay: { type: Boolean, default: true },
        status: { type: String, enum: ["ACTIVE", "INACTIVE", "ARCHIVED"], default: "ACTIVE" },
        effectiveFrom: { type: Date, default: null },
        effectiveTo: { type: Date, default: null },
        createdByAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
        updatedByAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    },
    { collection: "attendance_policies", timestamps: true, versionKey: false },
)

attendancePolicySchema.index(
    { companyId: 1, branchId: 1, code: 1 },
    { unique: true, name: "uq_attendance_policy_scope_code" },
)
attendancePolicySchema.index(
    { companyId: 1, branchId: 1, status: 1, effectiveFrom: -1 },
    { name: "idx_attendance_policy_effective_scope" },
)
attendancePolicySchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
    },
})

const AttendancePolicy =
    mongoose.models.AttendancePolicy ||
    mongoose.model("AttendancePolicy", attendancePolicySchema)

export default AttendancePolicy
