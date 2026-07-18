export const EMPLOYEE_COLUMNS = Object.freeze([
    {
        field: "employeeCode",
        header: "Employee Code",
        default: true,
        frozen: true,
        alignFrozen: "left",
        width: "10rem",
        minWidth: "10rem",
    },
    {
        field: "displayName",
        header: "Employee",
        default: true,
        frozen: true,
        alignFrozen: "left",
        width: "14rem",
        minWidth: "14rem",
    },
    {
        field: "gender",
        header: "Gender",
        default: true,
        width: "8rem",
        minWidth: "8rem",
    },
    {
        field: "company",
        header: "Company",
        default: true,
        width: "13rem",
        minWidth: "13rem",
    },
    {
        field: "branch",
        header: "Branch",
        default: true,
        width: "13rem",
        minWidth: "13rem",
    },
    {
        field: "department",
        header: "Department",
        default: true,
        width: "13rem",
        minWidth: "13rem",
    },
    {
        field: "position",
        header: "Position",
        default: true,
        width: "13rem",
        minWidth: "13rem",
    },
    {
        field: "line",
        header: "Line",
        default: true,
        width: "12rem",
        minWidth: "12rem",
    },
    {
        field: "shift",
        header: "Shift",
        default: true,
        width: "11rem",
        minWidth: "11rem",
    },
    {
        field: "employeeType",
        header: "Employee Type",
        default: true,
        width: "12rem",
        minWidth: "12rem",
    },
    {
        field: "employmentStatus",
        header: "Employment Status",
        default: true,
        width: "11rem",
        minWidth: "11rem",
    },
    {
        field: "phoneNumber",
        header: "Phone",
        default: false,
        width: "11rem",
        minWidth: "11rem",
    },
    {
        field: "email",
        header: "Email",
        default: false,
        width: "15rem",
        minWidth: "15rem",
    },
    {
        field: "nationality",
        header: "Nationality",
        default: false,
        width: "10rem",
        minWidth: "10rem",
    },
    {
        field: "joinDate",
        header: "Join Date",
        default: false,
        width: "10rem",
        minWidth: "10rem",
    },
    {
        field: "recordStatus",
        header: "Record Status",
        default: false,
        width: "10rem",
        minWidth: "10rem",
    },
])

export function defaultEmployeeColumns() {
    return EMPLOYEE_COLUMNS
        .filter((column) => column.default)
        .map((column) => column.field)
}