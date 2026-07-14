import mongoose from "mongoose"

const { Schema } = mongoose

const correctionSchema = new Schema(
    {
        correctedByAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
        correctedAt: { type: Date, default: null },
        reason: { type: String, trim: true, maxlength: 1000, default: "" },
        previousValues: { type: Schema.Types.Mixed, default: null },
    },
    { _id: false },
)

const policySnapshotSchema = new Schema(
    {
        policyId: { type: Schema.Types.ObjectId, ref: "AttendancePolicy", default: null },
        name: { type: String, default: "" },
        code: { type: String, default: "" },
        graceInMinutes: { type: Number, default: 0 },
        graceOutMinutes: { type: Number, default: 0 },
        minimumWorkedMinutes: { type: Number, default: 0 },
        lateRoundUnitMinutes: { type: Number, default: 1 },
        lateRoundMethod: { type: String, default: "CEIL" },
        earlyLeaveRoundUnitMinutes: { type: Number, default: 1 },
        earlyLeaveRoundMethod: { type: String, default: "CEIL" },
        autoGenerateAbsent: { type: Boolean, default: true },
        treatSundayAsRestDay: { type: Boolean, default: true },
    },
    { _id: false },
)

const attendanceRecordSchema = new Schema(
    {
        employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
        employeeCode: { type: String, required: true, trim: true, uppercase: true },
        attendanceDate: { type: Date, required: true },
        companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
        branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
        departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
        positionId: { type: Schema.Types.ObjectId, ref: "Position", required: true },
        lineId: { type: Schema.Types.ObjectId, ref: "Line", required: true },
        shiftId: { type: Schema.Types.ObjectId, ref: "Shift", required: true },
        scheduledStartAt: { type: Date, default: null },
        scheduledEndAt: { type: Date, default: null },
        scanWindowStartAt: { type: Date, default: null },
        scanWindowEndAt: { type: Date, default: null },
        firstInAt: { type: Date, default: null },
        lastOutAt: { type: Date, default: null },
        workedMinutes: { type: Number, min: 0, default: 0 },
        lateMinutes: { type: Number, min: 0, default: 0 },
        earlyLeaveMinutes: { type: Number, min: 0, default: 0 },
        dayType: {
            type: String,
            enum: ["WORKING_DAY", "REST_DAY", "HOLIDAY", "CLOSED_DAY"],
            default: "WORKING_DAY",
        },
        status: {
            type: String,
            enum: [
                "PRESENT",
                "LATE",
                "EARLY_LEAVE",
                "LATE_AND_EARLY_LEAVE",
                "MISSING_IN",
                "MISSING_OUT",
                "ABSENT",
                "REST_DAY",
                "HOLIDAY",
            ],
            required: true,
            default: "ABSENT",
        },
        source: {
            type: String,
            enum: ["MANUAL", "EXCEL_IMPORT", "MACHINE_SYNC"],
            default: "MANUAL",
        },
        verificationStatus: {
            type: String,
            enum: ["VERIFIED", "NEEDS_REVIEW", "CORRECTED"],
            default: "VERIFIED",
        },
        issueCodes: [{ type: String, trim: true }],
        rawScanIds: [{ type: Schema.Types.ObjectId, ref: "AttendanceRawScan" }],
        policySnapshot: { type: policySnapshotSchema, default: () => ({}) },
        calculationVersion: { type: String, default: "ATTENDANCE_ENGINE_V2" },
        lockStatus: {
            type: String,
            enum: ["OPEN", "HR_VERIFIED", "PAYROLL_LOCKED", "FINALIZED"],
            default: "OPEN",
        },
        correction: { type: correctionSchema, default: () => ({}) },
        note: { type: String, trim: true, maxlength: 1000, default: "" },
        createdByAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
        updatedByAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    },
    {
        collection: "attendance_records",
        timestamps: true,
        versionKey: false,
    },
)

attendanceRecordSchema.index(
    { employeeId: 1, attendanceDate: 1 },
    { unique: true, name: "uq_attendance_employee_date" },
)
attendanceRecordSchema.index(
    {
        attendanceDate: 1,
        companyId: 1,
        branchId: 1,
        departmentId: 1,
        positionId: 1,
        lineId: 1,
        status: 1,
        verificationStatus: 1,
    },
    { name: "idx_attendance_filters_v2" },
)
attendanceRecordSchema.index(
    { issueCodes: 1, attendanceDate: 1 },
    { name: "idx_attendance_issues" },
)

attendanceRecordSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
    },
})

const AttendanceRecord =
    mongoose.models.AttendanceRecord ||
    mongoose.model("AttendanceRecord", attendanceRecordSchema)

export default AttendanceRecord
