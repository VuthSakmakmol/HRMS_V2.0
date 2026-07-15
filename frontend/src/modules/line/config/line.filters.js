export function createLineStatusOptions(t) {
    return [
        {
            label: t("organization.line.allStatuses"),
            value: "ALL",
        },
        {
            label: t("organization.line.statusActive"),
            value: "ACTIVE",
        },
        {
            label: t("organization.line.statusInactive"),
            value: "INACTIVE",
        },
        {
            label: t("organization.line.statusArchived"),
            value: "ARCHIVED",
        },
    ]
}
