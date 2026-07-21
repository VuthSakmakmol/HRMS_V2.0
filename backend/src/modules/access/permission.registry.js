function permissionGroup(module, actions) {
    return actions.map((action) => ({
        code: `${module}.${action}`,
        module,
        action,
        name: `${module.replaceAll(".", " ")} ${action}`,
        description: `Allows ${action.toLowerCase()} access for ${module.replaceAll(".", " ")}.`,
    }))
}

export const PERMISSION_REGISTRY = Object.freeze([
    ...permissionGroup("SYSTEM.HEALTH", ["VIEW"]),

    ...permissionGroup("ACCESS.PERMISSION", ["VIEW"]),
    ...permissionGroup("ACCESS.ROLE", ["VIEW", "CREATE", "UPDATE", "DELETE"]),
    ...permissionGroup("ACCESS.ACCOUNT", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "DISABLE",
        "RESET_PASSWORD",
    ]),
    ...permissionGroup("ACCESS.AUDIT_LOG", ["VIEW"]),

    ...permissionGroup("ORGANIZATION.COMPANY", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
    ]),
    ...permissionGroup("ORGANIZATION.BRANCH", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
    ]),
    
    ...permissionGroup("ORGANIZATION.DEPARTMENT", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
        "IMPORT",
        "EXPORT",
    ]),
    
    ...permissionGroup("ORGANIZATION.POSITION", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
        "IMPORT",
        "EXPORT",
    ]),

    ...permissionGroup("ORGANIZATION.SHIFT", [
        "LOOKUP",
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
        "IMPORT",
        "EXPORT",
    ]),

        ...permissionGroup("ORGANIZATION.EMPLOYEE_TYPE", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
        "IMPORT",
        "EXPORT",
    ]),

    ...permissionGroup("ORGANIZATION.LINE", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
        "IMPORT",
        "EXPORT",
    ]),

        ...permissionGroup("ORGANIZATION.LOCATION", [
        "LOOKUP",
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
        "IMPORT",
        "EXPORT",
    ]),

    ...permissionGroup("APPROVAL.POLICY", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
        "PREVIEW",
    ]),

    ...permissionGroup("CALENDAR.DAY", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
        "IMPORT",
        "EXPORT",
    ]),

    ...permissionGroup("EMPLOYEE.PROFILE", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
        "IMPORT",
        "EXPORT",
    ]),

    ...permissionGroup("ATTENDANCE.RECORD", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "IMPORT",
        "EXPORT",
    ]),

    ...permissionGroup("ATTENDANCE.POLICY", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
    ]),

    ...permissionGroup("ATTENDANCE.SCAN", [
        "VIEW",
        "IMPORT",
    ]),

    ...permissionGroup("ATTENDANCE.VERIFICATION", [
        "VIEW",
        "RUN",
    ]),

    ...permissionGroup("LEAVE.REQUEST", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "APPROVE",
        "REJECT",
    ]),

    ...permissionGroup("OVERTIME.REQUEST", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "APPROVE",
        "REJECT",
        "EXPORT",
    ]),

    ...permissionGroup("PAYROLL.PERIOD", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "APPROVE",
        "EXPORT",
    ]),

    ...permissionGroup("EMPLOYEE.MOVEMENT", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
        "IMPORT",
        "EXPORT",
    ]),

    ...permissionGroup("REPORT.MANPOWER_PLAN", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
        "IMPORT",
        "EXPORT",
    ]),
    ...permissionGroup("ORGANIZATION.RECRUITMENT_CHANNEL", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
    ]),
    ...permissionGroup("REPORT.HR_DASHBOARD_TARGET", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
        "IMPORT",
        "EXPORT",
    ]),
    ...permissionGroup("ORGANIZATION.EXIT_REASON", [
        "VIEW",
        "CREATE",
        "UPDATE",
        "ARCHIVE",
    ]),




    ...permissionGroup("REPORT.HR_ANALYTICS", ["VIEW", "EXPORT"]),
])
