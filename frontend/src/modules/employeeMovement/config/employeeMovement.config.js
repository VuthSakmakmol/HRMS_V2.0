export const EMPLOYEE_MOVEMENT_PERMISSIONS = Object.freeze({
    VIEW: "EMPLOYEE.MOVEMENT.VIEW",
    EXPORT: "EMPLOYEE.MOVEMENT.EXPORT",
})

export const MOVEMENT_TYPES = [
    "NEW_HIRE", "REJOIN", "RESIGN", "TERMINATE", "ABANDON",
    "PASSED_AWAY", "RETIRE", "TRANSFER", "DEPARTMENT_CHANGE",
    "POSITION_CHANGE", "LINE_CHANGE", "SHIFT_CHANGE",
    "EMPLOYEE_TYPE_CHANGE", "STATUS_CHANGE", "OTHER",
]

export function titleCase(value) {
    return String(value || "").replaceAll("_", " ").toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export const movementTypeOptions = MOVEMENT_TYPES.map((value) => ({
    value,
    label: titleCase(value),
}))

export const statusOptions = ["ALL", "ACTIVE", "INACTIVE", "ARCHIVED"]
    .map((value) => ({ value, label: titleCase(value) }))

export const sourceOptions = ["ALL", "MANUAL", "EMPLOYEE_PROFILE", "IMPORT"]
    .map((value) => ({ value, label: titleCase(value) }))

export const movementColumns = [
    { field: "effectiveDate", header: "Effective Date", frozen: true, width: "9rem", minWidth: "9rem" },
    { field: "employeeCode", header: "Employee Code", width: "9rem", minWidth: "9rem" },
    { field: "employeeName", header: "Employee", width: "13rem", minWidth: "13rem" },
    { field: "movementType", header: "Movement Type", width: "12rem", minWidth: "12rem" },
    { field: "fromDepartment", header: "From Department", width: "12rem", minWidth: "12rem" },
    { field: "toDepartment", header: "To Department", width: "12rem", minWidth: "12rem" },
    { field: "fromPosition", header: "From Position", width: "12rem", minWidth: "12rem" },
    { field: "toPosition", header: "To Position", width: "12rem", minWidth: "12rem" },
    { field: "fromLine", header: "From Line", width: "10rem", minWidth: "10rem" },
    { field: "toLine", header: "To Line", width: "10rem", minWidth: "10rem" },
    { field: "fromShift", header: "From Shift", width: "10rem", minWidth: "10rem" },
    { field: "toShift", header: "To Shift", width: "10rem", minWidth: "10rem" },
    { field: "source", header: "Source", width: "10rem", minWidth: "10rem" },
    { field: "reason", header: "Reason", width: "16rem", minWidth: "16rem" },
    { field: "status", header: "Status", width: "8rem", minWidth: "8rem" },
]
