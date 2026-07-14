import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import {
    archiveCompanyController,
    createCompanyController,
    getCompanyController,
    listCompaniesController,
    lookupCompaniesController,
    updateCompanyController,
} from "../controllers/company.controller.js"
import {
    companyCreateSchema,
    companyIdParamSchema,
    companyListQuerySchema,
    companyUpdateSchema,
} from "../schemas/company.schema.js"
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js"
import { validateRequest } from "../../../shared/middleware/validateRequest.js"

const router = Router()

const COMPANY_PERMISSIONS = Object.freeze({
    LOOKUP: "ORGANIZATION.COMPANY.LOOKUP",
    VIEW: "ORGANIZATION.COMPANY.VIEW",
    CREATE: "ORGANIZATION.COMPANY.CREATE",
    UPDATE: "ORGANIZATION.COMPANY.UPDATE",
    ARCHIVE: "ORGANIZATION.COMPANY.ARCHIVE",
})

router.use(requireAuthentication)

router.get(
    "/lookup",
    requirePermission(COMPANY_PERMISSIONS.LOOKUP),
    validateRequest({ query: companyListQuerySchema }),
    asyncHandler(lookupCompaniesController),
)

router.get(
    "/",
    requirePermission(COMPANY_PERMISSIONS.VIEW),
    validateRequest({ query: companyListQuerySchema }),
    asyncHandler(listCompaniesController),
)

router.post(
    "/",
    requirePermission(COMPANY_PERMISSIONS.CREATE),
    validateRequest({ body: companyCreateSchema }),
    asyncHandler(createCompanyController),
)

router.get(
    "/:companyId",
    requirePermission(COMPANY_PERMISSIONS.VIEW),
    validateRequest({ params: companyIdParamSchema }),
    asyncHandler(getCompanyController),
)

router.patch(
    "/:companyId",
    requirePermission(COMPANY_PERMISSIONS.UPDATE),
    validateRequest({
        params: companyIdParamSchema,
        body: companyUpdateSchema,
    }),
    asyncHandler(updateCompanyController),
)

router.patch(
    "/:companyId/archive",
    requirePermission(COMPANY_PERMISSIONS.ARCHIVE),
    validateRequest({ params: companyIdParamSchema }),
    asyncHandler(archiveCompanyController),
)

export default router
