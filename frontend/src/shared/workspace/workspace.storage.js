const STORAGE_PREFIX = "hrms.workspace"

let activeContext = {
    companyId: "",
    branchId: "",
}

function storageKey(accountId) {
    return `${STORAGE_PREFIX}.${accountId || "anonymous"}`
}

export function getActiveWorkspaceContext() {
    return { ...activeContext }
}

export function setActiveWorkspaceContext(context = {}) {
    activeContext = {
        companyId: String(context.companyId || ""),
        branchId: String(context.branchId || ""),
    }
}

export function loadWorkspaceContext(accountId) {
    try {
        const parsed = JSON.parse(
            window.localStorage.getItem(storageKey(accountId)) || "{}",
        )

        return {
            companyId: String(parsed.companyId || ""),
            branchId: String(parsed.branchId || ""),
        }
    } catch {
        return { companyId: "", branchId: "" }
    }
}

export function saveWorkspaceContext(accountId, context) {
    const normalized = {
        companyId: String(context.companyId || ""),
        branchId: String(context.branchId || ""),
    }

    setActiveWorkspaceContext(normalized)
    window.localStorage.setItem(
        storageKey(accountId),
        JSON.stringify(normalized),
    )
}

export function clearActiveWorkspaceContext() {
    setActiveWorkspaceContext()
}
