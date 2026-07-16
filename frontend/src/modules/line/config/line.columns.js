export function createLineColumns(t) {
    return [
        {
            field: "code",
            header: t("organization.line.code"),
            sortable: true,
            frozen: true,
            alignFrozen: "left",
            width: "8rem",
            minWidth: "8rem",
        },
        {
            field: "name",
            header: t("organization.line.name"),
            sortable: true,
            minWidth: "12rem",
        },
        {
            field: "company",
            header: t("organization.line.company"),
            minWidth: "12rem",
        },
        {
            field: "branch",
            header: t("organization.line.branch"),
            minWidth: "11rem",
        },
        {
            field: "department",
            header: t("organization.line.department"),
            minWidth: "12rem",
        },
        {
            field: "leaderPosition",
            header: t("organization.line.leaderPosition"),
            minWidth: "12rem",
        },
        {
            field: "status",
            header: t("common.status"),
            sortable: true,
            minWidth: "7rem",
        },
        {
            field: "updatedAt",
            header: t("common.updatedAt"),
            sortable: true,
            minWidth: "11rem",
        },
    ]
}
