import { Router } from "express"
import multer from "multer"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"

import {
    lineCreateSchema,
    lineIdParamSchema,
    lineListQuerySchema,
    lineUpdateSchema,
} from "../schemas/line.schema.js"

import {
    archiveLine,
    createLine,
    getLineById,
    listLines,
    updateLine,
} from "../services/line.service.js"

import {
    buildLineExportWorkbook,
    buildLineImportTemplateWorkbook,
    getExportLines,
    importLinesFromRows,
    parseLineImportWorkbook,
} from "../services/lineExcel.service.js"

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
    "/",
    requirePermission(LINE_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(lineListQuerySchema, req.query)

            const result = await listLines({
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
    requirePermission(LINE_PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(lineCreateSchema, req.body)

            const line = await createLine({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({
                success: true,
                data: {
                    line,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/import-template",
    requirePermission(LINE_PERMISSIONS.IMPORT),
    async (req, res, next) => {
        try {
            const workbook = await buildLineImportTemplateWorkbook()
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="line-import-template.xlsx"',
            )

            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/export",
    requirePermission(LINE_PERMISSIONS.EXPORT),
    async (req, res, next) => {
        try {
            const query = parseRequest(lineListQuerySchema, req.query)

            const lines = await getExportLines({
                query,
                user: req.auth.user,
            })

            const workbook = await buildLineExportWorkbook({
                lines,
            })

            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="lines-export.xlsx"',
            )

            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/import",
    requirePermission(LINE_PERMISSIONS.IMPORT),
    upload.single("file"),
    async (req, res, next) => {
        try {
            if (!req.file) {
                throw new AppError({
                    statusCode: 422,
                    code: "ORGANIZATION_LINE_IMPORT_FILE_REQUIRED",
                    messageKey: "errors.organization.lineImport.fileRequired",
                })
            }

            const { rows, errors } = await parseLineImportWorkbook(
                req.file.buffer,
            )

            const summary = await importLinesFromRows({
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
                              code: "ORGANIZATION_LINE_IMPORT_HAS_ERRORS",
                              messageKey:
                                  "errors.organization.lineImport.hasErrors",
                          }
                        : undefined,
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:lineId",
    requirePermission(LINE_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const { lineId } = parseRequest(lineIdParamSchema, req.params)

            const line = await getLineById({
                lineId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    line,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:lineId",
    requirePermission(LINE_PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const { lineId } = parseRequest(lineIdParamSchema, req.params)
            const payload = parseRequest(lineUpdateSchema, req.body)

            const line = await updateLine({
                lineId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    line,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:lineId/archive",
    requirePermission(LINE_PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const { lineId } = parseRequest(lineIdParamSchema, req.params)

            const line = await archiveLine({
                lineId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    line,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router