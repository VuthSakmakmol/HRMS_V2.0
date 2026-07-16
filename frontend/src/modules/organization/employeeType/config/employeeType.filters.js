export function createEmployeeTypeStatusOptions(t) {
    return [
        { label: t("organization.employeeType.allStatuses"), value: "ALL" },
        { label: t("organization.employeeType.statusActive"), value: "ACTIVE" },
        { label: t("organization.employeeType.statusInactive"), value: "INACTIVE" },
        { label: t("organization.employeeType.statusArchived"), value: "ARCHIVED" },
    ]
}

export function createDashboardCategoryOptions(t, includeAll = false) {
    const rows = [
        { label: t("organization.employeeType.categoryBlueCollarSewer"), value: "BLUE_COLLAR_SEWER" },
        { label: t("organization.employeeType.categoryBlueCollarNonSewer"), value: "BLUE_COLLAR_NON_SEWER" },
        { label: t("organization.employeeType.categoryWhiteCollar"), value: "WHITE_COLLAR" },
        { label: t("organization.employeeType.categoryCustom"), value: "CUSTOM" },
    ]
    return includeAll
        ? [{ label: t("organization.employeeType.allCategories"), value: "ALL" }, ...rows]
        : rows
}

export function createPositionAssignmentModeOptions(t) {
    return [
        { label: t("organization.employeeType.allPositions"), value: "ALL_POSITIONS" },
        { label: t("organization.employeeType.specificPositions"), value: "SPECIFIC_POSITIONS" },
    ]
}
