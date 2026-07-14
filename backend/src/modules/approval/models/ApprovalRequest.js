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

const approvalTaskSchema = new Schema(
    {
        stepCode: {
            type: String,
            required: true,
            trim: true,
            set: normalizeCode,
        },

        stepName: {
            type: String,
            required: true,
            trim: true,
            set: normalizeText,
        },

        sequence: {
            type: Number,
            required: true,
        },

        approvalMode: {
            type: String,
            trim: true,
            default: "ALL",
            set: normalizeCode,
        },

        approverEmployeeId: {
            type: Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },

        originalApproverEmployeeId: {
            type: Schema.Types.ObjectId,
            ref: "Employee",
            default: null,
        },

        status: {
            type: String,
            enum: [
                "WAITING",
                "PENDING",
                "APPROVED",
                "REJECTED",
                "RETURNED",
                "SKIPPED",
                "CANCELED",
                "REASSIGNED",
            ],
            default: "WAITING",
            required: true,
        },

        decisionByAccountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },

        decisionByEmployeeId: {
            type: Schema.Types.ObjectId,
            ref: "Employee",
            default: null,
        },

        decisionAt: {
            type: Date,
            default: null,
        },

        note: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: "",
            set: normalizeText,
        },

        reassignedByAccountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },

        reassignedAt: {
            type: Date,
            default: null,
        },

        reassignmentReason: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: "",
            set: normalizeText,
        },
    },
    { timestamps: true },
)

const approvalRequestSchema = new Schema(
    {
        moduleKey: {
            type: String,
            required: true,
            trim: true,
            set: normalizeCode,
        },

        actionKey: {
            type: String,
            required: true,
            trim: true,
            default: "REQUEST",
            set: normalizeCode,
        },

        subjectType: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
            set: normalizeCode,
        },

        subjectId: {
            type: Schema.Types.ObjectId,
            required: true,
        },

        title: {
            type: String,
            trim: true,
            maxlength: 240,
            default: "",
            set: normalizeText,
        },

        requesterEmployeeId: {
            type: Schema.Types.ObjectId,
            ref: "Employee",
            default: null,
        },

        requesterAccountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },

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

        policyId: {
            type: Schema.Types.ObjectId,
            ref: "ApprovalPolicy",
            required: true,
        },

        policyVersion: {
            type: Number,
            required: true,
            min: 1,
        },

        policySnapshot: {
            type: Mixed,
            required: true,
        },

        contextSnapshot: {
            type: Mixed,
            default: {},
        },

        tasks: {
            type: [approvalTaskSchema],
            default: [],
        },

        status: {
            type: String,
            enum: [
                "DRAFT",
                "PENDING",
                "APPROVED",
                "REJECTED",
                "RETURNED",
                "CANCELED",
                "FAILED",
            ],
            default: "PENDING",
            required: true,
        },

        currentSequence: {
            type: Number,
            default: 1,
        },

        completedAt: {
            type: Date,
            default: null,
        },

        finalDecisionByAccountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },

        finalDecisionAt: {
            type: Date,
            default: null,
        },

        metadata: {
            type: Mixed,
            default: {},
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
        collection: "approval_requests",
        timestamps: true,
        versionKey: false,
    },
)

approvalRequestSchema.index(
    { moduleKey: 1, actionKey: 1, subjectType: 1, subjectId: 1 },
    { name: "idx_approval_request_subject" },
)

approvalRequestSchema.index(
    { status: 1, companyId: 1, branchId: 1, createdAt: -1 },
    { name: "idx_approval_request_status_scope" },
)

approvalRequestSchema.index(
    { "tasks.approverEmployeeId": 1, "tasks.status": 1, createdAt: -1 },
    { name: "idx_approval_task_inbox" },
)

approvalRequestSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        return returnedObject
    },
})

const ApprovalRequest =
    mongoose.models.ApprovalRequest ||
    mongoose.model("ApprovalRequest", approvalRequestSchema)

export default ApprovalRequest
