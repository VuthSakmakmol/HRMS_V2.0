const cacheStore = new Map()

function now() {
    return Date.now()
}

export function getCache(key) {
    const record = cacheStore.get(key)

    if (!record) {
        return null
    }

    if (record.expiresAt <= now()) {
        cacheStore.delete(key)
        return null
    }

    return record.value
}

export function setCache(key, value, ttlMs = 30_000) {
    cacheStore.set(key, {
        value,
        expiresAt: now() + ttlMs,
    })

    return value
}

export function deleteCache(key) {
    cacheStore.delete(key)
}

export function clearCacheByPrefix(prefix) {
    for (const key of cacheStore.keys()) {
        if (key.startsWith(prefix)) {
            cacheStore.delete(key)
        }
    }
}

export function clearAllCache() {
    cacheStore.clear()
}
