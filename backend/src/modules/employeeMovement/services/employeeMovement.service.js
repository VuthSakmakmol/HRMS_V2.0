
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
import EmployeeType from "../../employeeType/models/EmployeeType.js"
import Employee from "../../employee/models/Employee.js"
import EmployeeMovement from "../models/EmployeeMovement.js"

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function ensureObjectId(id, code, messageKey) {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError({ statusCode: 400, code, messageKey })
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

function getUserCompanyIds(user) {
    return [...new Set((user?.roleAssignments || []).map((item) => item.companyId).filter(Boolean))]
}

function getScopeFilter(user, target = "to") {
    if (user?.isRootAdmin) return {}

    const allBranchCompanyIds = []
    const branchIds = []

    for (const assignment of user?.roleAssignments || []) {
        if (assignment.allBranches && assignment.companyId) allBranchCompanyIds.push(assignment.companyId)
        for (const branchId of assignment.branchIds || []) branchIds.push(branchId)
    }

    const filters = []
    if (allBranchCompanyIds.length) filters.push({ [`${target}.companyId`]: { $in: [...new Set(allBranchCompanyIds)] } })
    if (branchIds.length) filters.push({ [`${target}.branchId`]: { $in: [...new Set(branchIds)] } })

    return filters.length ? { $or: filters } : { _id: { $in: [] } }
}

function buildSearchFilter(search) {
    const keyword = String(search || "").trim()
    if (!keyword) return {}
    const regex = new RegExp(escapeRegExp(keyword), "i")

    return {
        $or: [
            { reason: regex },
            { movementType: regex },
            { source: regex },
        ],
    }
}

function simpleOrg(item) {
    if (!item || typeof item !== "object") return null

    return {
        id: toId(item._id || item.id),
        code: item.code,
        name: item.name || item.title || item.displayName || item.legalName,
        displayName: item.displayName,
        title: item.title,
        shortName: item.shortName,
        status: item.status,
    }
}

function simpleEmployee(item) {
    if (!item || typeof item !== "object") return null

    return {
        id: toId(item._id || item.id),
        employeeCode: item.employeeCode,
        displayName: item.displayName,
        englishFirstName: item.englishFirstName,
        englishLastName: item.englishLastName,
        khmerFirstName: item.khmerFirstName,
        khmerLastName: item.khmerLastName,
        employmentStatus: item.employmentStatus,
        recordStatus: item.recordStatus,
    }
}

function serializeSnapshot(snapshot = {}) {
    return {
        companyId: toId(snapshot.companyId),
        branchId: toId(snapshot.branchId),
        departmentId: toId(snapshot.departmentId),
        positionId: toId(snapshot.positionId),
        lineId: toId(snapshot.lineId),
        shiftId: toId(snapshot.shiftId),
        employeeTypeId: toId(snapshot.employeeTypeId),
        employeeTypeChildId: toId(snapshot.employeeTypeChildId),
        employeeTypeChildCode: snapshot.employeeTypeChildCode || "",
        employeeTypeChildName: snapshot.employeeTypeChildName || "",
        employmentStatus: snapshot.employmentStatus || "",
        company: simpleOrg(snapshot.companyId),
        branch: simpleOrg(snapshot.branchId),
        department: simpleOrg(snapshot.departmentId),
        position: simpleOrg(snapshot.positionId),
        line: simpleOrg(snapshot.lineId),
        shift: simpleOrg(snapshot.shiftId),
        employeeType: simpleOrg(snapshot.employeeTypeId),
    }
}

export function serializeEmployeeMovement(movement) {
    if (!movement) return null
    const raw = typeof movement.toJSON === "function" ? movement.toJSON() : { ...movement }

    return {
        id: toId(raw._id || raw.id),
        employeeId: toId(raw.employeeId),
        employee: simpleEmployee(raw.employeeId),
        movementType: raw.movementType,
        effectiveDate: raw.effectiveDate,
        from: serializeSnapshot(raw.from),
        to: serializeSnapshot(raw.to),
        reason: raw.reason || "",
        source: raw.source || "MANUAL",
        status: raw.status,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

function movementPopulate(query) {
    const selectCompany = "code displayName legalName status"
    const selectBranch = "companyId code name shortName status"
    const selectDepartment = "companyId branchId code name shortName status"
    const selectPosition = "companyId branchId departmentId code title shortName level isManager status"
    const selectLine = "companyId branchId departmentId code name shortName status"
    const selectShift = "companyId branchId code name shortName startTime endTime status"
    const selectEmployeeType = "code name shortName status"

    return query
        .populate({ path: "employeeId", select: "employeeCode displayName englishFirstName englishLastName khmerFirstName khmerLastName employmentStatus recordStatus" })
        .populate({ path: "from.companyId", select: selectCompany })
        .populate({ path: "from.branchId", select: selectBranch })
        .populate({ path: "from.departmentId", select: selectDepartment })
        .populate({ path: "from.positionId", select: selectPosition })
        .populate({ path: "from.lineId", select: selectLine })
        .populate({ path: "from.shiftId", select: selectShift })
        .populate({ path: "from.employeeTypeId", select: selectEmployeeType })
        .populate({ path: "to.companyId", select: selectCompany })
        .populate({ path: "to.branchId", select: selectBranch })
        .populate({ path: "to.departmentId", select: selectDepartment })
        .populate({ path: "to.positionId", select: selectPosition })
        .populate({ path: "to.lineId", select: selectLine })
        .populate({ path: "to.shiftId", select: selectShift })
        .populate({ path: "to.employeeTypeId", select: selectEmployeeType })
}

function buildSnapshotFromEmployee(employee = {}) {
    return {
        companyId: employee.companyId || null,
        branchId: employee.branchId || null,
        departmentId: employee.departmentId || null,
        positionId: employee.positionId || null,
        lineId: employee.lineId || null,
        shiftId: employee.shiftId || null,
        employeeTypeId: employee.employeeTypeId || null,
        employeeTypeChildId: employee.employeeTypeChildId || null,
        employeeTypeChildCode: employee.employeeTypeChildCode || "",
        employeeTypeChildName: employee.employeeTypeChildName || "",
        employmentStatus: employee.employmentStatus || "",
    }
}

function buildCleanSnapshot(snapshot = {}) {
    return {
        companyId: snapshot.companyId || null,
        branchId: snapshot.branchId || null,
        departmentId: snapshot.departmentId || null,
        positionId: snapshot.positionId || null,
        lineId: snapshot.lineId || null,
        shiftId: snapshot.shiftId || null,
        employeeTypeId: snapshot.employeeTypeId || null,
        employeeTypeChildId: snapshot.employeeTypeChildId || null,
        employeeTypeChildCode: snapshot.employeeTypeChildCode || "",
        employeeTypeChildName: snapshot.employeeTypeChildName || "",
        employmentStatus: snapshot.employmentStatus || "",
    }
}

function getStatusMovementType(status) {
    switch (status) {
        case "RESIGNED":
            return "RESIGN"
        case "TERMINATED":
            return "TERMINATE"
        case "ABANDONED":
            return "ABANDON"
        case "PASSED_AWAY":
            return "PASSED_AWAY"
        case "RETIRED":
            return "RETIRE"
        case "WORKING":
            return "REJOIN"
        default:
            return "STATUS_CHANGE"
    }
}

function detectMovementType(before = {}, after = {}) {
    if (before.employmentStatus !== after.employmentStatus) {
        return getStatusMovementType(after.employmentStatus)
    }

    if (!sameId(before.departmentId, after.departmentId)) return "DEPARTMENT_CHANGE"
    if (!sameId(before.positionId, after.positionId)) return "POSITION_CHANGE"
    if (!sameId(before.lineId, after.lineId)) return "LINE_CHANGE"
    if (!sameId(before.shiftId, after.shiftId)) return "SHIFT_CHANGE"
    if (!sameId(before.employeeTypeId, after.employeeTypeId) || !sameId(before.employeeTypeChildId, after.employeeTypeChildId)) return "EMPLOYEE_TYPE_CHANGE"

    return null
}

function hasMovementRelevantChange(before = {}, after = {}) {
    return Boolean(detectMovementType(before, after))
}

function buildDateFilter(fromDate, toDate) {
    const filter = {}
    if (fromDate) filter.$gte = fromDate
    if (toDate) {
        const end = new Date(toDate)
        end.setHours(23, 59, 59, 999)
        filter.$lte = end
    }
    return Object.keys(filter).length ? filter : null
}

function buildListFilter(query, user) {
    const filter = {
        ...getScopeFilter(user, "to"),
        ...buildSearchFilter(query.search),
    }

    if (query.employeeId) filter.employeeId = query.employeeId
    if (query.companyId) filter["to.companyId"] = query.companyId
    if (query.branchId) filter["to.branchId"] = query.branchId
    if (query.departmentId) filter["to.departmentId"] = query.departmentId
    if (query.positionId) filter["to.positionId"] = query.positionId
    if (query.lineId) filter["to.lineId"] = query.lineId
    if (query.shiftId) filter["to.shiftId"] = query.shiftId
    if (query.employeeTypeId) filter["to.employeeTypeId"] = query.employeeTypeId
    if (query.employeeTypeChildId) filter["to.employeeTypeChildId"] = query.employeeTypeChildId
    if (query.movementType !== "ALL") filter.movementType = query.movementType
    if (query.source !== "ALL") filter.source = query.source
    if (query.status !== "ALL") filter.status = query.status

    const dateFilter = buildDateFilter(query.fromDate, query.toDate)
    if (dateFilter) filter.effectiveDate = dateFilter

    return filter
}

async function ensureEmployee(employeeId, user) {
    ensureObjectId(employeeId, "EMPLOYEE_MOVEMENT_EMPLOYEE_INVALID_ID", "errors.employee.movement.employeeInvalidId")

    const employee = await Employee.findOne({ _id: employeeId, ...getEmployeeScopeFilterFromUser(user) }).lean()
    if (!employee) {
        throw new AppError({
            statusCode: 404,
            code: "EMPLOYEE_MOVEMENT_EMPLOYEE_NOT_FOUND",
            messageKey: "errors.employee.movement.employeeNotFound",
        })
    }

    return employee
}

function getEmployeeScopeFilterFromUser(user) {
    if (user?.isRootAdmin) return {}

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

async function ensureSnapshotReferences(snapshot = {}) {
    const ids = [
        [snapshot.companyId, Company, "companyId"],
        [snapshot.branchId, Branch, "branchId"],
        [snapshot.departmentId, Department, "departmentId"],
        [snapshot.positionId, Position, "positionId"],
        [snapshot.lineId, Line, "lineId"],
        [snapshot.shiftId, Shift, "shiftId"],
        [snapshot.employeeTypeId, EmployeeType, "employeeTypeId"],
    ]

    for (const [id, Model, field] of ids) {
        if (!id) continue
        ensureObjectId(id, "EMPLOYEE_MOVEMENT_INVALID_REFERENCE", "errors.employee.movement.invalidReference")
        const exists = await Model.exists({ _id: id, status: { $ne: "ARCHIVED" } })
        if (!exists) {
            throw new AppError({
                statusCode: 404,
                code: "EMPLOYEE_MOVEMENT_REFERENCE_NOT_FOUND",
                messageKey: "errors.employee.movement.referenceNotFound",
                fields: {
                    [field]: ["errors.employee.movement.referenceNotFound"],
                },
            })
        }
    }
}

export async function listEmployeeMovements({ query, user }) {
    const cacheKey = `employeeMovement:list:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cached = getCache(cacheKey)
    if (cached) return cached

    const filter = buildListFilter(query, user)
    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
        movementPopulate(EmployeeMovement.find(filter))
            .sort({ effectiveDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        EmployeeMovement.countDocuments(filter),
    ])

    const result = {
        items: items.map(serializeEmployeeMovement),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        },
    }

    return setCache(cacheKey, result, 30_000)
}

export async function getEmployeeMovementById({ movementId, user }) {
    ensureObjectId(movementId, "EMPLOYEE_MOVEMENT_INVALID_ID", "errors.employee.movement.invalidId")

    const movement = await movementPopulate(EmployeeMovement.findOne({ _id: movementId, ...getScopeFilter(user, "to") })).lean()
    if (!movement) {
        throw new AppError({ statusCode: 404, code: "EMPLOYEE_MOVEMENT_NOT_FOUND", messageKey: "errors.employee.movement.notFound" })
    }

    return serializeEmployeeMovement(movement)
}

export async function createEmployeeMovement({ payload, user }) {
    const employee = await ensureEmployee(payload.employeeId, user)
    await ensureSnapshotReferences(payload.from || {})
    await ensureSnapshotReferences(payload.to || {})

    const fromSnapshot = Object.keys(payload.from || {}).length
        ? buildCleanSnapshot(payload.from)
        : buildSnapshotFromEmployee(employee)
    const toSnapshot = Object.keys(payload.to || {}).length
        ? buildCleanSnapshot(payload.to)
        : buildSnapshotFromEmployee(employee)

    const movement = await EmployeeMovement.create({
        employeeId: payload.employeeId,
        movementType: payload.movementType,
        effectiveDate: payload.effectiveDate,
        from: fromSnapshot,
        to: toSnapshot,
        reason: payload.reason || "",
        source: payload.source || "MANUAL",
        status: payload.status || "ACTIVE",
        createdByAccountId: user.accountId,
        updatedByAccountId: user.accountId,
    })

    clearCacheByPrefix("employeeMovement:list:")
    return getEmployeeMovementById({ movementId: movement._id, user })
}

export async function updateEmployeeMovement({ movementId, payload, user }) {
    ensureObjectId(movementId, "EMPLOYEE_MOVEMENT_INVALID_ID", "errors.employee.movement.invalidId")

    const existing = await EmployeeMovement.findOne({ _id: movementId, ...getScopeFilter(user, "to") }).lean()
    if (!existing) {
        throw new AppError({ statusCode: 404, code: "EMPLOYEE_MOVEMENT_NOT_FOUND", messageKey: "errors.employee.movement.notFound" })
    }
    if (existing.status === "ARCHIVED") {
        throw new AppError({ statusCode: 409, code: "EMPLOYEE_MOVEMENT_ARCHIVED", messageKey: "errors.employee.movement.archived" })
    }

    if (payload.from) await ensureSnapshotReferences(payload.from)
    if (payload.to) await ensureSnapshotReferences(payload.to)

    const updatePayload = {
        updatedByAccountId: user.accountId,
    }

    for (const field of ["movementType", "effectiveDate", "reason", "status"]) {
        if (payload[field] !== undefined) updatePayload[field] = payload[field]
    }
    if (payload.from !== undefined) updatePayload.from = buildCleanSnapshot(payload.from)
    if (payload.to !== undefined) updatePayload.to = buildCleanSnapshot(payload.to)

    const updated = await EmployeeMovement.findByIdAndUpdate(existing._id, { $set: updatePayload }, { new: true, runValidators: true, context: "query" }).lean()

    clearCacheByPrefix("employeeMovement:list:")
    return getEmployeeMovementById({ movementId: updated._id, user })
}

export async function archiveEmployeeMovement({ movementId, user }) {
    ensureObjectId(movementId, "EMPLOYEE_MOVEMENT_INVALID_ID", "errors.employee.movement.invalidId")

    const existing = await EmployeeMovement.findOne({ _id: movementId, ...getScopeFilter(user, "to") }).lean()
    if (!existing) {
        throw new AppError({ statusCode: 404, code: "EMPLOYEE_MOVEMENT_NOT_FOUND", messageKey: "errors.employee.movement.notFound" })
    }

    const archived = await EmployeeMovement.findByIdAndUpdate(existing._id, { $set: { status: "ARCHIVED", updatedByAccountId: user.accountId } }, { new: true, runValidators: true, context: "query" }).lean()

    clearCacheByPrefix("employeeMovement:list:")
    return getEmployeeMovementById({ movementId: archived._id, user })
}

export async function getExportEmployeeMovements({ query, user }) {
    const filter = buildListFilter({ ...query, page: 1, limit: 100, status: query.status || "ACTIVE" }, user)

    const items = await movementPopulate(EmployeeMovement.find(filter))
        .sort({ effectiveDate: -1, createdAt: -1 })
        .limit(10000)
        .lean()

    return items.map(serializeEmployeeMovement)
}

export async function createAutomaticMovementForEmployeeCreate({ employee, user }) {
    const raw = typeof employee.toObject === "function" ? employee.toObject() : employee

    if (!raw?._id) return null

    const movement = await EmployeeMovement.create({
        employeeId: raw._id,
        movementType: raw.employmentStatus === "WORKING" ? "NEW_HIRE" : getStatusMovementType(raw.employmentStatus),
        effectiveDate: raw.joinDate || new Date(),
        from: {},
        to: buildSnapshotFromEmployee(raw),
        reason: raw.remark || "Created from employee profile.",
        source: "EMPLOYEE_PROFILE",
        status: "ACTIVE",
        createdByAccountId: user?.accountId || null,
        updatedByAccountId: user?.accountId || null,
    })

    clearCacheByPrefix("employeeMovement:list:")
    return movement
}

export async function createAutomaticMovementForEmployeeUpdate({ before, after, user }) {
    if (!before?._id || !after?._id || !hasMovementRelevantChange(before, after)) return null

    const movementType = detectMovementType(before, after) || "OTHER"
    const effectiveDate = ["RESIGN", "TERMINATE", "ABANDON", "PASSED_AWAY", "RETIRE"].includes(movementType)
        ? after.resignDate || new Date()
        : new Date()

    const movement = await EmployeeMovement.create({
        employeeId: after._id,
        movementType,
        effectiveDate,
        from: buildSnapshotFromEmployee(before),
        to: buildSnapshotFromEmployee(after),
        reason: after.remark || after.resignReason || "Updated from employee profile.",
        source: "EMPLOYEE_PROFILE",
        status: "ACTIVE",
        createdByAccountId: user?.accountId || null,
        updatedByAccountId: user?.accountId || null,
    })

    clearCacheByPrefix("employeeMovement:list:")
    return movement
}
