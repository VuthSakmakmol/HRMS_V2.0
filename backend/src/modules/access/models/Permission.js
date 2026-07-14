import mongoose from "mongoose"

const { Schema } = mongoose

function normalizeCode(value) {
    if (typeof value !== "string") {
        return value
    }

    return value.trim().replace(/\s+/g, "_").toUpperCase()
}

const permissionSchema = new Schema(
    {
        code: {
            type: String,
            required: true,
            trim: true,
            minlength: 5,
            maxlength: 120,
            set: normalizeCode,
        },

        module: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 80,
            set: normalizeCode,
        },

        action: {
            type: String,
            required: true,
            enum: [
                "VIEW",
                "CREATE",
                "UPDATE",
                "DELETE",
                "ARCHIVE",
                "DISABLE",
                "APPROVE",
                "REJECT",
                "IMPORT",
                "EXPORT",
                "MANAGE",
                "RESET_PASSWORD",
            ],
            set: normalizeCode,
        },

        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 180,
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500,
            default: "",
        },

        isSystem: {
            type: Boolean,
            default: true,
            required: true,
        },

        isActive: {
            type: Boolean,
            default: true,
            required: true,
        },
    },
    {
        collection: "permissions",
        timestamps: true,
        versionKey: false,
    },
)

permissionSchema.index(
    { code: 1 },
    {
        unique: true,
        name: "uq_permission_code",
    },
)

permissionSchema.index(
    { module: 1, action: 1 },
    {
        name: "idx_permission_module_action",
    },
)

const Permission =
    mongoose.models.Permission ||
    mongoose.model("Permission", permissionSchema)

export default Permission