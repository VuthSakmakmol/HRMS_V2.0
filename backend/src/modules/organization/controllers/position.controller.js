import { AppError } from "../../../shared/errors/AppError.js"
import { sendList, sendSuccess } from "../../../shared/http/response.js"
import { writeAuditLog } from "../../audit/services/audit.service.js"
import {
    archivePosition,
    createPosition,
    getPositionById,
    listPositions,
    lookupPositions,
    updatePosition,
} from "../services/position.service.js"
import {
    buildPositionExportWorkbook,
    buildPositionImportTemplateWorkbook,
    getExportPositions,
    importPositionsFromRows,
    parsePositionImportWorkbook,
} from "../services/positionExcel.service.js"

function setExcelHeaders(res, filename) {
    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
    )
}

export async function listPositionsController(req, res) {
    const result = await listPositions({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendList(req, res, result)
}

export async function lookupPositionsController(req, res) {
    const items = await lookupPositions({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: { items },
    })
}

export async function getPositionController(req, res) {
    const position = await getPositionById({
        positionId: req.validatedParams.positionId,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: { position },
    })
}

export async function createPositionController(req, res) {
    const position = await createPosition({
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.POSITION",
        action: "CREATE",
        entityType: "Position",
        entityId: position.id,
        after: position,
    })

    return sendSuccess(req, res, {
        statusCode: 201,
        data: { position },
        messageKey: "messages.organization.position.created",
    })
}

export async function updatePositionController(req, res) {
    const positionId = req.validatedParams.positionId
    const before = await getPositionById({
        positionId,
        user: req.auth.user,
    })

    const position = await updatePosition({
        positionId,
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.POSITION",
        action: "UPDATE",
        entityType: "Position",
        entityId: position.id,
        before,
        after: position,
    })

    return sendSuccess(req, res, {
        data: { position },
        messageKey: "messages.organization.position.updated",
    })
}

export async function archivePositionController(req, res) {
    const positionId = req.validatedParams.positionId
    const before = await getPositionById({
        positionId,
        user: req.auth.user,
    })

    const position = await archivePosition({
        positionId,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.POSITION",
        action: "ARCHIVE",
        entityType: "Position",
        entityId: position.id,
        before,
        after: position,
    })

    return sendSuccess(req, res, {
        data: { position },
        messageKey: "messages.organization.position.archived",
    })
}

export async function downloadPositionImportTemplateController(req, res) {
    const workbook = await buildPositionImportTemplateWorkbook()
    const buffer = await workbook.xlsx.writeBuffer()

    setExcelHeaders(res, "position-import-template.xlsx")
    return res.status(200).send(Buffer.from(buffer))
}

export async function exportPositionsController(req, res) {
    const positions = await getExportPositions({
        query: req.validatedQuery,
        user: req.auth.user,
    })
    const workbook = await buildPositionExportWorkbook({ positions })
    const buffer = await workbook.xlsx.writeBuffer()

    setExcelHeaders(res, "positions-export.xlsx")
    return res.status(200).send(Buffer.from(buffer))
}

export async function importPositionsController(req, res) {
    if (!req.file) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_POSITION_IMPORT_FILE_REQUIRED",
            messageKey: "errors.organization.positionImport.fileRequired",
            fields: {
                file: ["errors.organization.positionImport.fileRequired"],
            },
        })
    }

    const { rows, errors } = await parsePositionImportWorkbook(req.file.buffer)
    const summary = await importPositionsFromRows({
        rows,
        parseErrors: errors,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.POSITION",
        action: "IMPORT",
        entityType: "PositionImport",
        after: {
            total: summary.total,
            created: summary.created,
            updated: summary.updated,
            skipped: summary.skipped,
            errorCount: summary.errors?.length || 0,
        },
    })

    return res.status(summary.errors.length > 0 ? 207 : 200).json({
        success: summary.errors.length === 0,
        data: { summary },
        error:
            summary.errors.length > 0
                ? {
                      code: "ORGANIZATION_POSITION_IMPORT_HAS_ERRORS",
                      messageKey:
                          "errors.organization.positionImport.hasErrors",
                      requestId: req.requestId,
                  }
                : undefined,
        meta: {
            requestId: req.requestId,
            generatedAt: new Date().toISOString(),
        },
    })
}
