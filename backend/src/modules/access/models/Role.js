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

const roleSchema = new Schema(
    {
        code: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 80,
            set: normalizeCode,
        },

        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 120,
            set: normalizeText,
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500,
            set: normalizeText,
            default: "",
        },

        scope: {
            type: String,
            enum: ["GLOBAL", "COMPANY", "BRANCH"],
            default: "COMPANY",
            required: true,
        },

        companyId: {
            type: Schema.Types.ObjectId,
            ref: "Company",
            default: null,
        },

        branchIds: {
            type: [
                {
                    type: Schema.Types.ObjectId,
                    ref: "Branch",
                },
            ],
            default: [],
        },

        permissionIds: {
            type: [
                {
                    type: Schema.Types.ObjectId,
                    ref: "Permission",
                },
            ],
            default: [],
        },

        isSystem: {
            type: Boolean,
            default: false,
            required: true,
        },

        isActive: {
            type: Boolean,
            default: true,
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
        collection: "roles",
        timestamps: true,
        versionKey: false,
    },
)

roleSchema.index(
    { code: 1 },
    {
        unique: true,
        name: "uq_role_code",
    },
)

roleSchema.index(
    { companyId: 1, isActive: 1, name: 1 },
    {
        name: "idx_role_company_active_name",
    },
)

const Role =
    mongoose.models.Role || mongoose.model("Role", roleSchema)

export default Role