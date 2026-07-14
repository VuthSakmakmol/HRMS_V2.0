import mongoose from "mongoose"

const { Schema } = mongoose

export const EMPLOYEE_TYPE_DASHBOARD_CATEGORIES = Object.freeze([
    "BLUE_COLLAR_SEWER",
    "BLUE_COLLAR_NON_SEWER",
    "WHITE_COLLAR",
    "CUSTOM",
])

export const EMPLOYEE_TYPE_POSITION_ASSIGNMENT_MODES = Object.freeze([
    "ALL_POSITIONS",
    "SPECIFIC_POSITIONS",
])

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

const employeeTypeChildSchema = new Schema(
    {
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
            maxlength: 120,
            set: normalizeText,
        },

        dashboardCategory: {
            type: String,
            enum: EMPLOYEE_TYPE_DASHBOARD_CATEGORIES,
            default: "CUSTOM",
            required: true,
        },

        positionAssignmentMode: {
            type: String,
            enum: EMPLOYEE_TYPE_POSITION_ASSIGNMENT_MODES,
            default: "SPECIFIC_POSITIONS",
            required: true,
        },

        positionIds: [
            {
                type: Schema.Types.ObjectId,
                ref: "Position",
            },
        ],
    },
    {
        _id: true,
        versionKey: false,
    },
)

const employeeTypeSchema = new Schema(
    {
        companyId: {
            type: Schema.Types.ObjectId,
            ref: "Company",
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

        dashboardCategory: {
            type: String,
            enum: EMPLOYEE_TYPE_DASHBOARD_CATEGORIES,
            default: "CUSTOM",
            required: true,
        },

        positionAssignmentMode: {
            type: String,
            enum: EMPLOYEE_TYPE_POSITION_ASSIGNMENT_MODES,
            default: "SPECIFIC_POSITIONS",
            required: true,
        },

        positionIds: [
            {
                type: Schema.Types.ObjectId,
                ref: "Position",
            },
        ],

        children: {
            type: [employeeTypeChildSchema],
            default: [],
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
        collection: "employee_types",
        timestamps: true,
        versionKey: false,
    },
)

employeeTypeSchema.index(
    {
        companyId: 1,
        code: 1,
    },
    {
        unique: true,
        name: "uq_employee_type_company_code",
    },
)

employeeTypeSchema.index(
    {
        companyId: 1,
        status: 1,
        name: 1,
    },
    {
        name: "idx_employee_type_company_status_name",
    },
)

employeeTypeSchema.index(
    {
        dashboardCategory: 1,
        status: 1,
    },
    {
        name: "idx_employee_type_dashboard_category_status",
    },
)

employeeTypeSchema.index(
    {
        positionIds: 1,
        status: 1,
    },
    {
        name: "idx_employee_type_direct_positions_status",
    },
)

employeeTypeSchema.index(
    {
        "children.positionIds": 1,
        status: 1,
    },
    {
        name: "idx_employee_type_child_positions_status",
    },
)

employeeTypeSchema.set("toJSON", {
    virtuals: true,

    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id

        if (Array.isArray(returnedObject.children)) {
            returnedObject.children = returnedObject.children.map((child) => ({
                ...child,
                id: child._id?.toString?.() || child.id,
                _id: undefined,
            }))
        }

        return returnedObject
    },
})

const EmployeeType =
    mongoose.models.EmployeeType ||
    mongoose.model("EmployeeType", employeeTypeSchema)

export default EmployeeType
