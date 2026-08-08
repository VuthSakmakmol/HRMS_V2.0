import mongoose from "mongoose"

const { Schema } = mongoose

function normalizeText(value) {
    if (typeof value !== "string") return value
    return value.trim().replace(/\s+/g, " ")
}

const manpowerPlanSchema = new Schema(
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
        year: {
            type: Number,
            min: 2000,
            max: 2100,
            required: true,
        },
        month: {
            type: Number,
            min: 1,
            max: 12,
            required: true,
        },
        departmentId: {
            type: Schema.Types.ObjectId,
            ref: "Department",
            required: true,
        },
        positionId: {
            type: Schema.Types.ObjectId,
            ref: "Position",
            required: true,
        },
        targetBudget: {
            type: Number,
            min: 0,
            default: 0,
            required: true,
        },
        targetRoadmap: {
            type: Number,
            min: 0,
            default: 0,
            required: true,
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
        collection: "manpower_plans",
        timestamps: true,
        versionKey: false,
    },
)

// One manpower plan for one position in one company/branch/month.
// Line, Shift, Employee Type and Employee Type Child are employee/setup
// dimensions and are intentionally not part of the manpower-plan key.
manpowerPlanSchema.index(
    {
        companyId: 1,
        branchId: 1,
        year: 1,
        month: 1,
        departmentId: 1,
        positionId: 1,
    },
    {
        unique: true,
        name: "uq_manpower_plan_position_scope",
    },
)

manpowerPlanSchema.index(
    {
        companyId: 1,
        branchId: 1,
        year: 1,
        month: 1,
        status: 1,
    },
    {
        name: "idx_manpower_plan_period_status",
    },
)

manpowerPlanSchema.index(
    {
        departmentId: 1,
        positionId: 1,
        status: 1,
    },
    {
        name: "idx_manpower_plan_position_status",
    },
)

manpowerPlanSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        return returnedObject
    },
})

const ManpowerPlan =
    mongoose.models.ManpowerPlan ||
    mongoose.model("ManpowerPlan", manpowerPlanSchema)

export default ManpowerPlan
