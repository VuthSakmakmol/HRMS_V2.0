import { EMPLOYEE_FORM_SECTIONS } from "./employee.form-sections.js"

export const EXIT_EMPLOYMENT_STATUSES = new Set([
    "RESIGNED",
    "TERMINATED",
    "ABANDONED",
    "PASSED_AWAY",
    "RETIRED",
])

function blank(value) {
    return value === null || value === undefined || String(value).trim() === ""
}

function safeDate(value) {
    if (blank(value)) return null
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
    return Number.isNaN(date.getTime()) ? null : date
}

function validateBasic(form, { editing = false } = {}) {
    const errors = {}
    const employeeCode = String(form.employeeCode || "").trim()

    if (!editing && !employeeCode) {
        errors.employeeCode = ["Employee Code is required."]
    } else if (!editing && (employeeCode.length < 2 || employeeCode.length > 40)) {
        errors.employeeCode = ["Employee Code must contain 2 to 40 characters."]
    } else if (!editing && !/^[A-Za-z0-9_-]+$/.test(employeeCode)) {
        errors.employeeCode = ["Employee Code can contain letters, numbers, underscore, and dash only."]
    }

    if (blank(form.dateOfBirth)) {
        errors.dateOfBirth = ["Date of Birth is required."]
    } else {
        const birthDate = safeDate(form.dateOfBirth)
        if (!birthDate) {
            errors.dateOfBirth = ["Enter a valid Date of Birth."]
        } else {
            const maximumBirthDate = new Date()
            maximumBirthDate.setHours(0, 0, 0, 0)
            maximumBirthDate.setFullYear(maximumBirthDate.getFullYear() - 18)
            if (birthDate > maximumBirthDate) {
                errors.dateOfBirth = ["Employee must be at least 18 years old."]
            }
        }
    }

    return errors
}

function validateContact(form) {
    const errors = {}
    const email = String(form.email || "").trim()
    const phoneNumber = String(form.phoneNumber || "").trim()

    if (!phoneNumber) {
        errors.phoneNumber = ["Phone Number is required."]
    } else if (!/^\d+$/.test(phoneNumber)) {
        errors.phoneNumber = ["Phone Number must contain digits only."]
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = ["Enter a valid email address."]
    }
    return errors
}

function validateAssignment(form, { positionOptions = [] } = {}) {
    const errors = {}
    const required = [
        ["companyId", "Company"],
        ["branchId", "Branch"],
        ["departmentId", "Department"],
        ["positionId", "Position"],
        ["lineId", "Line"],
        ["shiftId", "Shift"],
    ]

    for (const [field, label] of required) {
        if (blank(form[field])) errors[field] = [`${label} is required.`]
    }

    if (!blank(form.positionId) && Array.isArray(positionOptions) && positionOptions.length > 0) {
        const selectedPosition = positionOptions.find(
            (option) => String(option?.value || "") === String(form.positionId || ""),
        )

        if (selectedPosition?.configurationState === "UNCONFIGURED") {
            errors.positionId = [
                "This position is not assigned to an Employee Type. Configure it in Employee Type first, or choose another position.",
            ]
        } else if (selectedPosition?.configurationState === "AMBIGUOUS") {
            errors.positionId = [
                "This position has conflicting Employee Type assignments. Fix the Employee Type setup before assigning it to an employee.",
            ]
        }
    }

    return errors
}

function validateEmployment(form) {
    const errors = {}

    if (blank(form.joinDate)) errors.joinDate = ["Join Date is required."]
    if (blank(form.recruitmentChannelId)) errors.recruitmentChannelId = ["Recruitment Channel is required."]
    if (blank(form.employmentStatus)) errors.employmentStatus = ["Employment Status is required."]

    if (EXIT_EMPLOYMENT_STATUSES.has(form.employmentStatus)) {
        if (blank(form.resignDate)) errors.resignDate = ["Exit Date is required for this employment status."]
        if (blank(form.exitReasonId)) errors.exitReasonId = ["Exit Reason is required for this employment status."]
    }

    const joinDate = safeDate(form.joinDate)
    const exitDate = safeDate(form.resignDate)
    if (joinDate && exitDate && exitDate < joinDate) {
        errors.resignDate = ["Exit Date cannot be earlier than Join Date."]
    }

    return errors
}

export function validateEmployeeSection(form, sectionIndex, options = {}) {
    const section = EMPLOYEE_FORM_SECTIONS[sectionIndex]
    if (!section) return {}

    switch (section.key) {
        case "basic":
            return validateBasic(form, options)
        case "contact":
            return validateContact(form)
        case "assignment":
            return validateAssignment(form, options)
        case "employment":
            return validateEmployment(form)
        default:
            return {}
    }
}

export function validateEmployeeForm(form, options = {}) {
    return EMPLOYEE_FORM_SECTIONS.reduce((allErrors, _section, index) => ({
        ...allErrors,
        ...validateEmployeeSection(form, index, options),
    }), {})
}

export function employeeSectionIssueCount(form, sectionIndex, options = {}) {
    return Object.keys(validateEmployeeSection(form, sectionIndex, options)).length
}


const EMPLOYEE_FIELD_SECTION = Object.freeze({
    employeeCode: "basic",
    dateOfBirth: "basic",
    email: "contact",
    phoneNumber: "contact",
    agentPhoneNumber: "contact",
    nationality: "contact",
    companyId: "assignment",
    branchId: "assignment",
    departmentId: "assignment",
    positionId: "assignment",
    lineId: "assignment",
    shiftId: "assignment",
    joinDate: "employment",
    recruitmentChannelId: "employment",
    employmentStatus: "employment",
    recordStatus: "employment",
    resignDate: "employment",
    exitReasonId: "employment",
    resignReason: "employment",
})

export function employeeFieldSectionIndex(field) {
    const sectionKey = EMPLOYEE_FIELD_SECTION[field]
    if (!sectionKey) return -1
    return EMPLOYEE_FORM_SECTIONS.findIndex((section) => section.key === sectionKey)
}

export function firstEmployeeErrorSection(errors = {}) {
    let firstIndex = -1
    for (const field of Object.keys(errors || {})) {
        const index = employeeFieldSectionIndex(field)
        if (index >= 0 && (firstIndex < 0 || index < firstIndex)) firstIndex = index
    }
    return firstIndex
}
