import multer from "multer"
import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    getLocationCreateSchema,
    getLocationUpdateSchema,
    locationEntityParamSchema,
    locationIdParamSchema,
    locationListQuerySchema,
} from "../schemas/location.schema.js"
import {
    archiveLocation,
    createLocation,
    getLocationById,
    listLocations,
    lookupLocations,
    updateLocation,
} from "../services/location.service.js"
import {
    buildLocationExportWorkbook,
    buildLocationImportTemplateWorkbook,
    getExportLocations,
    getLocationExportFilename,
    getLocationImportFilename,
    importLocationsFromRows,
    parseLocationImportWorkbook,
} from "../services/locationExcel.service.js"

const router = Router()

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
})

const LOCATION_PERMISSIONS = Object.freeze({
    LOOKUP: "ORGANIZATION.LOCATION.LOOKUP",
    VIEW: "ORGANIZATION.LOCATION.VIEW",
    CREATE: "ORGANIZATION.LOCATION.CREATE",
    UPDATE: "ORGANIZATION.LOCATION.UPDATE",
    ARCHIVE: "ORGANIZATION.LOCATION.ARCHIVE",
    IMPORT: "ORGANIZATION.LOCATION.IMPORT",
    EXPORT: "ORGANIZATION.LOCATION.EXPORT",
})

function parseRequest(schema, value) {
    const parsed = schema.safeParse(value)

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

router.use(requireAuthentication)

router.get(
    "/:entity/lookup",
    requirePermission(LOCATION_PERMISSIONS.LOOKUP),
    async (req, res, next) => {
        try {
            const { entity } = parseRequest(
                locationEntityParamSchema,
                req.params,
            )
            const query = parseRequest(locationListQuerySchema, req.query)
            const result = await lookupLocations({
                entity,
                query,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: result,
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:entity",
    requirePermission(LOCATION_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const { entity } = parseRequest(
                locationEntityParamSchema,
                req.params,
            )
            const query = parseRequest(locationListQuerySchema, req.query)
            const result = await listLocations({
                entity,
                query,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: result,
            })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/:entity",
    requirePermission(LOCATION_PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const { entity } = parseRequest(
                locationEntityParamSchema,
                req.params,
            )
            const payload = parseRequest(
                getLocationCreateSchema(entity),
                req.body,
            )
            const location = await createLocation({
                entity,
                payload,
                user: req.auth.user,
            })

            res.status(201).json({
                success: true,
                data: {
                    location,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:entity/import-template",
    requirePermission(LOCATION_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const { entity } = parseRequest(
                locationEntityParamSchema,
                req.params,
            )
            const workbook = await buildLocationImportTemplateWorkbook({
                entity,
            })
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${getLocationImportFilename(entity)}"`,
            )

            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:entity/export",
    requirePermission(LOCATION_PERMISSIONS.EXPORT),
    async (req, res, next) => {
        try {
            const { entity } = parseRequest(
                locationEntityParamSchema,
                req.params,
            )
            const query = parseRequest(locationListQuerySchema, req.query)
            const locations = await getExportLocations({
                entity,
                query,
                user: req.auth.user,
            })
            const workbook = await buildLocationExportWorkbook({
                entity,
                items: locations,
            })
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${getLocationExportFilename(entity)}"`,
            )

            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/:entity/import",
    requirePermission(LOCATION_PERMISSIONS.IMPORT),
    upload.single("file"),
    async (req, res, next) => {
        try {
            if (!req.file) {
                throw new AppError({
                    statusCode: 422,
                    code: "LOCATION_IMPORT_FILE_REQUIRED",
                    messageKey: "errors.location.import.fileRequired",
                })
            }

            const { entity } = parseRequest(
                locationEntityParamSchema,
                req.params,
            )
            const { rows, errors } = await parseLocationImportWorkbook(
                req.file.buffer,
                entity,
            )
            const summary = await importLocationsFromRows({
                entity,
                rows,
                parseErrors: errors,
                user: req.auth.user,
            })

            res.status(summary.errors.length > 0 ? 207 : 200).json({
                success: summary.errors.length === 0,
                data: {
                    summary,
                },
                error:
                    summary.errors.length > 0
                        ? {
                              code: "LOCATION_IMPORT_HAS_ERRORS",
                              messageKey: "errors.location.import.hasErrors",
                          }
                        : undefined,
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:entity/:locationId",
    requirePermission(LOCATION_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const { entity, locationId } = parseRequest(
                locationIdParamSchema,
                req.params,
            )
            const location = await getLocationById({
                entity,
                locationId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    location,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:entity/:locationId",
    requirePermission(LOCATION_PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const { entity, locationId } = parseRequest(
                locationIdParamSchema,
                req.params,
            )
            const payload = parseRequest(
                getLocationUpdateSchema(entity),
                req.body,
            )
            const location = await updateLocation({
                entity,
                locationId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    location,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:entity/:locationId/archive",
    requirePermission(LOCATION_PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const { entity, locationId } = parseRequest(
                locationIdParamSchema,
                req.params,
            )
            const location = await archiveLocation({
                entity,
                locationId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    location,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router
