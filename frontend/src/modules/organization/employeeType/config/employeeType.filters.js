export function createEmployeeTypeStatusOptions(t) {
    return [
        { label: t("organization.employeeType.allStatuses"), value: "ALL" },
        { label: t("organization.employeeType.statusActive"), value: "ACTIVE" },
        { label: t("organization.employeeType.statusInactive"), value: "INACTIVE" },
        { label: t("organization.employeeType.statusArchived"), value: "ARCHIVED" },
    ]
}

export function createDashboardCategoryOptions(t, categories = [], includeAll = false) {
    const rows = categories.map((category) => ({ label: category.label || String(category.value || category).replaceAll("_", " "), value: category.value || category }))
    return includeAll ? [{ label: t("organization.employeeType.allCategories"), value: "ALL" }, ...rows] : rows
}

export function createPositionAssignmentModeOptions(t) {
    return [
        { label: t("organization.employeeType.allPositions"), value: "ALL_POSITIONS" },
        { label: t("organization.employeeType.specificPositions"), value: "SPECIFIC_POSITIONS" },
    ]
}
