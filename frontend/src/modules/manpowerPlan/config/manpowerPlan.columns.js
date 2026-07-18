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
        { field: "department", header: t("manpowerPlan.department"), minWidth: "13rem" },
        { field: "position", header: t("manpowerPlan.position"), minWidth: "14rem" },
        { field: "line", header: t("manpowerPlan.line"), minWidth: "11rem" },
        { field: "shift", header: t("manpowerPlan.shift"), minWidth: "10rem" },
        { field: "employeeType", header: t("manpowerPlan.type"), minWidth: "14rem" },
        { field: "targetBudget", header: t("manpowerPlan.budget"), sortable: true, width: "8rem", minWidth: "8rem" },
        { field: "targetRoadmap", header: t("manpowerPlan.roadmap"), sortable: true, width: "8rem", minWidth: "8rem" },
        { field: "remark", header: t("manpowerPlan.remark"), minWidth: "16rem" },
        { field: "status", header: t("common.status"), sortable: true, width: "8rem", minWidth: "8rem" },
        { field: "updatedAt", header: t("common.updatedAt"), sortable: true, width: "11rem", minWidth: "11rem" },
    ]
}
