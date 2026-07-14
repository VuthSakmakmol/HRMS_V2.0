import { Router } from "express"
import multer from "multer"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import { rawScanListQuerySchema } from "../schemas/attendanceScan.schema.js"
import {
    buildRawScanTemplate,
    importRawScans,
    listRawScans,
} from "../services/attendanceScan.service.js"

const router = Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024,
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
    requirePermission("ATTENDANCE.SCAN.VIEW"),
    async (req, res, next) => {
        try {
            const query = parseRequest(rawScanListQuerySchema, req.query)
            const result = await listRawScans({ query })
            res.status(200).json({ success: true, data: result })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/template",
    requirePermission("ATTENDANCE.SCAN.IMPORT"),
    async (req, res, next) => {
        try {
            const workbook = await buildRawScanTemplate()
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="attendance-raw-scan-template.xlsx"',
            )
            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/import",
    requirePermission("ATTENDANCE.SCAN.IMPORT"),
    upload.single("file"),
    async (req, res, next) => {
        try {
            if (!req.file) {
                throw new AppError({
                    statusCode: 422,
                    code: "ATTENDANCE_SCAN_FILE_REQUIRED",
                    messageKey: "errors.attendance.importFileRequired",
                })
            }

            const summary = await importRawScans({
                buffer: req.file.buffer,
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
