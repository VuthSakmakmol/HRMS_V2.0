import ExcelJS from "exceljs"

import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Company from "../../organization/models/Company.js"
import Branch from "../../organization/models/Branch.js"
import Position from "../../organization/models/Position.js"
import EmployeeType from "../models/EmployeeType.js"
import {
    createEmployeeType,
    listEmployeeTypes,
    updateEmployeeType,
} from "./employeeType.service.js"

const TEMPLATE_HEADERS = [
    "companyCode",
    "branchCode",
    "employeeTypeCode",
    "employeeTypeName",
    "positionDisplayName",
    "positionAssignmentMode",
    "childCode",
    "childName",
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
    return STATUS_VALUES.includes(status) ? status : null
}

function splitCodes(value) {
    return [
        ...new Set(
            String(value || "")
                .split(",")
                .map((item) => normalizeCode(item))
                .filter(Boolean),
        ),
    ]
}

function getCellValue(row, index) {
    const value = row.getCell(index).value

    if (value === null || value === undefined) return ""

    if (typeof value === "object") {
        if (value.text) return String(value.text)
        if (value.result !== undefined && value.result !== null) {
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

    const valid = TEMPLATE_HEADERS.every(
        (header, index) => actualHeaders[index] === header,
    )

    if (!valid) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_EMPLOYEE_TYPE_IMPORT_INVALID_TEMPLATE",
            messageKey: "errors.organization.employeeTypeImport.invalidTemplate",
        })
    }
}

function buildImportError(rowNumber, field, messageKey, details = undefined) {
    return {
        rowNumber,
        field,
        messageKey,
        ...(details ? { details } : {}),
    }
}

function applyEnterpriseWorksheetStyle(worksheet) {
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D4ED8" },
    }
    headerRow.alignment = { vertical: "middle", horizontal: "center" }
    headerRow.height = 22

    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.border = {
                top: { style: "thin", color: { argb: "FFE5E7EB" } },
                left: { style: "thin", color: { argb: "FFE5E7EB" } },
                bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
                right: { style: "thin", color: { argb: "FFE5E7EB" } },
            }
            cell.alignment = {
                vertical: "middle",
                wrapText: true,
            }
        })
    })

    worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: TEMPLATE_HEADERS.length },
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
        { header: "employeeTypeCode", key: "employeeTypeCode", width: 22 },
        { header: "employeeTypeName", key: "employeeTypeName", width: 28 },
        { header: "positionDisplayName", key: "positionDisplayName", width: 34 },
        {
            header: "positionAssignmentMode",
            key: "positionAssignmentMode",
            width: 28,
        },
        { header: "childCode", key: "childCode", width: 20 },
        { header: "childName", key: "childName", width: 26 },
        {
            header: "childPositionAssignmentMode",
            key: "childPositionAssignmentMode",
            width: 32,
        },
        { header: "positionCodes", key: "positionCodes", width: 46 },
        { header: "status", key: "status", width: 14 },
        { header: "description", key: "description", width: 46 },
    ]

    return { workbook, worksheet }
}

export async function buildEmployeeTypeImportTemplateWorkbook() {
    const { workbook, worksheet } = buildWorkbookBase("Employee Type Import")

    worksheet.addRows([
        {
            companyCode: "TRAX",
            branchCode: "PP",
            employeeTypeCode: "DIRECT",
            employeeTypeName: "Direct",
            positionDisplayName: "Sewer + Sewer-Jumper",
            positionAssignmentMode: "SPECIFIC_POSITIONS",
            childCode: "",
            childName: "",
            childPositionAssignmentMode: "",
            positionCodes: "SEWER,SEWER_JUMPER",
            status: "ACTIVE",
            description:
                "Employees in these positions automatically belong to Direct.",
        },
        {
            companyCode: "TRAX",
            branchCode: "PP",
            employeeTypeCode: "INDIRECT",
            employeeTypeName: "Indirect",
            positionDisplayName: "Support Positions",
            positionAssignmentMode: "SPECIFIC_POSITIONS",
            childCode: "SUPPORT",
            childName: "Support",
            childPositionAssignmentMode: "SPECIFIC_POSITIONS",
            positionCodes: "QC,MECHANIC,PACKING",
            status: "ACTIVE",
            description:
                "Child groups are optional and do not create a separate Excome category.",
        },
    ])

    applyEnterpriseWorksheetStyle(worksheet)

    const instructionSheet = workbook.addWorksheet("Instructions")
    instructionSheet.columns = [
        { header: "Field", key: "field", width: 32 },
        { header: "Required", key: "required", width: 18 },
        { header: "Rule", key: "rule", width: 120 },
    ]

    instructionSheet.addRows([
        {
            field: "companyCode",
            required: "Yes",
            rule: "Existing active company code. Import must match the selected workspace company.",
        },
        {
            field: "branchCode",
            required: "Yes",
            rule: "Existing active branch code. Import must match the selected workspace branch.",
        },
        {
            field: "employeeTypeCode",
            required: "Yes",
            rule: "Stable Employee Type code, for example DIRECT, INDIRECT, WHITE_COLLAR, or MERCHANDISING.",
        },
        {
            field: "employeeTypeName",
            required: "Yes",
            rule: "The Employee Type name shown dynamically in Excome Category.",
        },
        {
            field: "positionDisplayName",
            required: "No",
            rule: "Short business-friendly text shown in the Excome Positions column, for example Sewer + Sewer-Jumper. Excome never auto-lists mapped positions.",
        },
        {
            field: "positionAssignmentMode",
            required: "Yes",
            rule: "ALL_POSITIONS or SPECIFIC_POSITIONS. Use SPECIFIC_POSITIONS for normal setup.",
        },
        {
            field: "childCode / childName",
            required: "No",
            rule: "Optional child grouping inside the Employee Type. Excome Category still uses the parent Employee Type name.",
        },
        {
            field: "childPositionAssignmentMode",
            required: "When child used",
            rule: "ALL_POSITIONS or SPECIFIC_POSITIONS. Multiple children must use specific positions.",
        },
        {
            field: "positionCodes",
            required: "When SPECIFIC_POSITIONS",
            rule: "Comma-separated existing position codes. A position can belong to only one Employee Type/Child mapping.",
        },
        {
            field: "status",
            required: "No",
            rule: "ACTIVE or INACTIVE. Empty defaults ACTIVE.",
        },
        {
            field: "description",
            required: "No",
            rule: "Optional description. No Direct/Indirect/dashboard classification marking is required.",
        },
    ])

    applyEnterpriseWorksheetStyle(instructionSheet)
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
        const branchCode = normalizeCode(rowObject.branchCode)
        const employeeTypeCode = normalizeCode(rowObject.employeeTypeCode)
        const employeeTypeName = normalizeText(rowObject.employeeTypeName)
        const positionDisplayName = normalizeText(rowObject.positionDisplayName)
        const positionAssignmentMode = normalizeAssignmentMode(
            rowObject.positionAssignmentMode,
        )
        const childCode = normalizeCode(rowObject.childCode)
        const childName = normalizeText(rowObject.childName)
        const childPositionAssignmentMode = childCode
            ? normalizeAssignmentMode(rowObject.childPositionAssignmentMode)
            : null
        const positionCodes = splitCodes(rowObject.positionCodes)
        const status = normalizeStatus(rowObject.status)
        const description = normalizeText(rowObject.description)

        if (!companyCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "companyCode",
                    "errors.organization.employeeTypeImport.companyCodeRequired",
                ),
            )
        }

        if (!branchCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "branchCode",
                    "errors.organization.employeeTypeImport.branchNotFound",
                ),
            )
        }

        if (!employeeTypeCode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "employeeTypeCode",
                    "errors.organization.employeeTypeImport.employeeTypeCodeRequired",
                ),
            )
        } else if (!/^[A-Z0-9_-]{2,30}$/.test(employeeTypeCode)) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "employeeTypeCode",
                    "errors.organization.employeeTypeImport.employeeTypeCodeInvalid",
                ),
            )
        }

        if (!employeeTypeName) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "employeeTypeName",
                    "errors.organization.employeeTypeImport.employeeTypeNameRequired",
                ),
            )
        }

        if (!positionAssignmentMode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "positionAssignmentMode",
                    "errors.organization.employeeTypeImport.positionAssignmentModeInvalid",
                ),
            )
        }

        if (childCode && !childName) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "childName",
                    "errors.organization.employeeTypeImport.childNameRequired",
                ),
            )
        }

        if (childCode && !childPositionAssignmentMode) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "childPositionAssignmentMode",
                    "errors.organization.employeeTypeImport.positionAssignmentModeInvalid",
                ),
            )
        }

        const effectiveMode = childCode
            ? childPositionAssignmentMode
            : positionAssignmentMode

        if (
            effectiveMode === "SPECIFIC_POSITIONS" &&
            positionCodes.length === 0
        ) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "positionCodes",
                    "errors.organization.employeeTypeImport.positionCodesRequired",
                ),
            )
        }

        if (!status) {
            errors.push(
                buildImportError(
                    rowNumber,
                    "status",
                    "errors.organization.employeeTypeImport.statusInvalid",
                ),
            )
        }

        rows.push({
            rowNumber,
            companyCode,
            branchCode,
            employeeTypeCode,
            employeeTypeName,
            positionDisplayName,
            positionAssignmentMode:
                positionAssignmentMode || "SPECIFIC_POSITIONS",
            childCode,
            childName,
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
    return Company.findOne({
        code: companyCode,
        status: { $ne: "ARCHIVED" },
    }).lean()
}

async function findBranchByCode({ companyId, branchCode }) {
    return Branch.findOne({
        companyId,
        code: branchCode,
        status: { $ne: "ARCHIVED" },
    }).lean()
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
            { positionAssignmentMode: "ALL_POSITIONS" },
            { "children.positionAssignmentMode": "ALL_POSITIONS" },
        ],
    }

    if (employeeTypeId) {
        filter._id = { $ne: employeeTypeId }
    }

    return EmployeeType.findOne(filter).select("code name").lean()
}

function groupRows(rows) {
    const groups = new Map()

    for (const row of rows) {
        const key = `${row.companyCode}:${row.branchCode}:${row.employeeTypeCode}`

        if (!groups.has(key)) {
            groups.set(key, {
                companyCode: row.companyCode,
                branchCode: row.branchCode,
                employeeTypeCode: row.employeeTypeCode,
                employeeTypeName: row.employeeTypeName,
                positionDisplayName: row.positionDisplayName,
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
    onProgress,
}) {
    const errors = [...parseErrors]
    const groups = groupRows(rows)

    for (const group of groups) {
        const children = [...group.childrenByCode.values()]
        const hasDirectRows =
            group.directPositionCodes.length > 0 ||
            group.positionAssignmentMode === "ALL_POSITIONS"
        const hasChildRows = children.length > 0

        if (hasDirectRows && hasChildRows) {
            errors.push(
                buildImportError(
                    group.rowNumbers[0],
                    "childCode",
                    "errors.organization.employeeTypeImport.mixedDirectAndChild",
                ),
            )
        }

        const allPositionChildren = children.filter(
            (child) => child.positionAssignmentMode === "ALL_POSITIONS",
        )

        if (allPositionChildren.length > 0 && children.length > 1) {
            errors.push(
                buildImportError(
                    group.rowNumbers[0],
                    "childPositionAssignmentMode",
                    "errors.organization.employeeTypeImport.childAllPositionAmbiguous",
                ),
            )
        }

        const allPositionCodes = [
            ...group.directPositionCodes,
            ...children.flatMap((child) => child.positionCodes),
        ]

        if (hasDuplicate(allPositionCodes)) {
            errors.push(
                buildImportError(
                    group.rowNumbers[0],
                    "positionCodes",
                    "errors.organization.employeeTypeImport.duplicatePositionInFile",
                ),
            )
        }
    }

    if (errors.length > 0) {
        return {
            totalRows: rows.length,
            created: 0,
            updated: 0,
            skipped: rows.length,
            errors,
        }
    }

    let created = 0
    let updated = 0
    let skipped = 0
    let processedRows = 0

    for (const group of groups) {
        const company = await findCompanyByCode(group.companyCode)

        if (
            !company ||
            String(company._id) !== String(workspace.companyId)
        ) {
            errors.push(
                buildImportError(
                    group.rowNumbers[0],
                    "companyCode",
                    "errors.organization.employeeTypeImport.companyNotFound",
                ),
            )
            skipped += group.rowNumbers.length
            processedRows += group.rowNumbers.length
            continue
        }

        const branch = await findBranchByCode({
            companyId: company._id,
            branchCode: group.branchCode,
        })

        if (!branch || String(branch._id) !== String(workspace.branchId)) {
            errors.push(
                buildImportError(
                    group.rowNumbers[0],
                    "branchCode",
                    "errors.organization.employeeTypeImport.branchNotFound",
                ),
            )
            skipped += group.rowNumbers.length
            processedRows += group.rowNumbers.length
            continue
        }

        const allPositionCodes = [
            ...new Set([
                ...group.directPositionCodes,
                ...[...group.childrenByCode.values()].flatMap(
                    (child) => child.positionCodes,
                ),
            ]),
        ]

        const positions = await findPositionsByCodes({
            companyId: company._id,
            branchId: branch._id,
            positionCodes: allPositionCodes,
        })
        const positionByCode = new Map(
            positions.map((position) => [normalizeCode(position.code), position]),
        )
        const missingPositionCodes = allPositionCodes.filter(
            (positionCode) => !positionByCode.has(positionCode),
        )

        if (missingPositionCodes.length > 0) {
            errors.push(
                buildImportError(
                    group.rowNumbers[0],
                    "positionCodes",
                    "errors.organization.employeeTypeImport.positionNotFound",
                    { positionCodes: missingPositionCodes },
                ),
            )
            skipped += group.rowNumbers.length
            processedRows += group.rowNumbers.length
            continue
        }

        const existingEmployeeType = await EmployeeType.findOne({
            companyId: company._id,
            branchId: branch._id,
            code: group.employeeTypeCode,
        })

        const allActivePositions = await Position.find({
            companyId: company._id,
            branchId: branch._id,
            status: "ACTIVE",
        })
            .select("_id code")
            .lean()

        const directPositionIds =
            group.positionAssignmentMode === "ALL_POSITIONS"
                ? allActivePositions.map((position) => position._id)
                : group.directPositionCodes.map(
                      (positionCode) => positionByCode.get(positionCode)._id,
                  )

        const children = [...group.childrenByCode.values()].map((child) => ({
            code: child.code,
            name: child.name,
            positionAssignmentMode: child.positionAssignmentMode,
            positionIds:
                child.positionAssignmentMode === "ALL_POSITIONS"
                    ? allActivePositions.map((position) => position._id)
                    : child.positionCodes.map(
                          (positionCode) => positionByCode.get(positionCode)._id,
                      ),
        }))

        const allPositionIds = [
            ...new Set([
                ...directPositionIds.map(String),
                ...children.flatMap((child) =>
                    child.positionIds.map(String),
                ),
            ]),
        ]

        const conflict = await findPositionMappingConflict({
            companyId: company._id,
            branchId: branch._id,
            positionIds: allPositionIds,
            employeeTypeId: existingEmployeeType?._id || null,
        })

        if (conflict) {
            errors.push(
                buildImportError(
                    group.rowNumbers[0],
                    "positionCodes",
                    "errors.organization.employeeTypeImport.positionAlreadyMapped",
                    {
                        employeeTypeCode: conflict.code,
                        employeeTypeName: conflict.name,
                    },
                ),
            )
            skipped += group.rowNumbers.length
            processedRows += group.rowNumbers.length
            continue
        }

        const payload = {
            companyId: company._id,
            branchId: branch._id,
            code: group.employeeTypeCode,
            name: group.employeeTypeName,
            positionDisplayName: group.positionDisplayName,
            positionAssignmentMode:
                children.length > 0
                    ? "SPECIFIC_POSITIONS"
                    : group.positionAssignmentMode,
            positionIds: children.length > 0 ? [] : directPositionIds,
            children,
            status: group.status,
            description: group.description,
        }

        if (!existingEmployeeType) {
            await createEmployeeType({ payload, user })
            created += 1
        } else if (existingEmployeeType.status === "ARCHIVED") {
            errors.push(
                buildImportError(
                    group.rowNumbers[0],
                    "employeeTypeCode",
                    "errors.organization.employeeType.archived",
                ),
            )
            skipped += group.rowNumbers.length
        } else {
            await updateEmployeeType({
                employeeTypeId: existingEmployeeType._id,
                payload,
                user,
            })
            updated += 1
        }

        processedRows += group.rowNumbers.length
        onProgress?.({
            processedRows,
            totalRows: rows.length,
            percent: Math.min(
                95,
                20 + Math.round((processedRows / rows.length) * 75),
            ),
        })
    }

    clearCacheByPrefix("employeeType:")
    clearCacheByPrefix("employee:list:")
    clearCacheByPrefix("hr-dashboard:")
    clearCacheByPrefix("excome:")

    return {
        totalRows: rows.length,
        created,
        updated,
        skipped,
        errors,
    }
}

export async function getExportEmployeeTypes({ query, user }) {
    const items = []
    let page = 1
    let totalPages = 1

    do {
        const result = await listEmployeeTypes({
            query: {
                ...query,
                page,
                limit: 100,
            },
            user,
        })

        items.push(...(result.items || []))
        totalPages = Math.max(1, Number(result.pagination?.totalPages || 1))
        page += 1
    } while (page <= totalPages)

    return items
}

export async function buildEmployeeTypeExportWorkbook({ employeeTypes }) {
    const { workbook, worksheet } = buildWorkbookBase("Employee Types")

    for (const employeeType of employeeTypes) {
        if ((employeeType.children || []).length > 0) {
            for (const child of employeeType.children) {
                worksheet.addRow({
                    companyCode: employeeType.company?.code || "",
                    branchCode: employeeType.branch?.code || "",
                    employeeTypeCode: employeeType.code,
                    employeeTypeName: employeeType.name,
                    positionDisplayName: employeeType.positionDisplayName || "",
                    positionAssignmentMode:
                        employeeType.positionAssignmentMode ||
                        "SPECIFIC_POSITIONS",
                    childCode: child.code,
                    childName: child.name,
                    childPositionAssignmentMode:
                        child.positionAssignmentMode || "SPECIFIC_POSITIONS",
                    positionCodes:
                        child.positionAssignmentMode === "ALL_POSITIONS"
                            ? ""
                            : (child.positions || [])
                                  .map((position) => position.code)
                                  .filter(Boolean)
                                  .join(","),
                    status: employeeType.status,
                    description: employeeType.description || "",
                })
            }
            continue
        }

        worksheet.addRow({
            companyCode: employeeType.company?.code || "",
            branchCode: employeeType.branch?.code || "",
            employeeTypeCode: employeeType.code,
            employeeTypeName: employeeType.name,
            positionDisplayName: employeeType.positionDisplayName || "",
            positionAssignmentMode:
                employeeType.positionAssignmentMode || "SPECIFIC_POSITIONS",
            childCode: "",
            childName: "",
            childPositionAssignmentMode: "",
            positionCodes:
                employeeType.positionAssignmentMode === "ALL_POSITIONS"
                    ? ""
                    : (employeeType.positions || [])
                          .map((position) => position.code)
                          .filter(Boolean)
                          .join(","),
            status: employeeType.status,
            description: employeeType.description || "",
        })
    }

    applyEnterpriseWorksheetStyle(worksheet)
    return workbook
}
