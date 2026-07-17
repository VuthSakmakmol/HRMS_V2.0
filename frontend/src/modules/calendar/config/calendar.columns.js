export function createCalendarColumns(t) {
    return [
        { field: "dateKey", header: t("organization.calendar.day.date"), sortable: true, frozen: true, width: "9rem", minWidth: "9rem", maxWidth: "9rem", headerClass: "enterprise-table__code-header", bodyClass: "enterprise-table__code-cell" },
        { field: "name", header: t("organization.calendar.day.name"), sortable: true, width: "14rem", minWidth: "14rem" },
        { field: "holidayCategory", header: t("organization.calendar.day.category"), width: "11rem", minWidth: "11rem" },
        { field: "dayType", header: t("organization.calendar.day.dayType"), sortable: true, width: "12rem", minWidth: "12rem" },
        { field: "scopeLevel", header: t("organization.calendar.day.scope"), sortable: true, width: "9rem", minWidth: "9rem" },
        { field: "company", header: t("organization.calendar.day.company"), width: "13rem", minWidth: "13rem" },
        { field: "branch", header: t("organization.calendar.day.branch"), width: "13rem", minWidth: "13rem" },
        { field: "isPaidHoliday", header: t("organization.calendar.day.paidHoliday"), width: "8rem", minWidth: "8rem" },
        { field: "status", header: t("common.status"), sortable: true, width: "8rem", minWidth: "8rem" },
        { field: "updatedAt", header: t("common.updatedAt"), sortable: true, width: "11rem", minWidth: "11rem" },
    ]
}
