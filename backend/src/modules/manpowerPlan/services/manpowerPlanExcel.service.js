
import ExcelJS from "exceljs"

import Company from "../../organization/models/Company.js"
import Branch from "../../organization/models/Branch.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"
import Line from "../../line/models/Line.js"
import Shift from "../../shift/models/Shift.js"
import EmployeeType from "../../employeeType/models/EmployeeType.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    createManpowerPlan,
    getExportManpowerPlans,
    updateManpowerPlan,
} from "./manpowerPlan.service.js"
import ManpowerPlan from "../models/ManpowerPlan.js"

const TEMPLATE_HEADERS = [
    "companyCode",
    "branchCode",
    "year",
    "month",
    "departmentCode",
    "positionCode",
    "lineCode",
    "shiftCode",
    "employeeTypeCode",
    "employeeTypeChildCode",
    "targetBudget",
    "targetRoadmap",
    "status",
    "remark",
]

function normalizeCode(value) {
    return String(value || "").trim().replace(/\s+/g, "_").toUpperCase()
}

function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ")
}

function getCellValue(row, index) {
    const cell = row.getCell(index)
    const value = cell.value
    if (value === null || value === undefined) return ""
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
        { header: "companyCode", key: "companyCode", width: 18 },
        { header: "branchCode", key: "branchCode", width: 18 },
        { header: "year", key: "year", width: 10 },
        { header: "month", key: "month", width: 10 },
        { header: "departmentCode", key: "departmentCode", width: 20 },
        { header: "positionCode", key: "positionCode", width: 20 },
        { header: "lineCode", key: "lineCode", width: 18 },
        { header: "shiftCode", key: "shiftCode", width: 18 },
        { header: "employeeTypeCode", key: "employeeTypeCode", width: 22 },
        { header: "employeeTypeChildCode", key: "employeeTypeChildCode", width: 26 },
        { header: "targetBudget", key: "targetBudget", width: 18 },
        { header: "targetRoadmap", key: "targetRoadmap", width: 18 },
        { header: "status", key: "status", width: 14 },
        { header: "remark", key: "remark", width: 42 },
    ]

    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } }
    headerRow.alignment = { vertical: "middle", horizontal: "center" }

    return { workbook, worksheet }
}

export async function buildManpowerPlanImportTemplateWorkbook() {
    const { workbook, worksheet } = buildWorkbookBase("Manpower Plan Import")
    worksheet.addRow({
        companyCode: "TRAX",
        branchCode: "PP-HQ",
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        departmentCode: "PRODUCTION",
        positionCode: "SEWER",
        lineCode: "L01",
        shiftCode: "DAY",
        employeeTypeCode: "BLUE_COLLAR",
        employeeTypeChildCode: "DIRECT",
        targetBudget: 100,
        targetRoadmap: 120,
        status: "ACTIVE",
        remark: "Monthly manpower target",
    })
    return workbook
}

export async function buildManpowerPlanExportWorkbook({ plans }) {
    const { workbook, worksheet } = buildWorkbookBase("Manpower Plans Export")

    for (const plan of plans) {
        worksheet.addRow({
            companyCode: plan.company?.code || "",
            branchCode: plan.branch?.code || "",
            year: plan.year,
            month: plan.month,
            departmentCode: plan.department?.code || "",
            positionCode: plan.position?.code || "",
            lineCode: plan.line?.code || "",
            shiftCode: plan.shift?.code || "",
            employeeTypeCode: plan.employeeType?.code || "",
            employeeTypeChildCode: plan.employeeTypeChildCode || "",
            targetBudget: plan.targetBudget,
            targetRoadmap: plan.targetRoadmap,
            status: plan.status,
            remark: plan.remark || "",
        })
    }

    return workbook
}

export async function parseManpowerPlanImportWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.worksheets[0]

    if (!worksheet) {
        throw new AppError({ statusCode: 422, code: "MANPOWER_PLAN_IMPORT_EMPTY_WORKBOOK", messageKey: "errors.report.manpowerPlanImport.emptyWorkbook" })
    }

    const headerRow = worksheet.getRow(1)
    const actualHeaders = TEMPLATE_HEADERS.map((_, index) => normalizeText(getCellValue(headerRow, index + 1)))
    const isValid = TEMPLATE_HEADERS.every((header, index) => actualHeaders[index] === header)

    if (!isValid) {
        throw new AppError({ statusCode: 422, code: "MANPOWER_PLAN_IMPORT_INVALID_TEMPLATE", messageKey: "errors.report.manpowerPlanImport.invalidTemplate" })
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

async function resolveImportReferences(values, workspace) {
    const companyCode = normalizeCode(values.companyCode)
    const branchCode = normalizeCode(values.branchCode)
    const company = await Company.findOne({ _id: workspace.companyId, code: companyCode, status: { $ne: "ARCHIVED" } }).lean()
    if (!company) return { error: "company" }
    const branch = await Branch.findOne({ _id: workspace.branchId, companyId: company._id, code: branchCode, status: { $ne: "ARCHIVED" } }).lean()
    if (!branch) return { error: "branch" }

    const departmentCode = normalizeCode(values.departmentCode)
    const positionCode = normalizeCode(values.positionCode)
    const lineCode = normalizeCode(values.lineCode)
    const shiftCode = normalizeCode(values.shiftCode)
    const employeeTypeCode = normalizeCode(values.employeeTypeCode)
    const employeeTypeChildCode = normalizeCode(values.employeeTypeChildCode)

    const [department, position, line, shift, employeeType] = await Promise.all([
        departmentCode ? Department.findOne({ companyId: company._id, branchId: branch._id, code: departmentCode, status: { $ne: "ARCHIVED" } }).lean() : null,
        positionCode ? Position.findOne({ companyId: company._id, branchId: branch._id, code: positionCode, status: { $ne: "ARCHIVED" } }).lean() : null,
        lineCode ? Line.findOne({ companyId: company._id, branchId: branch._id, code: lineCode, status: { $ne: "ARCHIVED" } }).lean() : null,
        shiftCode ? Shift.findOne({ companyId: company._id, branchId: branch._id, code: shiftCode, status: { $ne: "ARCHIVED" } }).lean() : null,
        employeeTypeCode ? EmployeeType.findOne({ companyId: company._id, branchId: branch._id, code: employeeTypeCode, status: { $ne: "ARCHIVED" } }).lean() : null,
    ])

    if (departmentCode && !department) return { error: "department" }
    if (positionCode && !position) return { error: "position" }
    if (lineCode && !line) return { error: "line" }
    if (shiftCode && !shift) return { error: "shift" }
    if (employeeTypeCode && !employeeType) return { error: "employeeType" }

    const child = employeeTypeChildCode && employeeType
        ? (employeeType.children || []).find((item) => normalizeCode(item.code) === employeeTypeChildCode)
        : null
    if (employeeTypeChildCode && !child) return { error: "employeeTypeChild" }

    return {
        company,
        branch,
        department,
        position,
        line,
        shift,
        employeeType,
        child,
    }
}

export async function importManpowerPlansFromRows({ rows, parseErrors = [], user, workspace }) {
    const summary = { created: 0, updated: 0, skipped: 0, errors: [...parseErrors] }

    for (const row of rows) {
        const values = row.values
        const references = await resolveImportReferences(values, workspace)
        if (references.error) {
            summary.errors.push(buildImportError(row.rowNumber, references.error, `errors.report.manpowerPlanImport.${references.error}NotFound`))
            continue
        }

        const year = Number(values.year)
        const month = Number(values.month)
        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            summary.errors.push(buildImportError(row.rowNumber, "year", "errors.report.manpowerPlanImport.yearInvalid"))
            continue
        }
        if (!Number.isInteger(month) || month < 1 || month > 12) {
            summary.errors.push(buildImportError(row.rowNumber, "month", "errors.report.manpowerPlanImport.monthInvalid"))
            continue
        }

        const payload = {
            companyId: references.company._id.toString(),
            branchId: references.branch._id.toString(),
            year,
            month,
            departmentId: references.department?._id?.toString?.() || null,
            positionId: references.position?._id?.toString?.() || null,
            lineId: references.line?._id?.toString?.() || null,
            shiftId: references.shift?._id?.toString?.() || null,
            employeeTypeId: references.employeeType?._id?.toString?.() || null,
            employeeTypeChildId: references.child?._id?.toString?.() || null,
            targetBudget: Number(values.targetBudget || 0),
            targetRoadmap: Number(values.targetRoadmap || 0),
            status: normalizeCode(values.status || "ACTIVE") === "INACTIVE" ? "INACTIVE" : "ACTIVE",
            remark: normalizeText(values.remark),
        }

        try {
            const existing = await ManpowerPlan.findOne({
                companyId: payload.companyId,
                branchId: payload.branchId,
                year: payload.year,
                month: payload.month,
                departmentId: payload.departmentId,
                positionId: payload.positionId,
                lineId: payload.lineId,
                shiftId: payload.shiftId,
                employeeTypeId: payload.employeeTypeId,
                employeeTypeChildId: payload.employeeTypeChildId,
            }).lean()

            if (existing) {
                await updateManpowerPlan({ manpowerPlanId: existing._id.toString(), payload, user })
                summary.updated += 1
            } else {
                await createManpowerPlan({ payload, user })
                summary.created += 1
            }
        } catch (error) {
            summary.errors.push(buildImportError(row.rowNumber, "row", error.messageKey || "errors.report.manpowerPlanImport.rowFailed"))
        }
    }

    return summary
}

export { getExportManpowerPlans }
