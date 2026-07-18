import { Router } from "express"
import multer from "multer"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import {
    archivePositionController,
    createPositionController,
    downloadPositionImportTemplateController,
    exportPositionsController,
    getPositionController,
    getPositionImportJobController,
    importPositionsController,
    startPositionImportJobController,
    listPositionsController,
    lookupPositionsController,
    updatePositionController,
} from "../controllers/position.controller.js"
import {
    positionCreateSchema,
    positionIdParamSchema,
    positionListQuerySchema,
    positionUpdateSchema,
} from "../schemas/position.schema.js"
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

const POSITION_PERMISSIONS = Object.freeze({
    LOOKUP: "ORGANIZATION.POSITION.LOOKUP",
    VIEW: "ORGANIZATION.POSITION.VIEW",
    CREATE: "ORGANIZATION.POSITION.CREATE",
    UPDATE: "ORGANIZATION.POSITION.UPDATE",
    ARCHIVE: "ORGANIZATION.POSITION.ARCHIVE",
    IMPORT: "ORGANIZATION.POSITION.IMPORT",
    EXPORT: "ORGANIZATION.POSITION.EXPORT",
})

router.use(requireAuthentication)

router.get(
    "/lookup",
    requirePermission(POSITION_PERMISSIONS.LOOKUP),
    validateRequest({ query: positionListQuerySchema }),
    asyncHandler(lookupPositionsController),
)

router.get(
    "/import-template",
    requirePermission(POSITION_PERMISSIONS.VIEW),
    asyncHandler(downloadPositionImportTemplateController),
)

router.get(
    "/export",
    requirePermission(POSITION_PERMISSIONS.EXPORT),
    validateRequest({ query: positionListQuerySchema }),
    asyncHandler(exportPositionsController),
)

router.post(
    "/import-jobs",
    requirePermission(POSITION_PERMISSIONS.IMPORT),
    upload.single("file"),
    validateRequest({ query: positionListQuerySchema }),
    asyncHandler(startPositionImportJobController),
)

router.get(
    "/import-jobs/:jobId",
    requirePermission(POSITION_PERMISSIONS.IMPORT),
    asyncHandler(getPositionImportJobController),
)

router.post(
    "/import",
    requirePermission(POSITION_PERMISSIONS.IMPORT),
    upload.single("file"),
    validateRequest({ query: positionListQuerySchema }),
    asyncHandler(importPositionsController),
)

router.get(
    "/",
    requirePermission(POSITION_PERMISSIONS.VIEW),
    validateRequest({ query: positionListQuerySchema }),
    asyncHandler(listPositionsController),
)

router.post(
    "/",
    requirePermission(POSITION_PERMISSIONS.CREATE),
    validateRequest({ body: positionCreateSchema }),
    asyncHandler(createPositionController),
)

router.get(
    "/:positionId",
    requirePermission(POSITION_PERMISSIONS.VIEW),
    validateRequest({ params: positionIdParamSchema }),
    asyncHandler(getPositionController),
)

router.patch(
    "/:positionId",
    requirePermission(POSITION_PERMISSIONS.UPDATE),
    validateRequest({
        params: positionIdParamSchema,
        body: positionUpdateSchema,
    }),
    asyncHandler(updatePositionController),
)

router.patch(
    "/:positionId/archive",
    requirePermission(POSITION_PERMISSIONS.ARCHIVE),
    validateRequest({ params: positionIdParamSchema }),
    asyncHandler(archivePositionController),
)

export default router
