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

const shiftSchema = new Schema(
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

        shortName: {
            type: String,
            trim: true,
            maxlength: 80,
            set: normalizeText,
            default: "",
        },

        startTime: {
            type: String,
            required: true,
            match: /^([01]\d|2[0-3]):[0-5]\d$/,
        },

        endTime: {
            type: String,
            required: true,
            match: /^([01]\d|2[0-3]):[0-5]\d$/,
        },

        breakStartTime: {
            type: String,
            default: "",
            match: /^$|^([01]\d|2[0-3]):[0-5]\d$/,
        },

        breakEndTime: {
            type: String,
            default: "",
            match: /^$|^([01]\d|2[0-3]):[0-5]\d$/,
        },

        totalMinutes: {
            type: Number,
            required: true,
            min: 1,
            max: 1440,
        },

        breakMinutes: {
            type: Number,
            required: true,
            min: 0,
            max: 1440,
            default: 0,
        },

        workingMinutes: {
            type: Number,
            required: true,
            min: 1,
            max: 1440,
        },

        graceInMinutes: {
            type: Number,
            required: true,
            min: 0,
            max: 240,
            default: 0,
        },

        graceOutMinutes: {
            type: Number,
            required: true,
            min: 0,
            max: 240,
            default: 0,
        },

        isOvernight: {
            type: Boolean,
            required: true,
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
        collection: "shifts",
        timestamps: true,
        versionKey: false,
    },
)

shiftSchema.index(
    {
        companyId: 1,
        branchId: 1,
        code: 1,
    },
    {
        unique: true,
        name: "uq_shift_branch_code",
    },
)

shiftSchema.index(
    {
        companyId: 1,
        branchId: 1,
        status: 1,
        name: 1,
    },
    {
        name: "idx_shift_branch_status_name",
    },
)

shiftSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        return returnedObject
    },
})

const Shift = mongoose.models.Shift || mongoose.model("Shift", shiftSchema)

export default Shift