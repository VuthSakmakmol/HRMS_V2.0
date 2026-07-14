export function createBranchStatusOptions(t) {
    return [
        { label: t("organization.branch.statusAll"), value: "ALL" },
        { label: t("organization.branch.statusActive"), value: "ACTIVE" },
        { label: t("organization.branch.statusInactive"), value: "INACTIVE" },
        { label: t("organization.branch.statusArchived"), value: "ARCHIVED" },
    ]
}
