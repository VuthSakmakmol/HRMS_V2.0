import { Router } from "express"
import multer from "multer"

import { requireAuthentication, requirePermission } from "../../access/middleware/auth.middleware.js"
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js"
import { validateRequest } from "../../../shared/middleware/validateRequest.js"
import {
    archiveEmployeeController,
    createEmployeeController,
    downloadEmployeeImportTemplateController,
    exportEmployeesController,
    getEmployeeApprovalPreviewController,
    getEmployeeController,
    getEmployeeImportJobController,
    importEmployeesController,
    listEmployeesController,
    startEmployeeImportJobController,
    updateEmployeeController,
} from "../controllers/employee.controller.js"
import {
    employeeApprovalPreviewQuerySchema,
    employeeCreateSchema,
    employeeIdParamSchema,
    employeeImportQuerySchema,
    employeeListQuerySchema,
    employeeUpdateSchema,
} from "../schemas/employee.schema.js"

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } })

const EMPLOYEE_PERMISSIONS = Object.freeze({
    VIEW: "EMPLOYEE.PROFILE.VIEW",
    CREATE: "EMPLOYEE.PROFILE.CREATE",
    UPDATE: "EMPLOYEE.PROFILE.UPDATE",
    ARCHIVE: "EMPLOYEE.PROFILE.ARCHIVE",
    IMPORT: "EMPLOYEE.PROFILE.IMPORT",
    EXPORT: "EMPLOYEE.PROFILE.EXPORT",
})

router.use(requireAuthentication)
router.get("/approval-preview", requirePermission(EMPLOYEE_PERMISSIONS.VIEW), validateRequest({ query: employeeApprovalPreviewQuerySchema }), asyncHandler(getEmployeeApprovalPreviewController))
router.get("/import-template", requirePermission(EMPLOYEE_PERMISSIONS.VIEW), asyncHandler(downloadEmployeeImportTemplateController))
router.get("/export", requirePermission(EMPLOYEE_PERMISSIONS.EXPORT), validateRequest({ query: employeeListQuerySchema }), asyncHandler(exportEmployeesController))
router.post("/import-jobs", requirePermission(EMPLOYEE_PERMISSIONS.IMPORT), upload.single("file"), validateRequest({ query: employeeImportQuerySchema }), asyncHandler(startEmployeeImportJobController))
router.get("/import-jobs/:jobId", requirePermission(EMPLOYEE_PERMISSIONS.IMPORT), asyncHandler(getEmployeeImportJobController))
router.post("/import", requirePermission(EMPLOYEE_PERMISSIONS.IMPORT), upload.single("file"), validateRequest({ query: employeeImportQuerySchema }), asyncHandler(importEmployeesController))
router.get("/", requirePermission(EMPLOYEE_PERMISSIONS.VIEW), validateRequest({ query: employeeListQuerySchema }), asyncHandler(listEmployeesController))
router.post("/", requirePermission(EMPLOYEE_PERMISSIONS.CREATE), validateRequest({ body: employeeCreateSchema }), asyncHandler(createEmployeeController))
router.get("/:employeeId", requirePermission(EMPLOYEE_PERMISSIONS.VIEW), validateRequest({ params: employeeIdParamSchema }), asyncHandler(getEmployeeController))
router.patch("/:employeeId", requirePermission(EMPLOYEE_PERMISSIONS.UPDATE), validateRequest({ params: employeeIdParamSchema, body: employeeUpdateSchema }), asyncHandler(updateEmployeeController))
router.patch("/:employeeId/archive", requirePermission(EMPLOYEE_PERMISSIONS.ARCHIVE), validateRequest({ params: employeeIdParamSchema }), asyncHandler(archiveEmployeeController))

export default router
