import { Router } from "express"
import multer from "multer"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js"
import { validateRequest } from "../../../shared/middleware/validateRequest.js"
import {
    archiveDepartmentController,
    createDepartmentController,
    downloadDepartmentImportTemplateController,
    exportDepartmentsController,
    getDepartmentController,
    importDepartmentsController,
    listDepartmentsController,
    lookupDepartmentsController,
    updateDepartmentController,
} from "../controllers/department.controller.js"
import {
    departmentCreateSchema,
    departmentIdParamSchema,
    departmentListQuerySchema,
    departmentUpdateSchema,
} from "../schemas/department.schema.js"

const router = Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
})

const PERMISSIONS = Object.freeze({
    LOOKUP: "ORGANIZATION.DEPARTMENT.LOOKUP",
    VIEW: "ORGANIZATION.DEPARTMENT.VIEW",
    CREATE: "ORGANIZATION.DEPARTMENT.CREATE",
    UPDATE: "ORGANIZATION.DEPARTMENT.UPDATE",
    ARCHIVE: "ORGANIZATION.DEPARTMENT.ARCHIVE",
    IMPORT: "ORGANIZATION.DEPARTMENT.IMPORT",
    EXPORT: "ORGANIZATION.DEPARTMENT.EXPORT",
})

router.use(requireAuthentication)

router.get(
    "/lookup",
    requirePermission(PERMISSIONS.LOOKUP),
    validateRequest({
        query: departmentListQuerySchema,
    }),
    asyncHandler(lookupDepartmentsController),
)

router.get(
    "/import-template",
    requirePermission(PERMISSIONS.EXPORT),
    asyncHandler(downloadDepartmentImportTemplateController),
)

router.get(
    "/export",
    requirePermission(PERMISSIONS.EXPORT),
    validateRequest({
        query: departmentListQuerySchema,
    }),
    asyncHandler(exportDepartmentsController),
)

router.post(
    "/import",
    requirePermission(PERMISSIONS.IMPORT),
    upload.single("file"),
    asyncHandler(importDepartmentsController),
)

router.get(
    "/",
    requirePermission(PERMISSIONS.VIEW),
    validateRequest({
        query: departmentListQuerySchema,
    }),
    asyncHandler(listDepartmentsController),
)

router.post(
    "/",
    requirePermission(PERMISSIONS.CREATE),
    validateRequest({
        body: departmentCreateSchema,
    }),
    asyncHandler(createDepartmentController),
)

router.get(
    "/:departmentId",
    requirePermission(PERMISSIONS.VIEW),
    validateRequest({
        params: departmentIdParamSchema,
    }),
    asyncHandler(getDepartmentController),
)

router.patch(
    "/:departmentId",
    requirePermission(PERMISSIONS.UPDATE),
    validateRequest({
        params: departmentIdParamSchema,
        body: departmentUpdateSchema,
    }),
    asyncHandler(updateDepartmentController),
)

router.patch(
    "/:departmentId/archive",
    requirePermission(PERMISSIONS.ARCHIVE),
    validateRequest({
        params: departmentIdParamSchema,
    }),
    asyncHandler(archiveDepartmentController),
)

export default router
