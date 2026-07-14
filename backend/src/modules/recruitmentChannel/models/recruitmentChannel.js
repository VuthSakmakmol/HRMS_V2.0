import mongoose from "mongoose"

const { Schema } = mongoose

function normalizeCode(value) {
    if (typeof value !== "string") return value
    return value.trim().replace(/\s+/g, "_").toUpperCase()
}

function normalizeText(value) {
    if (typeof value !== "string") return value
    return value.trim().replace(/\s+/g, " ")
}

const recruitmentChannelSchema = new Schema(
    {
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
        code: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 40,
            match: /^[A-Z0-9_-]+$/,
            set: normalizeCode,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 160,
            set: normalizeText,
        },
        shortName: {
            type: String,
            trim: true,
            maxlength: 80,
            set: normalizeText,
            default: "",
        },
        targetMonthly: {
            type: Number,
            min: 0,
            max: 999999,
            default: 0,
        },
        sortOrder: {
            type: Number,
            min: 0,
            max: 999999,
            default: 0,
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
        collection: "recruitment_channels",
        timestamps: true,
        versionKey: false,
    },
)

recruitmentChannelSchema.index(
    { companyId: 1, branchId: 1, code: 1 },
    { unique: true, name: "uq_recruitment_channel_scope_code" },
)

recruitmentChannelSchema.index(
    { companyId: 1, branchId: 1, status: 1, sortOrder: 1, name: 1 },
    { name: "idx_recruitment_channel_scope_status_sort" },
)

recruitmentChannelSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        return returnedObject
    },
})

const RecruitmentChannel =
    mongoose.models.RecruitmentChannel ||
    mongoose.model("RecruitmentChannel", recruitmentChannelSchema)

export default RecruitmentChannel
