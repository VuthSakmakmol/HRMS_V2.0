import { Router } from "express"
import multer from "multer"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"

import {
    employeeTypeCreateSchema,
    employeeTypeIdParamSchema,
    employeeTypeListQuerySchema,
    employeeTypeUpdateSchema,
} from "../schemas/employeeType.schema.js"

import {
    archiveEmployeeType,
    createEmployeeType,
    getEmployeeTypeById,
    listEmployeeTypes,
    updateEmployeeType,
} from "../services/employeeType.service.js"

import {
    buildEmployeeTypeExportWorkbook,
    buildEmployeeTypeImportTemplateWorkbook,
    getExportEmployeeTypes,
    importEmployeeTypesFromRows,
    parseEmployeeTypeImportWorkbook,
} from "../services/employeeTypeExcel.service.js"

const router = Router()

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
})

const EMPLOYEE_TYPE_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.EMPLOYEE_TYPE.VIEW",
    CREATE: "ORGANIZATION.EMPLOYEE_TYPE.CREATE",
    UPDATE: "ORGANIZATION.EMPLOYEE_TYPE.UPDATE",
    ARCHIVE: "ORGANIZATION.EMPLOYEE_TYPE.ARCHIVE",
    IMPORT: "ORGANIZATION.EMPLOYEE_TYPE.IMPORT",
    EXPORT: "ORGANIZATION.EMPLOYEE_TYPE.EXPORT",
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
    requirePermission(EMPLOYEE_TYPE_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(employeeTypeListQuerySchema, req.query)

            const result = await listEmployeeTypes({
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
    requirePermission(EMPLOYEE_TYPE_PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(employeeTypeCreateSchema, req.body)

            const employeeType = await createEmployeeType({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({
                success: true,
                data: {
                    employeeType,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/import-template",
    requirePermission(EMPLOYEE_TYPE_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const workbook = await buildEmployeeTypeImportTemplateWorkbook()
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="employee-type-import-template.xlsx"',
            )

            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/export",
    requirePermission(EMPLOYEE_TYPE_PERMISSIONS.EXPORT),
    async (req, res, next) => {
        try {
            const query = parseRequest(employeeTypeListQuerySchema, req.query)

            const employeeTypes = await getExportEmployeeTypes({
                query,
                user: req.auth.user,
            })

            const workbook = await buildEmployeeTypeExportWorkbook({
                employeeTypes,
            })
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="employee-types-export.xlsx"',
            )

            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/import",
    requirePermission(EMPLOYEE_TYPE_PERMISSIONS.IMPORT),
    upload.single("file"),
    async (req, res, next) => {
        try {
            if (!req.file) {
                throw new AppError({
                    statusCode: 422,
                    code: "ORGANIZATION_EMPLOYEE_TYPE_IMPORT_FILE_REQUIRED",
                    messageKey:
                        "errors.organization.employeeTypeImport.fileRequired",
                })
            }

            const { rows, errors } = await parseEmployeeTypeImportWorkbook(
                req.file.buffer,
            )

            const summary = await importEmployeeTypesFromRows({
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
                              code: "ORGANIZATION_EMPLOYEE_TYPE_IMPORT_HAS_ERRORS",
                              messageKey:
                                  "errors.organization.employeeTypeImport.hasErrors",
                          }
                        : undefined,
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:employeeTypeId",
    requirePermission(EMPLOYEE_TYPE_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const { employeeTypeId } = parseRequest(
                employeeTypeIdParamSchema,
                req.params,
            )

            const employeeType = await getEmployeeTypeById({
                employeeTypeId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    employeeType,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:employeeTypeId",
    requirePermission(EMPLOYEE_TYPE_PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const { employeeTypeId } = parseRequest(
                employeeTypeIdParamSchema,
                req.params,
            )
            const payload = parseRequest(employeeTypeUpdateSchema, req.body)

            const employeeType = await updateEmployeeType({
                employeeTypeId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    employeeType,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:employeeTypeId/archive",
    requirePermission(EMPLOYEE_TYPE_PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const { employeeTypeId } = parseRequest(
                employeeTypeIdParamSchema,
                req.params,
            )

            const employeeType = await archiveEmployeeType({
                employeeTypeId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    employeeType,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router
