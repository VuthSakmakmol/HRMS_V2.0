import mongoose from "mongoose"

const { Schema } = mongoose

const attendanceImportIssueSchema = new Schema(
    {
        importBatchId: { type: Schema.Types.ObjectId, required: true, index: true },
        sourceRow: { type: Number, required: true, min: 2 },
        companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
        branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
        employeeCode: { type: String, required: true, trim: true, uppercase: true },
        attendanceDate: { type: Date, required: true },
        firstInAt: { type: Date, default: null },
        lastOutAt: { type: Date, default: null },
        status: {
            type: String,
            enum: ["NO_EMPLOYEE_MATCH", "RESOLVED", "ARCHIVED"],
            default: "NO_EMPLOYEE_MATCH",
        },
        resolvedEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
        resolvedAt: { type: Date, default: null },
        createdByAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    },
    {
        collection: "attendance_import_issues",
        timestamps: true,
        versionKey: false,
    },
)

attendanceImportIssueSchema.index(
    { companyId: 1, branchId: 1, status: 1, attendanceDate: -1 },
    { name: "idx_attendance_import_issue_scope" },
)

attendanceImportIssueSchema.index(
    { companyId: 1, branchId: 1, employeeCode: 1, attendanceDate: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "NO_EMPLOYEE_MATCH" },
        name: "uq_attendance_unmatched_employee_date",
    },
)

attendanceImportIssueSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
    },
})

const AttendanceImportIssue =
    mongoose.models.AttendanceImportIssue ||
    mongoose.model("AttendanceImportIssue", attendanceImportIssueSchema)

export default AttendanceImportIssue
