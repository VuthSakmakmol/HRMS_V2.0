import { Types } from "mongoose"

import {
    clearCacheByPrefix,
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"
import Branch from "../../organization/models/Branch.js"
import Company from "../../organization/models/Company.js"
import CalendarDay from "../models/CalendarDay.js"

const CALENDAR_CACHE_PREFIX = "calendar:"

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

function normalizeDateKey(value) {
    return String(value || "").trim()
}

function addDays(dateKey, count) {
    const date = new Date(`${dateKey}T00:00:00.000Z`)
    date.setUTCDate(date.getUTCDate() + count)
    return date.toISOString().slice(0, 10)
}

function diffDays(startDate, endDate) {
    const start = new Date(`${startDate}T00:00:00.000Z`).getTime()
    const end = new Date(`${endDate}T00:00:00.000Z`).getTime()
    return Math.round((end - start) / 86_400_000)
}

function getDefaultCalendarDay(dateKey) {
    const date = new Date(`${dateKey}T00:00:00.000Z`)
    const dayOfWeek = date.getUTCDay()

    if (dayOfWeek === 0) {
        return {
            id: null,
            dateKey,
            scopeLevel: "DEFAULT",
            scopeKey: "DEFAULT:SUNDAY",
            companyId: null,
            branchId: null,
            company: null,
            branch: null,
            dayType: "WEEKEND",
            name: "Sunday",
            holidayCategory: "",
            isPaidHoliday: false,
            description: "Default weekly rest day.",
            status: "ACTIVE",
            source: "DEFAULT_WEEKLY_RULE",
            isWorkingDay: false,
            isHoliday: false,
        }
    }

    return {
        id: null,
        dateKey,
        scopeLevel: "DEFAULT",
        scopeKey: "DEFAULT:WORKING_DAY",
        companyId: null,
        branchId: null,
        company: null,
        branch: null,
        dayType: "WORKING_DAY",
        name: "Working Day",
        holidayCategory: "",
        isPaidHoliday: false,
        description: "Default working day.",
        status: "ACTIVE",
        source: "DEFAULT_WEEKLY_RULE",
        isWorkingDay: true,
        isHoliday: false,
    }
}

function buildScopeKey({ scopeLevel, companyId, branchId }) {
    if (scopeLevel === "GLOBAL") {
        return "GLOBAL"
    }

    if (scopeLevel === "COMPANY") {
        return `COMPANY:${companyId}`
    }

    return `BRANCH:${branchId}`
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
    if (user?.isRootAdmin) {
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
    if (user?.isRootAdmin) {
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

function getCalendarScopeFilter(user) {
    if (user?.isRootAdmin) {
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

    const filters = [{ scopeLevel: "GLOBAL" }]

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

    return {
        $or: filters,
    }
}

function buildSearchFilter(search) {
    const normalizedSearch = String(search || "").trim()

    if (!normalizedSearch) {
        return {}
    }

    const searchRegex = new RegExp(escapeRegExp(normalizedSearch), "i")

    return {
        $or: [
            { name: searchRegex },
            { holidayCategory: searchRegex },
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

export function serializeCalendarDay(day, source = "OVERRIDE") {
    if (!day) {
        return null
    }

    const raw =
        typeof day.toJSON === "function"
            ? day.toJSON()
            : {
                  ...day,
              }

    const company =
        raw.companyId && typeof raw.companyId === "object"
            ? serializeCompany(raw.companyId)
            : null

    const branch =
        raw.branchId && typeof raw.branchId === "object"
            ? serializeBranch(raw.branchId)
            : null

    const dayType = raw.dayType

    return {
        id: raw._id?.toString?.() || raw.id,
        scopeLevel: raw.scopeLevel,
        scopeKey: raw.scopeKey,
        companyId: company?.id || raw.companyId?.toString?.() || raw.companyId || null,
        branchId: branch?.id || raw.branchId?.toString?.() || raw.branchId || null,
        company,
        branch,
        dateKey: raw.dateKey,
        dayType,
        name: raw.name,
        holidayCategory: raw.holidayCategory || "",
        isPaidHoliday: Boolean(raw.isPaidHoliday),
        description: raw.description || "",
        status: raw.status,
        source,
        isWorkingDay: ["WORKING_DAY", "SPECIAL_WORKING_DAY", "COMPANY_EVENT"].includes(dayType),
        isHoliday: ["HOLIDAY", "CLOSED_DAY", "WEEKEND"].includes(dayType),
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }
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

async function resolveScopePayload({ payload, user }) {
    if (payload.scopeLevel === "GLOBAL") {
        return {
            companyId: null,
            branchId: null,
            scopeKey: "GLOBAL",
        }
    }

    if (payload.scopeLevel === "COMPANY") {
        await ensureCompanyExists({
            companyId: payload.companyId,
            user,
        })

        return {
            companyId: payload.companyId,
            branchId: null,
            scopeKey: buildScopeKey({
                scopeLevel: "COMPANY",
                companyId: payload.companyId,
            }),
        }
    }

    await ensureCompanyExists({
        companyId: payload.companyId,
        user,
    })

    await ensureBranchExists({
        companyId: payload.companyId,
        branchId: payload.branchId,
        user,
    })

    return {
        companyId: payload.companyId,
        branchId: payload.branchId,
        scopeKey: buildScopeKey({
            scopeLevel: "BRANCH",
            branchId: payload.branchId,
        }),
    }
}

function handleDuplicateError(error) {
    if (error?.code !== 11000) {
        throw error
    }

    throw new AppError({
        statusCode: 409,
        code: "CALENDAR_DAY_DUPLICATE",
        messageKey: "errors.calendar.day.duplicate",
        fields: {
            dateKey: ["errors.calendar.day.duplicate"],
        },
    })
}

function clearCalendarCache() {
    clearCacheByPrefix(CALENDAR_CACHE_PREFIX)
}

export async function listCalendarDays({ query, user }) {
    const cacheKey = `${CALENDAR_CACHE_PREFIX}list:${user?.accountId || "anonymous"}:${JSON.stringify(query)}`
    const cached = getCache(cacheKey)

    if (cached) {
        return cached
    }

    const filter = {
        ...getCalendarScopeFilter(user),
        ...buildSearchFilter(query.search),
    }

    if (query.startDate || query.endDate) {
        filter.dateKey = {}

        if (query.startDate) {
            filter.dateKey.$gte = query.startDate
        }

        if (query.endDate) {
            filter.dateKey.$lte = query.endDate
        }
    }

    if (query.companyId) {
        await ensureCompanyExists({
            companyId: query.companyId,
            user,
        })

        filter.companyId = query.companyId
    }

    if (query.branchId) {
        if (!query.companyId) {
            ensureValidObjectId(
                query.branchId,
                "ORGANIZATION_BRANCH_INVALID_ID",
                "errors.organization.branch.invalidId",
            )
        } else {
            await ensureBranchExists({
                companyId: query.companyId,
                branchId: query.branchId,
                user,
            })
        }

        filter.branchId = query.branchId
    }

    if (query.scopeLevel !== "ALL") {
        filter.scopeLevel = query.scopeLevel
    }

    if (query.dayType !== "ALL") {
        filter.dayType = query.dayType
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
        CalendarDay.find(filter)
            .populate({
                path: "companyId",
                select: "code displayName legalName status",
            })
            .populate({
                path: "branchId",
                select: "companyId code name shortName status isHeadOffice",
            })
            .sort({ dateKey: -1, scopeLevel: 1, name: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        CalendarDay.countDocuments(filter),
    ])

    const result = {
        items: items.map((item) => serializeCalendarDay(item)),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        },
    }

    return setCache(cacheKey, result, 60_000)
}

export async function getCalendarDayById({ calendarDayId, user }) {
    ensureValidObjectId(
        calendarDayId,
        "CALENDAR_DAY_INVALID_ID",
        "errors.calendar.day.invalidId",
    )

    const day = await CalendarDay.findOne({
        _id: calendarDayId,
        ...getCalendarScopeFilter(user),
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

    if (!day) {
        throw new AppError({
            statusCode: 404,
            code: "CALENDAR_DAY_NOT_FOUND",
            messageKey: "errors.calendar.day.notFound",
        })
    }

    return serializeCalendarDay(day)
}

export async function createCalendarDay({ payload, user }) {
    const scopePayload = await resolveScopePayload({ payload, user })

    try {
        const calendarDay = await CalendarDay.create({
            scopeLevel: payload.scopeLevel,
            scopeKey: scopePayload.scopeKey,
            companyId: scopePayload.companyId,
            branchId: scopePayload.branchId,
            dateKey: payload.dateKey,
            dayType: payload.dayType,
            name: payload.name,
            holidayCategory: payload.holidayCategory || "",
            isPaidHoliday: Boolean(payload.isPaidHoliday),
            description: payload.description || "",
            status: payload.status || "ACTIVE",
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        clearCalendarCache()

        return getCalendarDayById({
            calendarDayId: calendarDay._id,
            user,
        })
    } catch (error) {
        handleDuplicateError(error)
    }
}

export async function updateCalendarDay({ calendarDayId, payload, user }) {
    ensureValidObjectId(
        calendarDayId,
        "CALENDAR_DAY_INVALID_ID",
        "errors.calendar.day.invalidId",
    )

    const existing = await CalendarDay.findOne({
        _id: calendarDayId,
        ...getCalendarScopeFilter(user),
    }).lean()

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "CALENDAR_DAY_NOT_FOUND",
            messageKey: "errors.calendar.day.notFound",
        })
    }

    if (existing.status === "ARCHIVED") {
        throw new AppError({
            statusCode: 409,
            code: "CALENDAR_DAY_ARCHIVED",
            messageKey: "errors.calendar.day.archived",
        })
    }

    const updatePayload = {
        updatedByAccountId: user.accountId,
    }

    for (const field of [
        "dayType",
        "name",
        "holidayCategory",
        "isPaidHoliday",
        "description",
        "status",
    ]) {
        if (payload[field] !== undefined) {
            updatePayload[field] = payload[field]
        }
    }

    const updated = await CalendarDay.findByIdAndUpdate(
        existing._id,
        {
            $set: updatePayload,
        },
        {
            new: true,
            runValidators: true,
            context: "query",
        },
    ).lean()

    clearCalendarCache()

    return getCalendarDayById({
        calendarDayId: updated._id,
        user,
    })
}

export async function archiveCalendarDay({ calendarDayId, user }) {
    ensureValidObjectId(
        calendarDayId,
        "CALENDAR_DAY_INVALID_ID",
        "errors.calendar.day.invalidId",
    )

    const existing = await CalendarDay.findOne({
        _id: calendarDayId,
        ...getCalendarScopeFilter(user),
    }).lean()

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "CALENDAR_DAY_NOT_FOUND",
            messageKey: "errors.calendar.day.notFound",
        })
    }

    const archived = await CalendarDay.findByIdAndUpdate(
        existing._id,
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

    clearCalendarCache()

    return getCalendarDayById({
        calendarDayId: archived._id,
        user,
    })
}

async function resolveBranchCompany({ companyId, branchId, user }) {
    if (!branchId) {
        return {
            companyId: companyId || null,
            branchId: null,
        }
    }

    ensureValidObjectId(
        branchId,
        "ORGANIZATION_BRANCH_INVALID_ID",
        "errors.organization.branch.invalidId",
    )

    const filter = {
        _id: branchId,
        status: { $ne: "ARCHIVED" },
        ...getBranchScopeFilter(user),
    }

    if (companyId) {
        filter.companyId = companyId
    }

    const branch = await Branch.findOne(filter).lean()

    if (!branch) {
        throw new AppError({
            statusCode: 404,
            code: "ORGANIZATION_BRANCH_NOT_FOUND",
            messageKey: "errors.organization.branch.notFound",
        })
    }

    return {
        companyId: branch.companyId.toString(),
        branchId: branch._id.toString(),
    }
}

export async function resolveCalendarDay({ query, user }) {
    const dateKey = normalizeDateKey(query.date)
    const resolvedScope = await resolveBranchCompany({
        companyId: query.companyId,
        branchId: query.branchId,
        user,
    })

    if (resolvedScope.companyId && !query.branchId) {
        await ensureCompanyExists({
            companyId: resolvedScope.companyId,
            user,
        })
    }

    const cacheKey = `${CALENDAR_CACHE_PREFIX}resolve:day:${dateKey}:${resolvedScope.companyId || ""}:${resolvedScope.branchId || ""}`
    const cached = getCache(cacheKey)

    if (cached) {
        return cached
    }

    const scopeKeys = ["GLOBAL"]

    if (resolvedScope.companyId) {
        scopeKeys.push(`COMPANY:${resolvedScope.companyId}`)
    }

    if (resolvedScope.branchId) {
        scopeKeys.push(`BRANCH:${resolvedScope.branchId}`)
    }

    const overrides = await CalendarDay.find({
        dateKey,
        scopeKey: { $in: scopeKeys },
        status: "ACTIVE",
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

    const overrideMap = new Map(overrides.map((item) => [item.scopeKey, item]))

    for (const scopeKey of [...scopeKeys].reverse()) {
        if (overrideMap.has(scopeKey)) {
            const result = serializeCalendarDay(overrideMap.get(scopeKey), "OVERRIDE")
            return setCache(cacheKey, result, 10 * 60_000)
        }
    }

    return setCache(cacheKey, getDefaultCalendarDay(dateKey), 10 * 60_000)
}

export async function resolveCalendarRange({ query, user }) {
    const days = diffDays(query.startDate, query.endDate)

    if (days < 0 || days > 370) {
        throw new AppError({
            statusCode: 422,
            code: "CALENDAR_RANGE_TOO_LARGE",
            messageKey: "errors.calendar.day.rangeTooLarge",
        })
    }

    const cacheKey = `${CALENDAR_CACHE_PREFIX}resolve:range:${query.startDate}:${query.endDate}:${query.companyId || ""}:${query.branchId || ""}`
    const cached = getCache(cacheKey)

    if (cached) {
        return cached
    }

    const items = []
    let current = query.startDate

    while (current <= query.endDate) {
        items.push(
            await resolveCalendarDay({
                query: {
                    date: current,
                    companyId: query.companyId,
                    branchId: query.branchId,
                },
                user,
            }),
        )

        current = addDays(current, 1)
    }

    const result = {
        items,
        map: Object.fromEntries(items.map((item) => [item.dateKey, item])),
    }

    return setCache(cacheKey, result, 10 * 60_000)
}

export async function getExportCalendarDays({ query, user }) {
    const result = await listCalendarDays({
        query: {
            ...query,
            page: 1,
            limit: 10000,
        },
        user,
    })

    return result.items
}
