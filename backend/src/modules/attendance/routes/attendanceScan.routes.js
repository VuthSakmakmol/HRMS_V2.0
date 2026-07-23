import { Router } from "express"
import multer from "multer"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    completeImportJob,
    createImportJob,
    failImportJob,
    getImportJob,
    updateImportJob,
} from "../../../shared/import/importJob.service.js"
import { rawScanListQuerySchema } from "../schemas/attendanceScan.schema.js"
import {
    buildRawScanTemplate,
    importRawScans,
    listRawScans,
} from "../services/attendanceScan.service.js"

const router = Router()
const ATTENDANCE_SCAN_IMPORT_MODULE = "ATTENDANCE_SCAN"
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
            const result = await listRawScans({ query, user: req.auth.user })
            res.status(200).json({ success: true, data: result })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/import-jobs",
    requirePermission("ATTENDANCE.SCAN.IMPORT"),
    upload.single("file"),
    async (req, res, next) => {
        try {
            if (!req.file) throw new AppError({ statusCode: 422, code: "ATTENDANCE_SCAN_FILE_REQUIRED", messageKey: "errors.attendance.importFileRequired" })
            const job = createImportJob({ module: ATTENDANCE_SCAN_IMPORT_MODULE, ownerAccountId: req.auth.user.accountId, fileName: req.file.originalname })
            const input = {
                buffer: Buffer.from(req.file.buffer),
                user: req.auth.user,
                companyId: req.query.companyId || req.headers["x-workspace-company-id"],
                branchId: req.query.branchId || req.headers["x-workspace-branch-id"],
            }
            updateImportJob(job.jobId, { status: "PROCESSING", phase: "READING_FILE", percent: 10 })
            setImmediate(async () => {
                try {
                    const summary = await importRawScans({ ...input, onProgress: (progress) => updateImportJob(job.jobId, progress) })
                    completeImportJob(job.jobId, summary)
                } catch (error) {
                    failImportJob(job.jobId, error)
                }
            })
            res.status(202).json({ success: true, data: { job: getImportJob({ jobId: job.jobId, ownerAccountId: req.auth.user.accountId, module: ATTENDANCE_SCAN_IMPORT_MODULE }) } })
        } catch (error) { next(error) }
    },
)

router.get(
    "/import-jobs/:jobId",
    requirePermission("ATTENDANCE.SCAN.IMPORT"),
    (req, res) => {
        const job = getImportJob({ jobId: req.params.jobId, ownerAccountId: req.auth.user.accountId, module: ATTENDANCE_SCAN_IMPORT_MODULE })
        if (!job) return res.status(404).json({ success: false, error: { code: "IMPORT_JOB_NOT_FOUND", message: "Import job was not found or expired." } })
        return res.status(200).json({ success: true, data: { job } })
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
                companyId: req.query.companyId || req.headers["x-workspace-company-id"],
                branchId: req.query.branchId || req.headers["x-workspace-branch-id"],
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
