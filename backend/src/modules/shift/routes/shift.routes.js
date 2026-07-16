import { Router } from "express"
import multer from "multer"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import {
    archiveShiftController,
    createShiftController,
    downloadShiftImportTemplateController,
    exportShiftsController,
    getShiftController,
    getShiftImportJobController,
    importShiftsController,
    startShiftImportJobController,
    listShiftsController,
    lookupShiftsController,
    updateShiftController,
} from "../controllers/shift.controller.js"
import {
    shiftCreateSchema,
    shiftIdParamSchema,
    shiftListQuerySchema,
    shiftUpdateSchema,
} from "../schemas/shift.schema.js"
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js"
import { validateRequest } from "../../../shared/middleware/validateRequest.js"

const router = Router()

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
    },
    fileFilter(req, file, callback) {
        const allowedMimeTypes = new Set([
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        ])

        if (!allowedMimeTypes.has(file.mimetype)) {
            return callback(
                new Error("Only Excel .xlsx or .xls files are allowed."),
            )
        }

        return callback(null, true)
    },
})

const SHIFT_PERMISSIONS = Object.freeze({
    LOOKUP: "ORGANIZATION.SHIFT.LOOKUP",
    VIEW: "ORGANIZATION.SHIFT.VIEW",
    CREATE: "ORGANIZATION.SHIFT.CREATE",
    UPDATE: "ORGANIZATION.SHIFT.UPDATE",
    ARCHIVE: "ORGANIZATION.SHIFT.ARCHIVE",
    IMPORT: "ORGANIZATION.SHIFT.IMPORT",
    EXPORT: "ORGANIZATION.SHIFT.EXPORT",
})

router.use(requireAuthentication)

router.get(
    "/lookup",
    requirePermission(SHIFT_PERMISSIONS.LOOKUP),
    validateRequest({ query: shiftListQuerySchema }),
    asyncHandler(lookupShiftsController),
)

router.get(
    "/import-template",
    requirePermission(SHIFT_PERMISSIONS.VIEW),
    asyncHandler(downloadShiftImportTemplateController),
)

router.get(
    "/export",
    requirePermission(SHIFT_PERMISSIONS.EXPORT),
    validateRequest({ query: shiftListQuerySchema }),
    asyncHandler(exportShiftsController),
)

router.post(
    "/import-jobs",
    requirePermission(SHIFT_PERMISSIONS.IMPORT),
    upload.single("file"),
    asyncHandler(startShiftImportJobController),
)

router.get(
    "/import-jobs/:jobId",
    requirePermission(SHIFT_PERMISSIONS.IMPORT),
    asyncHandler(getShiftImportJobController),
)

router.post(
    "/import",
    requirePermission(SHIFT_PERMISSIONS.IMPORT),
    upload.single("file"),
    asyncHandler(importShiftsController),
)

router.get(
    "/",
    requirePermission(SHIFT_PERMISSIONS.VIEW),
    validateRequest({ query: shiftListQuerySchema }),
    asyncHandler(listShiftsController),
)

router.post(
    "/",
    requirePermission(SHIFT_PERMISSIONS.CREATE),
    validateRequest({ body: shiftCreateSchema }),
    asyncHandler(createShiftController),
)

router.get(
    "/:shiftId",
    requirePermission(SHIFT_PERMISSIONS.VIEW),
    validateRequest({ params: shiftIdParamSchema }),
    asyncHandler(getShiftController),
)

router.patch(
    "/:shiftId",
    requirePermission(SHIFT_PERMISSIONS.UPDATE),
    validateRequest({
        params: shiftIdParamSchema,
        body: shiftUpdateSchema,
    }),
    asyncHandler(updateShiftController),
)

router.patch(
    "/:shiftId/archive",
    requirePermission(SHIFT_PERMISSIONS.ARCHIVE),
    validateRequest({ params: shiftIdParamSchema }),
    asyncHandler(archiveShiftController),
)

export default router
