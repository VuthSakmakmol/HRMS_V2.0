import { AppError } from "../../../shared/errors/AppError.js"

function id(value) {
    return String(value?._id || value?.id || value || "")
}

export function attendanceScopeFilter(user, companyField = "companyId", branchField = "branchId") {
    if (user?.isRootAdmin) return {}

    const scopes = []
    for (const assignment of user?.roleAssignments || []) {
        if (!assignment.companyId) continue
        if (assignment.allBranches) scopes.push({ [companyField]: assignment.companyId })
        else if (assignment.branchIds?.length) {
            scopes.push({
                [companyField]: assignment.companyId,
                [branchField]: { $in: assignment.branchIds },
            })
        }
    }
    return scopes.length ? { $or: scopes } : { _id: { $in: [] } }
}

export function assertAttendanceScope(user, companyId, branchId) {
    if (user?.isRootAdmin) return

    const allowed = (user?.roleAssignments || []).some((assignment) =>
        id(assignment.companyId) === id(companyId) &&
        (assignment.allBranches || (assignment.branchIds || []).some((value) => id(value) === id(branchId))),
    )

    if (!allowed) {
        throw new AppError({
            statusCode: 403,
            code: "ATTENDANCE_SCOPE_FORBIDDEN",
            messageKey: "errors.authorization.insufficientScope",
        })
    }
}

