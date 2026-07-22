import mongoose from "mongoose"

const { Schema } = mongoose

const attendanceDailyEmailLogSchema = new Schema(
    {
        companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
        branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
        reportDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
        to: { type: String, required: true, lowercase: true, trim: true },
        cc: [{ type: String, lowercase: true, trim: true }],
        subject: { type: String, required: true, trim: true },
        messageId: { type: String, trim: true, default: "" },
        summarySnapshot: { type: Schema.Types.Mixed, required: true },
        sentByAccountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
        sentByName: { type: String, trim: true, default: "" },
        triggerType: { type: String, enum: ["MANUAL", "AUTOMATIC"], default: "MANUAL" },
        sentAt: { type: Date, required: true, default: Date.now },
    },
    {
        collection: "attendance_daily_email_logs",
        timestamps: true,
        versionKey: false,
    },
)

attendanceDailyEmailLogSchema.index(
    { companyId: 1, branchId: 1, reportDate: 1, to: 1 },
    { name: "idx_attendance_daily_email_duplicate" },
)

const AttendanceDailyEmailLog =
    mongoose.models.AttendanceDailyEmailLog ||
    mongoose.model("AttendanceDailyEmailLog", attendanceDailyEmailLogSchema)

export default AttendanceDailyEmailLog
