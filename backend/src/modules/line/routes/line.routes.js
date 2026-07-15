import { Router } from "express"
import multer from "multer"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js"
import { validateRequest } from "../../../shared/middleware/validateRequest.js"
import {
    archiveLineController,
    createLineController,
    downloadLineImportTemplateController,
    exportLinesController,
    getLineController,
    importLinesController,
    listLinesController,
    updateLineController,
} from "../controllers/line.controller.js"
import {
    lineCreateSchema,
    lineIdParamSchema,
    lineListQuerySchema,
    lineUpdateSchema,
} from "../schemas/line.schema.js"

const router = Router()

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
})

const LINE_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.LINE.VIEW",
    CREATE: "ORGANIZATION.LINE.CREATE",
    UPDATE: "ORGANIZATION.LINE.UPDATE",
    ARCHIVE: "ORGANIZATION.LINE.ARCHIVE",
    IMPORT: "ORGANIZATION.LINE.IMPORT",
    EXPORT: "ORGANIZATION.LINE.EXPORT",
})

router.use(requireAuthentication)

router.get(
    "/",
    requirePermission(LINE_PERMISSIONS.VIEW),
    validateRequest({
        query: lineListQuerySchema,
    }),
    asyncHandler(listLinesController),
)

router.post(
    "/",
    requirePermission(LINE_PERMISSIONS.CREATE),
    validateRequest({
        body: lineCreateSchema,
    }),
    asyncHandler(createLineController),
)

router.get(
    "/import-template",
    requirePermission(LINE_PERMISSIONS.IMPORT),
    asyncHandler(downloadLineImportTemplateController),
)

router.get(
    "/export",
    requirePermission(LINE_PERMISSIONS.EXPORT),
    validateRequest({
        query: lineListQuerySchema,
    }),
    asyncHandler(exportLinesController),
)

router.post(
    "/import",
    requirePermission(LINE_PERMISSIONS.IMPORT),
    upload.single("file"),
    asyncHandler(importLinesController),
)

router.get(
    "/:lineId",
    requirePermission(LINE_PERMISSIONS.VIEW),
    validateRequest({
        params: lineIdParamSchema,
    }),
    asyncHandler(getLineController),
)

router.patch(
    "/:lineId",
    requirePermission(LINE_PERMISSIONS.UPDATE),
    validateRequest({
        params: lineIdParamSchema,
        body: lineUpdateSchema,
    }),
    asyncHandler(updateLineController),
)

router.patch(
    "/:lineId/archive",
    requirePermission(LINE_PERMISSIONS.ARCHIVE),
    validateRequest({
        params: lineIdParamSchema,
    }),
    asyncHandler(archiveLineController),
)

export default router
