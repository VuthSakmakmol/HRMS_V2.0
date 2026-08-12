import { Types } from "mongoose"

import {
    clearCacheByPrefix,
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Company from "../../organization/models/Company.js"
import Branch from "../../organization/models/Branch.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"
import Line from "../../line/models/Line.js"
import Shift from "../../shift/models/Shift.js"
import Country from "../../location/models/Country.js"
import Province from "../../location/models/Province.js"
import District from "../../location/models/District.js"
import Commune from "../../location/models/Commune.js"
import Village from "../../location/models/Village.js"
import RecruitmentChannel from "../../recruitmentChannel/models/recruitmentChannel.js"
import ExitReason from "../../exitReason/models/ExitReason.js"
import { resolveEmployeeTypeAssignmentByPosition } from "../../employeeType/services/employeeTypeAssignment.service.js"

import Employee from "../models/Employee.js"
import { resolveApprovalByAssignment } from "../../approval/services/approvalResolver.service.js"
import {
    createAutomaticMovementForEmployeeCreate,
    createAutomaticMovementForEmployeeUpdate,
} from "../../employeeMovement/services/employeeMovement.service.js"
import { provisionEmployeeAccount } from "../../access/services/accountProvisioning.service.js"
import { syncUnmatchedAttendanceForEmployee } from "../../attendance/services/attendanceUnmatchedSync.service.js"

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function ensureObjectId(id, code, messageKey) {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError({ statusCode: 400, code, messageKey })
    }
}

function serializeEmployeeType(employeeType) {
    if (!employeeType || typeof employeeType !== "object") return null

    return {
        id: employeeType._id?.toString?.() || employeeType.id,
        code: employeeType.code || employeeType.typeCode || "",
        name: employeeType.name || employeeType.typeName || employeeType.title || employeeType.displayName || "",
        shortName: employeeType.shortName || "",
        status: employeeType.status || employeeType.recordStatus || "",
    }
}

function serializeEmployeeTypeChild(raw = {}) {
    const childId = raw.employeeTypeChildId?._id?.toString?.() || raw.employeeTypeChildId?.id || raw.employeeTypeChildId?.toString?.() || null

    if (!childId && !raw.employeeTypeChildCode && !raw.employeeTypeChildName) return null

    return {
        id: childId,
        code: raw.employeeTypeChildCode || "",
        name: raw.employeeTypeChildName || "",
    }
}

function serializeExitReason(exitReason) {
    if (!exitReason || typeof exitReason !== "object") return null

    return {
        id: exitReason._id?.toString?.() || exitReason.id,
        companyId: exitReason.companyId?._id?.toString?.() || exitReason.companyId?.toString?.() || null,
        branchId: exitReason.branchId?._id?.toString?.() || exitReason.branchId?.toString?.() || null,
        code: exitReason.code || "",
        name: exitReason.name || "",
        status: exitReason.status || "",
    }
}

function serializeRecruitmentChannel(recruitmentChannel) {
    if (!recruitmentChannel || typeof recruitmentChannel !== "object") return null

    return {
        id: recruitmentChannel._id?.toString?.() || recruitmentChannel.id,
        code: recruitmentChannel.code || "",
        name: recruitmentChannel.name || "",
        shortName: recruitmentChannel.shortName || "",
        targetMonthly: Number(recruitmentChannel.targetMonthly || 0),
        status: recruitmentChannel.status || "",
    }
}

function toId(value) {
    return value?._id?.toString?.() || value?.id || value?.toString?.() || value || null
}

function sameId(a, b) {
    const left = toId(a)
    const right = toId(b)

    return Boolean(left && right && left === right)
}

async function resolveEmployeeTypeReporting(payload) {
    return resolveEmployeeTypeAssignmentByPosition({
        companyId: payload.companyId,
        branchId: payload.branchId,
        positionId: payload.positionId,
    })
}

async function ensureExitReason({ exitReasonId, companyId, branchId }) {
    if (!exitReasonId) return null

    ensureObjectId(
        exitReasonId,
        "EMPLOYEE_EXIT_REASON_INVALID_ID",
        "errors.employee.profile.exitReasonInvalidId",
    )

    const exitReason = await ExitReason.findOne({
        _id: exitReasonId,
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!exitReason) {
        throw new AppError({
            statusCode: 404,
            code: "EMPLOYEE_EXIT_REASON_NOT_FOUND",
            messageKey: "errors.employee.profile.exitReasonNotFound",
            fields: {
                exitReasonId: ["errors.employee.profile.exitReasonNotFound"],
            },
        })
    }

    const reasonCompanyId = toId(exitReason.companyId)
    const reasonBranchId = toId(exitReason.branchId)

    if (reasonCompanyId && !sameId(reasonCompanyId, companyId)) {
        throw new AppError({
            statusCode: 409,
            code: "EMPLOYEE_EXIT_REASON_COMPANY_MISMATCH",
            messageKey: "errors.employee.profile.exitReasonCompanyMismatch",
            fields: {
                exitReasonId: ["errors.employee.profile.exitReasonCompanyMismatch"],
            },
        })
    }

    if (reasonBranchId && !sameId(reasonBranchId, branchId)) {
        throw new AppError({
            statusCode: 409,
            code: "EMPLOYEE_EXIT_REASON_BRANCH_MISMATCH",
            messageKey: "errors.employee.profile.exitReasonBranchMismatch",
            fields: {
                exitReasonId: ["errors.employee.profile.exitReasonBranchMismatch"],
            },
        })
    }

    return exitReason
}

async function ensureRecruitmentChannel({ recruitmentChannelId, companyId, branchId }) {
    if (!recruitmentChannelId) return null

    ensureObjectId(
        recruitmentChannelId,
        "RECRUITMENT_CHANNEL_INVALID_ID",
        "errors.employee.profile.recruitmentChannelInvalidId",
    )

    const recruitmentChannel = await RecruitmentChannel.findOne({
        _id: recruitmentChannelId,
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!recruitmentChannel) {
        throw new AppError({
            statusCode: 404,
            code: "RECRUITMENT_CHANNEL_NOT_FOUND",
            messageKey: "errors.employee.profile.recruitmentChannelNotFound",
            fields: {
                recruitmentChannelId: ["errors.employee.profile.recruitmentChannelNotFound"],
            },
        })
    }

    const channelCompanyId = toId(recruitmentChannel.companyId)
    const channelBranchId = toId(recruitmentChannel.branchId)

    if (channelCompanyId && !sameId(channelCompanyId, companyId)) {
        throw new AppError({
            statusCode: 409,
            code: "RECRUITMENT_CHANNEL_COMPANY_MISMATCH",
            messageKey: "errors.employee.profile.recruitmentChannelCompanyMismatch",
            fields: {
                recruitmentChannelId: ["errors.employee.profile.recruitmentChannelCompanyMismatch"],
            },
        })
    }

    if (channelBranchId && !sameId(channelBranchId, branchId)) {
        throw new AppError({
            statusCode: 409,
            code: "RECRUITMENT_CHANNEL_BRANCH_MISMATCH",
            messageKey: "errors.employee.profile.recruitmentChannelBranchMismatch",
            fields: {
                recruitmentChannelId: ["errors.employee.profile.recruitmentChannelBranchMismatch"],
            },
        })
    }

    return recruitmentChannel
}


const EXIT_EMPLOYMENT_STATUSES = new Set([
    "RESIGNED",
    "TERMINATED",
    "ABANDONED",
    "PASSED_AWAY",
    "RETIRED",
])

function buildReportingReadiness(raw = {}) {
    const missing = []

    if (!raw.dateOfBirth) missing.push("DATE_OF_BIRTH")
    if (!raw.recruitmentChannelId) missing.push("RECRUITMENT_CHANNEL")
    if (!raw.joinDate) missing.push("JOIN_DATE")
    if (!raw.companyId) missing.push("COMPANY")
    if (!raw.branchId) missing.push("BRANCH")
    if (!raw.departmentId) missing.push("DEPARTMENT")
    if (!raw.positionId) missing.push("POSITION")
    if (!raw.lineId) missing.push("LINE")
    if (!raw.shiftId) missing.push("SHIFT")
    if (!raw.employeeTypeId || raw.employeeTypeReviewRequired) missing.push("EMPLOYEE_TYPE")

    if (EXIT_EMPLOYMENT_STATUSES.has(raw.employmentStatus)) {
        if (!raw.resignDate) missing.push("EXIT_DATE")
        if (!raw.exitReasonId) missing.push("EXIT_REASON")
    }

    return {
        ready: missing.length === 0,
        missing,
    }
}

function buildReportReadinessQuery(mode) {
    if (!mode || mode === "ALL") return null

    const readyConditions = [
        { dateOfBirth: { $ne: null } },
        { recruitmentChannelId: { $ne: null } },
        { joinDate: { $ne: null } },
        { companyId: { $ne: null } },
        { branchId: { $ne: null } },
        { departmentId: { $ne: null } },
        { positionId: { $ne: null } },
        { lineId: { $ne: null } },
        { shiftId: { $ne: null } },
        { employeeTypeId: { $ne: null } },
        { employeeTypeReviewRequired: { $ne: true } },
        {
            $or: [
                { employmentStatus: { $nin: [...EXIT_EMPLOYMENT_STATUSES] } },
                {
                    $and: [
                        { resignDate: { $ne: null } },
                        { exitReasonId: { $ne: null } },
                    ],
                },
            ],
        },
    ]

    if (mode === "READY") return { $and: readyConditions }
    return { $nor: [{ $and: readyConditions }] }
}

function ensureReportingData(payload) {
    if (!String(payload.phoneNumber || "").trim()) {
        throw new AppError({
            statusCode: 422,
            code: "EMPLOYEE_PHONE_NUMBER_REQUIRED",
            messageKey: "errors.validationFailed",
            fields: { phoneNumber: ["Phone Number is required."] },
        })
    }

    if (!/^\d+$/.test(String(payload.phoneNumber || "").trim())) {
        throw new AppError({
            statusCode: 422,
            code: "EMPLOYEE_PHONE_NUMBER_INVALID",
            messageKey: "errors.validationFailed",
            fields: { phoneNumber: ["Phone Number must contain digits only."] },
        })
    }

    if (!payload.dateOfBirth) {
        throw new AppError({
            statusCode: 422,
            code: "EMPLOYEE_DATE_OF_BIRTH_REQUIRED",
            messageKey: "errors.employee.profile.dateOfBirthRequired",
            fields: { dateOfBirth: ["errors.employee.profile.dateOfBirthRequired"] },
        })
    }

    if (!payload.recruitmentChannelId) {
        throw new AppError({
            statusCode: 422,
            code: "EMPLOYEE_RECRUITMENT_CHANNEL_REQUIRED",
            messageKey: "errors.employee.profile.recruitmentChannelRequired",
            fields: { recruitmentChannelId: ["errors.employee.profile.recruitmentChannelRequired"] },
        })
    }

    if (payload.joinDate && payload.resignDate && new Date(payload.resignDate) < new Date(payload.joinDate)) {
        throw new AppError({
            statusCode: 422,
            code: "EMPLOYEE_EXIT_DATE_BEFORE_JOIN_DATE",
            messageKey: "errors.employee.profile.exitDateBeforeJoinDate",
            fields: { resignDate: ["errors.employee.profile.exitDateBeforeJoinDate"] },
        })
    }

    if (EXIT_EMPLOYMENT_STATUSES.has(payload.employmentStatus)) {
        if (!payload.resignDate) {
            throw new AppError({
                statusCode: 422,
                code: "EMPLOYEE_RESIGN_DATE_REQUIRED",
                messageKey: "errors.employee.profile.resignDateRequired",
                fields: { resignDate: ["errors.employee.profile.resignDateRequired"] },
            })
        }

        if (!payload.exitReasonId) {
            throw new AppError({
                statusCode: 422,
                code: "EMPLOYEE_EXIT_REASON_REQUIRED",
                messageKey: "errors.employee.profile.exitReasonRequired",
                fields: { exitReasonId: ["errors.employee.profile.exitReasonRequired"] },
            })
        }
    }
}

function getUserCompanyIds(user) {
    return [...new Set((user?.roleAssignments || []).map((item) => item.companyId).filter(Boolean))]
}

function hasGlobalScope(user) {
    return (user?.roleAssignments || []).some(
        (assignment) => assignment.roleScope === "GLOBAL",
    )
}

function getCompanyScopeFilter(user) {
    if (user?.isRootAdmin || hasGlobalScope(user)) return {}
    const companyIds = getUserCompanyIds(user)
    return companyIds.length ? { _id: { $in: companyIds } } : { _id: { $in: [] } }
}

function getBranchScopeFilter(user) {
    if (user?.isRootAdmin || hasGlobalScope(user)) return {}
    const allBranchCompanyIds = []
    const branchIds = []

    for (const assignment of user?.roleAssignments || []) {
        if (assignment.allBranches && assignment.companyId) allBranchCompanyIds.push(assignment.companyId)
        for (const branchId of assignment.branchIds || []) branchIds.push(branchId)
    }

    const filters = []
    if (allBranchCompanyIds.length) filters.push({ companyId: { $in: [...new Set(allBranchCompanyIds)] } })
    if (branchIds.length) filters.push({ _id: { $in: [...new Set(branchIds)] } })
    return filters.length ? { $or: filters } : { _id: { $in: [] } }
}

function getEmployeeScopeFilter(user) {
    if (user?.isRootAdmin || hasGlobalScope(user)) return {}
    const allBranchCompanyIds = []
    const branchIds = []

    for (const assignment of user?.roleAssignments || []) {
        if (assignment.allBranches && assignment.companyId) allBranchCompanyIds.push(assignment.companyId)
        for (const branchId of assignment.branchIds || []) branchIds.push(branchId)
    }

    const filters = []
    if (allBranchCompanyIds.length) filters.push({ companyId: { $in: [...new Set(allBranchCompanyIds)] } })
    if (branchIds.length) filters.push({ branchId: { $in: [...new Set(branchIds)] } })
    return filters.length ? { $or: filters } : { _id: { $in: [] } }
}

function buildSearchFilter(search) {
    const keyword = String(search || "").trim()
    if (!keyword) return {}
    const regex = new RegExp(escapeRegExp(keyword), "i")
    return {
        $or: [
            { employeeCode: regex },
            { displayName: regex },
            { englishFirstName: regex },
            { englishLastName: regex },
            { khmerFirstName: regex },
            { khmerLastName: regex },
            { phoneNumber: regex },
            { email: regex },
            { "documents.nssfNo": regex },
            { "documents.idCardNo": regex },
        ],
    }
}

function buildEmployeeFilter(query, user) {
    const filter = {}
    const requiredConditions = []
    const scopeFilter = getEmployeeScopeFilter(user)
    const searchFilter = buildSearchFilter(query.search)

    if (Object.keys(scopeFilter).length) requiredConditions.push(scopeFilter)
    if (Object.keys(searchFilter).length) requiredConditions.push(searchFilter)

    const readinessFilter = buildReportReadinessQuery(query.reportReadiness)
    if (readinessFilter) requiredConditions.push(readinessFilter)
    if (requiredConditions.length) filter.$and = requiredConditions

    for (const key of [
        "companyId",
        "branchId",
        "departmentId",
        "positionId",
        "lineId",
        "shiftId",
        "employeeTypeId",
        "employeeTypeChildId",
        "recruitmentChannelId",
        "exitReasonId",
    ]) {
        if (query[key]) filter[key] = query[key]
    }

    if (query.employmentStatus !== "ALL") filter.employmentStatus = query.employmentStatus
    if (query.recordStatus !== "ALL") filter.recordStatus = query.recordStatus
    if (query.gender !== "ALL") filter.gender = query.gender
    if (query.maritalStatus !== "ALL") filter.maritalStatus = query.maritalStatus

    if (query.joinDateFrom || query.joinDateTo) {
        filter.joinDate = {}
        if (query.joinDateFrom) filter.joinDate.$gte = query.joinDateFrom
        if (query.joinDateTo) filter.joinDate.$lte = query.joinDateTo
    }

    if (query.resignDateFrom || query.resignDateTo) {
        filter.resignDate = {}
        if (query.resignDateFrom) filter.resignDate.$gte = query.resignDateFrom
        if (query.resignDateTo) filter.resignDate.$lte = query.resignDateTo
    }

    return filter
}

function ageFromDate(dateValue) {
    if (!dateValue) return null
    const dob = new Date(dateValue)
    if (Number.isNaN(dob.getTime())) return null
    const now = new Date()
    let age = now.getFullYear() - dob.getFullYear()
    const m = now.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1
    return age < 0 ? null : age
}

function simpleOrg(item) {
    if (!item || typeof item !== "object") return null
    return {
        id: item._id?.toString?.() || item.id,
        code: item.code,
        name: item.name || item.title || item.displayName || item.legalName,
        displayName: item.displayName,
        title: item.title,
        shortName: item.shortName,
        status: item.status,
    }
}

function simpleLocation(item) {
    if (!item || typeof item !== "object") return null
    return {
        id: item._id?.toString?.() || item.id,
        code: item.code,
        name: item.name,
        nameKh: item.nameKh,
        status: item.status,
    }
}

function serializeAddress(address = {}) {
    return {
        countryId: address.countryId?._id?.toString?.() || address.countryId?.id || address.countryId?.toString?.() || null,
        provinceId: address.provinceId?._id?.toString?.() || address.provinceId?.id || address.provinceId?.toString?.() || null,
        districtId: address.districtId?._id?.toString?.() || address.districtId?.id || address.districtId?.toString?.() || null,
        communeId: address.communeId?._id?.toString?.() || address.communeId?.id || address.communeId?.toString?.() || null,
        villageId: address.villageId?._id?.toString?.() || address.villageId?.id || address.villageId?.toString?.() || null,
        detail: address.detail || "",
        country: simpleLocation(address.countryId),
        province: simpleLocation(address.provinceId),
        district: simpleLocation(address.districtId),
        commune: simpleLocation(address.communeId),
        village: simpleLocation(address.villageId),
    }
}

export function serializeEmployee(employee) {
    if (!employee) return null
    const raw = typeof employee.toJSON === "function" ? employee.toJSON() : { ...employee }
    return {
        id: raw._id?.toString?.() || raw.id,
        employeeCode: raw.employeeCode,
        profileImageUrl: raw.profileImageUrl || "",
        khmerFirstName: raw.khmerFirstName || "",
        khmerLastName: raw.khmerLastName || "",
        englishFirstName: raw.englishFirstName || "",
        englishLastName: raw.englishLastName || "",
        displayName: raw.displayName || [raw.englishFirstName, raw.englishLastName].filter(Boolean).join(" ") || [raw.khmerFirstName, raw.khmerLastName].filter(Boolean).join(" "),
        gender: raw.gender || "UNKNOWN",
        dateOfBirth: raw.dateOfBirth,
        age: ageFromDate(raw.dateOfBirth),
        email: raw.email || "",
        phoneNumber: raw.phoneNumber || "",
        agentPhoneNumber: raw.agentPhoneNumber || "",
        agentPerson: raw.agentPerson || "",
        note: raw.note || "",
        maritalStatus: raw.maritalStatus || "UNKNOWN",
        spouseName: raw.spouseName || "",
        spouseContactNumber: raw.spouseContactNumber || "",
        education: raw.education || "",
        religion: raw.religion || "",
        nationality: raw.nationality || "",
        birthAddressDetail: raw.birthAddress?.detail || "",
        permanentAddressDetail: raw.permanentAddress?.detail || "",
        birthAddress: serializeAddress(raw.birthAddress),
        permanentAddress: serializeAddress(raw.permanentAddress),
        companyId: raw.companyId?._id?.toString?.() || raw.companyId?.id || raw.companyId?.toString?.(),
        branchId: raw.branchId?._id?.toString?.() || raw.branchId?.id || raw.branchId?.toString?.(),
        departmentId: raw.departmentId?._id?.toString?.() || raw.departmentId?.id || raw.departmentId?.toString?.(),
        positionId: raw.positionId?._id?.toString?.() || raw.positionId?.id || raw.positionId?.toString?.(),
        lineId: raw.lineId?._id?.toString?.() || raw.lineId?.id || raw.lineId?.toString?.(),
        shiftId: raw.shiftId?._id?.toString?.() || raw.shiftId?.id || raw.shiftId?.toString?.(),
        company: simpleOrg(raw.companyId),
        branch: simpleOrg(raw.branchId),
        department: simpleOrg(raw.departmentId),
        position: simpleOrg(raw.positionId),
        line: simpleOrg(raw.lineId),
        shift: simpleOrg(raw.shiftId),
        joinDate: raw.joinDate,
        employmentStatus: raw.employmentStatus,
        resignDate: raw.resignDate,
        resignReason: raw.resignReason || "",
        remark: raw.remark || "",
        documents: raw.documents || {},
        sourceOfHiring: raw.sourceOfHiring || "",
        recruitmentChannelId: raw.recruitmentChannelId?._id?.toString?.() || raw.recruitmentChannelId?.id || raw.recruitmentChannelId?.toString?.() || null,
        recruitmentChannel: serializeRecruitmentChannel(raw.recruitmentChannelId),
        exitReasonId: raw.exitReasonId?._id?.toString?.() || raw.exitReasonId?.id || raw.exitReasonId?.toString?.() || null,
        exitReason: serializeExitReason(raw.exitReasonId),
        introducerEmployeeId: raw.introducerEmployeeId?._id?.toString?.() || raw.introducerEmployeeId?.id || raw.introducerEmployeeId?.toString?.() || null,
        introducerEmployee: raw.introducerEmployeeId && typeof raw.introducerEmployeeId === "object" ? {
            id: raw.introducerEmployeeId._id?.toString?.() || raw.introducerEmployeeId.id,
            employeeCode: raw.introducerEmployeeId.employeeCode,
            displayName: raw.introducerEmployeeId.displayName
                || [raw.introducerEmployeeId.englishFirstName, raw.introducerEmployeeId.englishLastName].filter(Boolean).join(" ")
                || [raw.introducerEmployeeId.khmerFirstName, raw.introducerEmployeeId.khmerLastName].filter(Boolean).join(" "),
        } : null,
        employeeTypeId: raw.employeeTypeId?._id?.toString?.() || raw.employeeTypeId?.id || raw.employeeTypeId?.toString?.() || null,
        employeeType: serializeEmployeeType(raw.employeeTypeId),
        employeeTypeLabel: serializeEmployeeType(raw.employeeTypeId)?.name || serializeEmployeeType(raw.employeeTypeId)?.code || "",
        employeeTypeChildId: raw.employeeTypeChildId?.toString?.() || raw.employeeTypeChildId || null,
        employeeTypeChildCode: raw.employeeTypeChildCode || "",
        employeeTypeChildName: raw.employeeTypeChildName || "",
        employeeTypeChild: serializeEmployeeTypeChild(raw),
        employeeTypeReviewRequired: Boolean(raw.employeeTypeReviewRequired),
        employeeTypeReviewReason: raw.employeeTypeReviewReason || "",
        machineSkills: raw.machineSkills || {},
        approvalPolicyId: raw.approvalPolicyId?._id?.toString?.() || raw.approvalPolicyId?.id || raw.approvalPolicyId?.toString?.() || null,
        approvalPolicy: simpleOrg(raw.approvalPolicyId),
        recordStatus: raw.recordStatus,
        reportReadiness: buildReportingReadiness(raw).ready ? "READY" : "MISSING",
        missingReportFields: buildReportingReadiness(raw).missing,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

export function serializeEmployeeListItem(employee) {
    if (!employee) return null
    const raw = typeof employee.toJSON === "function" ? employee.toJSON() : { ...employee }

    return {
        id: raw._id?.toString?.() || raw.id,
        employeeCode: raw.employeeCode,
        profileImageUrl: raw.profileImageUrl || "",
        displayName: raw.displayName || [raw.englishFirstName, raw.englishLastName].filter(Boolean).join(" ") || [raw.khmerFirstName, raw.khmerLastName].filter(Boolean).join(" "),
        khmerFirstName: raw.khmerFirstName || "",
        khmerLastName: raw.khmerLastName || "",
        englishFirstName: raw.englishFirstName || "",
        englishLastName: raw.englishLastName || "",
        gender: raw.gender || "UNKNOWN",
        dateOfBirth: raw.dateOfBirth || null,
        age: ageFromDate(raw.dateOfBirth),
        phoneNumber: raw.phoneNumber || "",
        email: raw.email || "",
        nationality: raw.nationality || "",
        company: simpleOrg(raw.companyId),
        branch: simpleOrg(raw.branchId),
        department: simpleOrg(raw.departmentId),
        position: simpleOrg(raw.positionId),
        line: simpleOrg(raw.lineId),
        shift: simpleOrg(raw.shiftId),
        employeeType: serializeEmployeeType(raw.employeeTypeId),
        employeeTypeChildName: raw.employeeTypeChildName || "",
        recruitmentChannel: serializeRecruitmentChannel(raw.recruitmentChannelId),
        exitReason: serializeExitReason(raw.exitReasonId),
        joinDate: raw.joinDate,
        employmentStatus: raw.employmentStatus,
        resignDate: raw.resignDate || null,
        recruitmentChannelId: toId(raw.recruitmentChannelId),
        exitReasonId: toId(raw.exitReasonId),
        employeeTypeReviewRequired: Boolean(raw.employeeTypeReviewRequired),
        reportReadiness: buildReportingReadiness(raw).ready ? "READY" : "MISSING",
        missingReportFields: buildReportingReadiness(raw).missing,
        recordStatus: raw.recordStatus,
        idCardNo: raw.documents?.idCardNo || "",
        idCardExpireDate: raw.documents?.idCardExpireDate || null,
        nssfNo: raw.documents?.nssfNo || "",
        passportNo: raw.documents?.passportNo || "",
        passportExpireDate: raw.documents?.passportExpireDate || null,
        visaExpireDate: raw.documents?.visaExpireDate || null,
        medicalCheckNo: raw.documents?.medicalCheckNo || "",
        medicalCheckDate: raw.documents?.medicalCheckDate || null,
        workingBookNo: raw.documents?.workingBookNo || "",
        singleNeedle: Number(raw.machineSkills?.singleNeedle || 0),
        overlock: Number(raw.machineSkills?.overlock || 0),
        coverstitch: Number(raw.machineSkills?.coverstitch || 0),
        totalMachines: Number(raw.machineSkills?.totalMachines || 0),
        note: raw.note || "",
        updatedAt: raw.updatedAt,
    }
}

function employeeListPopulate(query) {
    return query
        .select("employeeCode profileImageUrl khmerFirstName khmerLastName englishFirstName englishLastName displayName gender dateOfBirth phoneNumber email nationality birthAddress.detail permanentAddress.detail companyId branchId departmentId positionId lineId shiftId employeeTypeId employeeTypeChildName employeeTypeReviewRequired joinDate employmentStatus resignDate recruitmentChannelId exitReasonId recordStatus documents machineSkills note updatedAt")
        .populate({ path: "companyId", select: "code displayName legalName status" })
        .populate({ path: "branchId", select: "code name shortName status" })
        .populate({ path: "departmentId", select: "code name shortName status" })
        .populate({ path: "positionId", select: "code title shortName status" })
        .populate({ path: "lineId", select: "code name shortName status" })
        .populate({ path: "shiftId", select: "code name shortName status" })
        .populate({ path: "employeeTypeId", select: "code name title displayName status recordStatus" })
        .populate({ path: "recruitmentChannelId", select: "companyId branchId code name status" })
        .populate({ path: "exitReasonId", select: "companyId branchId code name status" })
}

function employeePopulate(query) {
    return query
        .populate({ path: "companyId", select: "code displayName legalName status" })
        .populate({ path: "branchId", select: "companyId code name shortName status" })
        .populate({ path: "departmentId", select: "companyId branchId code name shortName status" })
        .populate({ path: "positionId", select: "companyId branchId departmentId code title shortName level isManager status" })
        .populate({ path: "lineId", select: "companyId branchId departmentId code name shortName allowedPositionIds leaderPositionId status" })
        .populate({ path: "shiftId", select: "companyId branchId code name shortName startTime endTime workingMinutes isOvernight status" })
        .populate({ path: "recruitmentChannelId", select: "companyId branchId code name shortName targetMonthly status" })
        .populate({ path: "exitReasonId", select: "companyId branchId code name status" })
        .populate({ path: "introducerEmployeeId", select: "employeeCode displayName englishFirstName englishLastName khmerFirstName khmerLastName recordStatus" })
        .populate({ path: "employeeTypeId", select: "code name typeCode typeName title displayName shortName status recordStatus" })
        .populate({ path: "approvalPolicyId", select: "code name moduleKey status" })
        .populate({ path: "birthAddress.countryId", select: "code name nationality phoneCode status" })
        .populate({ path: "birthAddress.provinceId", select: "code name nameKh status" })
        .populate({ path: "birthAddress.districtId", select: "code name nameKh status" })
        .populate({ path: "birthAddress.communeId", select: "code name nameKh status" })
        .populate({ path: "birthAddress.villageId", select: "code name nameKh status" })
        .populate({ path: "permanentAddress.countryId", select: "code name nationality phoneCode status" })
        .populate({ path: "permanentAddress.provinceId", select: "code name nameKh status" })
        .populate({ path: "permanentAddress.districtId", select: "code name nameKh status" })
        .populate({ path: "permanentAddress.communeId", select: "code name nameKh status" })
        .populate({ path: "permanentAddress.villageId", select: "code name nameKh status" })
}

async function ensureCompany(companyId, user) {
    ensureObjectId(companyId, "EMPLOYEE_COMPANY_INVALID_ID", "errors.organization.company.invalidId")
    const company = await Company.findOne({ _id: companyId, ...getCompanyScopeFilter(user) }).lean()
    if (!company) throw new AppError({ statusCode: 404, code: "EMPLOYEE_COMPANY_NOT_FOUND", messageKey: "errors.organization.company.notFound" })
    if (company.status === "ARCHIVED") throw new AppError({ statusCode: 409, code: "EMPLOYEE_COMPANY_ARCHIVED", messageKey: "errors.organization.company.archived" })
    return company
}

async function ensureBranch(companyId, branchId, user) {
    ensureObjectId(branchId, "EMPLOYEE_BRANCH_INVALID_ID", "errors.organization.branch.invalidId")
    const branch = await Branch.findOne({ _id: branchId, companyId, ...getBranchScopeFilter(user) }).lean()
    if (!branch) throw new AppError({ statusCode: 404, code: "EMPLOYEE_BRANCH_NOT_FOUND", messageKey: "errors.organization.branch.notFound" })
    if (branch.status === "ARCHIVED") throw new AppError({ statusCode: 409, code: "EMPLOYEE_BRANCH_ARCHIVED", messageKey: "errors.organization.branch.archived" })
    return branch
}

async function validateAssignment(payload, user) {
    await ensureCompany(payload.companyId, user)
    await ensureBranch(payload.companyId, payload.branchId, user)

    const [department, position, line, shift] = await Promise.all([
        Department.findOne({ _id: payload.departmentId, companyId: payload.companyId, branchId: payload.branchId, status: { $ne: "ARCHIVED" } }).lean(),
        Position.findOne({ _id: payload.positionId, companyId: payload.companyId, branchId: payload.branchId, departmentId: payload.departmentId, status: { $ne: "ARCHIVED" } }).lean(),
        Line.findOne({
            _id: payload.lineId,
            companyId: payload.companyId,
            branchId: payload.branchId,
            status: { $ne: "ARCHIVED" },
        }).lean(),
        Shift.findOne({ _id: payload.shiftId, companyId: payload.companyId, branchId: payload.branchId, status: { $ne: "ARCHIVED" } }).lean(),
    ])

    if (!department) throw new AppError({ statusCode: 404, code: "EMPLOYEE_DEPARTMENT_NOT_FOUND", messageKey: "errors.organization.department.notFound", fields: { departmentId: ["errors.organization.department.notFound"] } })
    if (!position) throw new AppError({ statusCode: 404, code: "EMPLOYEE_POSITION_NOT_FOUND", messageKey: "errors.organization.position.notFound", fields: { positionId: ["errors.organization.position.notFound"] } })
    if (!line) throw new AppError({ statusCode: 404, code: "EMPLOYEE_LINE_NOT_FOUND", messageKey: "errors.organization.line.notFound", fields: { lineId: ["errors.organization.line.notFound"] } })
    if (!shift) throw new AppError({ statusCode: 404, code: "EMPLOYEE_SHIFT_NOT_FOUND", messageKey: "errors.organization.shift.notFound", fields: { shiftId: ["errors.organization.shift.notFound"] } })

}

async function validateAddress(address, prefix) {
    if (!address) return

    const { countryId, provinceId, districtId, communeId, villageId } = address

    if (!countryId && !provinceId && !districtId && !communeId && !villageId) return

    if (countryId) ensureObjectId(countryId, "EMPLOYEE_LOCATION_INVALID_ID", "errors.location.invalidId")
    if (provinceId) ensureObjectId(provinceId, "EMPLOYEE_LOCATION_INVALID_ID", "errors.location.invalidId")
    if (districtId) ensureObjectId(districtId, "EMPLOYEE_LOCATION_INVALID_ID", "errors.location.invalidId")
    if (communeId) ensureObjectId(communeId, "EMPLOYEE_LOCATION_INVALID_ID", "errors.location.invalidId")
    if (villageId) ensureObjectId(villageId, "EMPLOYEE_LOCATION_INVALID_ID", "errors.location.invalidId")

    const countryFilter = countryId
        ? { _id: countryId, status: { $ne: "ARCHIVED" } }
        : null

    const provinceFilter = provinceId
        ? { _id: provinceId, status: { $ne: "ARCHIVED" } }
        : null
    if (provinceFilter && countryId) provinceFilter.countryId = countryId

    const districtFilter = districtId
        ? { _id: districtId, status: { $ne: "ARCHIVED" } }
        : null
    if (districtFilter && countryId) districtFilter.countryId = countryId
    if (districtFilter && provinceId) districtFilter.provinceId = provinceId

    const communeFilter = communeId
        ? { _id: communeId, status: { $ne: "ARCHIVED" } }
        : null
    if (communeFilter && countryId) communeFilter.countryId = countryId
    if (communeFilter && provinceId) communeFilter.provinceId = provinceId
    if (communeFilter && districtId) communeFilter.districtId = districtId

    const villageFilter = villageId
        ? { _id: villageId, status: { $ne: "ARCHIVED" } }
        : null
    if (villageFilter && countryId) villageFilter.countryId = countryId
    if (villageFilter && provinceId) villageFilter.provinceId = provinceId
    if (villageFilter && districtId) villageFilter.districtId = districtId
    if (villageFilter && communeId) villageFilter.communeId = communeId

    const [country, province, district, commune, village] = await Promise.all([
        countryFilter ? Country.findOne(countryFilter).lean() : null,
        provinceFilter ? Province.findOne(provinceFilter).lean() : null,
        districtFilter ? District.findOne(districtFilter).lean() : null,
        communeFilter ? Commune.findOne(communeFilter).lean() : null,
        villageFilter ? Village.findOne(villageFilter).lean() : null,
    ])

    if (countryId && !country) throw new AppError({ statusCode: 404, code: "EMPLOYEE_COUNTRY_NOT_FOUND", messageKey: "errors.location.countryNotFound", fields: { [`${prefix}.countryId`]: ["errors.location.countryNotFound"] } })
    if (provinceId && !province) throw new AppError({ statusCode: 404, code: "EMPLOYEE_PROVINCE_NOT_FOUND", messageKey: "errors.location.provinceNotFound", fields: { [`${prefix}.provinceId`]: ["errors.location.provinceNotFound"] } })
    if (districtId && !district) throw new AppError({ statusCode: 404, code: "EMPLOYEE_DISTRICT_NOT_FOUND", messageKey: "errors.location.districtNotFound", fields: { [`${prefix}.districtId`]: ["errors.location.districtNotFound"] } })
    if (communeId && !commune) throw new AppError({ statusCode: 404, code: "EMPLOYEE_COMMUNE_NOT_FOUND", messageKey: "errors.location.communeNotFound", fields: { [`${prefix}.communeId`]: ["errors.location.communeNotFound"] } })
    if (villageId && !village) throw new AppError({ statusCode: 404, code: "EMPLOYEE_VILLAGE_NOT_FOUND", messageKey: "errors.location.villageNotFound", fields: { [`${prefix}.villageId`]: ["errors.location.villageNotFound"] } })
}

async function validateAddresses(payload) {
    await Promise.all([
        validateAddress(payload.birthAddress, "birthAddress"),
        validateAddress(payload.permanentAddress, "permanentAddress"),
    ])
}

function ensureResignStatus(payload) {
    if (["RESIGNED", "TERMINATED", "ABANDONED", "PASSED_AWAY", "RETIRED"].includes(payload.employmentStatus) && !payload.resignDate) {
        throw new AppError({
            statusCode: 422,
            code: "EMPLOYEE_RESIGN_DATE_REQUIRED",
            messageKey: "errors.employee.profile.resignDateRequired",
            fields: { resignDate: ["errors.employee.profile.resignDateRequired"] },
        })
    }
}

function buildDisplayName(payload) {
    if (payload.displayName) return payload.displayName
    return [payload.englishFirstName, payload.englishLastName].filter(Boolean).join(" ") || [payload.khmerFirstName, payload.khmerLastName].filter(Boolean).join(" ") || payload.employeeCode
}

function buildEmployeePayload(payload, accountId) {
    const { createAccount, defaultRoleId, ...employeePayload } = payload
    const base = { ...employeePayload, updatedByAccountId: accountId }

    delete base.sourceOfHiring
    delete base.remark

    // Employee Type is system-managed from Position. Never accept a manual
    // Employee Type / Child override from Employee create or update payloads.
    delete base.employeeTypeId
    delete base.employeeTypeChildId
    delete base.employeeTypeChildCode
    delete base.employeeTypeChildName
    delete base.employeeTypeReviewRequired
    delete base.employeeTypeReviewReason

    if (payload.maritalStatus && payload.maritalStatus !== "MARRIED") {
        base.spouseName = ""
        base.spouseContactNumber = ""
    }

    const effectiveStatus = payload.employmentStatus
    if (effectiveStatus && !EXIT_EMPLOYMENT_STATUSES.has(effectiveStatus)) {
        base.resignDate = null
        base.exitReasonId = null
        base.resignReason = ""
    } else if (Object.hasOwn(payload, "resignDate") && !payload.resignDate) {
        base.exitReasonId = null
        base.resignReason = ""
    }

    if (payload.employeeCode || payload.englishFirstName || payload.englishLastName || payload.khmerFirstName || payload.khmerLastName || payload.displayName) {
        base.displayName = buildDisplayName({ ...payload, displayName: payload.displayName })
    }
    return base
}

function handleDuplicate(error) {
    if (error?.code !== 11000) throw error
    throw new AppError({
        statusCode: 409,
        code: "EMPLOYEE_CODE_EXISTS",
        messageKey: "errors.employee.profile.employeeCodeExists",
        fields: { employeeCode: ["errors.employee.profile.employeeCodeExists"] },
    })
}

export async function listEmployees({ query, user }) {
    const cacheKey = `employee:list:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cached = getCache(cacheKey)
    if (cached) return cached

    const filter = buildEmployeeFilter(query, user)

    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
        employeeListPopulate(Employee.find(filter))
            .sort({ employeeCode: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Employee.countDocuments(filter),
    ])

    const result = {
        items: items.map(serializeEmployeeListItem),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    }

    return setCache(cacheKey, result, 30_000)
}

/**
 * Return every employee matching the active filters with the complete profile
 * populated. Export must not reuse the compact paginated list serializer,
 * because that intentionally omits many employee fields.
 */
export async function listEmployeesForExport({ query, user }) {
    const filter = buildEmployeeFilter(query, user)
    const employees = await employeePopulate(Employee.find(filter))
        .sort({ employeeCode: 1 })
        .lean()

    return employees.map(serializeEmployee)
}

export async function getEmployeeById({ employeeId, user }) {
    ensureObjectId(employeeId, "EMPLOYEE_INVALID_ID", "errors.employee.profile.invalidId")
    const employee = await employeePopulate(Employee.findOne({ _id: employeeId, ...getEmployeeScopeFilter(user) })).lean()
    if (!employee) throw new AppError({ statusCode: 404, code: "EMPLOYEE_NOT_FOUND", messageKey: "errors.employee.profile.notFound" })
    return serializeEmployee(employee)
}

export async function createEmployee({ payload, user }) {
    await validateAssignment(payload, user)
    await validateAddresses(payload)
    const employeeTypeReporting = await resolveEmployeeTypeReporting(payload)
    const recruitmentChannel = await ensureRecruitmentChannel({
        recruitmentChannelId: payload.recruitmentChannelId,
        companyId: payload.companyId,
        branchId: payload.branchId,
    })
    const effectiveEmploymentStatus = payload.employmentStatus || "WORKING"
    const exitReason = await ensureExitReason({
        exitReasonId: EXIT_EMPLOYMENT_STATUSES.has(effectiveEmploymentStatus) ? payload.exitReasonId : null,
        companyId: payload.companyId,
        branchId: payload.branchId,
    })
    ensureReportingData({ ...payload, employmentStatus: effectiveEmploymentStatus })

    try {
        const employee = await Employee.create({
            ...buildEmployeePayload(payload, user.accountId),
            ...employeeTypeReporting,
            recruitmentChannelId: recruitmentChannel?._id || null,
            exitReasonId: EXIT_EMPLOYMENT_STATUSES.has(payload.employmentStatus || "WORKING") ? exitReason?._id || null : null,
            resignDate: EXIT_EMPLOYMENT_STATUSES.has(payload.employmentStatus || "WORKING") ? payload.resignDate || null : null,
            resignReason: EXIT_EMPLOYMENT_STATUSES.has(payload.employmentStatus || "WORKING")
                ? payload.resignReason || ""
                : "",
            displayName: buildDisplayName(payload),
            employmentStatus: payload.employmentStatus || "WORKING",
            gender: payload.gender || "UNKNOWN",
            maritalStatus: payload.maritalStatus || "UNKNOWN",
            recordStatus: payload.recordStatus || "ACTIVE",
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        try {
            await provisionEmployeeAccount({
                employee,
                user,
                createAccount: payload.createAccount !== false,
                defaultRoleId: payload.defaultRoleId || null,
            })
        } catch (error) {
            await Employee.findByIdAndDelete(employee._id)
            throw error
        }

        await createAutomaticMovementForEmployeeCreate({ employee, user })

        clearCacheByPrefix("employee:list:")
        clearCacheByPrefix("employeeMovement:list:")
        clearCacheByPrefix("hr-dashboard:")
        clearCacheByPrefix("excome:")
        await syncUnmatchedAttendanceForEmployee({ employee, user }).catch(() => null)
        return getEmployeeById({ employeeId: employee._id, user })
    } catch (error) {
        handleDuplicate(error)
    }
}

export async function updateEmployee({ employeeId, payload, user }) {
    ensureObjectId(employeeId, "EMPLOYEE_INVALID_ID", "errors.employee.profile.invalidId")
    const existing = await Employee.findOne({ _id: employeeId, ...getEmployeeScopeFilter(user) }).lean()
    if (!existing) throw new AppError({ statusCode: 404, code: "EMPLOYEE_NOT_FOUND", messageKey: "errors.employee.profile.notFound" })
    if (existing.recordStatus === "ARCHIVED") throw new AppError({ statusCode: 409, code: "EMPLOYEE_ARCHIVED", messageKey: "errors.employee.profile.archived" })

    const merged = { ...existing, ...payload }
    await validateAssignment(merged, user)
    await validateAddresses(payload)
    const employeeTypeReporting = await resolveEmployeeTypeReporting(merged)
    const recruitmentChannel = await ensureRecruitmentChannel({
        recruitmentChannelId: merged.recruitmentChannelId,
        companyId: merged.companyId,
        branchId: merged.branchId,
    })
    const effectiveEmploymentStatus = merged.employmentStatus || "WORKING"
    const exitReason = await ensureExitReason({
        exitReasonId: EXIT_EMPLOYMENT_STATUSES.has(effectiveEmploymentStatus) ? merged.exitReasonId : null,
        companyId: merged.companyId,
        branchId: merged.branchId,
    })
    ensureReportingData({ ...merged, employmentStatus: effectiveEmploymentStatus })

    try {
        const updatePayload = {
            ...buildEmployeePayload(payload, user.accountId),
            ...employeeTypeReporting,
            recruitmentChannelId: recruitmentChannel?._id || null,
            exitReasonId: EXIT_EMPLOYMENT_STATUSES.has(merged.employmentStatus) ? exitReason?._id || null : null,
            resignDate: EXIT_EMPLOYMENT_STATUSES.has(merged.employmentStatus) ? merged.resignDate || null : null,
            resignReason: EXIT_EMPLOYMENT_STATUSES.has(merged.employmentStatus)
                ? (payload.resignReason ?? existing.resignReason ?? "")
                : "",
        }
        delete updatePayload.employeeCode

        const updated = await Employee.findByIdAndUpdate(existing._id, { $set: updatePayload }, { new: true, runValidators: true, context: "query" }).lean()

        await createAutomaticMovementForEmployeeUpdate({ before: existing, after: updated, user })

        clearCacheByPrefix("employee:list:")
        clearCacheByPrefix("employeeMovement:list:")
        clearCacheByPrefix("hr-dashboard:")
        clearCacheByPrefix("excome:")
        await syncUnmatchedAttendanceForEmployee({ employee: updated, user }).catch(() => null)
        return getEmployeeById({ employeeId: updated._id, user })
    } catch (error) {
        handleDuplicate(error)
    }
}

export async function archiveEmployee({ employeeId, user }) {
    ensureObjectId(employeeId, "EMPLOYEE_INVALID_ID", "errors.employee.profile.invalidId")
    const existing = await Employee.findOne({ _id: employeeId, ...getEmployeeScopeFilter(user) }).lean()
    if (!existing) throw new AppError({ statusCode: 404, code: "EMPLOYEE_NOT_FOUND", messageKey: "errors.employee.profile.notFound" })
    const archived = await Employee.findByIdAndUpdate(existing._id, { $set: { recordStatus: "ARCHIVED", updatedByAccountId: user.accountId } }, { new: true, runValidators: true, context: "query" }).lean()
    clearCacheByPrefix("employee:list:")
    clearCacheByPrefix("hr-dashboard:")
        clearCacheByPrefix("excome:")
    return getEmployeeById({ employeeId: archived._id, user })
}

export async function getEmployeeApprovalPreview({ query, user }) {
    if (query.employeeId) {
        const employee = await Employee.findOne({
            _id: query.employeeId,
            ...getEmployeeScopeFilter(user),
        }).lean()

        if (!employee) {
            throw new AppError({
                statusCode: 404,
                code: "EMPLOYEE_NOT_FOUND",
                messageKey: "errors.employee.profile.notFound",
            })
        }

        return resolveApprovalByAssignment({
            moduleKey: query.moduleKey,
            actionKey: query.actionKey || "REQUEST",
            assignment: {
                ...employee,
                employeeId: employee._id,
            },
            context: {},
        })
    }

    return resolveApprovalByAssignment({
        moduleKey: query.moduleKey,
        actionKey: query.actionKey || "REQUEST",
        assignment: {
            companyId: query.companyId,
            branchId: query.branchId,
            departmentId: query.departmentId,
            positionId: query.positionId,
            lineId: query.lineId,
            employeeId: query.employeeId || null,
        },
        context: {},
    })
}
