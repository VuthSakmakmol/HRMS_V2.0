import { sendList, sendSuccess } from "../../../shared/http/response.js"
import { writeAuditLog } from "../../audit/services/audit.service.js"
import {
    archiveDepartment,
    createDepartment,
    getDepartmentById,
    listDepartments,
    lookupDepartments,
    updateDepartment,
} from "../services/department.service.js"
import {
    buildDepartmentExportWorkbook,
    buildDepartmentImportTemplateWorkbook,
    getExportDepartments,
    importDepartmentsFromRows,
    parseDepartmentImportWorkbook,
} from "../services/departmentExcel.service.js"
import { AppError } from "../../../shared/errors/AppError.js"

export async function listDepartmentsController(req, res) {
    const result = await listDepartments({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendList(req, res, result)
}

export async function lookupDepartmentsController(req, res) {
    const items = await lookupDepartments({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: {
            items,
        },
    })
}

export async function getDepartmentController(req, res) {
    const department = await getDepartmentById({
        departmentId: req.validatedParams.departmentId,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: {
            department,
        },
    })
}

export async function createDepartmentController(req, res) {
    const department = await createDepartment({
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.DEPARTMENT",
        action: "CREATE",
        entityType: "Department",
        entityId: department.id,
        after: department,
    })

    return sendSuccess(req, res, {
        statusCode: 201,
        data: {
            department,
        },
        messageKey: "organization.department.created",
    })
}

export async function updateDepartmentController(req, res) {
    const departmentId = req.validatedParams.departmentId
    const before = await getDepartmentById({
        departmentId,
        user: req.auth.user,
    })
    const department = await updateDepartment({
        departmentId,
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.DEPARTMENT",
        action: "UPDATE",
        entityType: "Department",
        entityId: department.id,
        before,
        after: department,
    })

    return sendSuccess(req, res, {
        data: {
            department,
        },
        messageKey: "organization.department.updated",
    })
}

export async function archiveDepartmentController(req, res) {
    const departmentId = req.validatedParams.departmentId
    const before = await getDepartmentById({
        departmentId,
        user: req.auth.user,
    })
    const department = await archiveDepartment({
        departmentId,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.DEPARTMENT",
        action: "ARCHIVE",
        entityType: "Department",
        entityId: department.id,
        before,
        after: department,
    })

    return sendSuccess(req, res, {
        data: {
            department,
        },
        messageKey: "organization.department.archived",
    })
}

export async function downloadDepartmentImportTemplateController(req, res) {
    const workbook = await buildDepartmentImportTemplateWorkbook()
    const buffer = await workbook.xlsx.writeBuffer()

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    res.setHeader(
        "Content-Disposition",
        'attachment; filename="department-import-template.xlsx"',
    )

    return res.status(200).send(Buffer.from(buffer))
}

export async function exportDepartmentsController(req, res) {
    const departments = await getExportDepartments({
        query: req.validatedQuery,
        user: req.auth.user,
    })
    const workbook = await buildDepartmentExportWorkbook({
        departments,
    })
    const buffer = await workbook.xlsx.writeBuffer()

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    res.setHeader(
        "Content-Disposition",
        'attachment; filename="departments-export.xlsx"',
    )

    return res.status(200).send(Buffer.from(buffer))
}

export async function importDepartmentsController(req, res) {
    if (!req.file) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_DEPARTMENT_IMPORT_FILE_REQUIRED",
            messageKey: "errors.organization.departmentImport.fileRequired",
        })
    }

    const { companyId, branchId } = req.validatedQuery

    if (!companyId || !branchId) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_DEPARTMENT_WORKSPACE_REQUIRED",
            messageKey: "errors.organization.department.workspaceRequired",
            fields: {
                companyId: ["errors.organization.department.workspaceRequired"],
                branchId: ["errors.organization.department.workspaceRequired"],
            },
        })
    }

    await listDepartments({
        query: {
            ...req.validatedQuery,
            page: 1,
            limit: 1,
        },
        user: req.auth.user,
    })

    const { rows, errors } = await parseDepartmentImportWorkbook(
        req.file.buffer,
    )
    const summary = await importDepartmentsFromRows({
        rows,
        parseErrors: errors,
        user: req.auth.user,
        workspace: {
            companyId,
            branchId,
        },
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.DEPARTMENT",
        action: "IMPORT",
        entityType: "Department",
        after: summary,
    })

    return res.status(summary.errors.length > 0 ? 207 : 200).json({
        success: summary.errors.length === 0,
        data: {
            summary,
        },
        error:
            summary.errors.length > 0
                ? {
                      code: "ORGANIZATION_DEPARTMENT_IMPORT_HAS_ERRORS",
                      messageKey:
                          "errors.organization.departmentImport.hasErrors",
                  }
                : undefined,
        meta: {
            requestId: req.requestId,
            generatedAt: new Date().toISOString(),
        },
    })
}
