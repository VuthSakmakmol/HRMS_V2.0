export const EXIT_REASON_PERMISSIONS = Object.freeze({
    CREATE: "ORGANIZATION.EXIT_REASON.CREATE",
    UPDATE: "ORGANIZATION.EXIT_REASON.UPDATE",
    ARCHIVE: "ORGANIZATION.EXIT_REASON.ARCHIVE",
})

export const exitReasonColumns = [
    { field: "code", header: "Code", frozen: true, width: "10rem", minWidth: "10rem" },
    { field: "name", header: "Exit Reason", width: "17rem", minWidth: "17rem" },
    { field: "description", header: "Description", width: "24rem", minWidth: "24rem" },
    { field: "status", header: "Status", width: "8rem", minWidth: "8rem" },
    { field: "updatedAt", header: "Updated", width: "11rem", minWidth: "11rem" },
]

export const statusOptions = [
    { label: "All", value: "ALL" },
    { label: "Active", value: "ACTIVE" },
    { label: "Inactive", value: "INACTIVE" },
    { label: "Archived", value: "ARCHIVED" },
]
