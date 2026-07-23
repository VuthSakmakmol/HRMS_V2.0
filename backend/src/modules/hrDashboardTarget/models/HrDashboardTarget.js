import mongoose from "mongoose"

const { Schema } = mongoose

function normalizeText(value) {
    if (typeof value !== "string") return value
    return value.trim().replace(/\s+/g, " ")
}

const hrDashboardTargetSchema = new Schema(
    {
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

        metric: {
            type: String,
            enum: ["ABSENCE_RATE", "TURNOVER_RATE"],
            required: true,
            index: true,
        },

        year: {
            type: Number,
            min: 2000,
            max: 2100,
            required: true,
            index: true,
        },

        // 0 means whole year / all months. 1-12 means month-specific override.
        month: {
            type: Number,
            min: 0,
            max: 12,
            default: 0,
            required: true,
            index: true,
        },

        targetScope: {
            type: String,
            enum: ["OVERALL", "EMPLOYEE_TYPE"],
            default: "EMPLOYEE_TYPE",
            required: true,
            index: true,
        },

        employeeTypeId: {
            type: Schema.Types.ObjectId,
            ref: "EmployeeType",
            default: null,
            index: true,
        },

        employeeTypeChildId: {
            type: Schema.Types.ObjectId,
            default: null,
            index: true,
        },
        employeeTypeChildCode: {
            type: String,
            trim: true,
            maxlength: 30,
            default: "",
        },
        employeeTypeChildName: {
            type: String,
            trim: true,
            maxlength: 120,
            set: normalizeText,
            default: "",
        },

        targetRate: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
            default: 0,
        },

        remark: {
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
        collection: "hr_dashboard_targets",
        timestamps: true,
        versionKey: false,
    },
)

hrDashboardTargetSchema.index(
    {
        companyId: 1,
        branchId: 1,
        metric: 1,
        year: 1,
        month: 1,
        targetScope: 1,
        employeeTypeId: 1,
        employeeTypeChildId: 1,
    },
    {
        name: "idx_hr_dashboard_target_employee_type_child_period_metric",
    },
)

hrDashboardTargetSchema.index(
    {
        companyId: 1,
        branchId: 1,
        metric: 1,
        year: 1,
        status: 1,
    },
    {
        name: "idx_hr_dashboard_target_lookup",
    },
)

hrDashboardTargetSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        return returnedObject
    },
})

const HrDashboardTarget =
    mongoose.models.HrDashboardTarget ||
    mongoose.model("HrDashboardTarget", hrDashboardTargetSchema)

export default HrDashboardTarget
