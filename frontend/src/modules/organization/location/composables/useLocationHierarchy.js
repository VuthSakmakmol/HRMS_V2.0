import { computed, onBeforeUnmount, ref } from "vue"

import { lookupLocations } from "../api/location.api.js"

function idOf(value) {
    if (!value) {
        return ""
    }

    if (typeof value === "string") {
        return value
    }

    return value.id || value._id || ""
}

export function useLocationHierarchy() {
    const countries = ref([])
    const provinces = ref([])
    const districts = ref([])
    const communes = ref([])
    const villages = ref([])

    const loadingCountries = ref(false)
    const loadingProvinces = ref(false)
    const loadingDistricts = ref(false)
    const loadingCommunes = ref(false)
    const loadingVillages = ref(false)

    const controllers = new Map()
    const cache = new Map()

    const loading = computed(
        () =>
            loadingCountries.value ||
            loadingProvinces.value ||
            loadingDistricts.value ||
            loadingCommunes.value ||
            loadingVillages.value,
    )

    function abort(level) {
        controllers.get(level)?.abort()
        controllers.delete(level)
    }

    function abortBelow(level) {
        const order = ["countries", "provinces", "districts", "communes", "villages"]
        const index = order.indexOf(level)

        for (const child of order.slice(index + 1)) {
            abort(child)
        }
    }

    async function request(level, params, target, loadingRef) {
        abort(level)

        const cacheKey = `${level}:${JSON.stringify(params)}`
        const cached = cache.get(cacheKey)

        if (cached) {
            target.value = cached
            return cached
        }

        const controller = new AbortController()
        controllers.set(level, controller)
        loadingRef.value = true

        try {
            const rows = await lookupLocations(level, params, controller.signal)
            const normalized = Array.isArray(rows) ? rows : []

            cache.set(cacheKey, normalized)
            target.value = normalized
            return normalized
        } catch (error) {
            if (error?.name === "AbortError" || error?.code === "ERR_CANCELED") {
                return []
            }

            target.value = []
            throw error
        } finally {
            if (controllers.get(level) === controller) {
                controllers.delete(level)
                loadingRef.value = false
            }
        }
    }

    function loadCountries() {
        return request(
            "countries",
            { limit: 100, status: "ACTIVE" },
            countries,
            loadingCountries,
        )
    }

    async function loadProvinces(countryId) {
        abortBelow("countries")
        provinces.value = []
        districts.value = []
        communes.value = []
        villages.value = []

        const parentId = idOf(countryId)
        if (!parentId) {
            return []
        }

        return request(
            "provinces",
            { countryId: parentId, limit: 100, status: "ACTIVE" },
            provinces,
            loadingProvinces,
        )
    }

    async function loadDistricts(provinceId) {
        abortBelow("provinces")
        districts.value = []
        communes.value = []
        villages.value = []

        const parentId = idOf(provinceId)
        if (!parentId) {
            return []
        }

        return request(
            "districts",
            { provinceId: parentId, limit: 100, status: "ACTIVE" },
            districts,
            loadingDistricts,
        )
    }

    async function loadCommunes(districtId) {
        abortBelow("districts")
        communes.value = []
        villages.value = []

        const parentId = idOf(districtId)
        if (!parentId) {
            return []
        }

        return request(
            "communes",
            { districtId: parentId, limit: 100, status: "ACTIVE" },
            communes,
            loadingCommunes,
        )
    }

    async function loadVillages(communeId) {
        abortBelow("communes")
        villages.value = []

        const parentId = idOf(communeId)
        if (!parentId) {
            return []
        }

        return request(
            "villages",
            { communeId: parentId, limit: 100, status: "ACTIVE" },
            villages,
            loadingVillages,
        )
    }

    async function hydrate({ countryId, provinceId, districtId, communeId } = {}) {
        await loadCountries()

        if (countryId) {
            await loadProvinces(countryId)
        }

        if (provinceId) {
            await loadDistricts(provinceId)
        }

        if (districtId) {
            await loadCommunes(districtId)
        }

        if (communeId) {
            await loadVillages(communeId)
        }
    }

    function invalidate() {
        cache.clear()
    }

    onBeforeUnmount(() => {
        for (const controller of controllers.values()) {
            controller.abort()
        }
        controllers.clear()
    })

    return {
        countries,
        provinces,
        districts,
        communes,
        villages,
        loading,
        loadingCountries,
        loadingProvinces,
        loadingDistricts,
        loadingCommunes,
        loadingVillages,
        loadCountries,
        loadProvinces,
        loadDistricts,
        loadCommunes,
        loadVillages,
        hydrate,
        invalidate,
    }
}
