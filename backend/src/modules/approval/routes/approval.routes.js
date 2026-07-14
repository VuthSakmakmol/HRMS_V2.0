import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"

import {
    approvalInboxQuerySchema,
    approvalModuleCreateSchema,
    approvalModuleListQuerySchema,
    approvalModuleUpdateSchema,
    approvalPolicyCreateSchema,
    approvalPolicyListQuerySchema,
    approvalPolicyUpdateSchema,
    approvalRequestListQuerySchema,
    approvalRequestStartSchema,
    approvalResolvePreviewBodySchema,
    approvalResolvePreviewQuerySchema,
    approvalTaskDecisionSchema,
    approvalTaskReassignSchema,
    moduleIdParamSchema,
    policyIdParamSchema,
    requestIdParamSchema,
    taskParamSchema,
} from "../schemas/approval.schema.js"

import {
    archiveApprovalModule,
    createApprovalModule,
    listApprovalModules,
    updateApprovalModule,
} from "../services/approvalModule.service.js"

import {
    archiveApprovalPolicy,
    createApprovalPolicy,
    getApprovalPolicyById,
    listApprovalPolicies,
    updateApprovalPolicy,
} from "../services/approvalPolicy.service.js"

import {
    BUILT_IN_RESOLVERS,
    resolveApprovalPreview,
} from "../services/approvalResolver.service.js"

import {
    decideApprovalTask,
    getApprovalRequestById,
    listApprovalInbox,
    listApprovalRequests,
    reassignApprovalTask,
    startApprovalRequest,
} from "../services/approvalWorkflow.service.js"

const router = Router()

const PERMISSIONS = Object.freeze({
    MODULE_VIEW: "APPROVAL.MODULE.VIEW",
    MODULE_CREATE: "APPROVAL.MODULE.CREATE",
    MODULE_UPDATE: "APPROVAL.MODULE.UPDATE",
    MODULE_ARCHIVE: "APPROVAL.MODULE.ARCHIVE",

    POLICY_VIEW: "APPROVAL.POLICY.VIEW",
    POLICY_CREATE: "APPROVAL.POLICY.CREATE",
    POLICY_UPDATE: "APPROVAL.POLICY.UPDATE",
    POLICY_ARCHIVE: "APPROVAL.POLICY.ARCHIVE",
    POLICY_PREVIEW: "APPROVAL.POLICY.PREVIEW",

    WORKFLOW_VIEW: "APPROVAL.WORKFLOW.VIEW",
    WORKFLOW_START: "APPROVAL.WORKFLOW.START",
    WORKFLOW_INBOX: "APPROVAL.WORKFLOW.INBOX",
    WORKFLOW_DECIDE: "APPROVAL.WORKFLOW.DECIDE",
    WORKFLOW_REASSIGN: "APPROVAL.WORKFLOW.REASSIGN",
})

function parseRequest(schema, value) {
    const parsed = schema.safeParse(value)

    if (!parsed.success) {
        throw new AppError({
            statusCode: 422,
            code: "VALIDATION_FAILED",
            messageKey: "errors.validationFailed",
            fields: parsed.error.flatten().fieldErrors,
        })
    }

    return parsed.data
}

router.use(requireAuthentication)

router.get(
    "/modules",
    requirePermission(PERMISSIONS.MODULE_VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(approvalModuleListQuerySchema, req.query)
            const result = await listApprovalModules({ query })

            res.status(200).json({ success: true, data: result })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/modules",
    requirePermission(PERMISSIONS.MODULE_CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(approvalModuleCreateSchema, req.body)
            const module = await createApprovalModule({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({ success: true, data: { module } })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/modules/:moduleId",
    requirePermission(PERMISSIONS.MODULE_UPDATE),
    async (req, res, next) => {
        try {
            const { moduleId } = parseRequest(moduleIdParamSchema, req.params)
            const payload = parseRequest(approvalModuleUpdateSchema, req.body)
            const module = await updateApprovalModule({
                moduleId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({ success: true, data: { module } })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/modules/:moduleId/archive",
    requirePermission(PERMISSIONS.MODULE_ARCHIVE),
    async (req, res, next) => {
        try {
            const { moduleId } = parseRequest(moduleIdParamSchema, req.params)
            const module = await archiveApprovalModule({
                moduleId,
                user: req.auth.user,
            })

            res.status(200).json({ success: true, data: { module } })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/resolver-options",
    requirePermission(PERMISSIONS.POLICY_VIEW),
    async (req, res) => {
        res.status(200).json({
            success: true,
            data: {
                items: BUILT_IN_RESOLVERS,
            },
        })
    },
)

router.get(
    "/policies",
    requirePermission(PERMISSIONS.POLICY_VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(approvalPolicyListQuerySchema, req.query)
            const result = await listApprovalPolicies({ query })

            res.status(200).json({ success: true, data: result })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/policies",
    requirePermission(PERMISSIONS.POLICY_CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(approvalPolicyCreateSchema, req.body)
            const policy = await createApprovalPolicy({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({ success: true, data: { policy } })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/policies/:policyId",
    requirePermission(PERMISSIONS.POLICY_VIEW),
    async (req, res, next) => {
        try {
            const { policyId } = parseRequest(policyIdParamSchema, req.params)
            const policy = await getApprovalPolicyById({ policyId })

            res.status(200).json({ success: true, data: { policy } })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/policies/:policyId",
    requirePermission(PERMISSIONS.POLICY_UPDATE),
    async (req, res, next) => {
        try {
            const { policyId } = parseRequest(policyIdParamSchema, req.params)
            const payload = parseRequest(approvalPolicyUpdateSchema, req.body)
            const policy = await updateApprovalPolicy({
                policyId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({ success: true, data: { policy } })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/policies/:policyId/archive",
    requirePermission(PERMISSIONS.POLICY_ARCHIVE),
    async (req, res, next) => {
        try {
            const { policyId } = parseRequest(policyIdParamSchema, req.params)
            const policy = await archiveApprovalPolicy({
                policyId,
                user: req.auth.user,
            })

            res.status(200).json({ success: true, data: { policy } })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/resolve-preview",
    requirePermission(PERMISSIONS.POLICY_PREVIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(approvalResolvePreviewQuerySchema, req.query)
            const preview = await resolveApprovalPreview({ query })

            res.status(200).json({ success: true, data: { preview } })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/resolve-preview",
    requirePermission(PERMISSIONS.POLICY_PREVIEW),
    async (req, res, next) => {
        try {
            const body = parseRequest(approvalResolvePreviewBodySchema, req.body)
            const preview = await resolveApprovalPreview({ body })

            res.status(200).json({ success: true, data: { preview } })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/requests",
    requirePermission(PERMISSIONS.WORKFLOW_VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(approvalRequestListQuerySchema, req.query)
            const result = await listApprovalRequests({ query })

            res.status(200).json({ success: true, data: result })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/requests/start",
    requirePermission(PERMISSIONS.WORKFLOW_START),
    async (req, res, next) => {
        try {
            const payload = parseRequest(approvalRequestStartSchema, req.body)
            const request = await startApprovalRequest({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({ success: true, data: { request } })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/requests/:requestId",
    requirePermission(PERMISSIONS.WORKFLOW_VIEW),
    async (req, res, next) => {
        try {
            const { requestId } = parseRequest(requestIdParamSchema, req.params)
            const request = await getApprovalRequestById({ requestId })

            res.status(200).json({ success: true, data: { request } })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/tasks/inbox",
    requirePermission(PERMISSIONS.WORKFLOW_INBOX),
    async (req, res, next) => {
        try {
            const query = parseRequest(approvalInboxQuerySchema, req.query)
            const result = await listApprovalInbox({ query })

            res.status(200).json({ success: true, data: result })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/requests/:requestId/tasks/:taskId/decision",
    requirePermission(PERMISSIONS.WORKFLOW_DECIDE),
    async (req, res, next) => {
        try {
            const params = parseRequest(taskParamSchema, req.params)
            const payload = parseRequest(approvalTaskDecisionSchema, req.body)
            const request = await decideApprovalTask({
                ...params,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({ success: true, data: { request } })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/requests/:requestId/tasks/:taskId/reassign",
    requirePermission(PERMISSIONS.WORKFLOW_REASSIGN),
    async (req, res, next) => {
        try {
            const params = parseRequest(taskParamSchema, req.params)
            const payload = parseRequest(approvalTaskReassignSchema, req.body)
            const request = await reassignApprovalTask({
                ...params,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({ success: true, data: { request } })
        } catch (error) {
            next(error)
        }
    },
)

export default router
