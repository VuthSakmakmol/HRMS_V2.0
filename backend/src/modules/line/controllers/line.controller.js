import { AppError } from "../../../shared/errors/AppError.js"
import { sendList, sendSuccess } from "../../../shared/http/response.js"
import { writeAuditLog } from "../../audit/services/audit.service.js"
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

export async function listLinesController(req, res) {
    const result = await listLines({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendList(req, res, result)
}

export async function getLineController(req, res) {
    const line = await getLineById({
        lineId: req.validatedParams.lineId,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: {
            line,
        },
    })
}

export async function createLineController(req, res) {
    const line = await createLine({
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.LINE",
        action: "CREATE",
        entityType: "Line",
        entityId: line.id,
        after: line,
    })

    return sendSuccess(req, res, {
        statusCode: 201,
        data: {
            line,
        },
        messageKey: "organization.line.created",
    })
}

export async function updateLineController(req, res) {
    const lineId = req.validatedParams.lineId
    const before = await getLineById({
        lineId,
        user: req.auth.user,
    })
    const line = await updateLine({
        lineId,
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.LINE",
        action: "UPDATE",
        entityType: "Line",
        entityId: line.id,
        before,
        after: line,
    })

    return sendSuccess(req, res, {
        data: {
            line,
        },
        messageKey: "organization.line.updated",
    })
}

export async function archiveLineController(req, res) {
    const lineId = req.validatedParams.lineId
    const before = await getLineById({
        lineId,
        user: req.auth.user,
    })
    const line = await archiveLine({
        lineId,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.LINE",
        action: "ARCHIVE",
        entityType: "Line",
        entityId: line.id,
        before,
        after: line,
    })

    return sendSuccess(req, res, {
        data: {
            line,
        },
        messageKey: "organization.line.archived",
    })
}

export async function downloadLineImportTemplateController(req, res) {
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

    return res.status(200).send(Buffer.from(buffer))
}

export async function exportLinesController(req, res) {
    const lines = await getExportLines({
        query: req.validatedQuery,
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

    return res.status(200).send(Buffer.from(buffer))
}

export async function importLinesController(req, res) {
    if (!req.file) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_LINE_IMPORT_FILE_REQUIRED",
            messageKey: "errors.organization.lineImport.fileRequired",
        })
    }

    const { rows, errors } = await parseLineImportWorkbook(req.file.buffer)
    const summary = await importLinesFromRows({
        rows,
        parseErrors: errors,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.LINE",
        action: "IMPORT",
        entityType: "Line",
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
                      code: "ORGANIZATION_LINE_IMPORT_HAS_ERRORS",
                      messageKey: "errors.organization.lineImport.hasErrors",
                  }
                : undefined,
        meta: {
            requestId: req.requestId,
            generatedAt: new Date().toISOString(),
        },
    })
}
