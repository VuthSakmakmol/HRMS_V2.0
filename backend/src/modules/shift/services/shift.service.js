import { Types } from "mongoose"

import {
    clearCacheByPrefix,
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Company from "../../organization/models/Company.js"
import Branch from "../../organization/models/Branch.js"

import Shift from "../models/Shift.js"

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function ensureValidObjectId(id, errorCode, messageKey) {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError({
            statusCode: 400,
            code: errorCode,
            messageKey,
        })
    }
}

function parseTimeToMinutes(time) {
    const [hour, minute] = String(time).split(":").map(Number)
    return hour * 60 + minute
}

function calculateDurationMinutes(startTime, endTime) {
    const startMinutes = parseTimeToMinutes(startTime)
    let endMinutes = parseTimeToMinutes(endTime)

    if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60
    }

    return endMinutes - startMinutes
}

function calculateShiftTiming(payload) {
    const totalMinutes = calculateDurationMinutes(
        payload.startTime,
        payload.endTime,
    )

    if (totalMinutes <= 0 || totalMinutes > 1440) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_SHIFT_TIME_INVALID",
            messageKey: "errors.organization.shift.invalidTimeRange",
            fields: {
                endTime: ["errors.organization.shift.invalidTimeRange"],
            },
        })
    }

    let breakMinutes = 0

    if (payload.breakStartTime && payload.breakEndTime) {
        breakMinutes = calculateDurationMinutes(
            payload.breakStartTime,
            payload.breakEndTime,
        )

        if (breakMinutes < 0 || breakMinutes >= totalMinutes) {
            throw new AppError({
                statusCode: 422,
                code: "ORGANIZATION_SHIFT_BREAK_INVALID",
                messageKey: "errors.organization.shift.invalidBreakRange",
                fields: {
                    breakStartTime: [
                        "errors.organization.shift.invalidBreakRange",
                    ],
                    breakEndTime: [
                        "errors.organization.shift.invalidBreakRange",
                    ],
                },
            })
        }
    }

    const workingMinutes = totalMinutes - breakMinutes

    if (workingMinutes <= 0) {
        throw new AppError({
            statusCode: 422,
            code: "ORGANIZATION_SHIFT_WORKING_MINUTES_INVALID",
            messageKey: "errors.organization.shift.invalidWorkingMinutes",
        })
    }

    return {
        totalMinutes,
        breakMinutes,
        workingMinutes,
        isOvernight:
            parseTimeToMinutes(payload.endTime) <=
            parseTimeToMinutes(payload.startTime),
    }
}

function hasGlobalScope(user) {
    return (user?.roleAssignments || []).some(
        (assignment) => assignment.roleScope === "GLOBAL",
    )
}

function getUserCompanyIds(user) {
    return [
        ...new Set(
            (user?.roleAssignments || [])
                .map((assignment) => assignment.companyId)
                .filter(Boolean),
        ),
    ]
}

function getCompanyScopeFilter(user) {
    if (user?.isRootAdmin || hasGlobalScope(user)) {
        return {}
    }

    const companyIds = getUserCompanyIds(user)

    if (companyIds.length === 0) {
        return {
            _id: { $in: [] },
        }
    }

    return {
        _id: { $in: companyIds },
    }
}

function getBranchScopeFilter(user) {
    if (user?.isRootAdmin || hasGlobalScope(user)) {
        return {}
    }

    const allBranchCompanyIds = []
    const branchIds = []

    for (const assignment of user?.roleAssignments || []) {
        if (assignment.allBranches && assignment.companyId) {
            allBranchCompanyIds.push(assignment.companyId)
        }

        for (const branchId of assignment.branchIds || []) {
            branchIds.push(branchId)
        }
    }

    const filters = []

    if (allBranchCompanyIds.length > 0) {
        filters.push({
            companyId: { $in: [...new Set(allBranchCompanyIds)] },
        })
    }

    if (branchIds.length > 0) {
        filters.push({
            _id: { $in: [...new Set(branchIds)] },
        })
    }

    if (filters.length === 0) {
        return {
            _id: { $in: [] },
        }
    }

    return {
        $or: filters,
    }
}

function getShiftScopeFilter(user) {
    if (user?.isRootAdmin || hasGlobalScope(user)) {
        return {}
    }

    const allBranchCompanyIds = []
    const branchIds = []

    for (const assignment of user?.roleAssignments || []) {
        if (assignment.allBranches && assignment.companyId) {
            allBranchCompanyIds.push(assignment.companyId)
        }

        for (const branchId of assignment.branchIds || []) {
            branchIds.push(branchId)
        }
    }

    const filters = []

    if (allBranchCompanyIds.length > 0) {
        filters.push({
            companyId: { $in: [...new Set(allBranchCompanyIds)] },
        })
    }

    if (branchIds.length > 0) {
        filters.push({
            branchId: { $in: [...new Set(branchIds)] },
        })
    }

    if (filters.length === 0) {
        return {
            _id: { $in: [] },
        }
    }

    return {
        $or: filters,
    }
}

function buildShiftSearchFilter(search) {
    const normalizedSearch = String(search || "").trim()

    if (!normalizedSearch) {
        return {}
    }

    const searchRegex = new RegExp(escapeRegExp(normalizedSearch), "i")

    return {
        $or: [
            { code: searchRegex },
            { name: searchRegex },
            { shortName: searchRegex },
            { description: searchRegex },
        ],
    }
}

function serializeCompany(company) {
    if (!company || typeof company !== "object") {
        return null
    }

    return {
        id: company._id?.toString?.() || company.id,
        code: company.code,
        displayName: company.displayName,
        legalName: company.legalName,
        status: company.status,
    }
}

function serializeBranch(branch) {
    if (!branch || typeof branch !== "object") {
        return null
    }

    return {
        id: branch._id?.toString?.() || branch.id,
        companyId: branch.companyId?.toString?.() || branch.companyId,
        code: branch.code,
        name: branch.name,
        shortName: branch.shortName,
        status: branch.status,
        isHeadOffice: Boolean(branch.isHeadOffice),
    }
}

export function serializeShift(shift) {
    if (!shift) {
        return null
    }

    const raw =
        typeof shift.toJSON === "function"
            ? shift.toJSON()
            : {
                  ...shift,
              }

    const populatedCompany =
        raw.companyId && typeof raw.companyId === "object"
            ? serializeCompany(raw.companyId)
            : null

    const populatedBranch =
        raw.branchId && typeof raw.branchId === "object"
            ? serializeBranch(raw.branchId)
            : null

    return {
        id: raw._id?.toString?.() || raw.id,
        companyId:
            populatedCompany?.id ||
            raw.companyId?.toString?.() ||
            raw.companyId,
        branchId:
            populatedBranch?.id || raw.branchId?.toString?.() || raw.branchId,

        company: populatedCompany,
        branch: populatedBranch,

        code: raw.code,
        name: raw.name,
        shortName: raw.shortName || "",

        startTime: raw.startTime,
        endTime: raw.endTime,
        breakStartTime: raw.breakStartTime || "",
        breakEndTime: raw.breakEndTime || "",

        totalMinutes: Number(raw.totalMinutes || 0),
        breakMinutes: Number(raw.breakMinutes || 0),
        workingMinutes: Number(raw.workingMinutes || 0),
        graceInMinutes: Number(raw.graceInMinutes || 0),
        graceOutMinutes: Number(raw.graceOutMinutes || 0),
        isOvernight: Boolean(raw.isOvernight),

        description: raw.description || "",
        status: raw.status,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
}

function buildUpdatePayload(payload, accountId) {
    const updatePayload = {
        updatedByAccountId: accountId,
    }

    for (const field of [
        "code",
        "name",
        "shortName",
        "startTime",
        "endTime",
        "breakStartTime",
        "breakEndTime",
        "graceInMinutes",
        "graceOutMinutes",
        "description",
        "status",
    ]) {
        if (payload[field] !== undefined) {
            updatePayload[field] = payload[field]
        }
    }

    return updatePayload
}

function handleDuplicateError(error) {
    if (error?.code !== 11000) {
        throw error
    }

    throw new AppError({
        statusCode: 409,
        code: "ORGANIZATION_SHIFT_CODE_EXISTS",
        messageKey: "errors.organization.shift.codeExists",
        fields: {
            code: ["errors.organization.shift.codeExists"],
        },
    })
}

async function ensureCompanyExists({ companyId, user }) {
    ensureValidObjectId(
        companyId,
        "ORGANIZATION_COMPANY_INVALID_ID",
        "errors.organization.company.invalidId",
    )

    const company = await Company.findOne({
        _id: companyId,
        ...getCompanyScopeFilter(user),
    }).lean()

    if (!company) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_COMPANY_NOT_FOUND",
            messageKey: "errors.organization.company.notFound",
        })
    }

    if (company.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_COMPANY_ARCHIVED",
            messageKey: "errors.organization.company.archived",
        })
    }

    return company
}

async function ensureBranchExists({ companyId, branchId, user }) {
    ensureValidObjectId(
        branchId,
        "ORGANIZATION_BRANCH_INVALID_ID",
        "errors.organization.branch.invalidId",
    )

    const branch = await Branch.findOne({
        _id: branchId,
        companyId,
        ...getBranchScopeFilter(user),
    }).lean()

    if (!branch) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_BRANCH_NOT_FOUND",
            messageKey: "errors.organization.branch.notFound",
        })
    }

    if (branch.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_BRANCH_ARCHIVED",
            messageKey: "errors.organization.branch.archived",
        })
    }

    return branch
}

export async function listShifts({ query, user }) {
    const cacheKey = `shift:list:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cachedResult = getCache(cacheKey)

    if (cachedResult) {
        return cachedResult
    }

    const filter = {
        ...getShiftScopeFilter(user),
        ...buildShiftSearchFilter(query.search),
    }

    if (query.companyId) {
        await ensureCompanyExists({
            companyId: query.companyId,
            user,
        })

        filter.companyId = query.companyId
    }

    if (query.branchId) {
        if (query.companyId) {
            await ensureBranchExists({
                companyId: query.companyId,
                branchId: query.branchId,
                user,
            })
        }

        filter.branchId = query.branchId
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
        Shift.find(filter)
            .populate({
                path: "companyId",
                select: "code displayName legalName status",
            })
            .populate({
                path: "branchId",
                select: "companyId code name shortName status isHeadOffice",
            })
            .sort({ name: 1, code: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Shift.countDocuments(filter),
    ])

    const result = {
        items: items.map(serializeShift),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        },
    }

    return setCache(cacheKey, result, 30_000)
}

export async function lookupShifts({ query, user }) {
    const normalizedQuery = {
        ...query,
        page: 1,
        limit: Math.min(Number(query.limit || 100), 100),
        status: "ACTIVE",
    }

    const cacheKey = `shift:lookup:${user?.accountId || "anonymous"}:${JSON.stringify(normalizedQuery)}`
    const cachedResult = getCache(cacheKey)

    if (cachedResult) {
        return cachedResult
    }

    const filter = {
        ...getShiftScopeFilter(user),
        ...buildShiftSearchFilter(normalizedQuery.search),
        status: "ACTIVE",
    }

    if (normalizedQuery.companyId) {
        await ensureCompanyExists({
            companyId: normalizedQuery.companyId,
            user,
        })

        filter.companyId = normalizedQuery.companyId
    }

    if (normalizedQuery.branchId) {
        if (normalizedQuery.companyId) {
            await ensureBranchExists({
                companyId: normalizedQuery.companyId,
                branchId: normalizedQuery.branchId,
                user,
            })
        }

        filter.branchId = normalizedQuery.branchId
    }

    const shifts = await Shift.find(filter)
        .select(
            "companyId branchId code name shortName startTime endTime workingMinutes isOvernight status",
        )
        .sort({ name: 1, code: 1 })
        .limit(normalizedQuery.limit)
        .lean()

    const result = {
        items: shifts.map((shift) => ({
            id: shift._id.toString(),
            companyId: shift.companyId?.toString?.() || shift.companyId,
            branchId: shift.branchId?.toString?.() || shift.branchId,
            code: shift.code,
            name: shift.name,
            shortName: shift.shortName || "",
            startTime: shift.startTime,
            endTime: shift.endTime,
            workingMinutes: Number(shift.workingMinutes || 0),
            isOvernight: Boolean(shift.isOvernight),
            status: shift.status,
        })),
    }

    return setCache(cacheKey, result, 60_000)
}

export async function getShiftById({ shiftId, user }) {
    ensureValidObjectId(
        shiftId,
        "ORGANIZATION_SHIFT_INVALID_ID",
        "errors.organization.shift.invalidId",
    )

    const shift = await Shift.findOne({
        _id: shiftId,
        ...getShiftScopeFilter(user),
    })
        .populate({
            path: "companyId",
            select: "code displayName legalName status",
        })
        .populate({
            path: "branchId",
            select: "companyId code name shortName status isHeadOffice",
        })
        .lean()

    if (!shift) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_SHIFT_NOT_FOUND",
            messageKey: "errors.organization.shift.notFound",
        })
    }

    return serializeShift(shift)
}

export async function createShift({ payload, user }) {
    await ensureCompanyExists({
        companyId: payload.companyId,
        user,
    })

    await ensureBranchExists({
        companyId: payload.companyId,
        branchId: payload.branchId,
        user,
    })

    const timing = calculateShiftTiming(payload)

    try {
        const shift = await Shift.create({
            companyId: payload.companyId,
            branchId: payload.branchId,
            code: payload.code,
            name: payload.name,
            shortName: payload.shortName || "",
            startTime: payload.startTime,
            endTime: payload.endTime,
            breakStartTime: payload.breakStartTime || "",
            breakEndTime: payload.breakEndTime || "",
            totalMinutes: timing.totalMinutes,
            breakMinutes: timing.breakMinutes,
            workingMinutes: timing.workingMinutes,
            graceInMinutes: payload.graceInMinutes || 0,
            graceOutMinutes: payload.graceOutMinutes || 0,
            isOvernight: timing.isOvernight,
            description: payload.description || "",
            status: payload.status || "ACTIVE",
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        clearCacheByPrefix("shift:list:")
        clearCacheByPrefix("shift:lookup:")

        return getShiftById({
            shiftId: shift._id,
            user,
        })
    } catch (error) {
        handleDuplicateError(error)
    }
}

export async function updateShift({ shiftId, payload, user }) {
    ensureValidObjectId(
        shiftId,
        "ORGANIZATION_SHIFT_INVALID_ID",
        "errors.organization.shift.invalidId",
    )

    const existingShift = await Shift.findOne({
        _id: shiftId,
        ...getShiftScopeFilter(user),
    }).lean()

    if (!existingShift) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_SHIFT_NOT_FOUND",
            messageKey: "errors.organization.shift.notFound",
        })
    }

    if (existingShift.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "ORGANIZATION_SHIFT_ARCHIVED",
            messageKey: "errors.organization.shift.archived",
        })
    }

    const mergedPayload = {
        ...existingShift,
        ...payload,
    }

    const timing = calculateShiftTiming(mergedPayload)

    try {
        const updatedShift = await Shift.findByIdAndUpdate(
            existingShift._id,
            {
                $set: {
                    ...buildUpdatePayload(payload, user.accountId),
                    totalMinutes: timing.totalMinutes,
                    breakMinutes: timing.breakMinutes,
                    workingMinutes: timing.workingMinutes,
                    isOvernight: timing.isOvernight,
                },
            },
            {
                new: true,
                runValidators: true,
                context: "query",
            },
        ).lean()

        clearCacheByPrefix("shift:list:")
        clearCacheByPrefix("shift:lookup:")

        return getShiftById({
            shiftId: updatedShift._id,
            user,
        })
    } catch (error) {
        handleDuplicateError(error)
    }
}

export async function archiveShift({ shiftId, user }) {
    ensureValidObjectId(
        shiftId,
        "ORGANIZATION_SHIFT_INVALID_ID",
        "errors.organization.shift.invalidId",
    )

    const existingShift = await Shift.findOne({
        _id: shiftId,
        ...getShiftScopeFilter(user),
    }).lean()

    if (!existingShift) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_SHIFT_NOT_FOUND",
            messageKey: "errors.organization.shift.notFound",
        })
    }

    const archivedShift = await Shift.findByIdAndUpdate(
        existingShift._id,
        {
            $set: {
                status: "ARCHIVED",
                updatedByAccountId: user.accountId,
            },
        },
        {
            new: true,
            runValidators: true,
            context: "query",
        },
    ).lean()

    clearCacheByPrefix("shift:list:")
    clearCacheByPrefix("shift:lookup:")

    return getShiftById({
        shiftId: archivedShift._id,
        user,
    })
}