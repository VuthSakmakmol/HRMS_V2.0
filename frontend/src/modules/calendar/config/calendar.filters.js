export function createCalendarStatusOptions(t) {
    return ["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"].map((value) => ({ label: t(`organization.calendar.status.${value}`), value }))
}

export function createCalendarScopeOptions(t, includeAll = true) {
    return (includeAll ? ["ALL", "GLOBAL", "COMPANY", "BRANCH"] : ["GLOBAL", "COMPANY", "BRANCH"]).map((value) => ({ label: t(`organization.calendar.scope.${value}`), value }))
}

export function createCalendarDayTypeOptions(t, includeAll = true) {
    const values = ["WORKING_DAY", "WEEKEND", "HOLIDAY", "SPECIAL_WORKING_DAY", "COMPANY_EVENT", "CLOSED_DAY"]
    return (includeAll ? ["ALL", ...values] : values).map((value) => ({ label: t(`organization.calendar.dayTypes.${value}`), value }))
}
