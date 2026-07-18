import ExcelJS from "exceljs"

import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Company from "../../organization/models/Company.js"
import Position from "../../organization/models/Position.js"
import EmployeeType from "../models/EmployeeType.js"
import { listEmployeeTypes } from "./employeeType.service.js"

const TEMPLATE_HEADERS = [
    "companyCode",
    "branchCode",
    "employeeTypeCode",
    "employeeTypeName",
    "dashboardCategory",
    "positionAssignmentMode",
    "childCode",
    "childName",
    "childDashboardCategory",
    "childPositionAssignmentMode",
    "positionCodes",
    "status",
    "description",
]

const STATUS_VALUES = ["ACTIVE", "INACTIVE"]
const POSITION_ASSIGNMENT_MODES = ["ALL_POSITIONS", "SPECIFIC_POSITIONS"]

function normalizeCode(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, "")
}

function normalizeText(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
}

function normalizeDashboardCategory(value) {
    const normalized = String(value || "").trim().replace(/[\s-]+/g, "_").replace(/[^A-Za-z0-9_]/g, "").toUpperCase()
    return normalized.length >= 2 && normalized.length <= 80 ? normalized : null
}

function normalizeAssignmentMode(value) {
    const normalized = normalizeCode(value || "SPECIFIC_POSITIONS")

    if (normalized === "ALL" || normalized === "ALL_POSITION") {
        return "ALL_POSITIONS"
    }

    if (normalized === "SPECIFIC" || normalized === "POSITION") {
        return "SPECIFIC_POSITIONS"
    }

    return POSITION_ASSIGNMENT_MODES.includes(normalized) ? normalized : null
}

function normalizeStatus(value) {
    const status = normalizeCode(value || "ACTIVE")

    if (!STATUS_VALUES.includes(status)) {
        return null
    }

    return status
}

function splitCodes(value) {
    return String(value || "")
        .split(",")
        .map((item) => normalizeCode(item))
        .filter(Boolean)
}

function getCellValue(row, index) {
    const cell = row.getCell(index)
    const value = cell.value

    if (value === null || value === undefined) {
        return ""
    }

    if (typeof value === "object") {
        if (value.text) return String(value.text)
        if (value.result) return String(value.result)
        if (value.richText) return value.richText.map((item) => item.text).join("")
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
            code: "ORGANIZATION_EMPLOYEE_TYPE_IMPORT_INVALID_TEMPLATE",
            messageKey:
                "errors.organization.employeeTypeImport.invalidTemplate",
        })
    }
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
        { header: "employeeTypeCode", key: "employeeTypeCode", width: 22 },
        { header: "employeeTypeName", key: "employeeTypeName", width: 28 },
        { header: "dashboardCategory", key: "dashboardCategory", width: 26 },
        { header: "positionAssignmentMode", key: "positionAssignmentMode", width: 28 },
        { header: "childCode", key: "childCode", width: 18 },
        { header: "childName", key: "childName", width: 22 },
        { header: "childDashboardCategory", key: "childDashboardCategory", width: 28 },
        {
            header: "childPositionAssignmentMode",
            key: "childPositionAssignmentMode",
            width: 32,
        },
        { header: "positionCodes", key: "positionCodes", width: 42 },
        { header: "status", key: "status", width: 14 },
        { header: "description", key: "description", width: 46 },
    ]

    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D4ED8" },
    }
    headerRow.alignment = { vertical: "middle", horizontal: "center" }

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

    return { workbook, worksheet }
}

export async function buildEmployeeTypeImportTemplateWorkbook() {
    const { workbook, worksheet } = buildWorkbookBase("Employee Type Import")

    worksheet.addRows([
        {
            companyCode: "TRAX",
            branchCode: "PP",
            employeeTypeCode: "BLUE_COLLAR",
            employeeTypeName: "Blue Collar",
            dashboardCategory: "PRODUCTION",
            positionAssignmentMode: "SPECIFIC_POSITIONS",
            childCode: "SEWER",
            childName: "Sewer",
            childDashboardCategory: "SEWING",
            childPositionAssignmentMode: "SPECIFIC_POSITIONS",
            positionCodes: "SEWER",
            status: "ACTIVE",
            description: "Blue collar sewer positions.",
        },
        {
            companyCode: "TRAX",
            branchCode: "PP",
            employeeTypeCode: "BLUE_COLLAR",
            employeeTypeName: "Blue Collar",
            dashboardCategory: "PRODUCTION",
            positionAssignmentMode: "SPECIFIC_POSITIONS",
            childCode: "NON_SEWER",
            childName: "Non-Sewer",
            childDashboardCategory: "NON_SEWING",
            childPositionAssignmentMode: "SPECIFIC_POSITIONS",
            positionCodes: "CUTTER,QC,PACKING",
            status: "ACTIVE",
            description: "Blue collar non-sewer positions.",
        },
        {
            companyCode: "TRAX",
            branchCode: "PP",
            employeeTypeCode: "WHITE_COLLAR",
            employeeTypeName: "White Collar",
            dashboardCategory: "OFFICE",
            positionAssignmentMode: "ALL_POSITIONS",
            childCode: "",
            childName: "",
            childDashboardCategory: "",
            childPositionAssignmentMode: "",
            positionCodes: "",
            status: "ACTIVE",
            description: "White collar, office, management, or all allowed positions.",
        },
    ])

    const instructionSheet = workbook.addWorksheet("Instructions")

    instructionSheet.columns = [
        { header: "Field", key: "field", width: 32 },
        { header: "Required", key: "required", width: 14 },
        { header: "Rule", key: "rule", width: 120 },
    ]

    instructionSheet.addRows([
        { field: "companyCode", required: "Yes", rule: "Existing active company code." },
        { field: "branchCode", required: "Yes", rule: "Existing active branch code belonging to company." },
        { field: "employeeTypeCode", required: "Yes", rule: "Example: BLUE_COLLAR or WHITE_COLLAR." },
        { field: "employeeTypeName", required: "Yes", rule: "Display name." },
        { field: "dashboardCategory", required: "Yes", rule: "User-defined category, for example PRODUCTION, OFFICE, MANAGEMENT, or CONTRACTOR." },
        { field: "positionAssignmentMode", required: "Yes", rule: "ALL_POSITIONS or SPECIFIC_POSITIONS." },
        { field: "childCode", required: "No", rule: "Use child rows for groups like SEWER and NON_SEWER under BLUE_COLLAR." },
        { field: "childDashboardCategory", required: "When child used", rule: "Dashboard category for the child group." },
        { field: "childPositionAssignmentMode", required: "When child used", rule: "ALL_POSITIONS or SPECIFIC_POSITIONS. Multiple children should use SPECIFIC_POSITIONS." },
        { field: "positionCodes", required: "When SPECIFIC_POSITIONS", rule: "Comma-separated position codes. Empty is allowed only for ALL_POSITIONS." },
        { field: "status", required: "No", rule: "ACTIVE or INACTIVE. Empty defaults ACTIVE." },
    ])

    return workbook
}

export async function parseEmployeeTypeImportWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const worksheet = workbook.worksheets[0]

    if (!worksheet) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_EMPLOYEE_TYPE_IMPORT_EMPTY_FILE",
            messageKey: "errors.organization.employeeTypeImport.emptyFile",
        })
    }

    validateHeaderRow(worksheet)

    const rows = []
    const errors = []

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return

        const rowObject = getRowObject(row)
        const isEmpty = TEMPLATE_HEADERS.every(
            (header) => !normalizeText(rowObject[header]),
        )

        if (isEmpty) return

        const companyCode = normalizeCode(rowObject.companyCode)
        const employeeTypeCode = normalizeCode(rowObject.employeeTypeCode)
        const employeeTypeName = normalizeText(rowObject.employeeTypeName)
        const dashboardCategory = normalizeDashboardCategory(
            rowObject.dashboardCategory,
        )
        const positionAssignmentMode = normalizeAssignmentMode(
            rowObject.positionAssignmentMode,
        )
        const childCode = normalizeCode(rowObject.childCode)
        const childName = normalizeText(rowObject.childName)
        const childDashboardCategory = childCode
            ? normalizeDashboardCategory(rowObject.childDashboardCategory)
            : null
        const childPositionAssignmentMode = childCode
            ? normalizeAssignmentMode(rowObject.childPositionAssignmentMode)
            : null
        const positionCodes = splitCodes(rowObject.positionCodes)
        const status = normalizeStatus(rowObject.status)
        const description = normalizeText(rowObject.description)

        if (!companyCode) {
            errors.push(buildImportError(rowNumber, "companyCode", "errors.organization.employeeTypeImport.companyCodeRequired"))
        }

        if (!employeeTypeCode) {
            errors.push(buildImportError(rowNumber, "employeeTypeCode", "errors.organization.employeeTypeImport.employeeTypeCodeRequired"))
        }

        if (employeeTypeCode && !/^[A-Z0-9_-]{2,30}$/.test(employeeTypeCode)) {
            errors.push(buildImportError(rowNumber, "employeeTypeCode", "errors.organization.employeeTypeImport.employeeTypeCodeInvalid"))
        }

        if (!employeeTypeName) {
            errors.push(buildImportError(rowNumber, "employeeTypeName", "errors.organization.employeeTypeImport.employeeTypeNameRequired"))
        }

        if (!dashboardCategory) {
            errors.push(buildImportError(rowNumber, "dashboardCategory", "errors.organization.employeeTypeImport.dashboardCategoryInvalid"))
        }

        if (!positionAssignmentMode) {
            errors.push(buildImportError(rowNumber, "positionAssignmentMode", "errors.organization.employeeTypeImport.positionAssignmentModeInvalid"))
        }

        if (childCode && !childName) {
            errors.push(buildImportError(rowNumber, "childName", "errors.organization.employeeTypeImport.childNameRequired"))
        }

        if (childCode && !childDashboardCategory) {
            errors.push(buildImportError(rowNumber, "childDashboardCategory", "errors.organization.employeeTypeImport.dashboardCategoryInvalid"))
        }

        if (childCode && !childPositionAssignmentMode) {
            errors.push(buildImportError(rowNumber, "childPositionAssignmentMode", "errors.organization.employeeTypeImport.positionAssignmentModeInvalid"))
        }

        const effectiveMode = childCode
            ? childPositionAssignmentMode
            : positionAssignmentMode

        if (effectiveMode === "SPECIFIC_POSITIONS" && positionCodes.length === 0) {
            errors.push(buildImportError(rowNumber, "positionCodes", "errors.organization.employeeTypeImport.positionCodesRequired"))
        }

        if (!status) {
            errors.push(buildImportError(rowNumber, "status", "errors.organization.employeeTypeImport.statusInvalid"))
        }

        rows.push({
            rowNumber,
            companyCode,
            employeeTypeCode,
            employeeTypeName,
            dashboardCategory: dashboardCategory || "UNSPECIFIED",
            positionAssignmentMode: positionAssignmentMode || "SPECIFIC_POSITIONS",
            childCode,
            childName,
            childDashboardCategory: childDashboardCategory || "UNSPECIFIED",
            childPositionAssignmentMode:
                childPositionAssignmentMode || "SPECIFIC_POSITIONS",
            positionCodes,
            status: status || "ACTIVE",
            description,
        })
    })

    if (rows.length === 0) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_EMPLOYEE_TYPE_IMPORT_NO_DATA_ROWS",
            messageKey: "errors.organization.employeeTypeImport.noDataRows",
        })
    }

    return { rows, errors }
}

async function findCompanyByCode(companyCode) {
    return Company.findOne({ code: companyCode, status: { $ne: "ARCHIVED" } }).lean()
}

async function findPositionsByCodes({ companyId, branchId, positionCodes }) {
    if (positionCodes.length === 0) return []

    return Position.find({
        companyId,
        branchId,
        code: { $in: positionCodes },
        status: { $ne: "ARCHIVED" },
    }).lean()
}

async function findPositionMappingConflict({
    companyId,
    branchId,
    positionIds,
    employeeTypeId = null,
}) {
    if (positionIds.length === 0) return null

    const filter = {
        companyId,
        branchId,
        status: { $ne: "ARCHIVED" },
        $or: [
            { positionIds: { $in: positionIds } },
            { "children.positionIds": { $in: positionIds } },
        ],
    }

    if (employeeTypeId) filter._id = { $ne: employeeTypeId }

    return EmployeeType.findOne(filter).select("code name").lean()
}

function groupRows(rows) {
    const groups = new Map()

    for (const row of rows) {
        const key = `${row.companyCode}:${row.employeeTypeCode}`

        if (!groups.has(key)) {
            groups.set(key, {
                companyCode: row.companyCode,
                employeeTypeCode: row.employeeTypeCode,
                employeeTypeName: row.employeeTypeName,
                dashboardCategory: row.dashboardCategory,
                positionAssignmentMode: row.positionAssignmentMode,
                status: row.status,
                description: row.description,
                rowNumbers: [],
                directPositionCodes: [],
                childrenByCode: new Map(),
            })
        }

        const group = groups.get(key)
        group.rowNumbers.push(row.rowNumber)

        if (row.childCode) {
            if (!group.childrenByCode.has(row.childCode)) {
                group.childrenByCode.set(row.childCode, {
                    code: row.childCode,
                    name: row.childName,
                    dashboardCategory: row.childDashboardCategory,
                    positionAssignmentMode: row.childPositionAssignmentMode,
                    rowNumbers: [],
                    positionCodes: [],
                })
            }

            const child = group.childrenByCode.get(row.childCode)
            child.rowNumbers.push(row.rowNumber)
            child.positionCodes.push(...row.positionCodes)
            continue
        }

        group.directPositionCodes.push(...row.positionCodes)
    }

    return [...groups.values()]
}

function hasDuplicate(values = []) {
    return new Set(values).size !== values.length
}

export async function importEmployeeTypesFromRows({
    rows,
    parseErrors = [],
    user,
    workspace,
}) {
    const errors = [...parseErrors]
    const groups = groupRows(rows)

    for (const group of groups) {
        const hasDirectRows = group.directPositionCodes.length > 0 || group.positionAssignmentMode === "ALL_POSITIONS"
        const hasChildRows = group.childrenByCode.size > 0

        if (hasDirectRows && hasChildRows) {
            errors.push(buildImportError(group.rowNumbers[0], "childCode", "errors.organization.employeeTypeImport.mixedDirectAndChild"))
        }

        const children = [...group.childrenByCode.values()]
        const allPositionChildren = children.filter(
            (child) => child.positionAssignmentMode === "ALL_POSITIONS",
        )

        if (allPositionChildren.length > 0 && children.length > 1) {
            errors.push(buildImportError(group.rowNumbers[0], "childPositionAssignmentMode", "errors.organization.employeeTypeImport.childAllPositionAmbiguous"))
        }

        const allPositionCodes = [
            ...group.directPositionCodes,
            ...children.flatMap((child) => child.positionCodes),
        ]

        if (hasDuplicate(allPositionCodes)) {
            errors.push(buildImportError(group.rowNumbers[0], "positionCodes", "errors.organization.employeeTypeImport.duplicatePositionInFile"))
        }
    }

    if (errors.length > 0) {
        return { totalRows: rows.length, created: 0, updated: 0, skipped: rows.length, errors }
    }

    let created = 0
    let updated = 0
    let skipped = 0

    for (const group of groups) {
        const company = await findCompanyByCode(group.companyCode)

        if (
            !company ||
            company._id.toString() !== workspace.companyId.toString()
        ) {
            errors.push(buildImportError(group.rowNumbers[0], "companyCode", "errors.organization.employeeTypeImport.companyNotFound"))
            skipped += group.rowNumbers.length
            continue
        }

        const allPositionCodes = [
            ...new Set([
                ...group.directPositionCodes,
                ...[...group.childrenByCode.values()].flatMap((child) => child.positionCodes),
            ]),
        ]

        const positions = await findPositionsByCodes({
            companyId: company._id,
            branchId: workspace.branchId,
            positionCodes: allPositionCodes,
        })
        const positionByCode = new Map(positions.map((position) => [position.code, position]))
        const missingPositionCodes = allPositionCodes.filter((positionCode) => !positionByCode.has(positionCode))

        if (missingPositionCodes.length > 0) {
            errors.push(buildImportError(group.rowNumbers[0], "positionCodes", "errors.organization.employeeTypeImport.positionNotFound"))
            skipped += group.rowNumbers.length
            continue
        }

        const existingEmployeeType = await EmployeeType.findOne({
            companyId: company._id,
            branchId: workspace.branchId,
            code: group.employeeTypeCode,
        })

        const directPositionIds = group.positionAssignmentMode === "ALL_POSITIONS"
            ? []
            : group.directPositionCodes.map((positionCode) => positionByCode.get(positionCode)._id)

        const children = [...group.childrenByCode.values()].map((child) => ({
            code: child.code,
            name: child.name,
            dashboardCategory: child.dashboardCategory,
            positionAssignmentMode: child.positionAssignmentMode,
            positionIds: child.positionAssignmentMode === "ALL_POSITIONS"
                ? []
                : child.positionCodes.map((positionCode) => positionByCode.get(positionCode)._id),
        }))

        const allPositionIds = [
            ...new Set([
                ...directPositionIds,
                ...children.flatMap((child) => child.positionIds),
            ]),
        ]

        const conflict = await findPositionMappingConflict({
            companyId: company._id,
            branchId: workspace.branchId,
            positionIds: allPositionIds,
            employeeTypeId: existingEmployeeType?._id || null,
        })

        if (conflict) {
            errors.push(buildImportError(group.rowNumbers[0], "positionCodes", "errors.organization.employeeTypeImport.positionAlreadyMapped"))
            skipped += group.rowNumbers.length
            continue
        }

        const updatePayload = {
            companyId: company._id,
            branchId: workspace.branchId,
            code: group.employeeTypeCode,
            name: group.employeeTypeName,
            dashboardCategory: group.dashboardCategory,
            positionAssignmentMode: children.length > 0
                ? "SPECIFIC_POSITIONS"
                : group.positionAssignmentMode,
            positionIds: children.length > 0 ? [] : directPositionIds,
            children,
            status: group.status,
            description: group.description,
            updatedByAccountId: user?.accountId || null,
        }

        if (!existingEmployeeType) {
            await EmployeeType.create({
                ...updatePayload,
                createdByAccountId: user?.accountId || null,
            })
            created += 1
            continue
        }

        if (existingEmployeeType.status === "ARCHIVED") {
            errors.push(buildImportError(group.rowNumbers[0], "employeeTypeCode", "errors.organization.employeeType.archived"))
            skipped += group.rowNumbers.length
            continue
        }

        existingEmployeeType.set(updatePayload)
        await existingEmployeeType.save()
        updated += 1
    }

    clearCacheByPrefix("employeeType:")
    clearCacheByPrefix("employee:list:")
    clearCacheByPrefix("hr-dashboard:")

    return { totalRows: rows.length, created, updated, skipped, errors }
}

export async function getExportEmployeeTypes({ query, user }) {
    const result = await listEmployeeTypes({
        query: { ...query, page: 1, limit: 100 },
        user,
    })

    return result.items
}

export async function buildEmployeeTypeExportWorkbook({ employeeTypes }) {
    const { workbook, worksheet } = buildWorkbookBase("Employee Types")
    worksheet.spliceRows(2, 0)

    for (const employeeType of employeeTypes) {
        if ((employeeType.children || []).length > 0) {
            for (const child of employeeType.children) {
                worksheet.addRow({
                    companyCode: employeeType.company?.code || "",
                    employeeTypeCode: employeeType.code,
                    employeeTypeName: employeeType.name,
                    dashboardCategory: employeeType.dashboardCategory || "UNSPECIFIED",
                    positionAssignmentMode:
                        employeeType.positionAssignmentMode || "SPECIFIC_POSITIONS",
                    childCode: child.code,
                    childName: child.name,
                    childDashboardCategory: child.dashboardCategory || "UNSPECIFIED",
                    childPositionAssignmentMode:
                        child.positionAssignmentMode || "SPECIFIC_POSITIONS",
                    positionCodes:
                        child.positionAssignmentMode === "ALL_POSITIONS"
                            ? ""
                            : (child.positions || []).map((position) => position.code).join(","),
                    status: employeeType.status,
                    description: employeeType.description || "",
                })
            }

            continue
        }

        worksheet.addRow({
            companyCode: employeeType.company?.code || "",
            employeeTypeCode: employeeType.code,
            employeeTypeName: employeeType.name,
            dashboardCategory: employeeType.dashboardCategory || "UNSPECIFIED",
            positionAssignmentMode:
                employeeType.positionAssignmentMode || "SPECIFIC_POSITIONS",
            childCode: "",
            childName: "",
            childDashboardCategory: "",
            childPositionAssignmentMode: "",
            positionCodes:
                employeeType.positionAssignmentMode === "ALL_POSITIONS"
                    ? ""
                    : (employeeType.positions || []).map((position) => position.code).join(","),
            status: employeeType.status,
            description: employeeType.description || "",
        })
    }

    return workbook
}
