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
        // Legacy compatibility only. Line no longer has Department as a parent.
        // New writes derive Departments from the selected Positions and unset this field.
        departmentId: {
            type: Schema.Types.ObjectId,
            ref: "Department",
            default: null,
        },

        // A Line can support multiple Positions from any Department in the
        // selected Company + Branch.
        positionIds: {
            type: [{ type: Schema.Types.ObjectId, ref: "Position" }],
            default: [],
            validate: {
                validator(value) {
                    return Array.isArray(value) && value.length >= 1
                },
                message: "At least one Position is required for a Line.",
            },
        },

        // Backward compatibility for development data created while Line
        // belonged to exactly one Position. New writes use positionIds only.
        positionId: {
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
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 160,
            set: normalizeText,
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

// Line Code is a Branch-level identity. One Line record can support Positions
// from multiple Departments without duplicating the Line.
lineSchema.index(
    {
        companyId: 1,
        branchId: 1,
        code: 1,
    },
    {
        name: "idx_line_branch_code",
    },
)

lineSchema.index(
    {
        companyId: 1,
        branchId: 1,
        positionIds: 1,
        status: 1,
        name: 1,
    },
    {
        name: "idx_line_positions_status_name",
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
