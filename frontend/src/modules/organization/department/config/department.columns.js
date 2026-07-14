export function createDepartmentColumns(t) {
    return [
        {
            field: "code",
            header: t("organization.department.code"),
            sortable: true,
            frozen: true,
            alignFrozen: "left",
            width: "9rem",
            minWidth: "9rem",
            maxWidth: "9rem",
            headerClass: "enterprise-table__code-header",
            bodyClass: "enterprise-table__code-cell",
        },
        {
            field: "name",
            header: t("organization.department.name"),
            sortable: true,
            width: "14rem",
            minWidth: "14rem",
        },
        {
            field: "company",
            header: t("organization.department.company"),
            sortable: false,
            width: "13rem",
            minWidth: "13rem",
        },
        {
            field: "branch",
            header: t("organization.department.branch"),
            sortable: false,
            width: "13rem",
            minWidth: "13rem",
        },
        {
            field: "parentDepartment",
            header: t("organization.department.parentDepartment"),
            sortable: false,
            width: "14rem",
            minWidth: "14rem",
        },
        {
            field: "status",
            header: t("common.status"),
            sortable: true,
            width: "8rem",
            minWidth: "8rem",
        },
        {
            field: "updatedAt",
            header: t("common.updatedAt"),
            sortable: true,
            width: "11rem",
            minWidth: "11rem",
        },
    ]
}
