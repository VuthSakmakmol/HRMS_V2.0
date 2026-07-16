import { Router } from "express"
import multer from "multer"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import {
    archiveLocationController,
    createLocationController,
    downloadLocationImportTemplateController,
    exportLocationsController,
    getLocationController,
    getLocationImportJobController,
    importLocationsController,
    listLocationsController,
    lookupLocationsController,
    startLocationImportJobController,
    updateLocationController,
} from "../controllers/location.controller.js"
import {
    getLocationCreateSchema,
    getLocationUpdateSchema,
    locationEntityParamSchema,
    locationIdParamSchema,
    locationListQuerySchema,
} from "../schemas/location.schema.js"
import { AppError } from "../../../shared/errors/AppError.js"
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
            return callback(new Error("Only Excel .xlsx or .xls files are allowed."))
        }

        return callback(null, true)
    },
})


function parseDynamicBody(schema, body) {
    const parsed = schema.safeParse(body)

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

const LOCATION_PERMISSIONS = Object.freeze({
    LOOKUP: "ORGANIZATION.LOCATION.LOOKUP",
    VIEW: "ORGANIZATION.LOCATION.VIEW",
    CREATE: "ORGANIZATION.LOCATION.CREATE",
    UPDATE: "ORGANIZATION.LOCATION.UPDATE",
    ARCHIVE: "ORGANIZATION.LOCATION.ARCHIVE",
    IMPORT: "ORGANIZATION.LOCATION.IMPORT",
    EXPORT: "ORGANIZATION.LOCATION.EXPORT",
})

router.use(requireAuthentication)

router.get(
    "/:entity/lookup",
    requirePermission(LOCATION_PERMISSIONS.LOOKUP),
    validateRequest({
        params: locationEntityParamSchema,
        query: locationListQuerySchema,
    }),
    asyncHandler(lookupLocationsController),
)

router.get(
    "/:entity/import-template",
    requirePermission(LOCATION_PERMISSIONS.VIEW),
    validateRequest({ params: locationEntityParamSchema }),
    asyncHandler(downloadLocationImportTemplateController),
)

router.get(
    "/:entity/export",
    requirePermission(LOCATION_PERMISSIONS.EXPORT),
    validateRequest({
        params: locationEntityParamSchema,
        query: locationListQuerySchema,
    }),
    asyncHandler(exportLocationsController),
)

router.post(
    "/:entity/import-jobs",
    requirePermission(LOCATION_PERMISSIONS.IMPORT),
    upload.single("file"),
    validateRequest({ params: locationEntityParamSchema }),
    asyncHandler(startLocationImportJobController),
)

router.get(
    "/:entity/import-jobs/:jobId",
    requirePermission(LOCATION_PERMISSIONS.IMPORT),
    validateRequest({ params: locationEntityParamSchema.passthrough() }),
    asyncHandler(getLocationImportJobController),
)

router.post(
    "/:entity/import",
    requirePermission(LOCATION_PERMISSIONS.IMPORT),
    upload.single("file"),
    validateRequest({ params: locationEntityParamSchema }),
    asyncHandler(importLocationsController),
)

router.get(
    "/:entity",
    requirePermission(LOCATION_PERMISSIONS.VIEW),
    validateRequest({
        params: locationEntityParamSchema,
        query: locationListQuerySchema,
    }),
    asyncHandler(listLocationsController),
)

router.post(
    "/:entity",
    requirePermission(LOCATION_PERMISSIONS.CREATE),
    validateRequest({ params: locationEntityParamSchema }),
    asyncHandler(async (req, res) => {
        req.validatedBody = parseDynamicBody(
            getLocationCreateSchema(req.validatedParams.entity),
            req.body,
        )
        return createLocationController(req, res)
    }),
)

router.get(
    "/:entity/:locationId",
    requirePermission(LOCATION_PERMISSIONS.VIEW),
    validateRequest({ params: locationIdParamSchema }),
    asyncHandler(getLocationController),
)

router.patch(
    "/:entity/:locationId",
    requirePermission(LOCATION_PERMISSIONS.UPDATE),
    validateRequest({ params: locationIdParamSchema }),
    asyncHandler(async (req, res) => {
        req.validatedBody = parseDynamicBody(
            getLocationUpdateSchema(req.validatedParams.entity),
            req.body,
        )
        return updateLocationController(req, res)
    }),
)

router.patch(
    "/:entity/:locationId/archive",
    requirePermission(LOCATION_PERMISSIONS.ARCHIVE),
    validateRequest({ params: locationIdParamSchema }),
    asyncHandler(archiveLocationController),
)

export default router
