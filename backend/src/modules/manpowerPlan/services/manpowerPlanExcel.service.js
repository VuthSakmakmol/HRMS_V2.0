import ExcelJS from "exceljs"

import { AppError } from "../../../shared/errors/AppError.js"
import Branch from "../../organization/models/Branch.js"
import Company from "../../organization/models/Company.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"
import ManpowerPlan from "../models/ManpowerPlan.js"
import {
    buildManpowerPlanScopeFilter,
    createManpowerPlan,
    getExportManpowerPlans,
    makeManpowerPlanDuplicateKey,
    updateManpowerPlan,
} from "./manpowerPlan.service.js"

const TEMPLATE_HEADERS = Object.freeze([
    "companyCode",
    "branchCode",
    "year",
    "month",
    "departmentCode",
    "positionCode",
    "targetBudget",
    "targetRoadmap",
    "status",
    "remark",
])

const MAX_TARGET = 1_000_000
const ALLOWED_STATUSES = new Set(["ACTIVE", "INACTIVE"])

function normalizeCode(value) {
    return String(value || "").trim().replace(/\s+/g, "_").toUpperCase()
}

function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ")
}

function displayValue(value) {
    if (value === null || value === undefined) return ""
    if (value instanceof Date) return value.toISOString()
    return String(value).trim()
}

function getCellValue(row, index) {
    const value = row.getCell(index).value
    if (value === null || value === undefined) return ""
    if (value instanceof Date) return value

    if (typeof value === "object") {
        if (value.text !== undefined) return value.text
        if (value.result !== undefined) return value.result
        if (Array.isArray(value.richText)) {
            return value.richText.map((item) => item.text || "").join("")
        }
    }

    return value
}

function buildImportError(
    rowNumber,
    field,
    messageKey,
    { value = "", expected = "" } = {},
) {
    return {
        rowNumber,
        field,
        messageKey,
        value: displayValue(value),
        expected: displayValue(expected),
    }
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
        { header: "targetBudget", key: "targetBudget", width: 18 },
        { header: "targetRoadmap", key: "targetRoadmap", width: 18 },
        { header: "status", key: "status", width: 14 },
        { header: "remark", key: "remark", width: 42 },
    ]

    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D4ED8" },
    }
    headerRow.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
    }
    headerRow.height = 30
    worksheet.autoFilter = {
        from: "A1",
        to: `${worksheet.getColumn(TEMPLATE_HEADERS.length).letter}1`,
    }

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
        targetBudget: 1200,
        targetRoadmap: 1180,
        status: "ACTIVE",
        remark: "Monthly manpower target",
    })

    const instructions = workbook.addWorksheet("Instructions")
    instructions.columns = [
        { header: "Rule", key: "rule", width: 30 },
        { header: "Description", key: "description", width: 105 },
    ]
    instructions.addRows([
        {
            rule: "File format",
            description: "Use the .xlsx sample file. Keep the first sheet and all header names unchanged.",
        },
        {
            rule: "Required scope",
            description: "Each manpower plan is uniquely identified by company, branch, year, month, department, and position.",
        },
        {
            rule: "No employee dimensions",
            description: "Do not enter Line, Shift, Employee Type, or Employee Type Child. These belong to employee/setup data and are not manpower budget dimensions.",
        },
        {
            rule: "Workspace",
            description: "companyCode and branchCode must match the company and branch selected in the HRMS top bar.",
        },
        {
            rule: "Department and position",
            description: "departmentCode and positionCode are required. The position must belong to the selected department and branch.",
        },
        {
            rule: "Period",
            description: "year must be from 2000 to 2100. month must be a whole number from 1 to 12.",
        },
        {
            rule: "Targets",
            description: "targetBudget and targetRoadmap must be whole numbers from 0 to 1,000,000. Blank target cells are treated as 0.",
        },
        {
            rule: "Status",
            description: "Use ACTIVE or INACTIVE. Blank status is treated as ACTIVE.",
        },
        {
            rule: "Validation",
            description: "The complete workbook is validated before records are saved. If any validation error exists, correct the listed rows and import again.",
        },
    ])

    const instructionHeader = instructions.getRow(1)
    instructionHeader.font = { bold: true, color: { argb: "FFFFFFFF" } }
    instructionHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D4ED8" },
    }
    instructionHeader.alignment = { vertical: "middle", horizontal: "center" }
    instructions.getColumn(2).alignment = { vertical: "top", wrapText: true }

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
            targetBudget: plan.targetBudget,
            targetRoadmap: plan.targetRoadmap,
            status: plan.status,
            remark: plan.remark || "",
        })
    }

    return workbook
}

function countDataRows(worksheet) {
    let totalRows = 0

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const hasValue = TEMPLATE_HEADERS.some((_, index) =>
            normalizeText(displayValue(getCellValue(row, index + 1))) !== "",
        )
        if (hasValue) totalRows += 1
    })

    return totalRows
}

export async function parseManpowerPlanImportWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()

    try {
        await workbook.xlsx.load(buffer)
    } catch {
        throw new AppError({
            statusCode: 422,
            code: "MANPOWER_PLAN_IMPORT_INVALID_FILE",
            messageKey: "errors.report.manpowerPlanImport.invalidFile",
            details: {
                errors: [
                    buildImportError(
                        null,
                        "file",
                        "errors.report.manpowerPlanImport.invalidFile",
                        { expected: "A valid .xlsx Excel workbook" },
                    ),
                ],
            },
        })
    }

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
        throw new AppError({
            statusCode: 422,
            code: "MANPOWER_PLAN_IMPORT_EMPTY_WORKBOOK",
            messageKey: "errors.report.manpowerPlanImport.emptyWorkbook",
            details: {
                errors: [
                    buildImportError(
                        null,
                        "file",
                        "errors.report.manpowerPlanImport.emptyWorkbook",
                        { expected: "A workbook with a first worksheet" },
                    ),
                ],
            },
        })
    }

    const totalRows = countDataRows(worksheet)
    const headerRow = worksheet.getRow(1)
    const errors = []

    TEMPLATE_HEADERS.forEach((expectedHeader, index) => {
        const actualHeader = normalizeText(
            displayValue(getCellValue(headerRow, index + 1)),
        )

        if (actualHeader !== expectedHeader) {
            errors.push(
                buildImportError(
                    1,
                    expectedHeader,
                    "errors.report.manpowerPlanImport.headerInvalid",
                    {
                        value: actualHeader,
                        expected: expectedHeader,
                    },
                ),
            )
        }
    })

    if (errors.length) return { rows: [], errors, totalRows }

    const rows = []
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return

        const values = {}
        TEMPLATE_HEADERS.forEach((header, index) => {
            values[header] = getCellValue(row, index + 1)
        })

        const empty = Object.values(values).every(
            (value) => normalizeText(displayValue(value)) === "",
        )

        if (!empty) rows.push({ rowNumber, values })
    })

    if (!rows.length) {
        errors.push(
            buildImportError(
                null,
                "file",
                "errors.report.manpowerPlanImport.noDataRows",
                { expected: "At least one manpower plan row below the header" },
            ),
        )
    }

    return { rows, errors, totalRows }
}

function parseTarget(value, field, rowNumber, errors) {
    const raw = normalizeText(displayValue(value))
    if (!raw) return 0

    const number = Number(raw)
    if (
        !Number.isFinite(number) ||
        !Number.isInteger(number) ||
        number < 0 ||
        number > MAX_TARGET
    ) {
        errors.push(
            buildImportError(
                rowNumber,
                field,
                "errors.report.manpowerPlanImport.targetInvalid",
                {
                    value: raw,
                    expected: `A whole number from 0 to ${MAX_TARGET.toLocaleString("en-US")}`,
                },
            ),
        )
        return null
    }

    return number
}

function parsePeriodNumber(value, field, rowNumber, minimum, maximum, errors) {
    const raw = normalizeText(displayValue(value))
    const number = Number(raw)

    if (!raw || !Number.isInteger(number) || number < minimum || number > maximum) {
        errors.push(
            buildImportError(
                rowNumber,
                field,
                `errors.report.manpowerPlanImport.${field}Invalid`,
                {
                    value: raw,
                    expected: `A whole number from ${minimum} to ${maximum}`,
                },
            ),
        )
        return null
    }

    return number
}

async function loadImportWorkspace(workspace) {
    const [company, branch] = await Promise.all([
        Company.findById(workspace.companyId).lean(),
        Branch.findOne({
            _id: workspace.branchId,
            companyId: workspace.companyId,
        }).lean(),
    ])

    if (!company || !branch) {
        throw new AppError({
            statusCode: 422,
            code: "MANPOWER_PLAN_IMPORT_WORKSPACE_NOT_FOUND",
            messageKey: "errors.report.manpowerPlanImport.workspaceNotFound",
        })
    }

    return {
        company,
        branch,
        companyCode: normalizeCode(company.code),
        branchCode: normalizeCode(branch.code),
        departmentCache: new Map(),
        positionCache: new Map(),
    }
}

async function findDepartment(code, context) {
    if (context.departmentCache.has(code)) return context.departmentCache.get(code)

    const department = await Department.findOne({
        companyId: context.company._id,
        branchId: context.branch._id,
        code,
        status: { $ne: "ARCHIVED" },
    }).lean()

    context.departmentCache.set(code, department || null)
    return department || null
}

async function findPosition(code, departmentId, context) {
    const key = `${departmentId || ""}::${code}`
    if (context.positionCache.has(key)) return context.positionCache.get(key)

    const position = await Position.findOne({
        companyId: context.company._id,
        branchId: context.branch._id,
        departmentId,
        code,
        status: { $ne: "ARCHIVED" },
    }).lean()

    context.positionCache.set(key, position || null)
    return position || null
}

async function validateImportRow(row, context) {
    const values = row.values
    const errors = []
    const rowNumber = row.rowNumber

    const companyCode = normalizeCode(values.companyCode)
    const branchCode = normalizeCode(values.branchCode)

    if (!companyCode) {
        errors.push(
            buildImportError(
                rowNumber,
                "companyCode",
                "errors.report.manpowerPlanImport.companyCodeRequired",
                { expected: context.company.code },
            ),
        )
    } else if (companyCode !== context.companyCode) {
        errors.push(
            buildImportError(
                rowNumber,
                "companyCode",
                "errors.report.manpowerPlanImport.companyCodeMismatch",
                {
                    value: values.companyCode,
                    expected: context.company.code,
                },
            ),
        )
    }

    if (!branchCode) {
        errors.push(
            buildImportError(
                rowNumber,
                "branchCode",
                "errors.report.manpowerPlanImport.branchCodeRequired",
                { expected: context.branch.code },
            ),
        )
    } else if (branchCode !== context.branchCode) {
        errors.push(
            buildImportError(
                rowNumber,
                "branchCode",
                "errors.report.manpowerPlanImport.branchCodeMismatch",
                {
                    value: values.branchCode,
                    expected: context.branch.code,
                },
            ),
        )
    }

    const year = parsePeriodNumber(values.year, "year", rowNumber, 2000, 2100, errors)
    const month = parsePeriodNumber(values.month, "month", rowNumber, 1, 12, errors)
    const targetBudget = parseTarget(values.targetBudget, "targetBudget", rowNumber, errors)
    const targetRoadmap = parseTarget(values.targetRoadmap, "targetRoadmap", rowNumber, errors)
    const status = normalizeCode(values.status || "ACTIVE")

    if (!ALLOWED_STATUSES.has(status)) {
        errors.push(
            buildImportError(
                rowNumber,
                "status",
                "errors.report.manpowerPlanImport.statusInvalid",
                {
                    value: values.status,
                    expected: "ACTIVE or INACTIVE",
                },
            ),
        )
    }

    const remark = normalizeText(values.remark)
    if (remark.length > 500) {
        errors.push(
            buildImportError(
                rowNumber,
                "remark",
                "errors.report.manpowerPlanImport.remarkTooLong",
                {
                    value: `${remark.length} characters`,
                    expected: "500 characters or fewer",
                },
            ),
        )
    }

    const departmentCode = normalizeCode(values.departmentCode)
    const positionCode = normalizeCode(values.positionCode)

    let department = null
    let position = null

    if (!departmentCode) {
        errors.push(
            buildImportError(
                rowNumber,
                "departmentCode",
                "errors.report.manpowerPlanImport.departmentCodeRequired",
                { expected: `An active department code in branch ${context.branch.code}` },
            ),
        )
    } else {
        department = await findDepartment(departmentCode, context)
        if (!department) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "departmentCode",
                    "errors.report.manpowerPlanImport.departmentCodeNotFound",
                    {
                        value: values.departmentCode,
                        expected: `An active department code in branch ${context.branch.code}`,
                    },
                ),
            )
        }
    }

    if (!positionCode) {
        errors.push(
            buildImportError(
                rowNumber,
                "positionCode",
                "errors.report.manpowerPlanImport.positionCodeRequired",
                { expected: "An active position code under the selected department" },
            ),
        )
    } else if (department) {
        position = await findPosition(positionCode, department._id, context)
        if (!position) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "positionCode",
                    "errors.report.manpowerPlanImport.positionCodeNotFound",
                    {
                        value: values.positionCode,
                        expected: `An active position under department ${department.code}`,
                    },
                ),
            )
        }
    }

    if (errors.length) return { errors, prepared: null }

    const payload = {
        companyId: context.company._id.toString(),
        branchId: context.branch._id.toString(),
        year,
        month,
        departmentId: department._id.toString(),
        positionId: position._id.toString(),
        targetBudget,
        targetRoadmap,
        status,
        remark,
    }

    return {
        errors: [],
        prepared: {
            rowNumber,
            payload,
            duplicateKey: makeManpowerPlanDuplicateKey(payload),
        },
    }
}

function saveErrorDetails(error) {
    if (error?.fields && typeof error.fields === "object") {
        const [field, messages] = Object.entries(error.fields)[0] || []
        return {
            field: field || "row",
            messageKey:
                Array.isArray(messages) && messages[0]
                    ? messages[0]
                    : error.messageKey,
        }
    }

    return {
        field: "row",
        messageKey:
            error?.messageKey || "errors.report.manpowerPlanImport.rowFailed",
    }
}

export async function importManpowerPlansFromRows({
    rows,
    parseErrors = [],
    totalRows = rows.length,
    user,
    workspace,
}) {
    const summary = {
        totalRows,
        created: 0,
        updated: 0,
        skipped: 0,
        validationFailed: false,
        errors: [...parseErrors],
    }

    if (parseErrors.length || !rows.length) {
        summary.validationFailed = true
        summary.skipped = totalRows
        return summary
    }

    const context = await loadImportWorkspace(workspace)
    const preparedRows = []
    const firstRowsByScope = new Map()

    for (const row of rows) {
        const validation = await validateImportRow(row, context)
        summary.errors.push(...validation.errors)
        if (!validation.prepared) continue

        const firstRowNumber = firstRowsByScope.get(validation.prepared.duplicateKey)
        if (firstRowNumber) {
            summary.errors.push(
                buildImportError(
                    row.rowNumber,
                    "row",
                    "errors.report.manpowerPlanImport.duplicateInFile",
                    {
                        value: `Duplicates row ${firstRowNumber}`,
                        expected: "One row for each Company + Branch + Year + Month + Department + Position",
                    },
                ),
            )
            continue
        }

        firstRowsByScope.set(validation.prepared.duplicateKey, row.rowNumber)
        preparedRows.push(validation.prepared)
    }

    if (!summary.errors.length) {
        for (const prepared of preparedRows) {
            const existing = await ManpowerPlan.findOne(
                buildManpowerPlanScopeFilter(prepared.payload),
            ).lean()

            if (existing?.status === "ARCHIVED") {
                summary.errors.push(
                    buildImportError(
                        prepared.rowNumber,
                        "row",
                        "errors.report.manpowerPlanImport.archivedScope",
                        {
                            expected: "Restore the archived position-level plan before importing this scope",
                        },
                    ),
                )
                continue
            }

            prepared.existingId = existing?._id?.toString?.() || null
        }
    }

    if (summary.errors.length) {
        summary.validationFailed = true
        summary.skipped = totalRows
        return summary
    }

    for (const prepared of preparedRows) {
        try {
            if (prepared.existingId) {
                await updateManpowerPlan({
                    manpowerPlanId: prepared.existingId,
                    payload: prepared.payload,
                    user,
                })
                summary.updated += 1
            } else {
                await createManpowerPlan({
                    payload: prepared.payload,
                    user,
                })
                summary.created += 1
            }
        } catch (error) {
            const details = saveErrorDetails(error)
            summary.errors.push(
                buildImportError(
                    prepared.rowNumber,
                    details.field,
                    details.messageKey,
                ),
            )
            summary.skipped += 1
        }
    }

    return summary
}

export { getExportManpowerPlans }
