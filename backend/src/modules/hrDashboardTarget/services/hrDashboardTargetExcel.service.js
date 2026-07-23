import ExcelJS from "exceljs"
import mongoose from "mongoose"

import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import EmployeeType from "../../employeeType/models/EmployeeType.js"
import HrDashboardTarget from "../models/HrDashboardTarget.js"

const HEADERS = [
    "Target Scope",
    "Metric",
    "Year",
    "Month",
    "Employee Type Code",
    "Employee Type Child Code",
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
        payload.targetScope,
        id(payload.employeeTypeId),
        id(payload.employeeTypeChildId),
    ].join("|")
}

function styleSheet(sheet) {
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
    sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
    }
    sheet.views = [{ state: "frozen", ySplit: 1 }]
    sheet.autoFilter = { from: "A1", to: "I1" }
    sheet.columns = [
        { width: 20 },
        { width: 20 },
        { width: 10 },
        { width: 10 },
        { width: 24 },
        { width: 26 },
        { width: 14 },
        { width: 40 },
        { width: 14 },
    ]
    sheet.getColumn(7).numFmt = "0.00"
}

export async function buildHrDashboardTargetTemplate() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Dashboard Targets")
    sheet.addRow(HEADERS)
    sheet.addRow([
        "OVERALL",
        "ABSENCE_RATE",
        new Date().getFullYear(),
        0,
        "",
        "",
        3.5,
        "Whole-year overall target",
        "ACTIVE",
    ])
    sheet.addRow([
        "EMPLOYEE_TYPE",
        "ABSENCE_RATE",
        new Date().getFullYear(),
        0,
        "BLUE_COLLAR",
        "DIRECT",
        3.5,
        "Whole-year employee type target",
        "ACTIVE",
    ])
    styleSheet(sheet)
    return workbook
}

export async function buildHrDashboardTargetExport(records = []) {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Dashboard Targets")
    sheet.addRow(HEADERS)
    for (const record of records) {
        sheet.addRow([
            record.targetScope,
            record.metric,
            record.year,
            record.month,
            record.employeeType?.code || "",
            record.employeeTypeChildCode || "",
            record.targetRate,
            record.remark || "",
            record.status,
        ])
    }
    styleSheet(sheet)
    return workbook
}

export async function parseHrDashboardTargetWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    if (!sheet) {
        return { rows: [], errors: [{ row: 0, message: "Workbook does not contain a worksheet." }] }
    }

    const actual = HEADERS.map((_, index) => text(sheet.getRow(1).getCell(index + 1).value))
    if (actual.some((header, index) => header !== HEADERS[index])) {
        return {
            rows: [],
            errors: [{ row: 1, message: `Invalid headers. Expected exactly: ${HEADERS.join(", ")}.` }],
        }
    }

    const rows = []
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const values = HEADERS.map((_, index) => row.getCell(index + 1).value)
        if (values.every((value) => value === null || value === undefined || text(value) === "")) return
        rows.push({
            rowNumber,
            targetScope: code(values[0]),
            metric: code(values[1]),
            year: Number(values[2]),
            month: Number(values[3]),
            employeeTypeCode: code(values[4]),
            employeeTypeChildCode: code(values[5]),
            targetRate: Number(values[6]),
            remark: text(values[7]),
            status: code(values[8]) || "ACTIVE",
        })
    })
    return { rows, errors: [] }
}

export async function importHrDashboardTargets({ rows, parseErrors, workspace, user }) {
    const errors = [...parseErrors]
    if (errors.length) {
        return { totalRows: rows.length, created: 0, updated: 0, errorCount: errors.length, errors }
    }

    const scope = { companyId: workspace.companyId, branchId: workspace.branchId }
    const [employeeTypes, existingTargets] = await Promise.all([
        EmployeeType.find({ companyId: workspace.companyId, status: { $ne: "ARCHIVED" } }).lean(),
        HrDashboardTarget.find(scope).lean(),
    ])
    const employeeTypeMap = new Map(employeeTypes.map((item) => [code(item.code), item]))
    const existingMap = new Map(existingTargets.map((item) => [keyOf(item), item]))
    const fileKeys = new Set()
    const payloads = []

    for (const row of rows) {
        const rowErrors = []
        if (!["OVERALL", "EMPLOYEE_TYPE"].includes(row.targetScope)) rowErrors.push("Target Scope must be OVERALL or EMPLOYEE_TYPE.")
        if (!["ABSENCE_RATE", "TURNOVER_RATE"].includes(row.metric)) rowErrors.push("Metric must be ABSENCE_RATE or TURNOVER_RATE.")
        if (!Number.isInteger(row.year) || row.year < 2000 || row.year > 2100) rowErrors.push("Year must be from 2000 to 2100.")
        if (!Number.isInteger(row.month) || row.month < 0 || row.month > 12) rowErrors.push("Month must be 0 for whole year or 1 to 12.")
        if (row.targetScope === "EMPLOYEE_TYPE" && !row.employeeTypeCode) rowErrors.push("Employee Type Code is required for EMPLOYEE_TYPE scope.")
        if (row.targetScope === "OVERALL" && (row.employeeTypeCode || row.employeeTypeChildCode)) rowErrors.push("Employee Type and Child Code must be blank for OVERALL scope.")
        if (!Number.isFinite(row.targetRate) || row.targetRate < 0 || row.targetRate > 100) rowErrors.push("Target Rate must be from 0 to 100.")
        if (!["ACTIVE", "INACTIVE"].includes(row.status)) rowErrors.push("Status must be ACTIVE or INACTIVE.")
        if (row.remark.length > 500) rowErrors.push("Remark cannot exceed 500 characters.")

        const employeeType = row.targetScope === "EMPLOYEE_TYPE"
            ? employeeTypeMap.get(row.employeeTypeCode)
            : null
        if (row.employeeTypeCode && !employeeType) rowErrors.push(`Employee Type ${row.employeeTypeCode} was not found.`)
        const children = employeeType?.children || []
        const employeeTypeChild = row.employeeTypeChildCode
            ? children.find((child) => code(child.code) === row.employeeTypeChildCode)
            : null
        if (row.targetScope === "EMPLOYEE_TYPE" && children.length && !row.employeeTypeChildCode) {
            rowErrors.push(`Employee Type Child Code is required for ${row.employeeTypeCode}.`)
        }
        if (row.employeeTypeChildCode && !employeeTypeChild) {
            rowErrors.push(`Employee Type Child ${row.employeeTypeChildCode} was not found under ${row.employeeTypeCode}.`)
        }
        if (!children.length && row.employeeTypeChildCode) {
            rowErrors.push(`Employee Type ${row.employeeTypeCode} does not have child groups.`)
        }

        const payload = {
            ...scope,
            metric: row.metric,
            year: row.year,
            month: row.month,
            targetScope: row.targetScope,
            employeeTypeId: employeeType?._id,
            employeeTypeChildId: employeeTypeChild?._id || null,
            employeeTypeChildCode: employeeTypeChild?.code || "",
            employeeTypeChildName: employeeTypeChild?.name || "",
            targetRate: row.targetRate,
            remark: row.remark,
            status: row.status,
            updatedByAccountId: user.accountId,
        }
        const uniqueKey = keyOf(payload)
        if (fileKeys.has(uniqueKey)) rowErrors.push("Duplicate target scope, metric, and period inside the Excel file.")
        fileKeys.add(uniqueKey)
        const existing = existingMap.get(uniqueKey)
        if (existing?.status === "ARCHIVED") rowErrors.push("An archived target already exists for this metric, period, employee type, and child.")

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
                targetScope: payload.targetScope,
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
