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

const positionSchema = new Schema(
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

        reportsToPositionId: {
            type: Schema.Types.ObjectId,
            ref: "Position",
            default: null,
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

        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 160,
            set: normalizeText,
        },

        level: {
            type: Number,
            min: 0,
            max: 99,
            default: 0,
        },

        isManager: {
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
        collection: "positions",
        timestamps: true,
        versionKey: false,
    },
)

positionSchema.index(
    {
        companyId: 1,
        branchId: 1,
        departmentId: 1,
        code: 1,
    },
    {
        unique: true,
        name: "uq_position_department_code",
    },
)

positionSchema.index(
    {
        companyId: 1,
        branchId: 1,
        departmentId: 1,
        status: 1,
        title: 1,
    },
    {
        name: "idx_position_department_status_title",
    },
)

positionSchema.index(
    {
        reportsToPositionId: 1,
        status: 1,
    },
    {
        name: "idx_position_reports_to_status",
    },
)

positionSchema.set("toJSON", {
    virtuals: true,

    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id

        return returnedObject
    },
})

const Position =
    mongoose.models.Position || mongoose.model("Position", positionSchema)

export default Position