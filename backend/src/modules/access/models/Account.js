import mongoose from "mongoose"

const { Schema } = mongoose

function normalizeLoginId(value) {
    if (typeof value !== "string") {
        return value
    }

    return value.trim().toLowerCase()
}

function normalizeText(value) {
    if (typeof value !== "string") {
        return value
    }

    return value.trim().replace(/\s+/g, " ")
}

const roleAssignmentSchema = new Schema(
    {
        roleId: {
            type: Schema.Types.ObjectId,
            ref: "Role",
            required: true,
        },

        companyId: {
            type: Schema.Types.ObjectId,
            ref: "Company",
            default: null,
        },

        allBranches: {
            type: Boolean,
            default: true,
            required: true,
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
    },
    {
        _id: false,
    },
)

const accountSchema = new Schema(
    {
        loginId: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 120,
            set: normalizeLoginId,
        },

        displayName: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 160,
            set: normalizeText,
        },

        employeeId: {
            type: Schema.Types.ObjectId,
            ref: "Employee",
            default: null,
        },

        passwordHash: {
            type: String,
            required: true,
            select: false,
        },

        status: {
            type: String,
            enum: ["ACTIVE", "DISABLED", "LOCKED"],
            default: "ACTIVE",
            required: true,
        },

        isRootAdmin: {
            type: Boolean,
            default: false,
            required: true,
        },

        roleAssignments: {
            type: [roleAssignmentSchema],
            default: [],
        },

        passwordVersion: {
            type: Number,
            default: 1,
            min: 1,
            required: true,
        },

        lastLoginAt: {
            type: Date,
            default: null,
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
        collection: "accounts",
        timestamps: true,
        versionKey: false,
    },
)

accountSchema.index(
    { loginId: 1 },
    {
        unique: true,
        name: "uq_account_login_id",
    },
)

accountSchema.index(
    { employeeId: 1 },
    {
        unique: true,
        sparse: true,
        name: "uq_account_employee_id",
    },
)

accountSchema.index(
    { status: 1, displayName: 1 },
    {
        name: "idx_account_status_display_name",
    },
)

accountSchema.set("toJSON", {
    virtuals: true,

    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()

        delete returnedObject._id
        delete returnedObject.passwordHash

        return returnedObject
    },
})

const Account =
    mongoose.models.Account || mongoose.model("Account", accountSchema)

export default Account