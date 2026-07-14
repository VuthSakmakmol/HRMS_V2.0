import { Router } from "express"
import multer from "multer"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    calendarDayCreateSchema,
    calendarDayIdParamSchema,
    calendarDayListQuerySchema,
    calendarDayUpdateSchema,
    calendarResolveDayQuerySchema,
    calendarResolveRangeQuerySchema,
} from "../schemas/calendar.schema.js"
import {
    archiveCalendarDay,
    createCalendarDay,
    getCalendarDayById,
    listCalendarDays,
    resolveCalendarDay,
    resolveCalendarRange,
    updateCalendarDay,
} from "../services/calendar.service.js"
import {
    buildCalendarExportWorkbook,
    buildCalendarImportTemplateWorkbook,
    getCalendarExportRows,
    importCalendarDaysFromRows,
    parseCalendarImportWorkbook,
} from "../services/calendarExcel.service.js"

const router = Router()

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
})

const CALENDAR_PERMISSIONS = Object.freeze({
    VIEW: "CALENDAR.DAY.VIEW",
    CREATE: "CALENDAR.DAY.CREATE",
    UPDATE: "CALENDAR.DAY.UPDATE",
    ARCHIVE: "CALENDAR.DAY.ARCHIVE",
    IMPORT: "CALENDAR.DAY.IMPORT",
    EXPORT: "CALENDAR.DAY.EXPORT",
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

router.get("/resolve/day", async (req, res, next) => {
    try {
        const query = parseRequest(calendarResolveDayQuerySchema, req.query)
        const day = await resolveCalendarDay({ query, user: req.auth.user })

        res.status(200).json({
            success: true,
            data: { day },
        })
    } catch (error) {
        next(error)
    }
})

router.get("/resolve/range", async (req, res, next) => {
    try {
        const query = parseRequest(calendarResolveRangeQuerySchema, req.query)
        const result = await resolveCalendarRange({ query, user: req.auth.user })

        res.status(200).json({
            success: true,
            data: result,
        })
    } catch (error) {
        next(error)
    }
})

router.get(
    "/days",
    requirePermission(CALENDAR_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(calendarDayListQuerySchema, req.query)
            const result = await listCalendarDays({ query, user: req.auth.user })

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
    "/days",
    requirePermission(CALENDAR_PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(calendarDayCreateSchema, req.body)
            const day = await createCalendarDay({ payload, user: req.auth.user })

            res.status(201).json({
                success: true,
                data: { day },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/days/import-template",
    requirePermission(CALENDAR_PERMISSIONS.IMPORT),
    async (req, res, next) => {
        try {
            const workbook = await buildCalendarImportTemplateWorkbook()
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="calendar-import-template.xlsx"',
            )

            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/days/export",
    requirePermission(CALENDAR_PERMISSIONS.EXPORT),
    async (req, res, next) => {
        try {
            const query = parseRequest(calendarDayListQuerySchema, req.query)
            const days = await getCalendarExportRows({ query, user: req.auth.user })
            const workbook = await buildCalendarExportWorkbook({ days })
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="calendar-days-export.xlsx"',
            )

            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/days/import",
    requirePermission(CALENDAR_PERMISSIONS.IMPORT),
    upload.single("file"),
    async (req, res, next) => {
        try {
            if (!req.file) {
                throw new AppError({
                    statusCode: 422,
                    code: "CALENDAR_IMPORT_FILE_REQUIRED",
                    messageKey: "errors.calendar.import.fileRequired",
                })
            }

            const { rows, errors } = await parseCalendarImportWorkbook(req.file.buffer)
            const summary = await importCalendarDaysFromRows({
                rows,
                parseErrors: errors,
                user: req.auth.user,
            })

            res.status(summary.errors.length > 0 ? 207 : 200).json({
                success: summary.errors.length === 0,
                data: { summary },
                error:
                    summary.errors.length > 0
                        ? {
                              code: "CALENDAR_IMPORT_HAS_ERRORS",
                              messageKey: "errors.calendar.import.hasErrors",
                          }
                        : undefined,
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/days/:calendarDayId",
    requirePermission(CALENDAR_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const { calendarDayId } = parseRequest(calendarDayIdParamSchema, req.params)
            const day = await getCalendarDayById({ calendarDayId, user: req.auth.user })

            res.status(200).json({
                success: true,
                data: { day },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/days/:calendarDayId",
    requirePermission(CALENDAR_PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const { calendarDayId } = parseRequest(calendarDayIdParamSchema, req.params)
            const payload = parseRequest(calendarDayUpdateSchema, req.body)
            const day = await updateCalendarDay({
                calendarDayId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { day },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/days/:calendarDayId/archive",
    requirePermission(CALENDAR_PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const { calendarDayId } = parseRequest(calendarDayIdParamSchema, req.params)
            const day = await archiveCalendarDay({ calendarDayId, user: req.auth.user })

            res.status(200).json({
                success: true,
                data: { day },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router
