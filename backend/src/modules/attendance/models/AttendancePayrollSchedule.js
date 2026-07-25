import mongoose from "mongoose"

const attendancePayrollScheduleSchema = new mongoose.Schema(
    {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
            index: true,
        },
        branchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Branch",
            required: true,
            index: true,
        },
        enabled: { type: Boolean, default: false },
        runTime: { type: String, default: "08:00", trim: true },
        timeZone: { type: String, default: "Asia/Phnom_Penh", trim: true },
        status: {
            type: String,
            enum: ["IDLE", "RUNNING", "SUCCESS", "FAILED"],
            default: "IDLE",
        },
        runNowRequestedAt: { type: Date, default: null },
        claimedAt: { type: Date, default: null },
        claimToken: { type: String, default: null },
        lastRunAt: { type: Date, default: null },
        lastFinishedAt: { type: Date, default: null },
        lastSuccessAt: { type: Date, default: null },
        lastImportedFile: { type: String, default: "" },
        lastError: { type: String, default: "" },
        updatedByAccountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },
    },
    { timestamps: true },
)

attendancePayrollScheduleSchema.index(
    { companyId: 1, branchId: 1 },
    { unique: true },
)

export default mongoose.model(
    "AttendancePayrollSchedule",
    attendancePayrollScheduleSchema,
)
