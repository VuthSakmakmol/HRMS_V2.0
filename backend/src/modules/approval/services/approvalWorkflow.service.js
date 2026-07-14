import { Types } from "mongoose"

import { AppError } from "../../../shared/errors/AppError.js"

import Employee from "../../employee/models/Employee.js"
import ApprovalRequest from "../models/ApprovalRequest.js"

import {
    resolveApprovalByAssignment,
    serializePolicy,
} from "./approvalResolver.service.js"
import ApprovalPolicy from "../models/ApprovalPolicy.js"

function normalizeCode(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase()
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function objectIdString(value) {
    return value?._id?.toString?.() || value?.id || value?.toString?.() || null
}

function serializeTask(task) {
    return {
        id: objectIdString(task._id),
        stepCode: task.stepCode,
        stepName: task.stepName,
        sequence: task.sequence,
        approvalMode: task.approvalMode,
        approverEmployeeId: objectIdString(task.approverEmployeeId),
        originalApproverEmployeeId: objectIdString(task.originalApproverEmployeeId),
        status: task.status,
        decisionByAccountId: objectIdString(task.decisionByAccountId),
        decisionByEmployeeId: objectIdString(task.decisionByEmployeeId),
        decisionAt: task.decisionAt,
        note: task.note || "",
        reassignedByAccountId: objectIdString(task.reassignedByAccountId),
        reassignedAt: task.reassignedAt,
        reassignmentReason: task.reassignmentReason || "",
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
    }
}

function serializeRequest(request) {
    if (!request) {
        return null
    }

    const raw = typeof request.toJSON === "function" ? request.toJSON() : { ...request }

    return {
        id: objectIdString(raw._id),
        moduleKey: raw.moduleKey,
        actionKey: raw.actionKey,
        subjectType: raw.subjectType,
        subjectId: objectIdString(raw.subjectId),
        title: raw.title || "",
        requesterEmployeeId: objectIdString(raw.requesterEmployeeId),
        requesterAccountId: objectIdString(raw.requesterAccountId),
        companyId: objectIdString(raw.companyId),
        branchId: objectIdString(raw.branchId),
        departmentId: objectIdString(raw.departmentId),
        lineId: objectIdString(raw.lineId),
        positionId: objectIdString(raw.positionId),
        policyId: objectIdString(raw.policyId),
        policyVersion: Number(raw.policyVersion || 1),
        policySnapshot: raw.policySnapshot || null,
        contextSnapshot: raw.contextSnapshot || {},
        tasks: (raw.tasks || []).map(serializeTask),
        status: raw.status,
        currentSequence: Number(raw.currentSequence || 1),
        completedAt: raw.completedAt,
        finalDecisionByAccountId: objectIdString(raw.finalDecisionByAccountId),
        finalDecisionAt: raw.finalDecisionAt,
        metadata: raw.metadata || {},
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

function buildSearchFilter(search) {
    const keyword = String(search || "").trim()

    if (!keyword) {
        return {}
    }

    const regex = new RegExp(escapeRegExp(keyword), "i")

    return {
        $or: [
            { moduleKey: regex },
            { actionKey: regex },
            { subjectType: regex },
            { title: regex },
        ],
    }
}

function buildRequestFilter(query) {
    const filter = {
        ...buildSearchFilter(query.search),
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    if (query.moduleKey) {
        filter.moduleKey = normalizeCode(query.moduleKey)
    }

    if (query.actionKey) {
        filter.actionKey = normalizeCode(query.actionKey)
    }

    if (query.companyId) {
        filter.companyId = query.companyId
    }

    if (query.branchId) {
        filter.branchId = query.branchId
    }

    return filter
}

async function getPolicyFull(policyId) {
    const policy = await ApprovalPolicy.findById(policyId).lean()

    if (!policy) {
        throw new AppError({
            statusCode: 404,
            code: "APPROVAL_POLICY_NOT_FOUND",
            messageKey: "errors.approval.policy.notFound",
        })
    }

    return policy
}

function buildTasksFromPreview(preview) {
    const tasks = []
    const firstSequence = preview.steps?.[0]?.sequence || 1

    for (const step of preview.steps || []) {
        for (const approver of step.approvers || []) {
            tasks.push({
                stepCode: step.stepCode,
                stepName: step.stepName,
                sequence: step.sequence,
                approvalMode: normalizeCode(step.approvalMode || "ALL"),
                approverEmployeeId: approver.id,
                originalApproverEmployeeId: approver.id,
                status: step.sequence === firstSequence ? "PENDING" : "WAITING",
            })
        }
    }

    return tasks
}

function ensureRequiredApprovers(preview, allowMissingOptionalApprovers) {
    const missingRequiredStep = (preview.steps || []).find((step) => {
        return step.isRequired !== false && (!step.approvers || step.approvers.length === 0)
    })

    if (missingRequiredStep) {
        throw new AppError({
            statusCode: 422,
            code: "APPROVAL_REQUIRED_APPROVER_MISSING",
            messageKey: "errors.approval.policy.requiredApproverMissing",
            fields: {
                steps: ["errors.approval.policy.requiredApproverMissing"],
            },
        })
    }

    if (!allowMissingOptionalApprovers) {
        const missingAnyStep = (preview.steps || []).find((step) => {
            return !step.approvers || step.approvers.length === 0
        })

        if (missingAnyStep) {
            throw new AppError({
                statusCode: 422,
                code: "APPROVAL_APPROVER_MISSING",
                messageKey: "errors.approval.policy.approverMissing",
            })
        }
    }
}

export async function listApprovalRequests({ query }) {
    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit
    const filter = buildRequestFilter(query)

    const [items, total] = await Promise.all([
        ApprovalRequest.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        ApprovalRequest.countDocuments(filter),
    ])

    return {
        items: items.map(serializeRequest),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        },
    }
}

export async function getApprovalRequestById({ requestId }) {
    const request = await ApprovalRequest.findById(requestId).lean()

    if (!request) {
        throw new AppError({
            statusCode: 404,
            code: "APPROVAL_REQUEST_NOT_FOUND",
            messageKey: "errors.approval.request.notFound",
        })
    }

    return serializeRequest(request)
}

export async function startApprovalRequest({ payload, user }) {
    const assignment = {
        ...payload.assignment,
        employeeId: payload.assignment.employeeId || payload.requesterEmployeeId,
        _id: payload.assignment.employeeId || payload.requesterEmployeeId,
    }

    const preview = await resolveApprovalByAssignment({
        moduleKey: payload.moduleKey,
        actionKey: payload.actionKey,
        assignment,
        context: payload.context || {},
    })

    if (!preview.policy) {
        throw new AppError({
            statusCode: 422,
            code: "APPROVAL_POLICY_NOT_MATCHED",
            messageKey: "errors.approval.policy.noPolicyMatched",
        })
    }

    ensureRequiredApprovers(preview, payload.allowMissingOptionalApprovers)

    const policy = await getPolicyFull(preview.policy.id)
    const tasks = buildTasksFromPreview(preview)

    if (tasks.length === 0) {
        throw new AppError({
            statusCode: 422,
            code: "APPROVAL_NO_TASK_CREATED",
            messageKey: "errors.approval.request.noTaskCreated",
        })
    }

    const request = await ApprovalRequest.create({
        moduleKey: normalizeCode(payload.moduleKey),
        actionKey: normalizeCode(payload.actionKey || "REQUEST"),
        subjectType: normalizeCode(payload.subjectType),
        subjectId: payload.subjectId,
        title: payload.title || "",
        requesterEmployeeId: payload.requesterEmployeeId || null,
        requesterAccountId: user.accountId,
        companyId: assignment.companyId,
        branchId: assignment.branchId || null,
        departmentId: assignment.departmentId || null,
        lineId: assignment.lineId || null,
        positionId: assignment.positionId || null,
        policyId: policy._id,
        policyVersion: policy.version,
        policySnapshot: serializePolicy(policy),
        contextSnapshot: payload.context || {},
        tasks,
        status: "PENDING",
        currentSequence: Math.min(...tasks.map((task) => task.sequence)),
        metadata: payload.metadata || {},
        createdByAccountId: user.accountId,
        updatedByAccountId: user.accountId,
    })

    return serializeRequest(request)
}

export async function listApprovalInbox({ query }) {
    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const taskFilter = {
        "tasks.approverEmployeeId": query.employeeId,
    }

    if (query.status !== "ALL") {
        taskFilter["tasks.status"] = query.status
    }

    const [items, total] = await Promise.all([
        ApprovalRequest.find(taskFilter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        ApprovalRequest.countDocuments(taskFilter),
    ])

    return {
        items: items.map(serializeRequest),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        },
    }
}

function getTaskOrThrow(request, taskId) {
    const task = request.tasks.id(taskId)

    if (!task) {
        throw new AppError({
            statusCode: 404,
            code: "APPROVAL_TASK_NOT_FOUND",
            messageKey: "errors.approval.task.notFound",
        })
    }

    return task
}

function sameSequenceTasks(request, sequence) {
    return request.tasks.filter((task) => Number(task.sequence) === Number(sequence))
}

function activateNextSequenceOrFinish(request) {
    const pendingOrWaitingTasks = request.tasks.filter((task) =>
        ["WAITING", "PENDING"].includes(task.status),
    )

    if (pendingOrWaitingTasks.length === 0) {
        request.status = "APPROVED"
        request.completedAt = new Date()
        request.finalDecisionAt = new Date()
        return
    }

    const nextSequence = Math.min(...pendingOrWaitingTasks.map((task) => task.sequence))
    request.currentSequence = nextSequence

    for (const task of request.tasks) {
        if (Number(task.sequence) === Number(nextSequence) && task.status === "WAITING") {
            task.status = "PENDING"
        }
    }
}

function completeStepIfReady(request, sequence) {
    const tasks = sameSequenceTasks(request, sequence)
    const activeTasks = tasks.filter((task) => !["CANCELED", "SKIPPED", "REASSIGNED"].includes(task.status))
    const approvalMode = normalizeCode(activeTasks[0]?.approvalMode || "ALL")

    if (approvalMode === "ANY") {
        const hasApproved = activeTasks.some((task) => task.status === "APPROVED")

        if (!hasApproved) {
            return
        }

        for (const task of activeTasks) {
            if (task.status === "PENDING") {
                task.status = "SKIPPED"
                task.note = task.note || "Skipped because another approver approved this ANY step."
            }
        }

        activateNextSequenceOrFinish(request)
        return
    }

    const allApproved = activeTasks.every((task) => task.status === "APPROVED")

    if (allApproved) {
        activateNextSequenceOrFinish(request)
    }
}

export async function decideApprovalTask({ requestId, taskId, payload, user }) {
    const request = await ApprovalRequest.findById(requestId)

    if (!request) {
        throw new AppError({
            statusCode: 404,
            code: "APPROVAL_REQUEST_NOT_FOUND",
            messageKey: "errors.approval.request.notFound",
        })
    }

    if (request.status !== "PENDING") {
        throw new AppError({
            statusCode: 409,
            code: "APPROVAL_REQUEST_NOT_PENDING",
            messageKey: "errors.approval.request.notPending",
        })
    }

    const task = getTaskOrThrow(request, taskId)

    if (task.status !== "PENDING") {
        throw new AppError({
            statusCode: 409,
            code: "APPROVAL_TASK_NOT_PENDING",
            messageKey: "errors.approval.task.notPending",
        })
    }

    if (objectIdString(task.approverEmployeeId) !== payload.actorEmployeeId) {
        throw new AppError({
            statusCode: 403,
            code: "APPROVAL_TASK_NOT_ASSIGNED_TO_ACTOR",
            messageKey: "errors.approval.task.notAssignedToActor",
        })
    }

    const decision = normalizeCode(payload.decision)
    const now = new Date()

    task.decisionByAccountId = user.accountId
    task.decisionByEmployeeId = payload.actorEmployeeId
    task.decisionAt = now
    task.note = payload.note || ""

    if (decision === "APPROVE") {
        task.status = "APPROVED"
        completeStepIfReady(request, task.sequence)
    }

    if (decision === "REJECT") {
        task.status = "REJECTED"
        request.status = "REJECTED"
        request.completedAt = now
        request.finalDecisionAt = now
        request.finalDecisionByAccountId = user.accountId

        for (const item of request.tasks) {
            if (["WAITING", "PENDING"].includes(item.status)) {
                item.status = "CANCELED"
            }
        }
    }

    if (decision === "RETURN") {
        task.status = "RETURNED"
        request.status = "RETURNED"
        request.completedAt = now
        request.finalDecisionAt = now
        request.finalDecisionByAccountId = user.accountId

        for (const item of request.tasks) {
            if (["WAITING", "PENDING"].includes(item.status)) {
                item.status = "CANCELED"
            }
        }
    }

    request.updatedByAccountId = user.accountId
    await request.save()

    return getApprovalRequestById({ requestId })
}

export async function reassignApprovalTask({ requestId, taskId, payload, user }) {
    if (!Types.ObjectId.isValid(payload.toEmployeeId)) {
        throw new AppError({
            statusCode: 422,
            code: "APPROVAL_REASSIGN_INVALID_EMPLOYEE",
            messageKey: "errors.employee.profile.invalidId",
        })
    }

    const [request, employee] = await Promise.all([
        ApprovalRequest.findById(requestId),
        Employee.findOne({
            _id: payload.toEmployeeId,
            recordStatus: "ACTIVE",
            employmentStatus: "WORKING",
        }).lean(),
    ])

    if (!request) {
        throw new AppError({
            statusCode: 404,
            code: "APPROVAL_REQUEST_NOT_FOUND",
            messageKey: "errors.approval.request.notFound",
        })
    }

    if (!employee) {
        throw new AppError({
            statusCode: 404,
            code: "APPROVAL_REASSIGN_EMPLOYEE_NOT_FOUND",
            messageKey: "errors.employee.profile.notFound",
        })
    }

    const task = getTaskOrThrow(request, taskId)

    if (!["WAITING", "PENDING"].includes(task.status)) {
        throw new AppError({
            statusCode: 409,
            code: "APPROVAL_TASK_CANNOT_REASSIGN",
            messageKey: "errors.approval.task.cannotReassign",
        })
    }

    task.originalApproverEmployeeId = task.originalApproverEmployeeId || task.approverEmployeeId
    task.approverEmployeeId = payload.toEmployeeId
    task.reassignedByAccountId = user.accountId
    task.reassignedAt = new Date()
    task.reassignmentReason = payload.reason
    request.updatedByAccountId = user.accountId

    await request.save()

    return getApprovalRequestById({ requestId })
}
