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

const lineSchema = new Schema(
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

        departmentId: {
            type: Schema.Types.ObjectId,
            ref: "Department",
            required: true,
        },

        code: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 30,
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

        allowedPositionIds: [
            {
                type: Schema.Types.ObjectId,
                ref: "Position",
            },
        ],

        leaderPositionId: {
            type: Schema.Types.ObjectId,
            ref: "Position",
            default: null,
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
        collection: "lines",
        timestamps: true,
        versionKey: false,
    },
)

lineSchema.index(
    {
        companyId: 1,
        branchId: 1,
        departmentId: 1,
        code: 1,
    },
    {
        unique: true,
        name: "uq_line_department_code",
    },
)

lineSchema.index(
    {
        companyId: 1,
        branchId: 1,
        departmentId: 1,
        status: 1,
        name: 1,
    },
    {
        name: "idx_line_department_status_name",
    },
)

lineSchema.index(
    {
        allowedPositionIds: 1,
        status: 1,
    },
    {
        name: "idx_line_allowed_positions_status",
    },
)

lineSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        return returnedObject
    },
})

const Line = mongoose.models.Line || mongoose.model("Line", lineSchema)

export default Line