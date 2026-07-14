import { sendList, sendSuccess } from "../../../shared/http/response.js"
import { writeAuditLog } from "../../audit/services/audit.service.js"
import {
    archiveBranch,
    createBranch,
    getBranchById,
    listBranches,
    lookupBranches,
    updateBranch,
} from "../services/branch.service.js"

export async function listBranchesController(req, res) {
    const result = await listBranches({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendList(req, res, result)
}

export async function lookupBranchesController(req, res) {
    const items = await lookupBranches({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: { items },
    })
}

export async function getBranchController(req, res) {
    const branch = await getBranchById({
        branchId: req.validatedParams.branchId,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: { branch },
    })
}

export async function createBranchController(req, res) {
    const branch = await createBranch({
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.BRANCH",
        action: "CREATE",
        entityType: "Branch",
        entityId: branch.id,
        after: branch,
    })

    return sendSuccess(req, res, {
        statusCode: 201,
        data: { branch },
        messageKey: "messages.organization.branch.created",
    })
}

export async function updateBranchController(req, res) {
    const branchId = req.validatedParams.branchId
    const before = await getBranchById({
        branchId,
        user: req.auth.user,
    })

    const branch = await updateBranch({
        branchId,
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.BRANCH",
        action: "UPDATE",
        entityType: "Branch",
        entityId: branch.id,
        before,
        after: branch,
    })

    return sendSuccess(req, res, {
        data: { branch },
        messageKey: "messages.organization.branch.updated",
    })
}

export async function archiveBranchController(req, res) {
    const branchId = req.validatedParams.branchId
    const before = await getBranchById({
        branchId,
        user: req.auth.user,
    })

    const branch = await archiveBranch({
        branchId,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.BRANCH",
        action: "ARCHIVE",
        entityType: "Branch",
        entityId: branch.id,
        before,
        after: branch,
    })

    return sendSuccess(req, res, {
        data: { branch },
        messageKey: "messages.organization.branch.archived",
    })
}
