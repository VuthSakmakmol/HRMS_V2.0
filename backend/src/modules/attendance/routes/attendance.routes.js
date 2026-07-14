import { Router } from "express"
import multer from "multer"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"

import {
    attendanceIdParamSchema,
    attendanceListQuerySchema,
    attendanceUpsertSchema,
} from "../schemas/attendance.schema.js"
import {
    listAttendanceRecords,
    updateAttendanceRecord,
    upsertAttendanceRecord,
} from "../services/attendance.service.js"
import {
    buildAttendanceImportTemplate,
    importAttendanceRows,
    parseAttendanceWorkbook,
} from "../services/attendanceExcel.service.js"

const router = Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024,
    },
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
    requirePermission("ATTENDANCE.RECORD.VIEW"),
    async (req, res, next) => {
        try {
            const query = parseRequest(attendanceListQuerySchema, req.query)
            const result = await listAttendanceRecords({ query })

            res.status(200).json({ success: true, data: result })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/",
    requirePermission("ATTENDANCE.RECORD.CREATE"),
    async (req, res, next) => {
        try {
            const payload = parseRequest(attendanceUpsertSchema, req.body)
            const record = await upsertAttendanceRecord({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({ success: true, data: { record } })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:attendanceId",
    requirePermission("ATTENDANCE.RECORD.UPDATE"),
    async (req, res, next) => {
        try {
            const { attendanceId } = parseRequest(
                attendanceIdParamSchema,
                req.params,
            )
            const payload = parseRequest(attendanceUpsertSchema, req.body)
            const record = await updateAttendanceRecord({
                attendanceId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({ success: true, data: { record } })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/import-template",
    requirePermission("ATTENDANCE.RECORD.IMPORT"),
    async (req, res, next) => {
        try {
            const workbook = await buildAttendanceImportTemplate()
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="attendance-import-template.xlsx"',
            )
            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/import",
    requirePermission("ATTENDANCE.RECORD.IMPORT"),
    upload.single("file"),
    async (req, res, next) => {
        try {
            if (!req.file) {
                throw new AppError({
                    statusCode: 422,
                    code: "ATTENDANCE_IMPORT_FILE_REQUIRED",
                    messageKey: "errors.attendance.importFileRequired",
                })
            }

            const { rows, errors } = await parseAttendanceWorkbook(
                req.file.buffer,
            )
            const summary = await importAttendanceRows({
                rows,
                parseErrors: errors,
                user: req.auth.user,
            })

            res.status(summary.errorCount > 0 ? 207 : 200).json({
                success: summary.errorCount === 0,
                data: { summary },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router
