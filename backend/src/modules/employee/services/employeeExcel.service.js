import ExcelJS from "exceljs"

import { clearCacheByPrefix } from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Company from "../../organization/models/Company.js"
import Branch from "../../organization/models/Branch.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"
import Line from "../../line/models/Line.js"
import Shift from "../../shift/models/Shift.js"
import Province from "../../location/models/Province.js"
import District from "../../location/models/District.js"
import Commune from "../../location/models/Commune.js"
import Village from "../../location/models/Village.js"
import EmployeeType from "../../employeeType/models/EmployeeType.js"

import Employee from "../models/Employee.js"
import { listEmployees } from "./employee.service.js"
import { provisionEmployeeAccount } from "../../access/services/accountProvisioning.service.js"

const TEMPLATE_HEADERS = [
    "employeeCode",
    "profileImageUrl",
    "khmerFirstName",
    "khmerLastName",
    "englishFirstName",
    "englishLastName",
    "gender",
    "dateOfBirth",
    "email",
    "phoneNumber",
    "createAccount",
    "agentPhoneNumber",
    "agentPerson",
    "note",
    "maritalStatus",
    "spouseName",
    "spouseContactNumber",
    "education",
    "religion",
    "nationality",
    "birthProvince",
    "birthDistrict",
    "birthCommune",
    "birthVillage",
    "permanentProvince",
    "permanentDistrict",
    "permanentCommune",
    "permanentVillage",
    "companyCode",
    "branchCode",
    "departmentCode",
    "positionCode",
    "lineCode",
    "shiftCode",
    "joinDate",
    "employmentStatus",
    "resignDate",
    "resignReason",
    "remark",
    "idCardNo",
    "idCardExpireDate",
    "nssfNo",
    "passportNo",
    "passportExpireDate",
    "visaExpireDate",
    "medicalCheckNo",
    "medicalCheckDate",
    "workingBookNo",
    "sourceOfHiring",
    "introducerEmployeeCode",
    "employeeType",
    "singleNeedle",
    "overlock",
    "coverstitch",
    "totalMachines",
]

const HEADER_ALIASES = new Map([
    ["employee id", "employeeCode"],
    ["employee code", "employeeCode"],
    ["profile image", "profileImageUrl"],
    ["khmer first name", "khmerFirstName"],
    ["khmer last name", "khmerLastName"],
    ["english first name", "englishFirstName"],
    ["english last name", "englishLastName"],
    ["date of birth", "dateOfBirth"],
    ["phone number", "phoneNumber"],
    ["create account", "createAccount"],
    ["login account", "createAccount"],
    ["account", "createAccount"],
    ["agent phone number", "agentPhoneNumber"],
    ["agent person", "agentPerson"],
    ["married status", "maritalStatus"],
    ["spouse contact number", "spouseContactNumber"],
    ["place of birth - province", "birthProvince"],
    ["place of birth - district", "birthDistrict"],
    ["place of birth - commune", "birthCommune"],
    ["place of birth - village", "birthVillage"],
    ["permanent address - province", "permanentProvince"],
    ["permanent address - district", "permanentDistrict"],
    ["permanent address - commune", "permanentCommune"],
    ["permanent address - village", "permanentVillage"],
    ["department", "departmentCode"],
    ["position", "positionCode"],
    ["line", "lineCode"],
    ["shift", "shiftCode"],
    ["join date", "joinDate"],
    ["status", "employmentStatus"],
    ["resign date", "resignDate"],
    ["resign reason", "resignReason"],
    ["id card", "idCardNo"],
    ["id expire", "idCardExpireDate"],
    ["passport expire date", "passportExpireDate"],
    ["visa expire date", "visaExpireDate"],
    ["medical check", "medicalCheckNo"],
    ["medical check date", "medicalCheckDate"],
    ["working book", "workingBookNo"],
    ["source of hiring", "sourceOfHiring"],
    ["introducer id", "introducerEmployeeCode"],
    ["employee type", "employeeType"],
    ["single needle", "singleNeedle"],
])

function normalizeHeader(value) {
    const raw = String(value || "").trim()
    const key = raw.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
    return HEADER_ALIASES.get(key) || raw
}

function excelValueToPrimitive(value) {
    if (value === null || value === undefined) return ""
    if (value instanceof Date) return value
    if (["string", "number", "boolean"].includes(typeof value)) return value

    if (Array.isArray(value)) {
        return value.map((item) => excelValueToString(item)).join(",")
    }

    if (typeof value === "object") {
        if (Array.isArray(value.richText)) {
            return value.richText.map((item) => item?.text || "").join("")
        }

        if (Object.prototype.hasOwnProperty.call(value, "text")) {
            return excelValueToPrimitive(value.text)
        }

        if (Object.prototype.hasOwnProperty.call(value, "result")) {
            return excelValueToPrimitive(value.result)
        }

        if (Object.prototype.hasOwnProperty.call(value, "formula")) {
            return excelValueToPrimitive(value.result || "")
        }

        if (Object.prototype.hasOwnProperty.call(value, "hyperlink")) {
            return excelValueToPrimitive(value.text || "")
        }

        if (Object.prototype.hasOwnProperty.call(value, "error")) {
            return ""
        }

        if (typeof value.toString === "function" && value.toString !== Object.prototype.toString) {
            return value.toString()
        }

        return ""
    }

    return value
}

function excelValueToString(value) {
    const primitive = excelValueToPrimitive(value)
    if (primitive === null || primitive === undefined) return ""
    if (primitive instanceof Date) return primitive
    return String(primitive)
}

function normalizeCode(value) {
    return excelValueToString(value).trim().replace(/\s+/g, "_").toUpperCase()
}

function normalizeText(value) {
    return excelValueToString(value).trim().replace(/\s+/g, " ")
}

function normalizeGender(value) {
    const code = normalizeCode(value)
    if (["M", "MALE"].includes(code)) return "MALE"
    if (["F", "FEMALE"].includes(code)) return "FEMALE"
    if (["OTHER"].includes(code)) return "OTHER"
    return "UNKNOWN"
}

function normalizeMaritalStatus(value) {
    const code = normalizeCode(value)
    if (["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"].includes(code)) return code
    return "UNKNOWN"
}

function normalizeEmploymentStatus(value) {
    const code = normalizeCode(value)
    const map = {
        WORKING: "WORKING",
        ACTIVE: "WORKING",
        RESIGN: "RESIGNED",
        RESIGNED: "RESIGNED",
        TERMINATE: "TERMINATED",
        TERMINATED: "TERMINATED",
        ABANDON: "ABANDONED",
        ABANDONED: "ABANDONED",
        PASS_AWAY: "PASSED_AWAY",
        PASSED_AWAY: "PASSED_AWAY",
        RETIREMENT: "RETIRED",
        RETIRED: "RETIRED",
    }
    return map[code] || "WORKING"
}

function normalizeEmployeeTypeLookup(value) {
    const raw = normalizeText(value)
    if (!raw) return ""

    const code = normalizeCode(raw)
    return code === "MAARKETING" ? "MARKETING" : raw
}

function normalizeNumber(value) {
    const raw = excelValueToString(value).trim()
    if (!raw) return 0
    const num = Number(raw)
    return Number.isFinite(num) && num >= 0 ? num : 0
}

function normalizeBoolean(value, defaultValue = false) {
    const raw = excelValueToString(value).trim().toUpperCase()
    if (!raw) return defaultValue
    if (["YES", "Y", "TRUE", "1", "CREATE", "ON"].includes(raw)) return true
    if (["NO", "N", "FALSE", "0", "SKIP", "OFF"].includes(raw)) return false
    return defaultValue
}

function excelSerialToDate(serial) {
    const utcDays = Math.floor(Number(serial) - 25569)
    const utcValue = utcDays * 86400
    const date = new Date(utcValue * 1000)
    return Number.isNaN(date.getTime()) ? null : date
}

function normalizeDate(value) {
    const primitive = excelValueToPrimitive(value)
    if (!primitive) return null
    if (primitive instanceof Date) return Number.isNaN(primitive.getTime()) ? null : primitive
    if (typeof primitive === "number") return excelSerialToDate(primitive)
    const raw = excelValueToString(primitive).trim()
    if (!raw) return null
    if (/^\d+(\.\d+)?$/.test(raw)) return excelSerialToDate(Number(raw))

    const dayFirstMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (dayFirstMatch) {
        const [, dayText, monthText, yearText] = dayFirstMatch
        const day = Number(dayText)
        const month = Number(monthText)
        const year = Number(yearText)
        const date = new Date(Date.UTC(year, month - 1, day))

        if (
            date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day
        ) {
            return date
        }

        return null
    }

    return null
}

function getCellValue(row, index) {
    const cell = row.getCell(index)
    return excelValueToPrimitive(cell.value)
}

function buildError(rowNumber, field, messageKey, { value = "", expected = "" } = {}) {
    return { rowNumber, field, messageKey, value, expected }
}

const REQUIRED_IMPORT_HEADERS = [
    "employeeCode",
    "departmentCode",
    "positionCode",
    "lineCode",
    "shiftCode",
    "joinDate",
]

function isValidEmail(value) {
    return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isDigitsOnly(value) {
    return !value || /^\d+$/.test(value)
}

function isAtLeast18(date) {
    if (!date) return true
    const today = new Date()
    const cutoff = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
    return date <= cutoff
}

function makeLookupKey(...parts) {
    return parts.map((part) => normalizeCode(part)).join("::")
}

function addDocumentAliases(map, document, prefix = "") {
    const aliases = [
        document.code,
        document.typeCode,
        document.name,
        document.typeName,
        document.title,
        document.displayName,
        document.shortName,
    ]

    for (const alias of aliases) {
        if (!alias) continue
        map.set(`${prefix}${normalizeCode(alias)}`, document)
    }
}

function addCellHeaderStyle(worksheet) {
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } }
    headerRow.alignment = { vertical: "middle", horizontal: "center" }
}

export async function buildEmployeeImportTemplateWorkbook() {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "HRMS Enterprise"
    workbook.created = new Date()
    const worksheet = workbook.addWorksheet("Employees", { views: [{ state: "frozen", ySplit: 1 }] })
    worksheet.columns = TEMPLATE_HEADERS.map((header) => ({ header, key: header, width: Math.min(Math.max(header.length + 4, 16), 28) }))
    addCellHeaderStyle(worksheet)
    worksheet.addRow({
        employeeCode: "EMP001",
        khmerFirstName: "ដារ៉ា",
        khmerLastName: "សុខ",
        englishFirstName: "Dara",
        englishLastName: "Sok",
        gender: "MALE",
        dateOfBirth: "12/05/1995",
        phoneNumber: "0979866163",
        createAccount: "YES",
        maritalStatus: "SINGLE",
        education: "High School",
        religion: "Buddhism",
        nationality: "Khmer",
        birthProvince: "Kandal",
        birthDistrict: "Kien Svay",
        permanentProvince: "Kandal",
        permanentDistrict: "Kien Svay",
        companyCode: "TRAX",
        branchCode: "PP-HQ",
        departmentCode: "SEWING",
        positionCode: "SEWER",
        lineCode: "LINE_A",
        shiftCode: "DAY",
        joinDate: "15/08/2024",
        employmentStatus: "WORKING",
        employeeType: "DIRECT",
        singleNeedle: 1,
        overlock: 0,
        coverstitch: 0,
        totalMachines: 1,
    })
    const instructions = workbook.addWorksheet("Instructions")
    instructions.columns = [
        { header: "Rule", key: "rule", width: 34 },
        { header: "Description", key: "description", width: 100 },
    ]
    instructions.addRows([
        { rule: "Date format", description: "Enter every date as DD/MM/YYYY, for example 20/07/2026. Native Excel date cells are also accepted." },
        { rule: "Required codes", description: "Use companyCode, branchCode, departmentCode, positionCode, lineCode, and shiftCode for reliable import." },
        { rule: "Address columns", description: "Only Birth Address and Permanent Address are supported. Living, emergency contact, and family address columns are no longer imported." },
        { rule: "Age", description: "Do not import age. Backend calculates age from dateOfBirth." },
        { rule: "Team/Section", description: "Team and Section are ignored because the project structure is Department => Position => Line." },
        { rule: "Status", description: "Use WORKING, RESIGNED, TERMINATED, ABANDONED, PASSED_AWAY, or RETIRED. Old values Working, Resign, Terminate, Abandon, Pass Away, Retirement are accepted." },
        { rule: "Login account", description: "Set createAccount to YES to create login. Login ID = employeeCode. Initial password = employeeCode + phoneNumber. If the column is missing, YES is used." },
    ])
    instructions.getRow(1).font = { bold: true }
    return workbook
}

export async function parseEmployeeImportWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.worksheets[0]
    if (!worksheet) throw new AppError({ statusCode: 422, code: "EMPLOYEE_IMPORT_EMPTY_FILE", messageKey: "errors.employee.import.emptyFile" })

    const headerRow = worksheet.getRow(1)
    const headerMap = new Map()
    headerRow.eachCell((cell, colNumber) => {
        const key = normalizeHeader(cell.value)
        if (key) headerMap.set(colNumber, key)
    })

    const rows = []
    const errors = []
    const importedHeaders = new Set(headerMap.values())
    for (const requiredHeader of REQUIRED_IMPORT_HEADERS) {
        if (!importedHeaders.has(requiredHeader)) {
            errors.push(buildError(1, requiredHeader, "errors.employee.import.headerRequired", {
                expected: requiredHeader,
            }))
        }
    }

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const raw = {}
        for (const [colNumber, key] of headerMap.entries()) raw[key] = getCellValue(row, colNumber)
        const isEmpty = Object.values(raw).every((value) => excelValueToString(value).trim() === "")
        if (isEmpty) return

        const normalized = {
            rowNumber,
            employeeCode: normalizeCode(raw.employeeCode),
            profileImageUrl: normalizeText(raw.profileImageUrl),
            khmerFirstName: normalizeText(raw.khmerFirstName),
            khmerLastName: normalizeText(raw.khmerLastName),
            englishFirstName: normalizeText(raw.englishFirstName),
            englishLastName: normalizeText(raw.englishLastName),
            gender: normalizeGender(raw.gender),
            dateOfBirth: normalizeDate(raw.dateOfBirth),
            email: normalizeText(raw.email),
            phoneNumber: normalizeText(raw.phoneNumber),
            createAccount: normalizeBoolean(raw.createAccount, true),
            agentPhoneNumber: normalizeText(raw.agentPhoneNumber),
            agentPerson: normalizeText(raw.agentPerson),
            note: normalizeText(raw.note),
            maritalStatus: normalizeMaritalStatus(raw.maritalStatus),
            spouseName: normalizeText(raw.spouseName),
            spouseContactNumber: normalizeText(raw.spouseContactNumber),
            education: normalizeText(raw.education),
            religion: normalizeText(raw.religion),
            nationality: normalizeText(raw.nationality),
            birthProvince: normalizeText(raw.birthProvince),
            birthDistrict: normalizeText(raw.birthDistrict),
            birthCommune: normalizeText(raw.birthCommune),
            birthVillage: normalizeText(raw.birthVillage),
            permanentProvince: normalizeText(raw.permanentProvince),
            permanentDistrict: normalizeText(raw.permanentDistrict),
            permanentCommune: normalizeText(raw.permanentCommune),
            permanentVillage: normalizeText(raw.permanentVillage),
            companyCode: normalizeCode(raw.companyCode),
            branchCode: normalizeCode(raw.branchCode),
            departmentCode: normalizeText(raw.departmentCode),
            positionCode: normalizeText(raw.positionCode),
            lineCode: normalizeText(raw.lineCode),
            shiftCode: normalizeText(raw.shiftCode),
            joinDate: normalizeDate(raw.joinDate),
            employmentStatus: normalizeEmploymentStatus(raw.employmentStatus),
            resignDate: normalizeDate(raw.resignDate),
            resignReason: normalizeText(raw.resignReason),
            remark: normalizeText(raw.remark),
            idCardNo: normalizeText(raw.idCardNo),
            idCardExpireDate: normalizeDate(raw.idCardExpireDate),
            nssfNo: normalizeText(raw.nssfNo),
            passportNo: normalizeText(raw.passportNo),
            passportExpireDate: normalizeDate(raw.passportExpireDate),
            visaExpireDate: normalizeDate(raw.visaExpireDate),
            medicalCheckNo: normalizeText(raw.medicalCheckNo),
            medicalCheckDate: normalizeDate(raw.medicalCheckDate),
            workingBookNo: normalizeText(raw.workingBookNo),
            sourceOfHiring: normalizeText(raw.sourceOfHiring),
            introducerEmployeeCode: normalizeCode(raw.introducerEmployeeCode),
            employeeTypeLookup: normalizeEmployeeTypeLookup(raw.employeeType),
            singleNeedle: normalizeNumber(raw.singleNeedle),
            overlock: normalizeNumber(raw.overlock),
            coverstitch: normalizeNumber(raw.coverstitch),
            totalMachines: normalizeNumber(raw.totalMachines),
        }

        if (!normalized.employeeCode) errors.push(buildError(rowNumber, "employeeCode", "errors.employee.import.employeeCodeRequired"))
        if (raw.joinDate && !normalized.joinDate) errors.push(buildError(rowNumber, "joinDate", "errors.employee.import.dateInvalid", { value: normalizeText(raw.joinDate), expected: "DD/MM/YYYY or an Excel date" }))
        else if (!normalized.joinDate) errors.push(buildError(rowNumber, "joinDate", "errors.employee.import.joinDateRequired"))
        if (!normalized.departmentCode) errors.push(buildError(rowNumber, "departmentCode", "errors.employee.import.departmentRequired"))
        if (!normalized.positionCode) errors.push(buildError(rowNumber, "positionCode", "errors.employee.import.positionRequired"))
        if (!normalized.lineCode) errors.push(buildError(rowNumber, "lineCode", "errors.employee.import.lineRequired"))
        if (!normalized.shiftCode) errors.push(buildError(rowNumber, "shiftCode", "errors.employee.import.shiftRequired"))
        if (raw.dateOfBirth && !normalized.dateOfBirth) errors.push(buildError(rowNumber, "dateOfBirth", "errors.employee.import.dateInvalid", { value: normalizeText(raw.dateOfBirth), expected: "DD/MM/YYYY or an Excel date" }))
        if (normalized.dateOfBirth && !isAtLeast18(normalized.dateOfBirth)) errors.push(buildError(rowNumber, "dateOfBirth", "errors.employee.import.minimumAge", { value: normalizeText(raw.dateOfBirth), expected: "Employee must be at least 18 years old" }))
        for (const field of [
            "resignDate",
            "idCardExpireDate",
            "passportExpireDate",
            "visaExpireDate",
            "medicalCheckDate",
        ]) {
            if (raw[field] && !normalized[field]) {
                errors.push(buildError(rowNumber, field, "errors.employee.import.dateInvalid", {
                    value: normalizeText(raw[field]),
                    expected: "DD/MM/YYYY or an Excel date",
                }))
            }
        }
        if (!isValidEmail(normalized.email)) errors.push(buildError(rowNumber, "email", "errors.employee.import.emailInvalid", { value: normalized.email, expected: "name@example.com" }))
        if (!isDigitsOnly(normalized.phoneNumber)) errors.push(buildError(rowNumber, "phoneNumber", "errors.employee.import.phoneInvalid", { value: normalized.phoneNumber, expected: "Digits only, for example 0979866163" }))
        if (!isDigitsOnly(normalized.agentPhoneNumber)) errors.push(buildError(rowNumber, "agentPhoneNumber", "errors.employee.import.phoneInvalid", { value: normalized.agentPhoneNumber, expected: "Digits only" }))
        if (normalized.maritalStatus !== "MARRIED") {
            normalized.spouseName = ""
            normalized.spouseContactNumber = ""
        }
        if (normalized.employmentStatus !== "WORKING" && !normalized.resignDate) errors.push(buildError(rowNumber, "resignDate", "errors.employee.import.resignDateRequired", { expected: "Required when employmentStatus is not WORKING" }))

        rows.push(normalized)
    })
    if (rows.length === 0) errors.push(buildError(1, "file", "errors.employee.import.noDataRows"))
    return { rows, errors }
}

async function findByCodeOrName(Model, value, parentFilter = {}) {
    if (!value) return null
    const code = normalizeCode(value)
    const name = normalizeText(value)
    return Model.findOne({
        ...parentFilter,
        status: { $ne: "ARCHIVED" },
        $or: [
            { code },
            { name },
            { title: name },
            { displayName: name },
            { legalName: name },
            { shortName: name },
        ],
    }).lean()
}

async function findLineForEmployeeImport({
    value,
    companyId,
    branchId,
    departmentId,
}) {
    if (!value || !companyId || !branchId || !departmentId) {
        return null
    }

    const code = normalizeCode(value)
    const name = normalizeText(value)

    return Line.findOne({
        companyId,
        branchId,
        status: { $ne: "ARCHIVED" },
        $and: [
            {
                $or: [
                    { departmentId },
                    { departmentIds: departmentId },
                ],
            },
            {
                $or: [
                    { code },
                    { name },
                    { shortName: name },
                ],
            },
        ],
    }).lean()
}

async function findEmployeeType(value) {
    if (!value) return null

    const code = normalizeCode(value)
    const name = normalizeText(value)

    return EmployeeType.findOne({
        status: { $ne: "ARCHIVED" },
        $or: [
            { code },
            { typeCode: code },
            { name },
            { typeName: name },
            { title: name },
            { displayName: name },
            { shortName: name },
        ],
    }).lean()
}

async function resolveLocation({ provinceName, districtName, communeName, villageName }) {
    const province = await findByCodeOrName(Province, provinceName)
    const district = province && districtName ? await findByCodeOrName(District, districtName, { provinceId: province._id }) : null
    const commune = district && communeName ? await findByCodeOrName(Commune, communeName, { districtId: district._id }) : null
    const village = commune && villageName ? await findByCodeOrName(Village, villageName, { communeId: commune._id }) : null
    return {
        provinceId: province?._id || null,
        districtId: district?._id || null,
        communeId: commune?._id || null,
        villageId: village?._id || null,
    }
}

export async function importEmployeesFromRows({ rows, parseErrors, context, user, onProgress }) {
    const summary = {
        totalRows: rows.length,
        created: 0,
        updated: 0,
        skipped: 0,
        accountsCreated: 0,
        accountsExisting: 0,
        accountsSkipped: 0,
        errors: [...parseErrors],
    }
    if (summary.errors.length > 0) {
        summary.skipped = rows.length
        onProgress?.({ phase: "VALIDATED", percent: 55, processedRows: rows.length, totalRows: rows.length })
        return summary
    }

    const fallbackCompany = context.companyId ? await Company.findById(context.companyId).lean() : null
    const fallbackBranch = context.branchId ? await Branch.findOne({ _id: context.branchId, companyId: context.companyId }).lean() : null

    if (!fallbackCompany || !fallbackBranch) {
        summary.errors.push(buildError(1, "workspace", "errors.employee.import.workspaceRequired", {
            expected: "Select a company and branch in the top bar before importing",
        }))
        summary.skipped = rows.length
        return summary
    }

    const [departments, positions, lines, shifts, introducers, employeeTypes] = await Promise.all([
        Department.find({ companyId: fallbackCompany._id, branchId: fallbackBranch._id, status: { $ne: "ARCHIVED" } }).lean(),
        Position.find({ companyId: fallbackCompany._id, branchId: fallbackBranch._id, status: { $ne: "ARCHIVED" } }).lean(),
        Line.find({ companyId: fallbackCompany._id, branchId: fallbackBranch._id, status: { $ne: "ARCHIVED" } }).lean(),
        Shift.find({ companyId: fallbackCompany._id, branchId: fallbackBranch._id, status: { $ne: "ARCHIVED" } }).lean(),
        Employee.find({ companyId: fallbackCompany._id, branchId: fallbackBranch._id, recordStatus: { $ne: "ARCHIVED" } }).select("_id employeeCode").lean(),
        EmployeeType.find({ companyId: fallbackCompany._id, status: { $ne: "ARCHIVED" } }).lean(),
    ])

    const departmentMap = new Map()
    const positionMap = new Map()
    const lineMap = new Map()
    const shiftMap = new Map()
    const introducerMap = new Map()
    const employeeTypeMap = new Map()

    for (const department of departments) addDocumentAliases(departmentMap, department)
    for (const position of positions) addDocumentAliases(positionMap, position, `${position.departmentId?.toString()}::`)
    for (const line of lines) addDocumentAliases(lineMap, line)
    for (const shift of shifts) addDocumentAliases(shiftMap, shift)
    for (const introducer of introducers) introducerMap.set(normalizeCode(introducer.employeeCode), introducer)
    for (const employeeType of employeeTypes) addDocumentAliases(employeeTypeMap, employeeType)

    for (const [index, row] of rows.entries()) {
        const company = fallbackCompany
        const branch = fallbackBranch
        const department = departmentMap.get(normalizeCode(row.departmentCode)) || null
        const departmentPrefix = department ? `${department._id.toString()}::` : ""
        const position = department ? positionMap.get(`${departmentPrefix}${normalizeCode(row.positionCode)}`) || null : null
        const line = lineMap.get(normalizeCode(row.lineCode)) || null
        const shift = shiftMap.get(normalizeCode(row.shiftCode)) || null
        const introducer = row.introducerEmployeeCode ? introducerMap.get(normalizeCode(row.introducerEmployeeCode)) || null : null
        const employeeType = row.employeeTypeLookup ? employeeTypeMap.get(normalizeCode(row.employeeTypeLookup)) || null : null

        if (!department) summary.errors.push(buildError(row.rowNumber, "departmentCode", "errors.employee.import.departmentNotFound"))
        if (!position) summary.errors.push(buildError(row.rowNumber, "positionCode", "errors.employee.import.positionNotFound"))
        if (!line) summary.errors.push(buildError(row.rowNumber, "lineCode", "errors.employee.import.lineNotFound", {
            value: row.lineCode,
            expected: `An active line in branch ${branch.code || branch.name}`,
        }))
        if (!shift) summary.errors.push(buildError(row.rowNumber, "shiftCode", "errors.employee.import.shiftNotFound"))
        if (row.introducerEmployeeCode && !introducer) summary.errors.push(buildError(row.rowNumber, "introducerEmployeeCode", "errors.employee.import.introducerNotFound"))
        if (row.employeeTypeLookup && !employeeType) summary.errors.push(buildError(row.rowNumber, "employeeType", "errors.employee.import.employeeTypeNotFound"))

        row._resolved = { company, branch, department, position, line, shift, introducer, employeeType }
        onProgress?.({
            phase: "RESOLVING_REFERENCES",
            percent: 20 + Math.round(((index + 1) / Math.max(rows.length, 1)) * 35),
            processedRows: index + 1,
            totalRows: rows.length,
        })
    }

    if (summary.errors.length > 0) {
        summary.skipped = rows.length
        return summary
    }

    for (const [index, row] of rows.entries()) {
        const birthAddress = await resolveLocation({ provinceName: row.birthProvince, districtName: row.birthDistrict, communeName: row.birthCommune, villageName: row.birthVillage })
        const permanentAddress = await resolveLocation({ provinceName: row.permanentProvince, districtName: row.permanentDistrict, communeName: row.permanentCommune, villageName: row.permanentVillage })
        const { company, branch, department, position, line, shift, introducer, employeeType } = row._resolved
        const payload = {
            employeeCode: row.employeeCode,
            profileImageUrl: row.profileImageUrl,
            khmerFirstName: row.khmerFirstName,
            khmerLastName: row.khmerLastName,
            englishFirstName: row.englishFirstName,
            englishLastName: row.englishLastName,
            displayName: [row.englishFirstName, row.englishLastName].filter(Boolean).join(" ") || [row.khmerFirstName, row.khmerLastName].filter(Boolean).join(" ") || row.employeeCode,
            gender: row.gender,
            dateOfBirth: row.dateOfBirth,
            email: row.email,
            phoneNumber: row.phoneNumber,
            agentPhoneNumber: row.agentPhoneNumber,
            agentPerson: row.agentPerson,
            note: row.note,
            maritalStatus: row.maritalStatus,
            spouseName: row.spouseName,
            spouseContactNumber: row.spouseContactNumber,
            education: row.education,
            religion: row.religion,
            nationality: row.nationality,
            birthAddress,
            permanentAddress,
            companyId: company._id,
            branchId: branch._id,
            departmentId: department._id,
            positionId: position._id,
            lineId: line._id,
            shiftId: shift._id,
            joinDate: row.joinDate,
            employmentStatus: row.employmentStatus,
            resignDate: row.resignDate,
            resignReason: row.resignReason,
            remark: row.remark,
            documents: {
                idCardNo: row.idCardNo,
                idCardExpireDate: row.idCardExpireDate,
                nssfNo: row.nssfNo,
                passportNo: row.passportNo,
                passportExpireDate: row.passportExpireDate,
                visaExpireDate: row.visaExpireDate,
                medicalCheckNo: row.medicalCheckNo,
                medicalCheckDate: row.medicalCheckDate,
                workingBookNo: row.workingBookNo,
            },
            sourceOfHiring: row.sourceOfHiring,
            introducerEmployeeId: introducer?._id || null,
            employeeTypeId: employeeType?._id || null,
            machineSkills: {
                singleNeedle: row.singleNeedle,
                overlock: row.overlock,
                coverstitch: row.coverstitch,
                totalMachines: row.totalMachines,
            },
            recordStatus: "ACTIVE",
            updatedByAccountId: user.accountId,
        }

        const existing = await Employee.findOne({ employeeCode: row.employeeCode }).lean()
        let employee = null

        try {
            if (existing) {
                employee = await Employee.findByIdAndUpdate(
                    existing._id,
                    { $set: payload },
                    { returnDocument: "after", runValidators: true, context: "query" },
                ).lean()
                summary.updated += 1
            } else {
                employee = await Employee.create({ ...payload, createdByAccountId: user.accountId })
                summary.created += 1
            }
        } catch (error) {
            summary.skipped += 1
            summary.errors.push(
                buildError(
                    row.rowNumber,
                    "employeeCode",
                    error?.errors?.employeeCode?.message || error.messageKey || error.message || "errors.employee.import.saveFailed",
                ),
            )
            continue
        }

        try {
            const accountResult = await provisionEmployeeAccount({
                employee,
                user,
                createAccount: row.createAccount !== false,
            })

            if (accountResult.action === "CREATED") summary.accountsCreated += 1
            else if (accountResult.action === "EXISTS") summary.accountsExisting += 1
            else summary.accountsSkipped += 1
        } catch (error) {
            summary.accountsSkipped += 1
            summary.errors.push(
                buildError(
                    row.rowNumber,
                    "createAccount",
                    error.messageKey || error.code || "errors.employee.import.accountCreateFailed",
                ),
            )
        }

        onProgress?.({
            phase: "SAVING_ROWS",
            percent: 55 + Math.round(((index + 1) / Math.max(rows.length, 1)) * 40),
            processedRows: index + 1,
            totalRows: rows.length,
        })
    }

    clearCacheByPrefix("employee:list:")
    return summary
}

function formatDate(value) {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    const day = String(date.getUTCDate()).padStart(2, "0")
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    return `${day}/${month}/${date.getUTCFullYear()}`
}

export async function buildEmployeeExportWorkbook({ employees }) {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Employees", { views: [{ state: "frozen", ySplit: 1 }] })
    worksheet.columns = TEMPLATE_HEADERS.map((header) => ({ header, key: header, width: Math.min(Math.max(header.length + 4, 16), 28) }))
    addCellHeaderStyle(worksheet)
    for (const employee of employees) {
        worksheet.addRow({
            employeeCode: employee.employeeCode,
            profileImageUrl: employee.profileImageUrl,
            khmerFirstName: employee.khmerFirstName,
            khmerLastName: employee.khmerLastName,
            englishFirstName: employee.englishFirstName,
            englishLastName: employee.englishLastName,
            gender: employee.gender,
            dateOfBirth: formatDate(employee.dateOfBirth),
            email: employee.email,
            phoneNumber: employee.phoneNumber,
            agentPhoneNumber: employee.agentPhoneNumber,
            agentPerson: employee.agentPerson,
            note: employee.note,
            maritalStatus: employee.maritalStatus,
            spouseName: employee.spouseName,
            spouseContactNumber: employee.spouseContactNumber,
            education: employee.education,
            religion: employee.religion,
            nationality: employee.nationality,
            birthProvince: employee.birthAddress?.province?.name || "",
            birthDistrict: employee.birthAddress?.district?.name || "",
            birthCommune: employee.birthAddress?.commune?.name || "",
            birthVillage: employee.birthAddress?.village?.name || "",
            permanentProvince: employee.permanentAddress?.province?.name || "",
            permanentDistrict: employee.permanentAddress?.district?.name || "",
            permanentCommune: employee.permanentAddress?.commune?.name || "",
            permanentVillage: employee.permanentAddress?.village?.name || "",
            companyCode: employee.company?.code || "",
            branchCode: employee.branch?.code || "",
            departmentCode: employee.department?.code || "",
            positionCode: employee.position?.code || "",
            lineCode: employee.line?.code || "",
            shiftCode: employee.shift?.code || "",
            joinDate: formatDate(employee.joinDate),
            employmentStatus: employee.employmentStatus,
            resignDate: formatDate(employee.resignDate),
            resignReason: employee.resignReason,
            remark: employee.remark,
            idCardNo: employee.documents?.idCardNo || "",
            idCardExpireDate: formatDate(employee.documents?.idCardExpireDate),
            nssfNo: employee.documents?.nssfNo || "",
            passportNo: employee.documents?.passportNo || "",
            passportExpireDate: formatDate(employee.documents?.passportExpireDate),
            visaExpireDate: formatDate(employee.documents?.visaExpireDate),
            medicalCheckNo: employee.documents?.medicalCheckNo || "",
            medicalCheckDate: formatDate(employee.documents?.medicalCheckDate),
            workingBookNo: employee.documents?.workingBookNo || "",
            sourceOfHiring: employee.sourceOfHiring,
            introducerEmployeeCode: employee.introducerEmployee?.employeeCode || "",
            employeeType: employee.employeeType?.code || employee.employeeType?.name || employee.employeeTypeLabel || "",
            singleNeedle: employee.machineSkills?.singleNeedle || 0,
            overlock: employee.machineSkills?.overlock || 0,
            coverstitch: employee.machineSkills?.coverstitch || 0,
            totalMachines: employee.machineSkills?.totalMachines || 0,
        })
    }
    return workbook
}

export async function getExportEmployees({ query, user }) {
    const result = await listEmployees({ query: { ...query, page: 1, limit: 10000 }, user })
    return result.items
}
