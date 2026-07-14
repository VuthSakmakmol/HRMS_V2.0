import AuditLog from "../models/AuditLog.js"

function toPlainValue(value) {
    if (!value) {
        return null
    }

    if (typeof value.toJSON === "function") {
        return value.toJSON()
    }

    return structuredClone(value)
}

export async function writeAuditLog({
    req,
    user,
    module,
    action,
    entityType,
    entityId,
    before = null,
    after = null,
}) {
    try {
        await AuditLog.create({
            requestId: req.requestId,
            actorAccountId: user?.accountId || null,
            actorEmployeeId: user?.employeeId || null,
            module,
            action,
            entityType,
            entityId: entityId || null,
            before: toPlainValue(before),
            after: toPlainValue(after),
            ipAddress: req.ip || "",
            userAgent: req.get("user-agent") || "",
        })
    } catch (error) {
        console.error(
            `[audit][${req.requestId || "unknown"}] failed to write audit log`,
            error,
        )
    }
}
