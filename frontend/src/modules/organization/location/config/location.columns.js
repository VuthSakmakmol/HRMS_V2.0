export function createLocationColumns(t, entity) {
    const columns = [
        { field: "code", header: t("organization.location.code"), sortable: true, frozen: true, alignFrozen: "left", width: "9rem", minWidth: "9rem", maxWidth: "9rem", headerClass: "enterprise-table__code-header", bodyClass: "enterprise-table__code-cell" },
        { field: "name", header: t("organization.location.name"), sortable: true, width: "14rem", minWidth: "14rem" },
    ]
    if (entity !== "countries") columns.push({ field: "country", header: t("organization.location.country"), width: "12rem", minWidth: "12rem" })
    if (["districts", "communes", "villages"].includes(entity)) columns.push({ field: "province", header: t("organization.location.province"), width: "12rem", minWidth: "12rem" })
    if (["communes", "villages"].includes(entity)) columns.push({ field: "district", header: t("organization.location.district"), width: "12rem", minWidth: "12rem" })
    if (entity === "villages") columns.push({ field: "commune", header: t("organization.location.commune"), width: "12rem", minWidth: "12rem" })
    if (entity === "countries") {
        columns.push({ field: "nationality", header: t("organization.location.nationality"), width: "11rem", minWidth: "11rem" })
        columns.push({ field: "phoneCode", header: t("organization.location.phoneCode"), width: "8rem", minWidth: "8rem" })
    }
    columns.push({ field: "status", header: t("common.status"), sortable: true, width: "8rem", minWidth: "8rem" })
    columns.push({ field: "updatedAt", header: t("common.updatedAt"), sortable: true, width: "11rem", minWidth: "11rem" })
    return columns
}
