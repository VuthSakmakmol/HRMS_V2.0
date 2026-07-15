export function createPositionStatusOptions(t) {
    return [
        {
            label: t("organization.position.statusAll"),
            value: "ALL",
        },
        {
            label: t("organization.position.statusActive"),
            value: "ACTIVE",
        },
        {
            label: t("organization.position.statusInactive"),
            value: "INACTIVE",
        },
        {
            label: t("organization.position.statusArchived"),
            value: "ARCHIVED",
        },
    ]
}
