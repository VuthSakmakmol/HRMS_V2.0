import { Router } from "express"
import multer from "multer"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    hrDashboardTargetCreateSchema,
    hrDashboardTargetIdParamSchema,
    hrDashboardTargetListQuerySchema,
    hrDashboardTargetLookupQuerySchema,
    hrDashboardTargetUpdateSchema,
} from "../schemas/hrDashboardTarget.schema.js"
import {
    archiveHrDashboardTarget,
    createHrDashboardTarget,
    getHrDashboardTargetById,
    getHrDashboardTargetLookups,
    listHrDashboardTargets,
    listHrDashboardTargetsForExport,
    updateHrDashboardTarget,
} from "../services/hrDashboardTarget.service.js"
import {
    buildHrDashboardTargetExport,
    buildHrDashboardTargetTemplate,
    importHrDashboardTargets,
    parseHrDashboardTargetWorkbook,
} from "../services/hrDashboardTargetExcel.service.js"

const router = Router()

const HR_DASHBOARD_TARGET_PERMISSIONS = Object.freeze({
    VIEW: "REPORT.HR_DASHBOARD_TARGET.VIEW",
    CREATE: "REPORT.HR_DASHBOARD_TARGET.CREATE",
    UPDATE: "REPORT.HR_DASHBOARD_TARGET.UPDATE",
    ARCHIVE: "REPORT.HR_DASHBOARD_TARGET.ARCHIVE",
    IMPORT: "REPORT.HR_DASHBOARD_TARGET.IMPORT",
    EXPORT: "REPORT.HR_DASHBOARD_TARGET.EXPORT",
})

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
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
    requirePermission(HR_DASHBOARD_TARGET_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(hrDashboardTargetListQuerySchema, {
                ...req.query,
                companyId: req.headers["x-workspace-company-id"] || req.query.companyId,
                branchId: req.headers["x-workspace-branch-id"] || req.query.branchId,
            })
            const result = await listHrDashboardTargets({
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
    "/lookups",
    requirePermission(HR_DASHBOARD_TARGET_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(hrDashboardTargetLookupQuerySchema, {
                ...req.query,
                companyId: req.headers["x-workspace-company-id"] || req.query.companyId,
                branchId: req.headers["x-workspace-branch-id"] || req.query.branchId,
            })
            const items = await getHrDashboardTargetLookups({
                query,
                user: req.auth.user,
            })

            res.status(200).json({ success: true, data: { items } })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/import-template",
    requirePermission(HR_DASHBOARD_TARGET_PERMISSIONS.IMPORT),
    async (req, res, next) => {
        try {
            const workbook = await buildHrDashboardTargetTemplate()
            const buffer = await workbook.xlsx.writeBuffer()
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            res.setHeader("Content-Disposition", 'attachment; filename="dashboard-target-import-template.xlsx"')
            res.setHeader("Cache-Control", "no-store")
            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/export",
    requirePermission(HR_DASHBOARD_TARGET_PERMISSIONS.EXPORT),
    async (req, res, next) => {
        try {
            const query = parseRequest(hrDashboardTargetListQuerySchema, {
                ...req.query,
                companyId: req.headers["x-workspace-company-id"] || req.query.companyId,
                branchId: req.headers["x-workspace-branch-id"] || req.query.branchId,
            })
            const records = await listHrDashboardTargetsForExport({ query, user: req.auth.user })
            const workbook = await buildHrDashboardTargetExport(records)
            const buffer = await workbook.xlsx.writeBuffer()
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            res.setHeader("Content-Disposition", 'attachment; filename="dashboard-targets.xlsx"')
            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/import",
    requirePermission(HR_DASHBOARD_TARGET_PERMISSIONS.IMPORT),
    upload.single("file"),
    async (req, res, next) => {
        try {
            if (!req.file) {
                throw new AppError({
                    statusCode: 422,
                    code: "HR_DASHBOARD_TARGET_IMPORT_FILE_REQUIRED",
                    messageKey: "errors.report.hrDashboardTarget.importFileRequired",
                })
            }
            const companyId = req.headers["x-workspace-company-id"] || req.query.companyId
            const branchId = req.headers["x-workspace-branch-id"] || req.query.branchId
            const scope = parseRequest(
                hrDashboardTargetLookupQuerySchema,
                { companyId, branchId },
            )
            await getHrDashboardTargetLookups({ query: scope, user: req.auth.user })
            const parsed = await parseHrDashboardTargetWorkbook(req.file.buffer)
            const summary = await importHrDashboardTargets({
                rows: parsed.rows,
                parseErrors: parsed.errors,
                workspace: {
                    companyId: scope.companyId,
                    branchId: scope.branchId,
                },
                user: req.auth.user,
            })

            res.status(summary.errorCount ? 422 : 200).json({
                success: summary.errorCount === 0,
                data: { summary },
                ...(summary.errorCount
                    ? {
                          error: {
                              code: "HR_DASHBOARD_TARGET_IMPORT_VALIDATION_FAILED",
                              messageKey: "errors.report.hrDashboardTarget.importValidationFailed",
                              details: { importSummary: summary },
                          },
                      }
                    : {}),
            })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/",
    requirePermission(HR_DASHBOARD_TARGET_PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(hrDashboardTargetCreateSchema, {
                ...req.body,
                companyId: req.headers["x-workspace-company-id"] || req.body.companyId,
                branchId: req.headers["x-workspace-branch-id"] || req.body.branchId,
            })
            const target = await createHrDashboardTarget({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({
                success: true,
                data: { target },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:targetId",
    requirePermission(HR_DASHBOARD_TARGET_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const { targetId } = parseRequest(hrDashboardTargetIdParamSchema, req.params)
            const target = await getHrDashboardTargetById({
                targetId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { target },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:targetId",
    requirePermission(HR_DASHBOARD_TARGET_PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const { targetId } = parseRequest(hrDashboardTargetIdParamSchema, req.params)
            const payload = parseRequest(hrDashboardTargetUpdateSchema, {
                ...req.body,
                companyId: req.headers["x-workspace-company-id"] || req.body.companyId,
                branchId: req.headers["x-workspace-branch-id"] || req.body.branchId,
            })
            const target = await updateHrDashboardTarget({
                targetId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { target },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:targetId/archive",
    requirePermission(HR_DASHBOARD_TARGET_PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const { targetId } = parseRequest(hrDashboardTargetIdParamSchema, req.params)
            const target = await archiveHrDashboardTarget({
                targetId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { target },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router
