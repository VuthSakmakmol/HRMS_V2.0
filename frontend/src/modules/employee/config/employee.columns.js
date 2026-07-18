const column = (section, field, header, options = {}) => ({
    section,
    field,
    header,
    default: ["basic", "assignment", "employment"].includes(section),
    width: "11rem",
    minWidth: "11rem",
    ...options,
})

export const EMPLOYEE_COLUMNS = Object.freeze([
    column("basic", "employeeCode", "Employee Code", {
        frozen: true,
        alignFrozen: "left",
        width: "10rem",
        minWidth: "10rem",
    }),
    column("basic", "displayName", "Employee", {
        frozen: true,
        alignFrozen: "left",
        width: "14rem",
        minWidth: "14rem",
    }),
    column("basic", "khmerFirstName", "Khmer First Name", { width: "13rem" }),
    column("basic", "khmerLastName", "Khmer Last Name", { width: "13rem" }),
    column("basic", "englishFirstName", "English First Name", { width: "13rem" }),
    column("basic", "englishLastName", "English Last Name", { width: "13rem" }),
    column("basic", "gender", "Gender", { width: "8rem", minWidth: "8rem" }),
    column("basic", "dateOfBirth", "Date of Birth", { width: "10rem", minWidth: "10rem" }),
    column("basic", "age", "Age", { width: "6rem", minWidth: "6rem" }),

    column("contact", "phoneNumber", "Phone"),
    column("contact", "email", "Email", { width: "15rem", minWidth: "15rem" }),
    column("contact", "nationality", "Nationality", { width: "10rem", minWidth: "10rem" }),

    column("assignment", "company", "Company", { width: "13rem" }),
    column("assignment", "branch", "Branch", { width: "13rem" }),
    column("assignment", "department", "Department", { width: "13rem" }),
    column("assignment", "position", "Position", { width: "13rem" }),
    column("assignment", "line", "Line", { width: "12rem" }),
    column("assignment", "shift", "Shift"),
    column("assignment", "employeeType", "Employee Type", { width: "12rem" }),

    column("employment", "joinDate", "Join Date", { width: "10rem", minWidth: "10rem" }),
    column("employment", "employmentStatus", "Employment Status"),
    column("employment", "recordStatus", "Record Status", { width: "10rem", minWidth: "10rem" }),

    column("addresses", "birthAddressDetail", "Birth Address", { width: "18rem" }),
    column("addresses", "permanentAddressDetail", "Permanent Address", { width: "18rem" }),

    column("documents", "idCardNo", "ID Card Number"),
    column("documents", "idCardExpireDate", "ID Card Expiry", { width: "10rem", minWidth: "10rem" }),
    column("documents", "nssfNo", "NSSF Number"),
    column("documents", "passportNo", "Passport Number"),
    column("documents", "passportExpireDate", "Passport Expiry", { width: "10rem", minWidth: "10rem" }),
    column("documents", "visaExpireDate", "Visa Expiry", { width: "10rem", minWidth: "10rem" }),
    column("documents", "medicalCheckNo", "Medical Check Number", { width: "13rem" }),
    column("documents", "medicalCheckDate", "Medical Check Date", { width: "11rem" }),
    column("documents", "workingBookNo", "Working Book Number", { width: "13rem" }),

    column("skills", "singleNeedle", "Single Needle", { width: "9rem", minWidth: "9rem" }),
    column("skills", "overlock", "Overlock", { width: "8rem", minWidth: "8rem" }),
    column("skills", "coverstitch", "Coverstitch", { width: "9rem", minWidth: "9rem" }),
    column("skills", "totalMachines", "Total Machines", { width: "9rem", minWidth: "9rem" }),
    column("skills", "note", "Additional Note", { width: "18rem" }),
])

const SECTION_DEFINITIONS = Object.freeze([
    { key: "basic", label: "Basic Information", icon: "pi pi-user" },
    { key: "contact", label: "Contact & Personal", icon: "pi pi-phone" },
    { key: "assignment", label: "Organization Assignment", icon: "pi pi-sitemap" },
    { key: "employment", label: "Employment", icon: "pi pi-briefcase" },
    { key: "addresses", label: "Addresses", icon: "pi pi-map-marker" },
    { key: "documents", label: "Documents", icon: "pi pi-id-card" },
    { key: "skills", label: "Skills & Additional", icon: "pi pi-cog" },
])

export const EMPLOYEE_COLUMN_GROUPS = Object.freeze(
    SECTION_DEFINITIONS
        .map((section) => ({
            ...section,
            items: EMPLOYEE_COLUMNS.filter(
                (columnItem) => columnItem.section === section.key,
            ),
        }))
        .filter((section) => section.items.length > 0),
)

export function defaultEmployeeColumns() {
    return EMPLOYEE_COLUMNS
        .filter((columnItem) => columnItem.default)
        .map((columnItem) => columnItem.field)
}
