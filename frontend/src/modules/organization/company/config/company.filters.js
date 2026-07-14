export function createCompanyStatusOptions(t) {
    return [
        { label: t("organization.company.statusAll"), value: "ALL" },
        { label: t("organization.company.statusActive"), value: "ACTIVE" },
        { label: t("organization.company.statusSuspended"), value: "SUSPENDED" },
        { label: t("organization.company.statusArchived"), value: "ARCHIVED" },
    ]
}
