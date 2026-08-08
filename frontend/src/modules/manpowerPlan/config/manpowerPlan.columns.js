export function createManpowerPlanColumns(t) {
    return [
        {
            field: "year",
            header: t("manpowerPlan.period"),
            sortable: true,
            frozen: true,
            alignFrozen: "left",
            width: "8rem",
            minWidth: "8rem",
            maxWidth: "8rem",
            headerClass: "enterprise-table__code-header",
            bodyClass: "enterprise-table__code-cell",
        },
        {
            field: "department",
            header: t("manpowerPlan.department"),
            minWidth: "14rem",
        },
        {
            field: "position",
            header: t("manpowerPlan.position"),
            minWidth: "16rem",
        },
        {
            field: "targetBudget",
            header: t("manpowerPlan.budget"),
            sortable: true,
            width: "9rem",
            minWidth: "9rem",
        },
        {
            field: "targetRoadmap",
            header: t("manpowerPlan.roadmap"),
            sortable: true,
            width: "9rem",
            minWidth: "9rem",
        },
        {
            field: "remark",
            header: t("manpowerPlan.remark"),
            minWidth: "18rem",
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
