import { Types } from "mongoose"

import { AppError } from "../../../shared/errors/AppError.js"

import Company from "../../organization/models/Company.js"
import Branch from "../../organization/models/Branch.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"
import Line from "../../line/models/Line.js"
import Employee from "../../employee/models/Employee.js"
import Account from "../../access/models/Account.js"

import ApprovalPolicy from "../models/ApprovalPolicy.js"

export const BUILT_IN_RESOLVERS = Object.freeze([
    {
        resolverKey: "SPECIFIC_EMPLOYEE",
        label: "Specific employee",
        description: "Resolve to resolverConfig.employeeId.",
        sampleConfig: { employeeId: "<employeeId>" },
    },
    {
        resolverKey: "SPECIFIC_EMPLOYEES",
        label: "Specific employees",
        description: "Resolve to resolverConfig.employeeIds. Supports ALL or ANY approval mode.",
        sampleConfig: { employeeIds: ["<employeeId1>", "<employeeId2>"] },
    },
    {
        resolverKey: "POSITION_HOLDER",
        label: "Position holder",
        description: "Find active employee(s) by position. Can limit to same department or line.",
        sampleConfig: {
            positionId: "<positionId>",
            sameDepartment: true,
            sameLine: false,
        },
    },
    {
        resolverKey: "LINE_LEADER",
        label: "Line leader",
        description: "Use the leader position configured in Line module, or resolverConfig.positionId.",
        sampleConfig: { positionId: null },
    },
    {
        resolverKey: "DEPARTMENT_MANAGER",
        label: "Department manager",
        description: "Find active employee with manager position in the requester's department.",
        sampleConfig: {},
    },
    {
        resolverKey: "REPORTS_TO_POSITION_CHAIN",
        label: "Position reports-to chain",
        description: "Follow Position.reportsToPositionId upward from requester position.",
        sampleConfig: { level: 1 },
    },
    {
        resolverKey: "REQUESTER_MANAGER",
        label: "Requester manager",
        description: "Alias of REPORTS_TO_POSITION_CHAIN level 1.",
        sampleConfig: {},
    },
    {
        resolverKey: "ROLE_HOLDER",
        label: "Role holder",
        description: "Find account by roleId, then linked employee if accountId/employeeId exists in your account-employee linking model.",
        sampleConfig: { roleId: "<roleId>" },
    },
    {
        resolverKey: "EMPLOYEE_QUERY",
        label: "Employee query",
        description: "Advanced fallback. Query employee by fields in resolverConfig.match.",
        sampleConfig: { match: { employmentStatus: "WORKING" } },
    },
])

function normalizeCode(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase()
}

function toObjectIdOrNull(value) {
    if (!value || !Types.ObjectId.isValid(value)) {
        return null
    }

    return new Types.ObjectId(value)
}

function objectIdEqual(left, right) {
    if (!left || !right) {
        return false
    }

    return left.toString() === right.toString()
}

function getByPath(object, path) {
    return String(path || "")
        .split(".")
        .filter(Boolean)
        .reduce((current, key) => current?.[key], object)
}

function matchConditionValue(actualValue, rule) {
    if (rule === undefined || rule === null || rule === "") {
        return true
    }

    if (Array.isArray(rule)) {
        return rule.map(String).includes(String(actualValue))
    }

    if (typeof rule === "object") {
        if (rule.exists !== undefined) {
            const exists = actualValue !== undefined && actualValue !== null && actualValue !== ""
            if (Boolean(rule.exists) !== exists) {
                return false
            }
        }

        if (rule.equals !== undefined && String(actualValue) !== String(rule.equals)) {
            return false
        }

        if (Array.isArray(rule.in) && !rule.in.map(String).includes(String(actualValue))) {
            return false
        }

        if (Array.isArray(rule.notIn) && rule.notIn.map(String).includes(String(actualValue))) {
            return false
        }

        if (rule.min !== undefined && Number(actualValue) < Number(rule.min)) {
            return false
        }

        if (rule.max !== undefined && Number(actualValue) > Number(rule.max)) {
            return false
        }

        return true
    }

    return String(actualValue).toUpperCase() === String(rule).toUpperCase()
}

function conditionsMatch(policyConditions = {}, context = {}) {
    for (const [path, rule] of Object.entries(policyConditions || {})) {
        const actualValue = getByPath(context, path)

        if (!matchConditionValue(actualValue, rule)) {
            return false
        }
    }

    return true
}

function scopeScore(policy, assignment) {
    let score = 0
    const scope = policy.scope || {}

    if (scope.employeeId && objectIdEqual(scope.employeeId, assignment.employeeId || assignment._id)) {
        score += 10_000
    }

    if (scope.lineId && objectIdEqual(scope.lineId, assignment.lineId)) {
        score += 1_000
    }

    if (scope.positionId && objectIdEqual(scope.positionId, assignment.positionId)) {
        score += 800
    }

    if (scope.departmentId && objectIdEqual(scope.departmentId, assignment.departmentId)) {
        score += 600
    }

    if (scope.branchId && objectIdEqual(scope.branchId, assignment.branchId)) {
        score += 400
    }

    if (scope.companyId && objectIdEqual(scope.companyId, assignment.companyId)) {
        score += 200
    }

    score += Math.max(0, 9999 - Number(policy.priority || 100)) / 10_000

    return score
}

function buildPolicyFilter({ moduleKey, actionKey, assignment }) {
    return {
        moduleKey: normalizeCode(moduleKey),
        actionKey: normalizeCode(actionKey || "REQUEST"),
        status: "ACTIVE",
        "scope.companyId": assignment.companyId,
        $and: [
            { $or: [{ "scope.branchId": null }, { "scope.branchId": assignment.branchId || null }] },
            { $or: [{ "scope.departmentId": null }, { "scope.departmentId": assignment.departmentId || null }] },
            { $or: [{ "scope.lineId": null }, { "scope.lineId": assignment.lineId || null }] },
            { $or: [{ "scope.positionId": null }, { "scope.positionId": assignment.positionId || null }] },
            { $or: [{ "scope.employeeId": null }, { "scope.employeeId": assignment.employeeId || assignment._id || null }] },
        ],
    }
}

export function serializeEmployeeApprover(employee) {
    if (!employee) {
        return null
    }

    return {
        id: employee._id?.toString?.() || employee.id,
        employeeCode: employee.employeeCode,
        displayName:
            employee.displayName ||
            [employee.englishFirstName, employee.englishLastName]
                .filter(Boolean)
                .join(" ") ||
            employee.employeeCode,
        companyId: employee.companyId?.toString?.() || employee.companyId,
        branchId: employee.branchId?.toString?.() || employee.branchId,
        departmentId: employee.departmentId?.toString?.() || employee.departmentId,
        lineId: employee.lineId?.toString?.() || employee.lineId,
        positionId: employee.positionId?.toString?.() || employee.positionId,
    }
}

export function serializePolicy(policy) {
    if (!policy) {
        return null
    }

    const raw = typeof policy.toJSON === "function" ? policy.toJSON() : { ...policy }

    return {
        id: raw._id?.toString?.() || raw.id,
        moduleKey: raw.moduleKey,
        actionKey: raw.actionKey,
        code: raw.code,
        name: raw.name,
        scope: {
            companyId: raw.scope?.companyId?.toString?.() || raw.scope?.companyId,
            branchId: raw.scope?.branchId?.toString?.() || raw.scope?.branchId || null,
            departmentId: raw.scope?.departmentId?.toString?.() || raw.scope?.departmentId || null,
            lineId: raw.scope?.lineId?.toString?.() || raw.scope?.lineId || null,
            positionId: raw.scope?.positionId?.toString?.() || raw.scope?.positionId || null,
            employeeId: raw.scope?.employeeId?.toString?.() || raw.scope?.employeeId || null,
        },
        conditions: raw.conditions || {},
        priority: Number(raw.priority || 100),
        version: Number(raw.version || 1),
        steps: [...(raw.steps || [])].sort((a, b) => a.sequence - b.sequence),
        description: raw.description || "",
        status: raw.status,
        effectiveFrom: raw.effectiveFrom,
        effectiveTo: raw.effectiveTo,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

async function findEmployeesByQuery(query, limit = 20) {
    return Employee.find({
        ...query,
        recordStatus: "ACTIVE",
        employmentStatus: "WORKING",
    })
        .sort({ employeeCode: 1 })
        .limit(limit)
        .lean()
}

function sanitizeMatchConfig(match = {}, assignment) {
    const allowedFields = new Set([
        "companyId",
        "branchId",
        "departmentId",
        "lineId",
        "positionId",
        "employeeTypeId",
        "employmentStatus",
        "recordStatus",
    ])

    const query = {}

    for (const [field, value] of Object.entries(match || {})) {
        if (!allowedFields.has(field)) {
            continue
        }

        if (["companyId", "branchId", "departmentId", "lineId", "positionId", "employeeTypeId"].includes(field)) {
            const objectId = toObjectIdOrNull(value)
            if (objectId) {
                query[field] = objectId
            }
            continue
        }

        query[field] = value
    }

    if (!query.companyId && assignment.companyId) {
        query.companyId = assignment.companyId
    }

    return query
}

async function resolveSpecificEmployee(config) {
    const employeeId = config.employeeId || config.approverEmployeeId

    if (!employeeId) {
        return []
    }

    return Employee.find({
        _id: { $in: [employeeId] },
        recordStatus: { $ne: "ARCHIVED" },
    }).lean()
}

async function resolveSpecificEmployees(config) {
    const employeeIds = Array.isArray(config.employeeIds)
        ? config.employeeIds
        : [config.employeeId].filter(Boolean)

    if (employeeIds.length === 0) {
        return []
    }

    return Employee.find({
        _id: { $in: employeeIds },
        recordStatus: { $ne: "ARCHIVED" },
    })
        .sort({ employeeCode: 1 })
        .lean()
}

async function resolvePositionHolder(config, assignment) {
    if (!config.positionId) {
        return []
    }

    const query = {
        companyId: assignment.companyId,
        positionId: config.positionId,
    }

    if (assignment.branchId) {
        query.branchId = assignment.branchId
    }

    if (config.sameDepartment !== false && assignment.departmentId) {
        query.departmentId = assignment.departmentId
    }

    if (config.sameLine === true && assignment.lineId) {
        query.lineId = assignment.lineId
    }

    return findEmployeesByQuery(query, config.limit || 20)
}

async function resolveLineLeader(config, assignment) {
    if (!assignment.lineId) {
        return []
    }

    const line = await Line.findById(assignment.lineId).lean()
    const leaderPositionId = config.positionId || line?.leaderPositionId

    if (!leaderPositionId) {
        return []
    }

    return findEmployeesByQuery(
        {
            companyId: assignment.companyId,
            branchId: assignment.branchId,
            departmentId: assignment.departmentId,
            lineId: assignment.lineId,
            positionId: leaderPositionId,
        },
        config.limit || 20,
    )
}

async function resolveDepartmentManager(config, assignment) {
    if (!assignment.departmentId) {
        return []
    }

    const positions = await Position.find({
        companyId: assignment.companyId,
        branchId: assignment.branchId,
        departmentId: assignment.departmentId,
        isManager: true,
        status: { $ne: "ARCHIVED" },
    })
        .sort({ level: 1, code: 1 })
        .select("_id")
        .lean()

    if (positions.length === 0) {
        return []
    }

    return findEmployeesByQuery(
        {
            companyId: assignment.companyId,
            branchId: assignment.branchId,
            departmentId: assignment.departmentId,
            positionId: { $in: positions.map((item) => item._id) },
        },
        config.limit || 20,
    )
}

async function resolveReportsToPositionChain(config, assignment) {
    if (!assignment.positionId) {
        return []
    }

    const targetLevel = Number(config.level || 1)
    let currentPosition = await Position.findById(assignment.positionId).lean()
    let currentLevel = 0

    while (currentPosition?.reportsToPositionId && currentLevel < targetLevel) {
        currentPosition = await Position.findById(currentPosition.reportsToPositionId).lean()
        currentLevel += 1
    }

    if (!currentPosition?._id || currentLevel < targetLevel) {
        return []
    }

    return findEmployeesByQuery(
        {
            companyId: assignment.companyId,
            branchId: assignment.branchId,
            departmentId: assignment.departmentId,
            positionId: currentPosition._id,
        },
        config.limit || 20,
    )
}

async function resolveRoleHolder(config, assignment) {
    if (!config.roleId) {
        return []
    }

    const accounts = await Account.find({
        status: "ACTIVE",
        "roleAssignments.roleId": config.roleId,
    })
        .select("_id")
        .limit(config.limit || 20)
        .lean()

    if (accounts.length === 0) {
        return []
    }

    const accountIds = accounts.map((account) => account._id)

    return Employee.find({
        companyId: assignment.companyId,
        $or: [
            { accountId: { $in: accountIds } },
            { linkedAccountId: { $in: accountIds } },
        ],
        recordStatus: "ACTIVE",
        employmentStatus: "WORKING",
    })
        .sort({ employeeCode: 1 })
        .limit(config.limit || 20)
        .lean()
}

async function resolveEmployeeQuery(config, assignment) {
    return findEmployeesByQuery(
        sanitizeMatchConfig(config.match || {}, assignment),
        config.limit || 20,
    )
}

async function resolveByKey(resolverKey, resolverConfig, assignment) {
    const normalizedKey = normalizeCode(resolverKey)
    const config = resolverConfig || {}

    if (normalizedKey === "SPECIFIC_EMPLOYEE") {
        return resolveSpecificEmployee(config)
    }

    if (normalizedKey === "SPECIFIC_EMPLOYEES") {
        return resolveSpecificEmployees(config)
    }

    if (normalizedKey === "POSITION_HOLDER") {
        return resolvePositionHolder(config, assignment)
    }

    if (normalizedKey === "LINE_LEADER") {
        return resolveLineLeader(config, assignment)
    }

    if (normalizedKey === "DEPARTMENT_MANAGER") {
        return resolveDepartmentManager(config, assignment)
    }

    if (normalizedKey === "REQUESTER_MANAGER") {
        return resolveReportsToPositionChain({ level: 1, ...config }, assignment)
    }

    if (normalizedKey === "REPORTS_TO_POSITION_CHAIN") {
        return resolveReportsToPositionChain(config, assignment)
    }

    if (normalizedKey === "ROLE_HOLDER") {
        return resolveRoleHolder(config, assignment)
    }

    if (normalizedKey === "EMPLOYEE_QUERY") {
        return resolveEmployeeQuery(config, assignment)
    }

    return []
}

function removeSelfIfNeeded(employees, step, assignment) {
    if (step.allowSelfApproval === true) {
        return employees
    }

    const requesterEmployeeId = assignment.employeeId || assignment._id

    if (!requesterEmployeeId) {
        return employees
    }

    return employees.filter(
        (employee) => !objectIdEqual(employee._id, requesterEmployeeId),
    )
}

function applyAssignmentMode(employees, step) {
    const mode = normalizeCode(step.assignmentMode || "FIRST")

    if (mode === "ALL") {
        return employees
    }

    if (mode === "FIRST") {
        return employees.slice(0, 1)
    }

    if (mode === "ANY") {
        return employees
    }

    return employees.slice(0, 1)
}

export async function findBestApprovalPolicy({ moduleKey, actionKey = "REQUEST", assignment, context = {} }) {
    if (!assignment?.companyId) {
        return null
    }

    const today = new Date()

    const policies = await ApprovalPolicy.find({
        ...buildPolicyFilter({ moduleKey, actionKey, assignment }),
        $or: [
            { effectiveFrom: null },
            { effectiveFrom: { $lte: today } },
        ],
        $and: [
            ...buildPolicyFilter({ moduleKey, actionKey, assignment }).$and,
            {
                $or: [
                    { effectiveTo: null },
                    { effectiveTo: { $gte: today } },
                ],
            },
        ],
    }).lean()

    return policies
        .filter((policy) => conditionsMatch(policy.conditions || {}, context || {}))
        .sort((a, b) => scopeScore(b, assignment) - scopeScore(a, assignment))[0] || null
}

export async function resolveStepApprovers({ step, assignment }) {
    let employees = await resolveByKey(step.resolverKey, step.resolverConfig, assignment)
    employees = removeSelfIfNeeded(employees, step, assignment)

    if (employees.length === 0 && Array.isArray(step.fallbackResolvers)) {
        for (const fallback of step.fallbackResolvers) {
            employees = await resolveByKey(
                fallback.resolverKey,
                fallback.resolverConfig,
                assignment,
            )
            employees = removeSelfIfNeeded(employees, step, assignment)

            if (employees.length > 0) {
                break
            }
        }
    }

    return applyAssignmentMode(employees, step)
}

export async function resolveApprovalByAssignment({ moduleKey, actionKey = "REQUEST", assignment, context = {} }) {
    const policy = await findBestApprovalPolicy({
        moduleKey,
        actionKey,
        assignment,
        context,
    })

    if (!policy) {
        return {
            moduleKey: normalizeCode(moduleKey),
            actionKey: normalizeCode(actionKey),
            policy: null,
            steps: [],
            warnings: ["errors.approval.policy.noPolicyMatched"],
        }
    }

    const steps = []
    const warnings = []

    for (const step of [...(policy.steps || [])].sort((a, b) => a.sequence - b.sequence)) {
        const approvers = await resolveStepApprovers({ step, assignment })

        if (approvers.length === 0 && step.isRequired !== false) {
            warnings.push("errors.approval.policy.requiredApproverMissing")
        }

        steps.push({
            stepCode: step.stepCode,
            stepName: step.stepName,
            sequence: step.sequence,
            approvalMode: normalizeCode(step.approvalMode || "ALL"),
            assignmentMode: normalizeCode(step.assignmentMode || "FIRST"),
            resolverKey: step.resolverKey,
            resolverConfig: step.resolverConfig || {},
            isRequired: step.isRequired !== false,
            canReject: step.canReject !== false,
            canReturn: Boolean(step.canReturn),
            allowSelfApproval: Boolean(step.allowSelfApproval),
            description: step.description || "",
            approvers: approvers.map(serializeEmployeeApprover),
        })
    }

    return {
        moduleKey: normalizeCode(moduleKey),
        actionKey: normalizeCode(actionKey),
        policy: serializePolicy(policy),
        steps,
        warnings: [...new Set(warnings)],
    }
}

export async function resolveApprovalPreview({ query, body }) {
    if (body?.assignment) {
        return resolveApprovalByAssignment({
            moduleKey: body.moduleKey,
            actionKey: body.actionKey,
            assignment: {
                ...body.assignment,
                _id: body.assignment.employeeId || undefined,
            },
            context: body.context || {},
        })
    }

    if (query.employeeId) {
        const employee = await Employee.findOne({
            _id: query.employeeId,
            recordStatus: { $ne: "ARCHIVED" },
        }).lean()

        if (!employee) {
            throw new AppError({
                statusCode: 404,
                code: "EMPLOYEE_NOT_FOUND",
                messageKey: "errors.employee.profile.notFound",
            })
        }

        return resolveApprovalByAssignment({
            moduleKey: query.moduleKey,
            actionKey: query.actionKey,
            assignment: {
                ...employee,
                employeeId: employee._id,
            },
            context: query,
        })
    }

    return resolveApprovalByAssignment({
        moduleKey: query.moduleKey,
        actionKey: query.actionKey,
        assignment: query,
        context: query,
    })
}

export async function validatePolicyScope(scope) {
    if (!scope?.companyId) {
        throw new AppError({
            statusCode: 422,
            code: "APPROVAL_SCOPE_COMPANY_REQUIRED",
            messageKey: "errors.approval.policy.companyRequired",
            fields: { "scope.companyId": ["errors.approval.policy.companyRequired"] },
        })
    }

    const company = await Company.exists({
        _id: scope.companyId,
        status: { $ne: "ARCHIVED" },
    })

    if (!company) {
        throw new AppError({
            statusCode: 422,
            code: "APPROVAL_SCOPE_COMPANY_NOT_FOUND",
            messageKey: "errors.organization.company.notFound",
        })
    }

    if (scope.branchId) {
        const branch = await Branch.exists({
            _id: scope.branchId,
            companyId: scope.companyId,
            status: { $ne: "ARCHIVED" },
        })

        if (!branch) {
            throw new AppError({
                statusCode: 422,
                code: "APPROVAL_SCOPE_BRANCH_NOT_FOUND",
                messageKey: "errors.organization.branch.notFound",
            })
        }
    }

    if ((scope.departmentId || scope.lineId || scope.positionId || scope.employeeId) && !scope.branchId) {
        throw new AppError({
            statusCode: 422,
            code: "APPROVAL_SCOPE_BRANCH_REQUIRED",
            messageKey: "errors.approval.policy.branchRequiredForLowerScope",
        })
    }

    if (scope.departmentId) {
        const department = await Department.exists({
            _id: scope.departmentId,
            companyId: scope.companyId,
            branchId: scope.branchId,
            status: { $ne: "ARCHIVED" },
        })

        if (!department) {
            throw new AppError({
                statusCode: 422,
                code: "APPROVAL_SCOPE_DEPARTMENT_NOT_FOUND",
                messageKey: "errors.organization.department.notFound",
            })
        }
    }

    if (scope.lineId) {
        const line = await Line.exists({
            _id: scope.lineId,
            companyId: scope.companyId,
            branchId: scope.branchId,
            ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
            status: { $ne: "ARCHIVED" },
        })

        if (!line) {
            throw new AppError({
                statusCode: 422,
                code: "APPROVAL_SCOPE_LINE_NOT_FOUND",
                messageKey: "errors.organization.line.notFound",
            })
        }
    }

    if (scope.positionId) {
        const position = await Position.exists({
            _id: scope.positionId,
            companyId: scope.companyId,
            branchId: scope.branchId,
            ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
            status: { $ne: "ARCHIVED" },
        })

        if (!position) {
            throw new AppError({
                statusCode: 422,
                code: "APPROVAL_SCOPE_POSITION_NOT_FOUND",
                messageKey: "errors.organization.position.notFound",
            })
        }
    }

    if (scope.employeeId) {
        const employee = await Employee.exists({
            _id: scope.employeeId,
            companyId: scope.companyId,
            branchId: scope.branchId,
            ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
            ...(scope.lineId ? { lineId: scope.lineId } : {}),
            ...(scope.positionId ? { positionId: scope.positionId } : {}),
            recordStatus: { $ne: "ARCHIVED" },
        })

        if (!employee) {
            throw new AppError({
                statusCode: 422,
                code: "APPROVAL_SCOPE_EMPLOYEE_NOT_FOUND",
                messageKey: "errors.employee.profile.notFound",
            })
        }
    }
}
