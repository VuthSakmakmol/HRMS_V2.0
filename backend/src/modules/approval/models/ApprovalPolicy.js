import mongoose from "mongoose"

const { Schema } = mongoose
const { Mixed } = Schema.Types

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

const approvalPolicyScopeSchema = new Schema(
    {
        companyId: {
            type: Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },

        branchId: {
            type: Schema.Types.ObjectId,
            ref: "Branch",
            default: null,
        },

        departmentId: {
            type: Schema.Types.ObjectId,
            ref: "Department",
            default: null,
        },

        lineId: {
            type: Schema.Types.ObjectId,
            ref: "Line",
            default: null,
        },

        positionId: {
            type: Schema.Types.ObjectId,
            ref: "Position",
            default: null,
        },

        employeeId: {
            type: Schema.Types.ObjectId,
            ref: "Employee",
            default: null,
        },
    },
    { _id: false },
)

const resolverSchema = new Schema(
    {
        resolverKey: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
            set: normalizeCode,
        },

        resolverConfig: {
            type: Mixed,
            default: {},
        },
    },
    { _id: false },
)

const approvalStepSchema = new Schema(
    {
        stepCode: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80,
            set: normalizeCode,
        },

        stepName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160,
            set: normalizeText,
        },

        sequence: {
            type: Number,
            required: true,
            min: 1,
            max: 100,
        },

        approvalMode: {
            type: String,
            trim: true,
            maxlength: 40,
            default: "ALL",
            set: normalizeCode,
        },

        assignmentMode: {
            type: String,
            trim: true,
            maxlength: 40,
            default: "FIRST",
            set: normalizeCode,
        },

        resolverKey: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
            set: normalizeCode,
        },

        resolverConfig: {
            type: Mixed,
            default: {},
        },

        fallbackResolvers: {
            type: [resolverSchema],
            default: [],
        },

        allowSelfApproval: {
            type: Boolean,
            default: false,
            required: true,
        },

        isRequired: {
            type: Boolean,
            default: true,
            required: true,
        },

        canReject: {
            type: Boolean,
            default: true,
            required: true,
        },

        canReturn: {
            type: Boolean,
            default: false,
            required: true,
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500,
            default: "",
            set: normalizeText,
        },
    },
    { _id: false },
)

const approvalPolicySchema = new Schema(
    {
        moduleKey: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100,
            match: /^[A-Z0-9_.-]+$/,
            set: normalizeCode,
        },

        actionKey: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100,
            match: /^[A-Z0-9_.-]+$/,
            default: "REQUEST",
            set: normalizeCode,
        },

        code: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100,
            match: /^[A-Z0-9_.-]+$/,
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

        scope: {
            type: approvalPolicyScopeSchema,
            required: true,
        },

        conditions: {
            type: Mixed,
            default: {},
        },

        priority: {
            type: Number,
            min: 0,
            max: 9999,
            default: 100,
            required: true,
        },

        version: {
            type: Number,
            min: 1,
            default: 1,
            required: true,
        },

        steps: {
            type: [approvalStepSchema],
            default: [],
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500,
            default: "",
            set: normalizeText,
        },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
            default: "ACTIVE",
            required: true,
        },

        effectiveFrom: {
            type: Date,
            default: null,
        },

        effectiveTo: {
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
        collection: "approval_policies",
        timestamps: true,
        versionKey: false,
    },
)

approvalPolicySchema.index(
    { moduleKey: 1, actionKey: 1, code: 1 },
    { unique: true, name: "uq_approval_policy_code" },
)

approvalPolicySchema.index(
    {
        moduleKey: 1,
        actionKey: 1,
        status: 1,
        "scope.companyId": 1,
        "scope.branchId": 1,
        "scope.departmentId": 1,
        "scope.lineId": 1,
        "scope.positionId": 1,
        "scope.employeeId": 1,
        priority: 1,
    },
    { name: "idx_approval_policy_resolution" },
)

approvalPolicySchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        return returnedObject
    },
})

const ApprovalPolicy =
    mongoose.models.ApprovalPolicy ||
    mongoose.model("ApprovalPolicy", approvalPolicySchema)

export default ApprovalPolicy
