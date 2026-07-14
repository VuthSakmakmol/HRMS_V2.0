import mongoose from "mongoose"

const { Schema } = mongoose

function normalizeText(value) {
    if (typeof value !== "string") {
        return value
    }

    return value.trim().replace(/\s+/g, " ")
}

const calendarDaySchema = new Schema(
    {
        scopeLevel: {
            type: String,
            enum: ["GLOBAL", "COMPANY", "BRANCH"],
            required: true,
            default: "GLOBAL",
        },

        scopeKey: {
            type: String,
            required: true,
            trim: true,
        },

        companyId: {
            type: Schema.Types.ObjectId,
            ref: "Company",
            default: null,
        },

        branchId: {
            type: Schema.Types.ObjectId,
            ref: "Branch",
            default: null,
        },

        dateKey: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}-\d{2}$/,
        },

        dayType: {
            type: String,
            enum: [
                "WORKING_DAY",
                "WEEKEND",
                "HOLIDAY",
                "SPECIAL_WORKING_DAY",
                "COMPANY_EVENT",
                "CLOSED_DAY",
            ],
            required: true,
            default: "WORKING_DAY",
        },

        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 160,
            set: normalizeText,
        },

        holidayCategory: {
            type: String,
            trim: true,
            maxlength: 80,
            set: normalizeText,
            default: "",
        },

        isPaidHoliday: {
            type: Boolean,
            default: false,
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500,
            set: normalizeText,
            default: "",
        },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
            default: "ACTIVE",
            required: true,
        },

        createdByAccountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },

        updatedByAccountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },
    },
    {
        collection: "calendar_days",
        timestamps: true,
        versionKey: false,
    },
)

calendarDaySchema.index(
    {
        scopeKey: 1,
        dateKey: 1,
    },
    {
        unique: true,
        name: "uq_calendar_scope_date",
    },
)

calendarDaySchema.index(
    {
        dateKey: 1,
        status: 1,
        dayType: 1,
    },
    {
        name: "idx_calendar_date_status_type",
    },
)

calendarDaySchema.index(
    {
        companyId: 1,
        branchId: 1,
        dateKey: 1,
        status: 1,
    },
    {
        name: "idx_calendar_company_branch_date_status",
    },
)

calendarDaySchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        return returnedObject
    },
})

const CalendarDay =
    mongoose.models.CalendarDay || mongoose.model("CalendarDay", calendarDaySchema)

export default CalendarDay
