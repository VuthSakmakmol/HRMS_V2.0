import bcrypt from "bcryptjs"
import { Types } from "mongoose"

import { AppError } from "../../../shared/errors/AppError.js"

import Account from "../models/Account.js"

function normalizeLoginId(value) {
    return String(value || "").trim().toLowerCase()
}

function normalizeEmployeeCode(value) {
    return String(value || "").trim().replace(/\s+/g, "_").toUpperCase()
}

function normalizePhone(value) {
    return String(value || "").trim().replace(/\s+/g, "")
}

export function buildEmployeeInitialPassword(employee) {
    return `${normalizeEmployeeCode(employee?.employeeCode)}${normalizePhone(employee?.phoneNumber)}`
}

function getEmployeeId(employee) {
    const raw = employee?._id || employee?.id || employee?.employeeId
    if (!raw) return null
    return raw.toString()
}

function buildRoleAssignmentFromEmployee(employee, roleId) {
    if (!roleId) return null

    return {
        roleId,
        companyId: employee.companyId || null,
        allBranches: false,
        branchIds: employee.branchId ? [employee.branchId] : [],
    }
}

export async function provisionEmployeeAccount({
    employee,
    user,
    createAccount = true,
    defaultRoleId = null,
}) {
    if (!createAccount) {
        return {
            action: "SKIPPED",
            reason: "CREATE_ACCOUNT_DISABLED",
        }
    }

    const employeeId = getEmployeeId(employee)
    const employeeCode = normalizeEmployeeCode(employee?.employeeCode)
    const phoneNumber = normalizePhone(employee?.phoneNumber)

    if (!employeeId || !Types.ObjectId.isValid(employeeId)) {
        throw new AppError({
            statusCode: 422,
            code: "ACCOUNT_EMPLOYEE_REQUIRED",
            messageKey: "errors.access.account.employeeRequired",
        })
    }

    if (!employeeCode) {
        throw new AppError({
            statusCode: 422,
            code: "ACCOUNT_EMPLOYEE_CODE_REQUIRED",
            messageKey: "errors.access.account.employeeCodeRequired",
            fields: {
                employeeCode: ["errors.access.account.employeeCodeRequired"],
            },
        })
    }

    if (!phoneNumber) {
        throw new AppError({
            statusCode: 422,
            code: "ACCOUNT_PHONE_REQUIRED",
            messageKey: "errors.access.account.phoneRequired",
            fields: {
                phoneNumber: ["errors.access.account.phoneRequired"],
            },
        })
    }

    const loginId = normalizeLoginId(employeeCode)
    const existingByEmployee = await Account.findOne({ employeeId })
    const existingByLogin = await Account.findOne({ loginId })

    if (
        existingByLogin &&
        existingByLogin.employeeId?.toString?.() &&
        existingByLogin.employeeId.toString() !== employeeId
    ) {
        throw new AppError({
            statusCode: 409,
            code: "ACCOUNT_LOGIN_ID_EXISTS",
            messageKey: "errors.access.account.loginIdExists",
            fields: {
                employeeCode: ["errors.access.account.loginIdExists"],
            },
        })
    }

    if (
        existingByLogin &&
        !existingByLogin.employeeId &&
        existingByEmployee?._id?.toString?.() !== existingByLogin._id.toString()
    ) {
        throw new AppError({
            statusCode: 409,
            code: "ACCOUNT_LOGIN_ID_RESERVED",
            messageKey: "errors.access.account.loginIdReserved",
            fields: {
                employeeCode: ["errors.access.account.loginIdReserved"],
            },
        })
    }

    const displayName =
        employee.displayName ||
        [employee.englishFirstName, employee.englishLastName].filter(Boolean).join(" ") ||
        [employee.khmerFirstName, employee.khmerLastName].filter(Boolean).join(" ") ||
        employeeCode

    const roleAssignment = buildRoleAssignmentFromEmployee(employee, defaultRoleId)

    if (existingByEmployee || existingByLogin) {
        const account = existingByEmployee || existingByLogin
        const update = {
            employeeId,
            loginId,
            displayName,
            updatedByAccountId: user?.accountId || null,
        }

        if (roleAssignment) {
            const hasRole = account.roleAssignments?.some(
                (assignment) =>
                    assignment.roleId?.toString?.() === roleAssignment.roleId.toString() &&
                    assignment.companyId?.toString?.() === roleAssignment.companyId?.toString?.(),
            )

            if (!hasRole) {
                update.$push = { roleAssignments: roleAssignment }
            }
        }

        if (update.$push) {
            await Account.findByIdAndUpdate(account._id, {
                $set: {
                    employeeId: update.employeeId,
                    loginId: update.loginId,
                    displayName: update.displayName,
                    updatedByAccountId: update.updatedByAccountId,
                },
                $push: update.$push,
            })
        } else {
            await Account.findByIdAndUpdate(account._id, { $set: update })
        }

        return {
            action: "EXISTS",
            accountId: account._id.toString(),
            loginId,
        }
    }

    const passwordHash = await bcrypt.hash(buildEmployeeInitialPassword(employee), 12)

    const account = await Account.create({
        loginId,
        displayName,
        employeeId,
        passwordHash,
        status: "ACTIVE",
        isRootAdmin: false,
        roleAssignments: roleAssignment ? [roleAssignment] : [],
        createdByAccountId: user?.accountId || null,
        updatedByAccountId: user?.accountId || null,
    })

    return {
        action: "CREATED",
        accountId: account._id.toString(),
        loginId,
        initialPasswordRule: "EMPLOYEE_ID_PLUS_PHONE_NUMBER",
    }
}
