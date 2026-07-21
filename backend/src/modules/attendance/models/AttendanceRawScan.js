import mongoose from "mongoose"

const { Schema } = mongoose

const attendanceRawScanSchema = new Schema(
    {
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
        companyId: {
            type: Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        branchId: {
            type: Schema.Types.ObjectId,
            ref: "Branch",
            required: true,
        },
        employeeCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            index: true,
        },
        scannedAt: {
            type: Date,
            required: true,
            index: true,
        },
        deviceCode: {
            type: String,
            trim: true,
            maxlength: 120,
            default: "",
        },
        direction: {
            type: String,
            enum: ["IN", "OUT", "UNKNOWN"],
            default: "UNKNOWN",
        },
        source: {
            type: String,
            enum: ["EXCEL_IMPORT", "MACHINE_SYNC", "MANUAL"],
            default: "EXCEL_IMPORT",
        },
        importBatchId: {
            type: String,
            trim: true,
            index: true,
            default: "",
        },
        createdByAccountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },
    },
    {
        collection: "attendance_raw_scans",
        timestamps: true,
        versionKey: false,
    },
)

attendanceRawScanSchema.index(
    {
        employeeCode: 1,
        scannedAt: 1,
        deviceCode: 1,
    },
    {
        unique: true,
        name: "uq_attendance_raw_scan",
    },
)

attendanceRawScanSchema.index(
    { companyId: 1, branchId: 1, scannedAt: -1, employeeCode: 1 },
    { name: "idx_attendance_raw_scan_scope" },
)

attendanceRawScanSchema.index(
    {
        importBatchId: 1,
        employeeCode: 1,
    },
    {
        name: "idx_attendance_raw_batch_employee",
    },
)

attendanceRawScanSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        return returnedObject
    },
})

const AttendanceRawScan =
    mongoose.models.AttendanceRawScan ||
    mongoose.model("AttendanceRawScan", attendanceRawScanSchema)

export default AttendanceRawScan
