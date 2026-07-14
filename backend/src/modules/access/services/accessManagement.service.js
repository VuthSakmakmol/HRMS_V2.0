import bcrypt from "bcryptjs"
import { Types } from "mongoose"

import { AppError } from "../../../shared/errors/AppError.js"
import Branch from "../../organization/models/Branch.js"
import Company from "../../organization/models/Company.js"
import Account from "../models/Account.js"
import Permission from "../models/Permission.js"
import Role from "../models/Role.js"

const escapeRegExp = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

function validationError(code) {
    return new AppError({
        statusCode: 400,
        code,
        messageKey: "errors.validationFailed",
    })
}

function notFoundError(code) {
    return new AppError({
        statusCode: 404,
        code,
        messageKey: "errors.notFound",
    })
}

function ensureId(id) {
    if (!Types.ObjectId.isValid(id)) {
        throw validationError("ACCESS_INVALID_ID")
    }
}

function serialize(document) {
    if (!document) {
        return null
    }

    const value =
        typeof document.toJSON === "function"
            ? document.toJSON()
            : { ...document }

    value.id ||= value._id?.toString()

    delete value._id
    delete value.passwordHash

    return value
}

function handleDuplicate(error, code) {
    if (error?.code === 11000) {
        throw new AppError({
            statusCode: 409,
            code,
            messageKey: "errors.duplicate",
        })
    }

    throw error
}

function buildSearchFilter(search, fields) {
    const query = String(search || "").trim()

    if (!query) {
        return {}
    }

    const expression = new RegExp(escapeRegExp(query), "i")

    return {
        $or: fields.map((field) => ({ [field]: expression })),
    }
}

function normalizeId(value) {
    if (!value) {
        return null
    }

    if (typeof value === "string") {
        return value
    }

    return value.id?.toString() || value._id?.toString() || value.toString()
}

function uniqueIds(values = []) {
    return [...new Set(values.map(normalizeId).filter(Boolean))]
}

async function validatePermissions(permissionIds) {
    const uniquePermissionIds = uniqueIds(permissionIds)

    const count = await Permission.countDocuments({
        _id: { $in: uniquePermissionIds },
        isActive: true,
    })

    if (count !== uniquePermissionIds.length) {
        throw validationError("ACCESS_PERMISSION_INVALID")
    }
}

async function validateCompany(companyId) {
    if (!companyId) {
        throw validationError("ACCESS_COMPANY_REQUIRED")
    }

    const companyExists = await Company.exists({
        _id: companyId,
        status: { $ne: "ARCHIVED" },
    })

    if (!companyExists) {
        throw validationError("ACCESS_COMPANY_INVALID")
    }
}

async function validateBranches(companyId, branchIds) {
    const uniqueBranchIds = uniqueIds(branchIds)

    if (uniqueBranchIds.length === 0) {
        throw validationError("ACCESS_BRANCH_REQUIRED")
    }

    const count = await Branch.countDocuments({
        _id: { $in: uniqueBranchIds },
        companyId,
        status: { $ne: "ARCHIVED" },
    })

    if (count !== uniqueBranchIds.length) {
        throw validationError("ACCESS_BRANCH_INVALID")
    }

    return uniqueBranchIds
}

async function normalizeRoleScopePayload(payload) {
    const scope = payload.scope || "COMPANY"

    if (scope === "GLOBAL") {
        return {
            ...payload,
            scope,
            companyId: null,
            branchIds: [],
        }
    }

    await validateCompany(payload.companyId)

    if (scope === "COMPANY") {
        return {
            ...payload,
            scope,
            branchIds: [],
        }
    }

    if (scope === "BRANCH") {
        return {
            ...payload,
            scope,
            branchIds: await validateBranches(
                payload.companyId,
                payload.branchIds,
            ),
        }
    }

    throw validationError("ACCESS_ROLE_SCOPE_INVALID")
}

async function validateAssignments(assignments) {
    const normalizedAssignments = assignments || []
    const roleIds = uniqueIds(
        normalizedAssignments.map((assignment) => assignment.roleId),
    )

    const roles = await Role.find({
        _id: { $in: roleIds },
        isActive: true,
    }).lean()

    if (roles.length !== roleIds.length) {
        throw validationError("ACCESS_ROLE_INVALID")
    }

    const roleById = new Map(
        roles.map((role) => [role._id.toString(), role]),
    )

    for (const assignment of normalizedAssignments) {
        const role = roleById.get(normalizeId(assignment.roleId))

        if (!role) {
            throw validationError("ACCESS_ROLE_INVALID")
        }

        if (role.scope === "GLOBAL") {
            assignment.companyId = null
            assignment.allBranches = true
            assignment.branchIds = []
            continue
        }

        const effectiveCompanyId =
            normalizeId(assignment.companyId) || normalizeId(role.companyId)

        await validateCompany(effectiveCompanyId)
        assignment.companyId = effectiveCompanyId

        if (role.scope === "BRANCH") {
            const allowedBranchIds = new Set(uniqueIds(role.branchIds))
            const requestedBranchIds = uniqueIds(assignment.branchIds)
            const effectiveBranchIds =
                requestedBranchIds.length > 0
                    ? requestedBranchIds
                    : [...allowedBranchIds]

            if (
                effectiveBranchIds.length === 0 ||
                effectiveBranchIds.some(
                    (branchId) => !allowedBranchIds.has(branchId),
                )
            ) {
                throw validationError("ACCESS_BRANCH_INVALID")
            }

            await validateBranches(effectiveCompanyId, effectiveBranchIds)

            assignment.allBranches = false
            assignment.branchIds = effectiveBranchIds
            continue
        }

        if (assignment.allBranches) {
            assignment.branchIds = []
            continue
        }

        assignment.branchIds = await validateBranches(
            effectiveCompanyId,
            assignment.branchIds,
        )
    }
}

export async function listPermissions() {
    const items = await Permission.find({ isActive: true })
        .sort({ module: 1, action: 1 })
        .lean()

    return {
        items: items.map(serialize),
    }
}

export async function listRoleLookup() {
    const items = await Role.find({ isActive: true })
        .select("code name scope companyId branchIds isSystem")
        .sort({ name: 1 })
        .lean()

    return {
        items: items.map(serialize),
    }
}

export async function listScopeLookup() {
    const [companies, branches] = await Promise.all([
        Company.find({ status: { $ne: "ARCHIVED" } })
            .select("code displayName")
            .sort({ displayName: 1 })
            .lean(),
        Branch.find({ status: { $ne: "ARCHIVED" } })
            .select("code name companyId")
            .sort({ name: 1 })
            .lean(),
    ])

    return {
        companies: companies.map(serialize),
        branches: branches.map(serialize),
    }
}

export async function listRoles({ query }) {
    const filter = {
        ...buildSearchFilter(query.search, ["code", "name", "description"]),
    }

    if (query.status !== "ALL") {
        filter.isActive = query.status === "ACTIVE"
    }

    const skip = (query.page - 1) * query.limit

    const [items, total] = await Promise.all([
        Role.find(filter)
            .populate("companyId", "code displayName")
            .populate("branchIds", "code name companyId")
            .populate("permissionIds", "code module action name")
            .sort({ isSystem: -1, name: 1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        Role.countDocuments(filter),
    ])

    return {
        items: items.map(serialize),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
    }
}

export async function createRole({ payload, user }) {
    await validatePermissions(payload.permissionIds)

    const normalizedPayload = await normalizeRoleScopePayload({
        ...payload,
        branchIds: uniqueIds(payload.branchIds),
    })

    try {
        return serialize(
            await Role.create({
                ...normalizedPayload,
                createdByAccountId: user.accountId,
                updatedByAccountId: user.accountId,
            }),
        )
    } catch (error) {
        handleDuplicate(error, "ACCESS_ROLE_DUPLICATE")
    }
}

export async function updateRole({ id, payload, user }) {
    ensureId(id)

    const existing = await Role.findById(id).lean()

    if (!existing) {
        throw notFoundError("ACCESS_ROLE_NOT_FOUND")
    }

    if (
        existing.isSystem &&
        (payload.code ||
            payload.scope ||
            payload.companyId !== undefined ||
            payload.branchIds !== undefined)
    ) {
        throw new AppError({
            statusCode: 409,
            code: "ACCESS_SYSTEM_ROLE_PROTECTED",
            messageKey: "errors.permissionDenied",
        })
    }

    if (payload.permissionIds) {
        await validatePermissions(payload.permissionIds)
    }

    const mergedPayload = {
        ...existing,
        ...payload,
        companyId:
            payload.companyId !== undefined
                ? payload.companyId
                : normalizeId(existing.companyId),
        branchIds:
            payload.branchIds !== undefined
                ? uniqueIds(payload.branchIds)
                : uniqueIds(existing.branchIds),
    }

    const normalizedScopePayload = await normalizeRoleScopePayload(
        mergedPayload,
    )

    const updatePayload = {
        ...payload,
        scope: normalizedScopePayload.scope,
        companyId: normalizedScopePayload.companyId,
        branchIds: normalizedScopePayload.branchIds,
        updatedByAccountId: user.accountId,
    }

    try {
        return serialize(
            await Role.findByIdAndUpdate(
                id,
                { $set: updatePayload },
                {
                    returnDocument: "after",
                    runValidators: true,
                },
            ),
        )
    } catch (error) {
        handleDuplicate(error, "ACCESS_ROLE_DUPLICATE")
    }
}

export async function deleteRole({ id }) {
    ensureId(id)

    const role = await Role.findById(id)

    if (!role) {
        throw notFoundError("ACCESS_ROLE_NOT_FOUND")
    }

    if (role.isSystem) {
        throw new AppError({
            statusCode: 409,
            code: "ACCESS_SYSTEM_ROLE_PROTECTED",
            messageKey: "errors.permissionDenied",
        })
    }

    const isUsed = await Account.exists({
        "roleAssignments.roleId": role._id,
    })

    if (isUsed) {
        throw new AppError({
            statusCode: 409,
            code: "ACCESS_ROLE_IN_USE",
            messageKey: "errors.duplicate",
        })
    }

    await role.deleteOne()
}

export async function listAccounts({ query }) {
    const filter = {
        ...buildSearchFilter(query.search, ["loginId", "displayName"]),
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    const skip = (query.page - 1) * query.limit

    const [items, total] = await Promise.all([
        Account.find(filter)
            .populate("employeeId", "employeeCode firstName lastName")
            .populate(
                "roleAssignments.roleId",
                "code name scope companyId branchIds",
            )
            .populate("roleAssignments.companyId", "code displayName")
            .populate("roleAssignments.branchIds", "code name")
            .sort({ isRootAdmin: -1, displayName: 1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        Account.countDocuments(filter),
    ])

    return {
        items: items.map(serialize),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
    }
}

export async function createAccount({ payload, user }) {
    await validateAssignments(payload.roleAssignments)

    try {
        const passwordHash = await bcrypt.hash(payload.password, 12)
        const { password, ...data } = payload

        return serialize(
            await Account.create({
                ...data,
                passwordHash,
                createdByAccountId: user.accountId,
                updatedByAccountId: user.accountId,
            }),
        )
    } catch (error) {
        handleDuplicate(error, "ACCESS_ACCOUNT_DUPLICATE")
    }
}

export async function updateAccount({ id, payload, user }) {
    ensureId(id)

    const current = await Account.findById(id)

    if (!current) {
        throw notFoundError("ACCESS_ACCOUNT_NOT_FOUND")
    }

    if (current.isRootAdmin && !user.isRootAdmin) {
        throw new AppError({
            statusCode: 403,
            code: "ACCESS_ROOT_ACCOUNT_PROTECTED",
            messageKey: "errors.permissionDenied",
        })
    }

    if (payload.roleAssignments) {
        await validateAssignments(payload.roleAssignments)
    }

    try {
        return serialize(
            await Account.findByIdAndUpdate(
                id,
                {
                    $set: {
                        ...payload,
                        updatedByAccountId: user.accountId,
                    },
                },
                {
                    returnDocument: "after",
                    runValidators: true,
                },
            ),
        )
    } catch (error) {
        handleDuplicate(error, "ACCESS_ACCOUNT_DUPLICATE")
    }
}

export async function resetAccountPassword({ id, password, user }) {
    ensureId(id)

    const account = await Account.findById(id)

    if (!account) {
        throw notFoundError("ACCESS_ACCOUNT_NOT_FOUND")
    }

    account.passwordHash = await bcrypt.hash(password, 12)
    account.passwordVersion += 1
    account.updatedByAccountId = user.accountId

    await account.save()
}
