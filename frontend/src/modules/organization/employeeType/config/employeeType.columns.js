export function createEmployeeTypeColumns(t) {
    return [
        { field: "code", header: t("organization.employeeType.code"), sortable: true, frozen: true, minWidth: "9rem" },
        { field: "name", header: t("organization.employeeType.name"), sortable: true, minWidth: "13rem" },
        { field: "company", header: t("organization.employeeType.company"), minWidth: "12rem" },
        { field: "dashboardCategory", header: t("organization.employeeType.dashboardCategory"), minWidth: "12rem" },
        { field: "structure", header: t("organization.employeeType.structure"), minWidth: "10rem" },
        { field: "positionCount", header: t("organization.employeeType.positions"), minWidth: "8rem" },
        { field: "status", header: t("common.status"), sortable: true, minWidth: "8rem" },
        { field: "updatedAt", header: t("common.updatedAt"), sortable: true, minWidth: "10rem" },
    ]
}
