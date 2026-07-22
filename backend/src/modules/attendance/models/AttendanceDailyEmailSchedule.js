import mongoose from "mongoose"

const { Schema } = mongoose

const attendanceDailyEmailScheduleSchema = new Schema(
    {
        companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
        branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
        enabled: { type: Boolean, required: true, default: false },
        sendTime: { type: String, required: true, default: "08:00", match: /^([01]\d|2[0-3]):[0-5]\d$/ },
        timeZone: { type: String, required: true, default: "Asia/Phnom_Penh", trim: true },
        allowedDayTypes: {
            type: [String],
            default: ["WORKING_DAY", "SPECIAL_WORKING_DAY"],
        },
        activeFromDate: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
        configuredByAccountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
        lastAttemptDate: { type: String, default: null },
        lastAttemptAt: { type: Date, default: null },
        lastSentDate: { type: String, default: null },
        lastSentAt: { type: Date, default: null },
        lastSkippedDate: { type: String, default: null },
        lastSkippedDayType: { type: String, default: "" },
        lastError: { type: String, default: "", maxlength: 1000 },
    },
    {
        collection: "attendance_daily_email_schedules",
        timestamps: true,
        versionKey: false,
    },
)

attendanceDailyEmailScheduleSchema.index(
    { companyId: 1, branchId: 1 },
    { unique: true, name: "uq_attendance_daily_email_schedule_scope" },
)

const AttendanceDailyEmailSchedule =
    mongoose.models.AttendanceDailyEmailSchedule ||
    mongoose.model("AttendanceDailyEmailSchedule", attendanceDailyEmailScheduleSchema)

export default AttendanceDailyEmailSchedule
