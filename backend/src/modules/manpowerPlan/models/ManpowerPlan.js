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
            default: null,
        },
        positionId: {
            type: Schema.Types.ObjectId,
            ref: "Position",
            default: null,
        },
        lineId: {
            type: Schema.Types.ObjectId,
            ref: "Line",
            default: null,
        },
        shiftId: {
            type: Schema.Types.ObjectId,
            ref: "Shift",
            default: null,
        },

        employeeTypeId: {
            type: Schema.Types.ObjectId,
            ref: "EmployeeType",
            default: null,
        },
        employeeTypeChildId: {
            type: Schema.Types.ObjectId,
            default: null,
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

manpowerPlanSchema.index(
    {
        companyId: 1,
        branchId: 1,
        year: 1,
        month: 1,
        departmentId: 1,
        positionId: 1,
        lineId: 1,
        shiftId: 1,
        employeeTypeId: 1,
        employeeTypeChildId: 1,
    },
    {
        unique: true,
        name: "uq_manpower_plan_scope_period",
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
        lineId: 1,
        employeeTypeId: 1,
        status: 1,
    },
    {
        name: "idx_manpower_plan_dimension_status",
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