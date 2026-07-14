import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import {
    archiveBranchController,
    createBranchController,
    getBranchController,
    listBranchesController,
    lookupBranchesController,
    updateBranchController,
} from "../controllers/branch.controller.js"
import {
    branchCreateSchema,
    branchIdParamSchema,
    branchListQuerySchema,
    branchUpdateSchema,
} from "../schemas/branch.schema.js"
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js"
import { validateRequest } from "../../../shared/middleware/validateRequest.js"

const router = Router()

const BRANCH_PERMISSIONS = Object.freeze({
    LOOKUP: "ORGANIZATION.BRANCH.LOOKUP",
    VIEW: "ORGANIZATION.BRANCH.VIEW",
    CREATE: "ORGANIZATION.BRANCH.CREATE",
    UPDATE: "ORGANIZATION.BRANCH.UPDATE",
    ARCHIVE: "ORGANIZATION.BRANCH.ARCHIVE",
})

router.use(requireAuthentication)

router.get(
    "/lookup",
    requirePermission(BRANCH_PERMISSIONS.LOOKUP),
    validateRequest({ query: branchListQuerySchema }),
    asyncHandler(lookupBranchesController),
)

router.get(
    "/",
    requirePermission(BRANCH_PERMISSIONS.VIEW),
    validateRequest({ query: branchListQuerySchema }),
    asyncHandler(listBranchesController),
)

router.post(
    "/",
    requirePermission(BRANCH_PERMISSIONS.CREATE),
    validateRequest({ body: branchCreateSchema }),
    asyncHandler(createBranchController),
)

router.get(
    "/:branchId",
    requirePermission(BRANCH_PERMISSIONS.VIEW),
    validateRequest({ params: branchIdParamSchema }),
    asyncHandler(getBranchController),
)

router.patch(
    "/:branchId",
    requirePermission(BRANCH_PERMISSIONS.UPDATE),
    validateRequest({
        params: branchIdParamSchema,
        body: branchUpdateSchema,
    }),
    asyncHandler(updateBranchController),
)

router.patch(
    "/:branchId/archive",
    requirePermission(BRANCH_PERMISSIONS.ARCHIVE),
    validateRequest({ params: branchIdParamSchema }),
    asyncHandler(archiveBranchController),
)

export default router
