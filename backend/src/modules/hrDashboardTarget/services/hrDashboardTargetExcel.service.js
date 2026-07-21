import ExcelJS from "exceljs"
import mongoose from "mongoose"

import {
    clearCacheByPrefix,
} from "../../../shared/cache/memoryCache.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"
import Line from "../../line/models/Line.js"
import EmployeeType from "../../employeeType/models/EmployeeType.js"
import HrDashboardTarget from "../models/HrDashboardTarget.js"

const HEADERS = [
    "Metric",
    "Year",
    "Month",
    "Employee Type Code",
    "Employee Type Child Code",
    "Department Code",
    "Position Code",
    "Line Code",
    "Target Rate",
    "Remark",
    "Status",
]

function text(value) {
    return String(value || "").trim()
}

function code(value) {
    return text(value).toUpperCase()
}

function id(value) {
    return String(value?._id || value?.id || value || "")
}

function keyOf(payload) {
    return [
        payload.metric,
        payload.year,
        payload.month,
        id(payload.departmentId),
        id(payload.positionId),
        id(payload.lineId),
        id(payload.employeeTypeId),
        id(payload.employeeTypeChildId),
    ].join("|")
}

function mapByCode(items) {
    return new Map(items.map((item) => [code(item.code), item]))
}

function headerValue(row, index) {
    return text(row.getCell(index + 1).value)
}

export async function buildHrDashboardTargetTemplate() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Dashboard Targets")

    sheet.addRow(HEADERS)
    sheet.addRow([
        "ABSENCE_RATE",
        new Date().getFullYear(),
        0,
        "",
        "",
        "",
        "",
        "",
        3.5,
        "Whole-year branch target",
        "ACTIVE",
    ])
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
    sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
    }
    sheet.views = [{ state: "frozen", ySplit: 1 }]
    sheet.autoFilter = { from: "A1", to: "K1" }
    sheet.columns = [
        { width: 20 },
        { width: 10 },
        { width: 10 },
        { width: 22 },
        { width: 26 },
        { width: 20 },
        { width: 20 },
        { width: 18 },
        { width: 14 },
        { width: 36 },
        { width: 14 },
    ]
    sheet.getColumn(9).numFmt = "0.00"

    return workbook
}

export async function buildHrDashboardTargetExport(records = []) {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Dashboard Targets")

    sheet.addRow(HEADERS)
    for (const record of records) {
        sheet.addRow([
            record.metric,
            record.year,
            record.month,
            record.employeeType?.code || "",
            record.employeeTypeChildCode || "",
            record.department?.code || "",
            record.position?.code || "",
            record.line?.code || "",
            record.targetRate,
            record.remark || "",
            record.status,
        ])
    }
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
    sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
    }
    sheet.views = [{ state: "frozen", ySplit: 1 }]
    sheet.autoFilter = { from: "A1", to: "K1" }
    sheet.columns = [
        { width: 20 }, { width: 10 }, { width: 10 }, { width: 22 },
        { width: 26 }, { width: 20 }, { width: 20 }, { width: 18 },
        { width: 14 }, { width: 36 }, { width: 14 },
    ]
    sheet.getColumn(9).numFmt = "0.00"

    return workbook
}

export async function parseHrDashboardTargetWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]

    if (!sheet) {
        return { rows: [], errors: [{ row: 0, message: "Workbook does not contain a worksheet." }] }
    }

    const actualHeaders = HEADERS.map((_, index) => headerValue(sheet.getRow(1), index))
    if (actualHeaders.some((header, index) => header !== HEADERS[index])) {
        return {
            rows: [],
            errors: [{ row: 1, message: `Invalid headers. Expected exactly: ${HEADERS.join(", ")}.` }],
        }
    }

    const rows = []
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const values = Array.from({ length: HEADERS.length }, (_, index) => row.getCell(index + 1).value)
        if (values.every((value) => value === null || value === undefined || text(value) === "")) return

        rows.push({
            rowNumber,
            metric: code(values[0]),
            year: Number(values[1]),
            month: Number(values[2]),
            employeeTypeCode: code(values[3]),
            employeeTypeChildCode: code(values[4]),
            departmentCode: code(values[5]),
            positionCode: code(values[6]),
            lineCode: code(values[7]),
            targetRate: Number(values[8]),
            remark: text(values[9]),
            status: code(values[10]) || "ACTIVE",
        })
    })

    return { rows, errors: [] }
}

export async function importHrDashboardTargets({ rows, parseErrors, workspace, user }) {
    const errors = [...parseErrors]
    if (parseErrors.length) {
        return { totalRows: rows.length + errors.length, created: 0, updated: 0, errorCount: errors.length, errors }
    }

    const scope = {
        companyId: workspace.companyId,
        branchId: workspace.branchId,
    }
    const [departments, positions, lines, employeeTypes, existingTargets] = await Promise.all([
        Department.find({ ...scope, status: { $ne: "ARCHIVED" } }).lean(),
        Position.find({ ...scope, status: { $ne: "ARCHIVED" } }).lean(),
        Line.find({ ...scope, status: { $ne: "ARCHIVED" } }).lean(),
        EmployeeType.find({ companyId: workspace.companyId, status: { $ne: "ARCHIVED" } }).lean(),
        HrDashboardTarget.find(scope).lean(),
    ])
    const departmentMap = mapByCode(departments)
    const positionMap = mapByCode(positions)
    const lineMap = mapByCode(lines)
    const employeeTypeMap = mapByCode(employeeTypes)
    const existingMap = new Map(existingTargets.map((item) => [keyOf(item), item]))
    const fileKeys = new Set()
    const payloads = []

    for (const row of rows) {
        const rowErrors = []
        if (!["ABSENCE_RATE", "TURNOVER_RATE"].includes(row.metric)) rowErrors.push("Metric must be ABSENCE_RATE or TURNOVER_RATE.")
        if (!Number.isInteger(row.year) || row.year < 2000 || row.year > 2100) rowErrors.push("Year must be from 2000 to 2100.")
        if (!Number.isInteger(row.month) || row.month < 0 || row.month > 12) rowErrors.push("Month must be 0 for whole year or 1 to 12.")
        if (!Number.isFinite(row.targetRate) || row.targetRate < 0 || row.targetRate > 100) rowErrors.push("Target Rate must be from 0 to 100.")
        if (!["ACTIVE", "INACTIVE"].includes(row.status)) rowErrors.push("Status must be ACTIVE or INACTIVE.")
        if (row.remark.length > 500) rowErrors.push("Remark cannot exceed 500 characters.")

        const department = row.departmentCode ? departmentMap.get(row.departmentCode) : null
        const position = row.positionCode ? positionMap.get(row.positionCode) : null
        const line = row.lineCode ? lineMap.get(row.lineCode) : null
        const employeeType = row.employeeTypeCode ? employeeTypeMap.get(row.employeeTypeCode) : null
        if (row.departmentCode && !department) rowErrors.push(`Department ${row.departmentCode} was not found in this branch.`)
        if (row.positionCode && !position) rowErrors.push(`Position ${row.positionCode} was not found in this branch.`)
        if (row.lineCode && !line) rowErrors.push(`Line ${row.lineCode} was not found in this branch.`)
        if (row.employeeTypeCode && !employeeType) rowErrors.push(`Employee Type ${row.employeeTypeCode} was not found.`)
        if (position && department && id(position.departmentId) !== id(department._id)) rowErrors.push("Position does not belong to the selected department.")
        if (line && department && id(line.departmentId) !== id(department._id)) rowErrors.push("Line does not belong to the selected department.")
        if ((position || line) && !department) rowErrors.push("Department Code is required when Position Code or Line Code is provided.")

        let child = null
        if (row.employeeTypeChildCode) {
            if (!employeeType) rowErrors.push("Employee Type Code is required when a child code is provided.")
            else {
                child = (employeeType.children || []).find((item) => code(item.code) === row.employeeTypeChildCode)
                if (!child) rowErrors.push(`Employee Type Child ${row.employeeTypeChildCode} was not found.`)
            }
        }

        const payload = {
            ...scope,
            metric: row.metric,
            year: row.year,
            month: row.month,
            departmentId: department?._id || null,
            positionId: position?._id || null,
            lineId: line?._id || null,
            employeeTypeId: employeeType?._id || null,
            employeeTypeChildId: child?._id || null,
            employeeTypeChildCode: child?.code || "",
            employeeTypeChildName: child?.name || "",
            targetRate: row.targetRate,
            remark: row.remark,
            status: row.status,
            updatedByAccountId: user.accountId,
        }
        const uniqueKey = keyOf(payload)
        if (fileKeys.has(uniqueKey)) rowErrors.push("Duplicate metric, period, and scope inside the Excel file.")
        fileKeys.add(uniqueKey)
        const existing = existingMap.get(uniqueKey)
        if (existing?.status === "ARCHIVED") rowErrors.push("An archived target already exists for this metric, period, and scope.")

        if (rowErrors.length) errors.push({ row: row.rowNumber, message: rowErrors.join(" ") })
        else payloads.push({ payload, existing })
    }

    if (errors.length) {
        return { totalRows: rows.length, created: 0, updated: 0, errorCount: errors.length, errors }
    }

    const operations = payloads.map(({ payload }) => ({
        updateOne: {
            filter: {
                ...scope,
                metric: payload.metric,
                year: payload.year,
                month: payload.month,
                departmentId: payload.departmentId,
                positionId: payload.positionId,
                lineId: payload.lineId,
                employeeTypeId: payload.employeeTypeId,
                employeeTypeChildId: payload.employeeTypeChildId,
            },
            update: {
                $set: payload,
                $setOnInsert: { createdByAccountId: user.accountId },
            },
            upsert: true,
        },
    }))

    const session = await mongoose.startSession()
    try {
        await session.withTransaction(async () => {
            if (operations.length) await HrDashboardTarget.bulkWrite(operations, { session, ordered: true })
        })
    } finally {
        await session.endSession()
    }
    clearCacheByPrefix("hrDashboardTarget:list:")
    clearCacheByPrefix("hr-dashboard:data:")

    return {
        totalRows: rows.length,
        created: payloads.filter((item) => !item.existing).length,
        updated: payloads.filter((item) => item.existing).length,
        errorCount: 0,
        errors: [],
    }
}
