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

const departmentSchema = new Schema(
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

        parentDepartmentId: {
            type: Schema.Types.ObjectId,
            ref: "Department",
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
        collection: "departments",
        timestamps: true,
        versionKey: false,
    },
)

departmentSchema.index(
    {
        companyId: 1,
        branchId: 1,
        code: 1,
    },
    {
        unique: true,
        name: "uq_department_branch_code",
    },
)

departmentSchema.index(
    {
        companyId: 1,
        branchId: 1,
        status: 1,
        name: 1,
    },
    {
        name: "idx_department_branch_status_name",
    },
)

departmentSchema.index(
    {
        parentDepartmentId: 1,
        status: 1,
    },
    {
        name: "idx_department_parent_status",
    },
)

departmentSchema.set("toJSON", {
    virtuals: true,

    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id

        return returnedObject
    },
})

const Department =
    mongoose.models.Department ||
    mongoose.model("Department", departmentSchema)

export default Department
