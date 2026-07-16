export function createShiftColumns(t) {
    return [
        { field: "code", header: t("organization.shift.code"), frozen: true, minWidth: "8rem" },
        { field: "name", header: t("organization.shift.name"), minWidth: "11rem" },
        { field: "company", header: t("organization.shift.company"), minWidth: "11rem" },
        { field: "branch", header: t("organization.shift.branch"), minWidth: "11rem" },
        { field: "startTime", header: t("organization.shift.startTime"), minWidth: "7rem" },
        { field: "endTime", header: t("organization.shift.endTime"), minWidth: "7rem" },
        { field: "break", header: t("organization.shift.breakTime"), minWidth: "9rem" },
        { field: "workingMinutes", header: t("organization.shift.workingHours"), minWidth: "8rem" },
        { field: "grace", header: t("organization.shift.graceMinutes"), minWidth: "8rem" },
        { field: "status", header: t("common.status"), minWidth: "7rem" },
        { field: "updatedAt", header: t("common.updatedAt"), minWidth: "10rem" },
    ]
}
