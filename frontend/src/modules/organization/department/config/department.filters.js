export function createDepartmentStatusOptions(t) {
    return [
        {
            label: t("organization.department.statusAll"),
            value: "ALL",
        },
        {
            label: t("organization.department.statusActive"),
            value: "ACTIVE",
        },
        {
            label: t("organization.department.statusInactive"),
            value: "INACTIVE",
        },
        {
            label: t("organization.department.statusArchived"),
            value: "ARCHIVED",
        },
    ]
}
