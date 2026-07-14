import mongoose from "mongoose"

const { Schema } = mongoose

function normalizeCode(value) {
    if (typeof value !== "string") {
        return value
    }

    return value.trim().replace(/\s+/g, "_").toUpperCase()
}

function normalizeText(value) {
    if (typeof value !== "string") {
        return value
    }

    return value.trim().replace(/\s+/g, " ")
}

const approvalModuleSchema = new Schema(
    {
        moduleKey: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 2,
            maxlength: 100,
            match: /^[A-Z0-9_.-]+$/,
            set: normalizeCode,
        },

        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 180,
            set: normalizeText,
        },

        defaultActionKey: {
            type: String,
            trim: true,
            maxlength: 100,
            default: "REQUEST",
            set: normalizeCode,
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500,
            default: "",
            set: normalizeText,
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
        collection: "approval_modules",
        timestamps: true,
        versionKey: false,
    },
)

approvalModuleSchema.index(
    { moduleKey: 1 },
    { unique: true, name: "uq_approval_module_key" },
)

approvalModuleSchema.index(
    { status: 1, name: 1 },
    { name: "idx_approval_module_status_name" },
)

approvalModuleSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        return returnedObject
    },
})

const ApprovalModule =
    mongoose.models.ApprovalModule ||
    mongoose.model("ApprovalModule", approvalModuleSchema)

export default ApprovalModule
