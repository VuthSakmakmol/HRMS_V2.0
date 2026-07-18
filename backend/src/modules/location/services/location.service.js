import { Types } from "mongoose"

import {
    clearCacheByPrefix,
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"
import { AppError } from "../../../shared/errors/AppError.js"
import Country from "../models/Country.js"
import Province from "../models/Province.js"
import District from "../models/District.js"
import Commune from "../models/Commune.js"
import Village from "../models/Village.js"

const ENTITY_CONFIG = Object.freeze({
    countries: {
        model: Country,
        singular: "country",
        label: "Country",
        cachePrefix: "location:countries:list:",
        parentFields: [],
        childModel: Province,
        childName: "provinces",
        searchFields: ["code", "name", "nationality", "phoneCode", "description"],
        populate: [],
        sort: { name: 1, code: 1 },
    },
    provinces: {
        model: Province,
        singular: "province",
        label: "Province",
        cachePrefix: "location:provinces:list:",
        parentFields: ["countryId"],
        childModel: District,
        childName: "districts",
        searchFields: ["code", "name", "description"],
        populate: [
            {
                path: "countryId",
                select: "code name nationality phoneCode status",
            },
        ],
        sort: { name: 1, code: 1 },
    },
    districts: {
        model: District,
        singular: "district",
        label: "District",
        cachePrefix: "location:districts:list:",
        parentFields: ["countryId", "provinceId"],
        childModel: Commune,
        childName: "communes",
        searchFields: ["code", "name", "description"],
        populate: [
            {
                path: "countryId",
                select: "code name nationality phoneCode status",
            },
            {
                path: "provinceId",
                select: "countryId code name status",
            },
        ],
        sort: { name: 1, code: 1 },
    },
    communes: {
        model: Commune,
        singular: "commune",
        label: "Commune",
        cachePrefix: "location:communes:list:",
        parentFields: ["countryId", "provinceId", "districtId"],
        childModel: Village,
        childName: "villages",
        searchFields: ["code", "name", "description"],
        populate: [
            {
                path: "countryId",
                select: "code name nationality phoneCode status",
            },
            {
                path: "provinceId",
                select: "countryId code name status",
            },
            {
                path: "districtId",
                select: "countryId provinceId code name status",
            },
        ],
        sort: { name: 1, code: 1 },
    },
    villages: {
        model: Village,
        singular: "village",
        label: "Village",
        cachePrefix: "location:villages:list:",
        parentFields: ["countryId", "provinceId", "districtId", "communeId"],
        childModel: null,
        childName: "children",
        searchFields: ["code", "name", "description"],
        populate: [
            {
                path: "countryId",
                select: "code name nationality phoneCode status",
            },
            {
                path: "provinceId",
                select: "countryId code name status",
            },
            {
                path: "districtId",
                select: "countryId provinceId code name status",
            },
            {
                path: "communeId",
                select: "countryId provinceId districtId code name status",
            },
        ],
        sort: { name: 1, code: 1 },
    },
})

function getConfig(entity) {
    const config = ENTITY_CONFIG[entity]

    if (!config) {
        throw new AppError({
            statusCode: 404,
            code: "LOCATION_ENTITY_NOT_FOUND",
            messageKey: "errors.location.entityNotFound",
        })
    }

    return config
}

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

function toId(value) {
    return value?._id?.toString?.() || value?.id || value?.toString?.() || value
}

function isPopulated(value) {
    return Boolean(value && typeof value === "object" && !Types.ObjectId.isValid(value))
}

function buildSearchFilter(search, fields) {
    const normalizedSearch = String(search || "").trim()

    if (!normalizedSearch) {
        return {}
    }

    const searchRegex = new RegExp(escapeRegExp(normalizedSearch), "i")

    return {
        $or: fields.map((field) => ({
            [field]: searchRegex,
        })),
    }
}

function serializeCountry(country) {
    if (!country || typeof country !== "object") {
        return null
    }

    return {
        id: toId(country),
        code: country.code,
        name: country.name,
        nationality: country.nationality || "",
        phoneCode: country.phoneCode || "",
        status: country.status,
    }
}

function serializeProvince(province) {
    if (!province || typeof province !== "object") {
        return null
    }

    return {
        id: toId(province),
        countryId: toId(province.countryId),
        code: province.code,
        name: province.name,
        status: province.status,
    }
}

function serializeDistrict(district) {
    if (!district || typeof district !== "object") {
        return null
    }

    return {
        id: toId(district),
        countryId: toId(district.countryId),
        provinceId: toId(district.provinceId),
        code: district.code,
        name: district.name,
        status: district.status,
    }
}

function serializeCommune(commune) {
    if (!commune || typeof commune !== "object") {
        return null
    }

    return {
        id: toId(commune),
        countryId: toId(commune.countryId),
        provinceId: toId(commune.provinceId),
        districtId: toId(commune.districtId),
        code: commune.code,
        name: commune.name,
        status: commune.status,
    }
}

function serializeLocation(entity, item) {
    if (!item) {
        return null
    }

    const raw =
        typeof item.toJSON === "function"
            ? item.toJSON()
            : {
                  ...item,
              }

    const country = isPopulated(raw.countryId)
        ? serializeCountry(raw.countryId)
        : null
    const province = isPopulated(raw.provinceId)
        ? serializeProvince(raw.provinceId)
        : null
    const district = isPopulated(raw.districtId)
        ? serializeDistrict(raw.districtId)
        : null
    const commune = isPopulated(raw.communeId)
        ? serializeCommune(raw.communeId)
        : null

    const serialized = {
        id: toId(raw),
        countryId: country?.id || toId(raw.countryId) || null,
        provinceId: province?.id || toId(raw.provinceId) || null,
        districtId: district?.id || toId(raw.districtId) || null,
        communeId: commune?.id || toId(raw.communeId) || null,
        country,
        province,
        district,
        commune,
        code: raw.code,
        name: raw.name,
        nationality: raw.nationality || "",
        phoneCode: raw.phoneCode || "",
        description: raw.description || "",
        status: raw.status,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    }

    if (entity === "countries") {
        delete serialized.countryId
        delete serialized.provinceId
        delete serialized.districtId
        delete serialized.communeId
        delete serialized.country
        delete serialized.province
        delete serialized.district
        delete serialized.commune
    }

    return serialized
}

function buildUpdatePayload(payload, accountId) {
    const updatePayload = {
        updatedByAccountId: accountId,
    }

    for (const field of [
        "countryId",
        "provinceId",
        "districtId",
        "communeId",
        "code",
        "name",
        "nationality",
        "phoneCode",
        "description",
        "status",
    ]) {
        if (payload[field] !== undefined) {
            updatePayload[field] = payload[field]
        }
    }

    return updatePayload
}

function handleDuplicateLocationError(entity, error) {
    if (error?.code !== 11000) {
        throw error
    }

    const config = getConfig(entity)

    throw new AppError({
        statusCode: 409,
        code: `LOCATION_${config.label.toUpperCase()}_CODE_EXISTS`,
        messageKey: `errors.location.${config.singular}.codeExists`,
        fields: {
            code: [`errors.location.${config.singular}.codeExists`],
        },
    })
}

async function findActiveById(model, id, code, messageKey) {
    ensureValidObjectId(id, code, messageKey)

    const item = await model.findOne({
        _id: id,
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!item) {
        throw new AppError({
            statusCode: 404,
            code,
            messageKey,
        })
    }

    return item
}

export async function ensureCountryExists(countryId) {
    return findActiveById(
        Country,
        countryId,
        "LOCATION_COUNTRY_NOT_FOUND",
        "errors.location.country.notFound",
    )
}

export async function ensureProvinceExists({ countryId, provinceId }) {
    const province = await findActiveById(
        Province,
        provinceId,
        "LOCATION_PROVINCE_NOT_FOUND",
        "errors.location.province.notFound",
    )

    if (countryId && toId(province.countryId) !== toId(countryId)) {
        throw new AppError({
            statusCode: 409,
            code: "LOCATION_PROVINCE_PARENT_MISMATCH",
            messageKey: "errors.location.province.parentMismatch",
            fields: {
                provinceId: ["errors.location.province.parentMismatch"],
            },
        })
    }

    return province
}

export async function ensureDistrictExists({
    countryId,
    provinceId,
    districtId,
}) {
    const district = await findActiveById(
        District,
        districtId,
        "LOCATION_DISTRICT_NOT_FOUND",
        "errors.location.district.notFound",
    )

    if (
        (countryId && toId(district.countryId) !== toId(countryId)) ||
        (provinceId && toId(district.provinceId) !== toId(provinceId))
    ) {
        throw new AppError({
            statusCode: 409,
            code: "LOCATION_DISTRICT_PARENT_MISMATCH",
            messageKey: "errors.location.district.parentMismatch",
            fields: {
                districtId: ["errors.location.district.parentMismatch"],
            },
        })
    }

    return district
}

export async function ensureCommuneExists({
    countryId,
    provinceId,
    districtId,
    communeId,
}) {
    const commune = await findActiveById(
        Commune,
        communeId,
        "LOCATION_COMMUNE_NOT_FOUND",
        "errors.location.commune.notFound",
    )

    if (
        (countryId && toId(commune.countryId) !== toId(countryId)) ||
        (provinceId && toId(commune.provinceId) !== toId(provinceId)) ||
        (districtId && toId(commune.districtId) !== toId(districtId))
    ) {
        throw new AppError({
            statusCode: 409,
            code: "LOCATION_COMMUNE_PARENT_MISMATCH",
            messageKey: "errors.location.commune.parentMismatch",
            fields: {
                communeId: ["errors.location.commune.parentMismatch"],
            },
        })
    }

    return commune
}

async function ensureParentChain(entity, payload) {
    if (entity === "countries") {
        return
    }

    if (payload.countryId) {
        await ensureCountryExists(payload.countryId)
    }

    if (["districts", "communes", "villages", "provinces"].includes(entity)) {
        if (entity !== "provinces" && payload.provinceId) {
            await ensureProvinceExists({
                countryId: payload.countryId,
                provinceId: payload.provinceId,
            })
        }
    }

    if (["communes", "villages"].includes(entity) && payload.districtId) {
        await ensureDistrictExists({
            countryId: payload.countryId,
            provinceId: payload.provinceId,
            districtId: payload.districtId,
        })
    }

    if (entity === "villages" && payload.communeId) {
        await ensureCommuneExists({
            countryId: payload.countryId,
            provinceId: payload.provinceId,
            districtId: payload.districtId,
            communeId: payload.communeId,
        })
    }
}

function addPopulate(queryBuilder, populateItems) {
    let builtQuery = queryBuilder

    for (const populateItem of populateItems) {
        builtQuery = builtQuery.populate(populateItem)
    }

    return builtQuery
}

function buildLocationFilter({ entity, query }) {
    const config = getConfig(entity)
    const filter = {
        ...buildSearchFilter(query.search, config.searchFields),
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    for (const parentField of [
        "countryId",
        "provinceId",
        "districtId",
        "communeId",
    ]) {
        if (query[parentField]) {
            filter[parentField] = query[parentField]
        }
    }

    return filter
}

const LOOKUP_PARENT_FIELDS = Object.freeze({
    countries: null,
    provinces: "countryId",
    districts: "provinceId",
    communes: "districtId",
    villages: "communeId",
})

function assertLookupParent(entity, query) {
    const parentField = LOOKUP_PARENT_FIELDS[entity]

    if (!parentField || query[parentField]) {
        return
    }

    throw new AppError({
        statusCode: 422,
        code: "LOCATION_LOOKUP_PARENT_REQUIRED",
        messageKey: "errors.location.lookup.parentRequired",
        fields: {
            [parentField]: ["errors.location.lookup.parentRequired"],
        },
    })
}

export async function lookupLocations({ entity, query }) {
    const config = getConfig(entity)
    assertLookupParent(entity, query)
    const normalizedQuery = {
        ...query,
        page: 1,
        limit: Math.min(query.limit || 100, 100),
        status: "ACTIVE",
    }
    const filter = buildLocationFilter({
        entity,
        query: normalizedQuery,
    })
    const findQuery = config.model
        .find(filter)
        .sort(config.sort)
        .limit(normalizedQuery.limit)

    const items = await addPopulate(findQuery, config.populate).lean()

    return items.map((item) => {
        const location = serializeLocation(entity, item)

        return {
            id: location.id,
            code: location.code,
            name: location.name,
            countryId: location.countryId || null,
            provinceId: location.provinceId || null,
            districtId: location.districtId || null,
            communeId: location.communeId || null,
        }
    })
}

export async function listLocations({ entity, query }) {
    const config = getConfig(entity)
    const cacheKey = `${config.cachePrefix}${JSON.stringify(query)}`
    const cachedResult = getCache(cacheKey)

    if (cachedResult) {
        return cachedResult
    }

    const filter = buildLocationFilter({ entity, query })
    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const findQuery = config.model.find(filter).sort(config.sort).skip(skip).limit(limit)

    const [items, total] = await Promise.all([
        addPopulate(findQuery, config.populate).lean(),
        config.model.countDocuments(filter),
    ])

    const result = {
        items: items.map((item) => serializeLocation(entity, item)),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        },
    }

    return setCache(cacheKey, result, 30_000)
}

export async function listLocationsForExport({ entity, query }) {
    const config = getConfig(entity)
    const filter = buildLocationFilter({ entity, query })
    const findQuery = config.model.find(filter).sort(config.sort).limit(10000)
    const items = await addPopulate(findQuery, config.populate).lean()

    return items.map((item) => serializeLocation(entity, item))
}

export async function getLocationById({ entity, locationId }) {
    const config = getConfig(entity)

    ensureValidObjectId(
        locationId,
        `LOCATION_${config.label.toUpperCase()}_INVALID_ID`,
        `errors.location.${config.singular}.invalidId`,
    )

    const findQuery = config.model.findOne({
        _id: locationId,
    })

    const item = await addPopulate(findQuery, config.populate)

    if (!item) {
        throw new AppError({
            statusCode: 404,
            code: `LOCATION_${config.label.toUpperCase()}_NOT_FOUND`,
            messageKey: `errors.location.${config.singular}.notFound`,
        })
    }

    return serializeLocation(entity, item)
}

export async function createLocation({ entity, payload, user }) {
    const config = getConfig(entity)

    await ensureParentChain(entity, payload)

    try {
        const item = await config.model.create({
            ...payload,
            status: payload.status || "ACTIVE",
            createdByAccountId: user.accountId,
            updatedByAccountId: user.accountId,
        })

        clearCacheByPrefix("location:")

        return await getLocationById({
            entity,
            locationId: item._id.toString(),
        })
    } catch (error) {
        handleDuplicateLocationError(entity, error)
    }
}

export async function updateLocation({ entity, locationId, payload, user }) {
    const config = getConfig(entity)

    ensureValidObjectId(
        locationId,
        `LOCATION_${config.label.toUpperCase()}_INVALID_ID`,
        `errors.location.${config.singular}.invalidId`,
    )

    const currentItem = await config.model.findOne({
        _id: locationId,
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!currentItem) {
        throw new AppError({
            statusCode: 404,
            code: `LOCATION_${config.label.toUpperCase()}_NOT_FOUND`,
            messageKey: `errors.location.${config.singular}.notFound`,
        })
    }

    const nextPayload = {
        ...currentItem,
        ...payload,
    }

    await ensureParentChain(entity, nextPayload)

    try {
        const findQuery = config.model.findOneAndUpdate(
            {
                _id: locationId,
                status: { $ne: "ARCHIVED" },
            },
            {
                $set: buildUpdatePayload(payload, user.accountId),
            },
            {
                new: true,
                runValidators: true,
                context: "query",
            },
        )

        const item = await addPopulate(findQuery, config.populate)

        if (!item) {
            throw new AppError({
                statusCode: 404,
                code: `LOCATION_${config.label.toUpperCase()}_NOT_FOUND`,
                messageKey: `errors.location.${config.singular}.notFound`,
            })
        }

        clearCacheByPrefix("location:")

        return serializeLocation(entity, item)
    } catch (error) {
        if (error instanceof AppError) {
            throw error
        }

        handleDuplicateLocationError(entity, error)
    }
}

export async function archiveLocation({ entity, locationId, user }) {
    const config = getConfig(entity)

    ensureValidObjectId(
        locationId,
        `LOCATION_${config.label.toUpperCase()}_INVALID_ID`,
        `errors.location.${config.singular}.invalidId`,
    )

    if (config.childModel) {
        const childCount = await config.childModel.countDocuments({
            [`${config.singular}Id`]: locationId,
            status: { $ne: "ARCHIVED" },
        })

        if (childCount > 0) {
            throw new AppError({
                statusCode: 409,
                code: `LOCATION_${config.label.toUpperCase()}_HAS_${config.childName.toUpperCase()}`,
                messageKey: `errors.location.${config.singular}.hasChildren`,
            })
        }
    }

    const findQuery = config.model.findOneAndUpdate(
        {
            _id: locationId,
        },
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
    )

    const item = await addPopulate(findQuery, config.populate)

    if (!item) {
        throw new AppError({
            statusCode: 404,
            code: `LOCATION_${config.label.toUpperCase()}_NOT_FOUND`,
            messageKey: `errors.location.${config.singular}.notFound`,
        })
    }

    clearCacheByPrefix("location:")

    return serializeLocation(entity, item)
}

export async function resolveLocationIdsFromCodes({ entity, row }) {
    const payload = {
        ...row,
    }

    const countryCode = row.countryCode || row.parentCountryCode
    const provinceCode = row.provinceCode || row.parentProvinceCode
    const districtCode = row.districtCode || row.parentDistrictCode
    const communeCode = row.communeCode || row.parentCommuneCode

    if (entity === "countries") {
        delete payload.countryCode
        delete payload.provinceCode
        delete payload.districtCode
        delete payload.communeCode
        return payload
    }

    const country = await Country.findOne({
        code: String(countryCode || "").trim().replace(/\s+/g, "_").toUpperCase(),
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!country) {
        throw new AppError({
            statusCode: 404,
            code: "LOCATION_COUNTRY_NOT_FOUND",
            messageKey: "errors.location.country.notFound",
            fields: {
                countryCode: ["errors.location.country.notFound"],
            },
        })
    }

    payload.countryId = country._id.toString()

    if (entity === "provinces") {
        delete payload.countryCode
        delete payload.provinceCode
        delete payload.districtCode
        delete payload.communeCode
        return payload
    }

    const province = await Province.findOne({
        countryId: country._id,
        code: String(provinceCode || "").trim().replace(/\s+/g, "_").toUpperCase(),
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!province) {
        throw new AppError({
            statusCode: 404,
            code: "LOCATION_PROVINCE_NOT_FOUND",
            messageKey: "errors.location.province.notFound",
            fields: {
                provinceCode: ["errors.location.province.notFound"],
            },
        })
    }

    payload.provinceId = province._id.toString()

    if (entity === "districts") {
        delete payload.countryCode
        delete payload.provinceCode
        delete payload.districtCode
        delete payload.communeCode
        return payload
    }

    const district = await District.findOne({
        provinceId: province._id,
        code: String(districtCode || "").trim().replace(/\s+/g, "_").toUpperCase(),
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!district) {
        throw new AppError({
            statusCode: 404,
            code: "LOCATION_DISTRICT_NOT_FOUND",
            messageKey: "errors.location.district.notFound",
            fields: {
                districtCode: ["errors.location.district.notFound"],
            },
        })
    }

    payload.districtId = district._id.toString()

    if (entity === "communes") {
        delete payload.countryCode
        delete payload.provinceCode
        delete payload.districtCode
        delete payload.communeCode
        return payload
    }

    const commune = await Commune.findOne({
        districtId: district._id,
        code: String(communeCode || "").trim().replace(/\s+/g, "_").toUpperCase(),
        status: { $ne: "ARCHIVED" },
    }).lean()

    if (!commune) {
        throw new AppError({
            statusCode: 404,
            code: "LOCATION_COMMUNE_NOT_FOUND",
            messageKey: "errors.location.commune.notFound",
            fields: {
                communeCode: ["errors.location.commune.notFound"],
            },
        })
    }

    payload.communeId = commune._id.toString()

    delete payload.countryCode
    delete payload.provinceCode
    delete payload.districtCode
    delete payload.communeCode

    return payload
}
