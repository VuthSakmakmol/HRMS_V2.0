const ACCESS_TOKEN_KEY = "hrms_access_token"

function getStorage() {
    if (typeof window === "undefined") {
        return null
    }

    return window.localStorage
}

export function getStoredAccessToken() {
    const storage = getStorage()

    if (!storage) {
        return null
    }

    try {
        const token = storage.getItem(ACCESS_TOKEN_KEY)

        return token && token.trim() ? token.trim() : null
    } catch {
        return null
    }
}

export function saveAccessToken(accessToken) {
    const storage = getStorage()

    if (!storage || !accessToken) {
        return
    }

    storage.setItem(ACCESS_TOKEN_KEY, accessToken.trim())
}

export function clearAccessToken() {
    const storage = getStorage()

    if (!storage) {
        return
    }

    storage.removeItem(ACCESS_TOKEN_KEY)
}