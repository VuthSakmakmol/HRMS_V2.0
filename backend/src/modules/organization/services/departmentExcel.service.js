import ExcelJS from "exceljs"

import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"
import Branch from "../models/Branch.js"
import Company from "../models/Company.js"
import Department from "../models/Department.js"
import { listDepartments } from "./department.service.js"

const TEMPLATE_HEADERS = [
    "companyCode",
    "branchCode",
    "departmentCode",
    "departmentName",
    "shortName",
    "parentDepartmentCode",
    "status",
    "description",
]

const STATUS_VALUES = ["ACTIVE", "INACTIVE"]

function normalizeCode(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase()
}

function normalizeText(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
}

function normalizeStatus(value) {
    const status = normalizeCode(value || "ACTIVE")

    if (!STATUS_VALUES.includes(status)) {
        return null
    }

    return status
}

function getCellValue(row, index) {
    const cell = row.getCell(index)
    const value = cell.value

    if (value === null || value === undefined) {
        return ""
    }

    if (typeof value === "object") {
        if (value.text) {
            return String(value.text)
        }

        if (value.result) {
            return String(value.result)
        }

        if (value.richText) {
            return value.richText.map((item) => item.text).join("")
        }
    }

    return String(value)
}

function getRowObject(row) {
    const result = {}

    TEMPLATE_HEADERS.forEach((header, index) => {
        result[header] = getCellValue(row, index + 1)
    })

    return result
}

function validateHeaderRow(worksheet) {
    const headerRow = worksheet.getRow(1)

    const actualHeaders = TEMPLATE_HEADERS.map((_, index) =>
        normalizeText(getCellValue(headerRow, index + 1)),
    )

    const isValid = TEMPLATE_HEADERS.every(
        (header, index) => actualHeaders[index] === header,
    )

    if (!isValid) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_DEPARTMENT_IMPORT_INVALID_TEMPLATE",
            messageKey: "errors.organization.departmentImport.invalidTemplate",
        })
    }
}

function buildImportError(rowNumber, field, messageKey) {
    return {
        rowNumber,
        field,
        messageKey,
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
        { header: "departmentCode", key: "departmentCode", width: 20 },
        { header: "departmentName", key: "departmentName", width: 32 },
        { header: "shortName", key: "shortName", width: 18 },
        {
            header: "parentDepartmentCode",
            key: "parentDepartmentCode",
            width: 26,
        },
        { header: "status", key: "status", width: 14 },
        { header: "description", key: "description", width: 42 },
    ]

    const headerRow = worksheet.getRow(1)
    headerRow.height = 22
    headerRow.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
    }
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D4ED8" },
    }
    headerRow.alignment = {
        vertical: "middle",
        horizontal: "center",
    }

    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.border = {
                top: { style: "thin", color: { argb: "FFE5E7EB" } },
                left: { style: "thin", color: { argb: "FFE5E7EB" } },
                bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
                right: { style: "thin", color: { argb: "FFE5E7EB" } },
            }
        })
    })

    return {
        workbook,
        worksheet,
    }
}

export async function buildDepartmentImportTemplateWorkbook() {
    const { workbook, worksheet } = buildWorkbookBase("Department Import")

    worksheet.addRow({
        companyCode: "TRAX",
        branchCode: "PP-HQ",
        departmentCode: "HR",
        departmentName: "Human Resources",
        shortName: "HR",
        parentDepartmentCode: "",
        status: "ACTIVE",
        description: "Human Resources and Administration",
    })

    worksheet.addRow({
        companyCode: "TRAX",
        branchCode: "PP-HQ",
        departmentCode: "PAYROLL",
        departmentName: "Payroll",
        shortName: "Payroll",
        parentDepartmentCode: "HR",
        status: "ACTIVE",
        description: "Payroll team under HR",
    })

    const instructionSheet = workbook.addWorksheet("Instructions")

    instructionSheet.columns = [
        { header: "Field", key: "field", width: 26 },
        { header: "Required", key: "required", width: 14 },
        { header: "Rule", key: "rule", width: 80 },
    ]

    instructionSheet.addRows([
        {
            field: "companyCode",
            required: "Yes",
            rule: "Must match an existing active company code.",
        },
        {
            field: "branchCode",
            required: "Yes",
            rule: "Must match an existing active branch code inside the company.",
        },
        {
            field: "departmentCode",
            required: "Yes",
            rule: "Unique inside the selected company and branch. Letters, numbers, dash, underscore only.",
        },
        {
            field: "departmentName",
            required: "Yes",
            rule: "Department display name.",
        },
        {
            field: "shortName",
            required: "No",
            rule: "Optional short name.",
        },
        {
            field: "parentDepartmentCode",
            required: "No",
            rule: "Optional. Must exist in same company and branch, or be included in this same import file.",
        },
        {
            field: "status",
            required: "No",
            rule: "Allowed values: ACTIVE, INACTIVE. Blank means ACTIVE.",
        },
        {
            field: "description",
            required: "No",
            rule: "Optional description.",
        },
    ])

    instructionSheet.getRow(1).font = {
        bold: true,
    }

    return workbook
}

export async function buildDepartmentExportWorkbook({ departments }) {
    const { workbook, worksheet } = buildWorkbookBase("Departments")

    for (const department of departments) {
        worksheet.addRow({
            companyCode: department.company?.code || "",
            branchCode: department.branch?.code || "",
            departmentCode: department.code || "",
            departmentName: department.name || "",
            shortName: department.shortName || "",
            parentDepartmentCode: department.parentDepartment?.code || "",
            status: department.status || "",
            description: department.description || "",
        })
    }

    return workbook
}

export async function parseDepartmentImportWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()

    await workbook.xlsx.load(buffer)

    const worksheet = workbook.worksheets[0]

    if (!worksheet) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_DEPARTMENT_IMPORT_EMPTY_FILE",
            messageKey: "errors.organization.departmentImport.emptyFile",
        })
    }

    validateHeaderRow(worksheet)

    const rows = []
    const errors = []

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
            return
        }

        const raw = getRowObject(row)

        const isEmpty = Object.values(raw).every(
            (value) => normalizeText(value) === "",
        )

        if (isEmpty) {
            return
        }

        const normalized = {
            rowNumber,
            companyCode: normalizeCode(raw.companyCode),
            branchCode: normalizeCode(raw.branchCode),
            departmentCode: normalizeCode(raw.departmentCode),
            departmentName: normalizeText(raw.departmentName),
            shortName: normalizeText(raw.shortName),
            parentDepartmentCode: normalizeCode(raw.parentDepartmentCode),
            status: normalizeStatus(raw.status),
            description: normalizeText(raw.description),
        }

        if (!normalized.companyCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "companyCode",
                    "errors.organization.departmentImport.companyCodeRequired",
                ),
            )
        }

        if (!normalized.branchCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "branchCode",
                    "errors.organization.departmentImport.branchCodeRequired",
                ),
            )
        }

        if (!normalized.departmentCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "departmentCode",
                    "errors.organization.departmentImport.departmentCodeRequired",
                ),
            )
        } else if (!/^[A-Z0-9_-]{2,30}$/.test(normalized.departmentCode)) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "departmentCode",
                    "errors.organization.departmentImport.departmentCodeInvalid",
                ),
            )
        }

        if (!normalized.departmentName) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "departmentName",
                    "errors.organization.departmentImport.departmentNameRequired",
                ),
            )
        }

        if (!normalized.status) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "status",
                    "errors.organization.departmentImport.statusInvalid",
                ),
            )
        }

        rows.push(normalized)
    })

    if (rows.length === 0) {
        errors.push(
            buildImportError(
                2,
                "file",
                "errors.organization.departmentImport.noDataRows",
            ),
        )
    }

    return {
        rows,
        errors,
    }
}

async function buildCompanyMap({ companyCodes }) {
    const companies = await Company.find({
        code: { $in: [...companyCodes] },
        status: { $ne: "ARCHIVED" },
    }).lean()

    return new Map(companies.map((company) => [company.code, company]))
}

async function buildBranchMap({ branchCodes, companyIds }) {
    const branches = await Branch.find({
        companyId: { $in: [...companyIds] },
        code: { $in: [...branchCodes] },
        status: { $ne: "ARCHIVED" },
    }).lean()

    return new Map(
        branches.map((branch) => [
            `${branch.companyId.toString()}::${branch.code}`,
            branch,
        ]),
    )
}

async function buildDepartmentMap({ branchIds }) {
    const departments = await Department.find({
        branchId: { $in: [...branchIds] },
        status: { $ne: "ARCHIVED" },
    }).lean()

    return new Map(
        departments.map((department) => [
            `${department.branchId.toString()}::${department.code}`,
            department,
        ]),
    )
}

function makeDepartmentKey(branchId, departmentCode) {
    return `${branchId.toString()}::${departmentCode}`
}

function buildImportSummary() {
    return {
        totalRows: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
    }
}

export async function importDepartmentsFromRows({ rows, parseErrors, user }) {
    const summary = buildImportSummary()
    summary.totalRows = rows.length

    const errors = [...parseErrors]

    if (parseErrors.length > 0) {
        summary.skipped = rows.length
        summary.errors = errors
        return summary
    }

    const companyCodes = new Set(rows.map((row) => row.companyCode))
    const branchCodes = new Set(rows.map((row) => row.branchCode))

    const companyMap = await buildCompanyMap({ companyCodes })

    for (const row of rows) {
        if (!companyMap.has(row.companyCode)) {
            errors.push(
                buildImportError(
                    row.rowNumber,
                    "companyCode",
                    "errors.organization.departmentImport.companyNotFound",
                ),
            )
        }
    }

    if (errors.length > 0) {
        summary.skipped = rows.length
        summary.errors = errors
        return summary
    }

    const companyIds = new Set(
        [...companyMap.values()].map((company) => company._id),
    )

    const branchMap = await buildBranchMap({
        branchCodes,
        companyIds,
    })

    const resolvedRows = rows.map((row) => {
        const company = companyMap.get(row.companyCode)
        const branchKey = `${company._id.toString()}::${row.branchCode}`
        const branch = branchMap.get(branchKey)

        if (!branch) {
            errors.push(
                buildImportError(
                    row.rowNumber,
                    "branchCode",
                    "errors.organization.departmentImport.branchNotFound",
                ),
            )
        }

        return {
            ...row,
            company,
            branch,
        }
    })

    if (errors.length > 0) {
        summary.skipped = rows.length
        summary.errors = errors
        return summary
    }

    const branchIds = new Set(resolvedRows.map((row) => row.branch._id))

    const departmentMap = await buildDepartmentMap({
        branchIds,
    })

    const seenDepartmentKeys = new Set()

    for (const row of resolvedRows) {
        const departmentKey = makeDepartmentKey(
            row.branch._id,
            row.departmentCode,
        )

        if (seenDepartmentKeys.has(departmentKey)) {
            errors.push(
                buildImportError(
                    row.rowNumber,
                    "departmentCode",
                    "errors.organization.departmentImport.duplicateInFile",
                ),
            )
        }

        seenDepartmentKeys.add(departmentKey)
    }

    const importDepartmentKeys = new Set(
        resolvedRows.map((row) =>
            makeDepartmentKey(row.branch._id, row.departmentCode),
        ),
    )

    for (const row of resolvedRows) {
        if (!row.parentDepartmentCode) {
            continue
        }

        if (row.parentDepartmentCode === row.departmentCode) {
            errors.push(
                buildImportError(
                    row.rowNumber,
                    "parentDepartmentCode",
                    "errors.organization.department.parentSelf",
                ),
            )
            continue
        }

        const parentKey = makeDepartmentKey(
            row.branch._id,
            row.parentDepartmentCode,
        )

        if (!departmentMap.has(parentKey) && !importDepartmentKeys.has(parentKey)) {
            errors.push(
                buildImportError(
                    row.rowNumber,
                    "parentDepartmentCode",
                    "errors.organization.department.parentNotFound",
                ),
            )
        }
    }

    if (errors.length > 0) {
        summary.skipped = rows.length
        summary.errors = errors
        return summary
    }

    for (const row of resolvedRows) {
        const departmentKey = makeDepartmentKey(
            row.branch._id,
            row.departmentCode,
        )

        const existingDepartment = departmentMap.get(departmentKey)

        if (existingDepartment) {
            const updatedDepartment = await Department.findByIdAndUpdate(
                existingDepartment._id,
                {
                    $set: {
                        name: row.departmentName,
                        shortName: row.shortName,
                        description: row.description,
                        status: row.status,
                        updatedByAccountId: user.accountId,
                    },
                },
                {
                    new: true,
                    runValidators: true,
                    context: "query",
                },
            ).lean()

            departmentMap.set(departmentKey, updatedDepartment)
            summary.updated += 1
        } else {
            const createdDepartment = await Department.create({
                companyId: row.company._id,
                branchId: row.branch._id,
                parentDepartmentId: null,
                code: row.departmentCode,
                name: row.departmentName,
                shortName: row.shortName,
                description: row.description,
                status: row.status,
                createdByAccountId: user.accountId,
                updatedByAccountId: user.accountId,
            })

            departmentMap.set(departmentKey, createdDepartment.toObject())
            summary.created += 1
        }
    }

    for (const row of resolvedRows) {
        const departmentKey = makeDepartmentKey(
            row.branch._id,
            row.departmentCode,
        )

        const department = departmentMap.get(departmentKey)

        if (!row.parentDepartmentCode) {
            await Department.findByIdAndUpdate(department._id, {
                $set: {
                    parentDepartmentId: null,
                    updatedByAccountId: user.accountId,
                },
            })

            continue
        }

        const parentKey = makeDepartmentKey(
            row.branch._id,
            row.parentDepartmentCode,
        )

        const parentDepartment = departmentMap.get(parentKey)

        await Department.findByIdAndUpdate(department._id, {
            $set: {
                parentDepartmentId: parentDepartment._id,
                updatedByAccountId: user.accountId,
            },
        })
    }

    clearCacheByPrefix("department:list:")

    return summary
}

export async function getExportDepartments({ query, user }) {
    const result = await listDepartments({
        query: {
            ...query,
            page: 1,
            limit: 10000,
        },
        user,
    })

    return result.items
}
