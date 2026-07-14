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

const exitReasonSchema = new Schema(
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
            maxlength: 180,
            set: normalizeText,
        },

        shortName: {
            type: String,
            trim: true,
            maxlength: 80,
            set: normalizeText,
            default: "",
        },

        description: {
            type: String,
            trim: true,
            maxlength: 800,
            set: normalizeText,
            default: "",
        },

        sortOrder: {
            type: Number,
            min: 0,
            max: 9999,
            default: 0,
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
        collection: "exit_reasons",
        timestamps: true,
        versionKey: false,
    },
)

exitReasonSchema.index(
    { companyId: 1, branchId: 1, code: 1 },
    { unique: true, name: "uq_exit_reason_scope_code" },
)
exitReasonSchema.index(
    { companyId: 1, branchId: 1, status: 1, sortOrder: 1, name: 1 },
    { name: "idx_exit_reason_lookup" },
)
exitReasonSchema.index(
    { code: "text", name: "text", shortName: "text", description: "text" },
    { name: "idx_exit_reason_search_text" },
)

exitReasonSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        return returnedObject
    },
})

const ExitReason = mongoose.models.ExitReason || mongoose.model("ExitReason", exitReasonSchema)

export default ExitReason
