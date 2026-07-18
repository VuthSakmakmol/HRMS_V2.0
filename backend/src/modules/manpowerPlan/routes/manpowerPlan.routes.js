import multer from "multer"
import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    manpowerPlanBatchSaveSchema,
    manpowerPlanCreateSchema,
    manpowerPlanGridQuerySchema,
    manpowerPlanIdParamSchema,
    manpowerPlanListQuerySchema,
    manpowerPlanUpdateSchema,
} from "../schemas/manpowerPlan.schema.js"
import {
    archiveManpowerPlan,
    createManpowerPlan,
    getManpowerPlanById,
    listManpowerPlans,
    updateManpowerPlan,
    validateManpowerPlanWorkspace,
} from "../services/manpowerPlan.service.js"
import {
    getManpowerPlanningGrid,
    saveManpowerPlanBatch,
} from "../services/manpowerPlanBatch.service.js"
import {
    buildManpowerPlanExportWorkbook,
    buildManpowerPlanImportTemplateWorkbook,
    getExportManpowerPlans,
    importManpowerPlansFromRows,
    parseManpowerPlanImportWorkbook,
} from "../services/manpowerPlanExcel.service.js"

const router = Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
})

const MANPOWER_PLAN_PERMISSIONS = Object.freeze({
    VIEW: "REPORT.MANPOWER_PLAN.VIEW",
    CREATE: "REPORT.MANPOWER_PLAN.CREATE",
    UPDATE: "REPORT.MANPOWER_PLAN.UPDATE",
    ARCHIVE: "REPORT.MANPOWER_PLAN.ARCHIVE",
    IMPORT: "REPORT.MANPOWER_PLAN.IMPORT",
    EXPORT: "REPORT.MANPOWER_PLAN.EXPORT",
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
    "/planning-grid",
    requirePermission(MANPOWER_PLAN_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(
                manpowerPlanGridQuerySchema,
                req.query,
            )
            const result = await getManpowerPlanningGrid({
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

router.put(
    "/batch",
    requirePermission(MANPOWER_PLAN_PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(
                manpowerPlanBatchSaveSchema,
                req.body,
            )
            const result = await saveManpowerPlanBatch({
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    result,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/",
    requirePermission(MANPOWER_PLAN_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(
                manpowerPlanListQuerySchema,
                req.query,
            )
            const result = await listManpowerPlans({
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
    requirePermission(MANPOWER_PLAN_PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(
                manpowerPlanCreateSchema,
                req.body,
            )
            const manpowerPlan = await createManpowerPlan({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({
                success: true,
                data: {
                    manpowerPlan,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/import-template",
    requirePermission(MANPOWER_PLAN_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const workbook =
                await buildManpowerPlanImportTemplateWorkbook()
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="manpower-plan-import-template.xlsx"',
            )
            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/export",
    requirePermission(MANPOWER_PLAN_PERMISSIONS.EXPORT),
    async (req, res, next) => {
        try {
            const query = parseRequest(
                manpowerPlanListQuerySchema,
                req.query,
            )
            const plans = await getExportManpowerPlans({
                query,
                user: req.auth.user,
            })
            const workbook = await buildManpowerPlanExportWorkbook({
                plans,
            })
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="manpower-plans-export.xlsx"',
            )
            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/import",
    requirePermission(MANPOWER_PLAN_PERMISSIONS.IMPORT),
    upload.single("file"),
    async (req, res, next) => {
        try {
            const query = parseRequest(
                manpowerPlanListQuerySchema,
                req.query,
            )
            if (!query.companyId || !query.branchId) {
                throw new AppError({
                    statusCode: 422,
                    code: "MANPOWER_PLAN_WORKSPACE_REQUIRED",
                    messageKey: "errors.validationFailed",
                    fields: {
                        companyId: ["errors.validationFailed"],
                        branchId: ["errors.validationFailed"],
                    },
                })
            }

            // Validate that this user can access the selected workspace before
            // parsing or writing any workbook row.
            await validateManpowerPlanWorkspace({
                companyId: query.companyId,
                branchId: query.branchId,
                user: req.auth.user,
            })

            if (!req.file) {
                throw new AppError({
                    statusCode: 422,
                    code: "MANPOWER_PLAN_IMPORT_FILE_REQUIRED",
                    messageKey:
                        "errors.report.manpowerPlanImport.fileRequired",
                })
            }

            const { rows, errors } =
                await parseManpowerPlanImportWorkbook(req.file.buffer)
            const summary = await importManpowerPlansFromRows({
                rows,
                parseErrors: errors,
                user: req.auth.user,
                workspace: {
                    companyId: query.companyId,
                    branchId: query.branchId,
                },
            })

            res.status(summary.errors.length ? 207 : 200).json({
                success: summary.errors.length === 0,
                data: {
                    summary,
                },
                error: summary.errors.length
                    ? {
                          code: "MANPOWER_PLAN_IMPORT_HAS_ERRORS",
                          messageKey:
                              "errors.report.manpowerPlanImport.hasErrors",
                      }
                    : undefined,
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:manpowerPlanId",
    requirePermission(MANPOWER_PLAN_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const { manpowerPlanId } = parseRequest(
                manpowerPlanIdParamSchema,
                req.params,
            )
            const manpowerPlan = await getManpowerPlanById({
                manpowerPlanId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    manpowerPlan,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:manpowerPlanId",
    requirePermission(MANPOWER_PLAN_PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const { manpowerPlanId } = parseRequest(
                manpowerPlanIdParamSchema,
                req.params,
            )
            const payload = parseRequest(
                manpowerPlanUpdateSchema,
                req.body,
            )
            const manpowerPlan = await updateManpowerPlan({
                manpowerPlanId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    manpowerPlan,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:manpowerPlanId/archive",
    requirePermission(MANPOWER_PLAN_PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const { manpowerPlanId } = parseRequest(
                manpowerPlanIdParamSchema,
                req.params,
            )
            const manpowerPlan = await archiveManpowerPlan({
                manpowerPlanId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    manpowerPlan,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router
