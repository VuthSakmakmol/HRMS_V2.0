import { Router } from "express"
import multer from "multer"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"

import {
    shiftCreateSchema,
    shiftIdParamSchema,
    shiftListQuerySchema,
    shiftUpdateSchema,
} from "../schemas/shift.schema.js"

import {
    archiveShift,
    createShift,
    getShiftById,
    listShifts,
    lookupShifts,
    updateShift,
} from "../services/shift.service.js"

import {
    buildShiftExportWorkbook,
    buildShiftImportTemplateWorkbook,
    getExportShifts,
    importShiftsFromRows,
    parseShiftImportWorkbook,
} from "../services/shiftExcel.service.js"

const router = Router()

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
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
    "/lookup",
    requirePermission(SHIFT_PERMISSIONS.LOOKUP),
    async (req, res, next) => {
        try {
            const query = parseRequest(shiftListQuerySchema, req.query)

            const result = await lookupShifts({
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
    "/",
    requirePermission(SHIFT_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(shiftListQuerySchema, req.query)

            const result = await listShifts({
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
    "/",
    requirePermission(SHIFT_PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(shiftCreateSchema, req.body)

            const shift = await createShift({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({
                success: true,
                data: {
                    shift,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/import-template",
    requirePermission(SHIFT_PERMISSIONS.IMPORT),
    async (req, res, next) => {
        try {
            const workbook = await buildShiftImportTemplateWorkbook()
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="shift-import-template.xlsx"',
            )

            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/export",
    requirePermission(SHIFT_PERMISSIONS.EXPORT),
    async (req, res, next) => {
        try {
            const query = parseRequest(shiftListQuerySchema, req.query)

            const shifts = await getExportShifts({
                query,
                user: req.auth.user,
            })

            const workbook = await buildShiftExportWorkbook({
                shifts,
            })

            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="shifts-export.xlsx"',
            )

            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/import",
    requirePermission(SHIFT_PERMISSIONS.IMPORT),
    upload.single("file"),
    async (req, res, next) => {
        try {
            if (!req.file) {
                throw new AppError({
                    statusCode: 422,
                    code: "ORGANIZATION_SHIFT_IMPORT_FILE_REQUIRED",
                    messageKey: "errors.organization.shiftImport.fileRequired",
                })
            }

            const { rows, errors } = await parseShiftImportWorkbook(
                req.file.buffer,
            )

            const summary = await importShiftsFromRows({
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
                              code: "ORGANIZATION_SHIFT_IMPORT_HAS_ERRORS",
                              messageKey:
                                  "errors.organization.shiftImport.hasErrors",
                          }
                        : undefined,
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:shiftId",
    requirePermission(SHIFT_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const { shiftId } = parseRequest(shiftIdParamSchema, req.params)

            const shift = await getShiftById({
                shiftId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    shift,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:shiftId",
    requirePermission(SHIFT_PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const { shiftId } = parseRequest(shiftIdParamSchema, req.params)
            const payload = parseRequest(shiftUpdateSchema, req.body)

            const shift = await updateShift({
                shiftId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    shift,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:shiftId/archive",
    requirePermission(SHIFT_PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const { shiftId } = parseRequest(shiftIdParamSchema, req.params)

            const shift = await archiveShift({
                shiftId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    shift,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router