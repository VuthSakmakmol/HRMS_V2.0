import { Router } from "express"
import multer from "multer"
import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import {
    archiveEmployeeTypeController,
    createEmployeeTypeController,
    downloadEmployeeTypeImportTemplateController,
    exportEmployeeTypesController,
    getEmployeeTypeController,
    getEmployeeTypeImportJobController,
    importEmployeeTypesController,
    listEmployeeTypesController,
    listEmployeeTypeDashboardCategoriesController,
    startEmployeeTypeImportJobController,
    updateEmployeeTypeController,
} from "../controllers/employeeType.controller.js"
import {
    employeeTypeCreateSchema,
    employeeTypeIdParamSchema,
    employeeTypeListQuerySchema,
    employeeTypeUpdateSchema,
} from "../schemas/employeeType.schema.js"
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js"
import { validateRequest } from "../../../shared/middleware/validateRequest.js"

const router = Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter(req, file, callback) {
        const allowed = new Set([
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        ])
        return allowed.has(file.mimetype)
            ? callback(null, true)
            : callback(new Error("Only Excel .xlsx or .xls files are allowed."))
    },
})

export const EMPLOYEE_TYPE_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.EMPLOYEE_TYPE.VIEW",
    CREATE: "ORGANIZATION.EMPLOYEE_TYPE.CREATE",
    UPDATE: "ORGANIZATION.EMPLOYEE_TYPE.UPDATE",
    ARCHIVE: "ORGANIZATION.EMPLOYEE_TYPE.ARCHIVE",
    IMPORT: "ORGANIZATION.EMPLOYEE_TYPE.IMPORT",
    EXPORT: "ORGANIZATION.EMPLOYEE_TYPE.EXPORT",
})

router.use(requireAuthentication)
router.get("/dashboard-categories", requirePermission(EMPLOYEE_TYPE_PERMISSIONS.VIEW), asyncHandler(listEmployeeTypeDashboardCategoriesController))
router.get("/import-template", requirePermission(EMPLOYEE_TYPE_PERMISSIONS.VIEW), asyncHandler(downloadEmployeeTypeImportTemplateController))
router.get("/export", requirePermission(EMPLOYEE_TYPE_PERMISSIONS.EXPORT), validateRequest({ query: employeeTypeListQuerySchema }), asyncHandler(exportEmployeeTypesController))
router.post("/import-jobs", requirePermission(EMPLOYEE_TYPE_PERMISSIONS.IMPORT), upload.single("file"), asyncHandler(startEmployeeTypeImportJobController))
router.get("/import-jobs/:jobId", requirePermission(EMPLOYEE_TYPE_PERMISSIONS.IMPORT), asyncHandler(getEmployeeTypeImportJobController))
router.post("/import", requirePermission(EMPLOYEE_TYPE_PERMISSIONS.IMPORT), upload.single("file"), asyncHandler(importEmployeeTypesController))
router.get("/", requirePermission(EMPLOYEE_TYPE_PERMISSIONS.VIEW), validateRequest({ query: employeeTypeListQuerySchema }), asyncHandler(listEmployeeTypesController))
router.post("/", requirePermission(EMPLOYEE_TYPE_PERMISSIONS.CREATE), validateRequest({ body: employeeTypeCreateSchema }), asyncHandler(createEmployeeTypeController))
router.get("/:employeeTypeId", requirePermission(EMPLOYEE_TYPE_PERMISSIONS.VIEW), validateRequest({ params: employeeTypeIdParamSchema }), asyncHandler(getEmployeeTypeController))
router.patch("/:employeeTypeId", requirePermission(EMPLOYEE_TYPE_PERMISSIONS.UPDATE), validateRequest({ params: employeeTypeIdParamSchema, body: employeeTypeUpdateSchema }), asyncHandler(updateEmployeeTypeController))
router.patch("/:employeeTypeId/archive", requirePermission(EMPLOYEE_TYPE_PERMISSIONS.ARCHIVE), validateRequest({ params: employeeTypeIdParamSchema }), asyncHandler(archiveEmployeeTypeController))
export default router
