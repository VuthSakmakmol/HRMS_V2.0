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

import {
    attendanceIdParamSchema,
    attendanceListQuerySchema,
    attendanceImportIssueListQuerySchema,
    attendanceUpsertSchema,
} from "../schemas/attendance.schema.js"
import {
    listAttendanceRecords,
    getAttendanceExportRecords,
    updateAttendanceRecord,
    upsertAttendanceRecord,
} from "../services/attendance.service.js"
import {
    buildAttendanceImportTemplate,
    buildAttendanceExportWorkbook,
    importAttendanceRows,
    parseAttendanceWorkbook,
} from "../services/attendanceExcel.service.js"
import { listAttendanceImportIssues } from "../services/attendanceImportIssue.service.js"
import {
    buildAttendanceDailyReport,
    buildAttendanceDailyReportWorkbook,
} from "../services/attendanceDailyReport.service.js"
import {
    getAttendanceDailyEmailStatus,
    sendAttendanceDailyEmail,
} from "../services/attendanceDailyEmail.service.js"
import {
    getAttendanceDailyEmailSchedule,
    saveAttendanceDailyEmailSchedule,
} from "../services/attendanceDailyEmailSchedule.service.js"

const router = Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024,
    },
})
const ATTENDANCE_RECORD_IMPORT_MODULE = "ATTENDANCE_RECORD"
const ATTENDANCE_DAILY_REPORT_MODULE = "ATTENDANCE_DAILY_REPORT"
const ATTENDANCE_DAILY_EXPORT_MODULE = "ATTENDANCE_DAILY_EXPORT"
const dailyReportExports = new Map()

function startDailyReportJob({ req, module, exportExcel = false }) {
    const job = createImportJob({
        module,
        ownerAccountId: req.auth.user.accountId,
        fileName: `attendance-daily-report-${req.query.month || "report"}.xlsx`,
    })
    const query = { ...req.query }
    const user = req.auth.user

    setImmediate(async () => {
        try {
            updateImportJob(job.jobId, { status: "PROCESSING", phase: "PREPARING", percent: 5 })
            const report = await buildAttendanceDailyReport({
                query,
                user,
                onProgress: (progress) => updateImportJob(job.jobId, progress),
            })
            if (!exportExcel) {
                completeImportJob(job.jobId, { report, total: report.groupRows.length })
                return
            }
            updateImportJob(job.jobId, { phase: "BUILDING_EXCEL", percent: 70 })
            const workbook = await buildAttendanceDailyReportWorkbook(
                report,
                (progress) => updateImportJob(job.jobId, progress),
            )
            const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
            dailyReportExports.set(job.jobId, {
                buffer,
                fileName: `attendance-daily-report-${report.month}.xlsx`,
                ownerAccountId: String(user.accountId),
            })
            completeImportJob(job.jobId, { jobId: job.jobId, fileName: `attendance-daily-report-${report.month}.xlsx`, total: report.groupRows.length })
        } catch (error) {
            failImportJob(job.jobId, error)
        }
    })
    return job
}

async function processAttendanceImportJob({ jobId, fileBuffer, user, workspace }) {
    try {
        updateImportJob(jobId, { status: "PROCESSING", phase: "READING_FILE", percent: 10 })
        const { rows, errors } = await parseAttendanceWorkbook(fileBuffer)
        updateImportJob(jobId, { phase: "VALIDATING_ROWS", percent: 30, processedRows: 0, totalRows: rows.length + errors.length })
        const summary = await importAttendanceRows({
            rows,
            parseErrors: errors,
            user,
            workspace,
            onProgress: (progress) => updateImportJob(jobId, progress),
        })
        completeImportJob(jobId, summary)
    } catch (error) {
        failImportJob(jobId, error)
    }
}

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

router.post(
    "/daily-report/jobs",
    requirePermission("ATTENDANCE.RECORD.VIEW"),
    (req, res) => {
        const job = startDailyReportJob({ req, module: ATTENDANCE_DAILY_REPORT_MODULE })
        res.status(202).json({ success: true, data: { job } })
    },
)

router.get(
    "/daily-report/jobs/:jobId",
    requirePermission("ATTENDANCE.RECORD.VIEW"),
    (req, res, next) => {
        const job = getImportJob({ jobId: req.params.jobId, ownerAccountId: req.auth.user.accountId, module: ATTENDANCE_DAILY_REPORT_MODULE })
        if (!job) return next(new AppError({ statusCode: 404, code: "REPORT_JOB_NOT_FOUND", messageKey: "errors.notFound" }))
        return res.status(200).json({ success: true, data: { job } })
    },
)

router.post(
    "/daily-report/export-jobs",
    requirePermission("ATTENDANCE.RECORD.EXPORT"),
    (req, res) => {
        const job = startDailyReportJob({ req, module: ATTENDANCE_DAILY_EXPORT_MODULE, exportExcel: true })
        res.status(202).json({ success: true, data: { job } })
    },
)

router.get(
    "/daily-report/export-jobs/:jobId",
    requirePermission("ATTENDANCE.RECORD.EXPORT"),
    (req, res, next) => {
        const job = getImportJob({ jobId: req.params.jobId, ownerAccountId: req.auth.user.accountId, module: ATTENDANCE_DAILY_EXPORT_MODULE })
        if (!job) return next(new AppError({ statusCode: 404, code: "REPORT_JOB_NOT_FOUND", messageKey: "errors.notFound" }))
        return res.status(200).json({ success: true, data: { job } })
    },
)

router.get(
    "/daily-report/export-jobs/:jobId/download",
    requirePermission("ATTENDANCE.RECORD.EXPORT"),
    (req, res, next) => {
        const job = getImportJob({ jobId: req.params.jobId, ownerAccountId: req.auth.user.accountId, module: ATTENDANCE_DAILY_EXPORT_MODULE })
        const artifact = dailyReportExports.get(req.params.jobId)
        if (!job || job.status !== "COMPLETED" || !artifact || artifact.ownerAccountId !== String(req.auth.user.accountId)) {
            return next(new AppError({ statusCode: 404, code: "REPORT_EXPORT_NOT_FOUND", messageKey: "errors.notFound" }))
        }
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res.setHeader("Content-Disposition", `attachment; filename="${artifact.fileName}"`)
        res.status(200).send(artifact.buffer)
        dailyReportExports.delete(req.params.jobId)
    },
)

router.get(
    "/daily-report/email-status",
    requirePermission("ATTENDANCE.RECORD.VIEW"),
    async (req, res, next) => {
        try {
            const status = await getAttendanceDailyEmailStatus({
                date: req.query.date,
                companyId: req.query.companyId,
                branchId: req.query.branchId,
                user: req.auth.user,
            })
            res.status(200).json({ success: true, data: { status } })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/daily-report/send-email",
    requirePermission("ATTENDANCE.RECORD.EXPORT"),
    async (req, res, next) => {
        try {
            const result = await sendAttendanceDailyEmail({
                date: req.body.date,
                companyId: req.body.companyId,
                branchId: req.body.branchId,
                force: req.body.force === true,
                user: req.auth.user,
            })
            res.status(200).json({ success: true, data: result })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/daily-report/email-schedule",
    requirePermission("ATTENDANCE.RECORD.EXPORT"),
    async (req, res, next) => {
        try {
            const schedule = await getAttendanceDailyEmailSchedule({
                companyId: req.query.companyId,
                branchId: req.query.branchId,
                user: req.auth.user,
            })
            res.status(200).json({ success: true, data: { schedule } })
        } catch (error) {
            next(error)
        }
    },
)

router.put(
    "/daily-report/email-schedule",
    requirePermission("ATTENDANCE.RECORD.EXPORT"),
    async (req, res, next) => {
        try {
            const schedule = await saveAttendanceDailyEmailSchedule({
                companyId: req.body.companyId,
                branchId: req.body.branchId,
                payload: req.body,
                user: req.auth.user,
            })
            res.status(200).json({ success: true, data: { schedule } })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/daily-report",
    requirePermission("ATTENDANCE.RECORD.VIEW"),
    async (req, res, next) => {
        try {
            const report = await buildAttendanceDailyReport({ query: req.query, user: req.auth.user })
            res.status(200).json({ success: true, data: { report } })
        } catch (error) { next(error) }
    },
)

router.get(
    "/daily-report/export",
    requirePermission("ATTENDANCE.RECORD.EXPORT"),
    async (req, res, next) => {
        try {
            const report = await buildAttendanceDailyReport({ query: req.query, user: req.auth.user })
            const workbook = await buildAttendanceDailyReportWorkbook(report)
            const buffer = await workbook.xlsx.writeBuffer()
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            res.setHeader("Content-Disposition", `attachment; filename="attendance-daily-report-${report.month}.xlsx"`)
            res.status(200).send(Buffer.from(buffer))
        } catch (error) { next(error) }
    },
)

router.get(
    "/",
    requirePermission("ATTENDANCE.RECORD.VIEW"),
    async (req, res, next) => {
        try {
            const query = parseRequest(attendanceListQuerySchema, req.query)
            const result = await listAttendanceRecords({ query, user: req.auth.user })

            res.status(200).json({ success: true, data: result })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/import-issues",
    requirePermission("ATTENDANCE.RECORD.VIEW"),
    async (req, res, next) => {
        try {
            const query = parseRequest(
                attendanceImportIssueListQuerySchema,
                req.query,
            )
            const result = await listAttendanceImportIssues({
                query,
                user: req.auth.user,
            })

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
            const payload = parseRequest(attendanceUpsertSchema, {
                ...req.body,
                companyId: req.body.companyId || req.headers["x-workspace-company-id"],
                branchId: req.body.branchId || req.headers["x-workspace-branch-id"],
            })
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

router.get(
    "/export",
    requirePermission("ATTENDANCE.RECORD.EXPORT"),
    async (req, res, next) => {
        try {
            const query = parseRequest(attendanceListQuerySchema, req.query)
            const records = await getAttendanceExportRecords({ query, user: req.auth.user })
            const workbook = await buildAttendanceExportWorkbook(records)
            const buffer = await workbook.xlsx.writeBuffer()
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            res.setHeader("Content-Disposition", 'attachment; filename="attendance-records.xlsx"')
            res.status(200).send(Buffer.from(buffer))
        } catch (error) { next(error) }
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
            const payload = parseRequest(attendanceUpsertSchema, {
                ...req.body,
                companyId: req.body.companyId || req.headers["x-workspace-company-id"],
                branchId: req.body.branchId || req.headers["x-workspace-branch-id"],
            })
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
            res.setHeader(
                "Cache-Control",
                "no-store, no-cache, must-revalidate, proxy-revalidate",
            )
            res.setHeader("Pragma", "no-cache")
            res.setHeader("Expires", "0")
            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/import-jobs",
    requirePermission("ATTENDANCE.RECORD.IMPORT"),
    upload.single("file"),
    async (req, res, next) => {
        try {
            if (!req.file) throw new AppError({ statusCode: 422, code: "ATTENDANCE_IMPORT_FILE_REQUIRED", messageKey: "errors.attendance.importFileRequired" })
            const workspace = { companyId: req.query.companyId || req.headers["x-workspace-company-id"], branchId: req.query.branchId || req.headers["x-workspace-branch-id"] }
            const job = createImportJob({ module: ATTENDANCE_RECORD_IMPORT_MODULE, ownerAccountId: req.auth.user.accountId, fileName: req.file.originalname })
            updateImportJob(job.jobId, { percent: 5, phase: "UPLOADED" })
            const queuedJob = getImportJob({ jobId: job.jobId, ownerAccountId: req.auth.user.accountId, module: ATTENDANCE_RECORD_IMPORT_MODULE })
            const fileBuffer = Buffer.from(req.file.buffer)
            const user = req.auth.user
            setImmediate(() => void processAttendanceImportJob({ jobId: job.jobId, fileBuffer, user, workspace }))
            res.status(202).json({ success: true, data: { job: queuedJob } })
        } catch (error) { next(error) }
    },
)

router.get(
    "/import-jobs/:jobId",
    requirePermission("ATTENDANCE.RECORD.IMPORT"),
    async (req, res) => {
        const job = getImportJob({ jobId: req.params.jobId, ownerAccountId: req.auth.user.accountId, module: ATTENDANCE_RECORD_IMPORT_MODULE })
        if (!job) return res.status(404).json({ success: false, error: { code: "IMPORT_JOB_NOT_FOUND", message: "Import job was not found or expired." } })
        return res.status(200).json({ success: true, data: { job } })
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
                workspace: {
                    companyId: req.query.companyId || req.headers["x-workspace-company-id"],
                    branchId: req.query.branchId || req.headers["x-workspace-branch-id"],
                },
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
