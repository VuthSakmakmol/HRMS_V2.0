import mongoose from "mongoose"

const { Schema } = mongoose

const auditLogSchema = new Schema(
    {
        requestId: {
            type: String,
            trim: true,
            index: true,
        },
        actorAccountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            default: null,
            index: true,
        },
        actorEmployeeId: {
            type: Schema.Types.ObjectId,
            ref: "Employee",
            default: null,
            index: true,
        },
        module: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        action: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        entityType: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        entityId: {
            type: Schema.Types.ObjectId,
            default: null,
            index: true,
        },
        before: {
            type: Schema.Types.Mixed,
            default: null,
        },
        after: {
            type: Schema.Types.Mixed,
            default: null,
        },
        ipAddress: {
            type: String,
            trim: true,
            default: "",
        },
        userAgent: {
            type: String,
            trim: true,
            default: "",
        },
    },
    {
        collection: "audit_logs",
        timestamps: true,
        versionKey: false,
    },
)

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 })
auditLogSchema.index({ module: 1, action: 1, createdAt: -1 })
auditLogSchema.index({ actorAccountId: 1, createdAt: -1 })

const AuditLog =
    mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema)

export default AuditLog
