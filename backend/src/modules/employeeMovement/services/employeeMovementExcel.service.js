
import ExcelJS from "exceljs"

import Employee from "../../employee/models/Employee.js"
import EmployeeMovement from "../models/EmployeeMovement.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    createEmployeeMovement,
    getExportEmployeeMovements,
} from "./employeeMovement.service.js"

const TEMPLATE_HEADERS = [
    "employeeCode",
    "movementType",
    "effectiveDate",
    "reason",
    "status",
]

function normalizeCode(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase()
}

function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ")
}

function getCellValue(row, index) {
    const cell = row.getCell(index)
    const value = cell.value

    if (value === null || value === undefined) return ""
    if (value instanceof Date) return value
    if (typeof value === "object") {
        if (value.text) return String(value.text)
        if (value.result) return String(value.result)
        if (value.richText) return value.richText.map((item) => item.text).join("")
    }
    return String(value)
}

function buildImportError(rowNumber, field, messageKey) {
    return { rowNumber, field, messageKey }
}

function buildWorkbookBase(title) {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "HRMS Enterprise"
    workbook.created = new Date()
    workbook.modified = new Date()

    const worksheet = workbook.addWorksheet(title, {
        views: [{ state: "frozen", ySplit: 1 }],
    })

    worksheet.columns = [
        { header: "employeeCode", key: "employeeCode", width: 18 },
        { header: "movementType", key: "movementType", width: 22 },
        { header: "effectiveDate", key: "effectiveDate", width: 18 },
        { header: "reason", key: "reason", width: 42 },
        { header: "status", key: "status", width: 14 },
    ]

    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } }
    headerRow.alignment = { vertical: "middle", horizontal: "center" }

    return { workbook, worksheet }
}

export async function buildEmployeeMovementImportTemplateWorkbook() {
    const { workbook, worksheet } = buildWorkbookBase("Movement Import")
    worksheet.addRow({
        employeeCode: "10001",
        movementType: "TRANSFER",
        effectiveDate: new Date(),
        reason: "Transfer to another line",
        status: "ACTIVE",
    })
    return workbook
}

export async function buildEmployeeMovementExportWorkbook({ movements }) {
    const { workbook, worksheet } = buildWorkbookBase("Movements Export")

    for (const movement of movements) {
        worksheet.addRow({
            employeeCode: movement.employee?.employeeCode || "",
            movementType: movement.movementType,
            effectiveDate: movement.effectiveDate ? new Date(movement.effectiveDate) : "",
            reason: movement.reason || "",
            status: movement.status,
        })
    }

    worksheet.getColumn("effectiveDate").numFmt = "yyyy-mm-dd"
    return workbook
}

export async function parseEmployeeMovementImportWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
        throw new AppError({
            statusCode: 422,
            code: "EMPLOYEE_MOVEMENT_IMPORT_EMPTY_WORKBOOK",
            messageKey: "errors.employee.movementImport.emptyWorkbook",
        })
    }

    const headerRow = worksheet.getRow(1)
    const actualHeaders = TEMPLATE_HEADERS.map((_, index) => normalizeText(getCellValue(headerRow, index + 1)))
    const isValid = TEMPLATE_HEADERS.every((header, index) => actualHeaders[index] === header)

    if (!isValid) {
        throw new AppError({
            statusCode: 422,
            code: "EMPLOYEE_MOVEMENT_IMPORT_INVALID_TEMPLATE",
            messageKey: "errors.employee.movementImport.invalidTemplate",
        })
    }

    const rows = []
    const errors = []

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return

        const rowObject = {}
        TEMPLATE_HEADERS.forEach((header, index) => {
            rowObject[header] = getCellValue(row, index + 1)
        })

        const isEmpty = Object.values(rowObject).every((value) => normalizeText(value) === "")
        if (!isEmpty) rows.push({ rowNumber, values: rowObject })
    })

    return { rows, errors }
}

export async function importEmployeeMovementsFromRows({ rows, parseErrors = [], user }) {
    const summary = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [...parseErrors],
    }

    for (const row of rows) {
        const values = row.values
        const employeeCode = normalizeCode(values.employeeCode)
        const movementType = normalizeCode(values.movementType)
        const status = normalizeCode(values.status || "ACTIVE")
        const effectiveDate = values.effectiveDate instanceof Date ? values.effectiveDate : new Date(values.effectiveDate)

        if (!employeeCode) {
            summary.errors.push(buildImportError(row.rowNumber, "employeeCode", "errors.employee.movementImport.employeeCodeRequired"))
            continue
        }
        if (Number.isNaN(effectiveDate.getTime())) {
            summary.errors.push(buildImportError(row.rowNumber, "effectiveDate", "errors.employee.movementImport.effectiveDateInvalid"))
            continue
        }

        const employee = await Employee.findOne({ employeeCode, recordStatus: { $ne: "ARCHIVED" } }).lean()
        if (!employee) {
            summary.errors.push(buildImportError(row.rowNumber, "employeeCode", "errors.employee.movementImport.employeeNotFound"))
            continue
        }

        try {
            await createEmployeeMovement({
                payload: {
                    employeeId: employee._id.toString(),
                    movementType,
                    effectiveDate,
                    reason: normalizeText(values.reason),
                    source: "IMPORT",
                    status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
                },
                user,
            })
            summary.created += 1
        } catch (error) {
            summary.errors.push(buildImportError(row.rowNumber, "row", error.messageKey || "errors.employee.movementImport.rowFailed"))
        }
    }

    return summary
}

export { getExportEmployeeMovements }
