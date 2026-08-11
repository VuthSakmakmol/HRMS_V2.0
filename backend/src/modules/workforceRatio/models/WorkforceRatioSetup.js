import mongoose from "mongoose"

const { Schema } = mongoose

const workforceRatioSetupSchema = new Schema(
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

        directEmployeeTypeIds: [
            {
                type: Schema.Types.ObjectId,
                ref: "EmployeeType",
                required: true,
            },
        ],

        indirectEmployeeTypeIds: [
            {
                type: Schema.Types.ObjectId,
                ref: "EmployeeType",
                required: true,
            },
        ],

        // Annual I/D ratio budget shown beside the calculated workforce ratio
        // in Excome. It is reporting configuration only and never changes
        // employee classification.
        budgetYear: {
            type: Number,
            min: 2000,
            max: 2100,
            default: () => new Date().getUTCFullYear(),
        },

        budgetRatio: {
            type: Number,
            min: 0,
            max: 100,
            default: null,
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
        collection: "workforce_ratio_setups",
        timestamps: true,
        versionKey: false,
    },
)

/*
 * One authoritative Direct / Indirect setup per Company + Branch.
 * An archived record is reused if HR creates the setup again, so this unique
 * index remains simple and there can never be two competing configurations.
 */
workforceRatioSetupSchema.index(
    { companyId: 1, branchId: 1 },
    { unique: true, name: "uq_workforce_ratio_scope" },
)

workforceRatioSetupSchema.index(
    { status: 1, companyId: 1, branchId: 1 },
    { name: "idx_workforce_ratio_active_scope" },
)

workforceRatioSetupSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        return returnedObject
    },
})

const WorkforceRatioSetup =
    mongoose.models.WorkforceRatioSetup ||
    mongoose.model("WorkforceRatioSetup", workforceRatioSetupSchema)

export default WorkforceRatioSetup
