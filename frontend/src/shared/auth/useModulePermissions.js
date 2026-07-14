import { computed, unref } from "vue"

import { useAuthStore } from "@/app/stores/auth.store.js"

const MANAGE_ACTIONS = Object.freeze([
    "create",
    "update",
    "delete",
    "archive",
    "restore",
    "import",
    "approve",
    "reject",
    "cancel",
    "assign",
    "managePermission",
])

function normalizePermissionCode(permissionCode) {
    const value = unref(permissionCode)

    return typeof value === "string" ? value.trim() : ""
}

export function useModulePermissions(permissionMap = {}) {
    const authStore = useAuthStore()

    function can(action) {
        return computed(() => {
            const permissionCode = normalizePermissionCode(permissionMap[action])

            if (!permissionCode) {
                return false
            }

            return authStore.hasPermission(permissionCode)
        })
    }

    const permissions = {
        canView: can("view"),
        canCreate: can("create"),
        canUpdate: can("update"),
        canDelete: can("delete"),
        canArchive: can("archive"),
        canRestore: can("restore"),
        canImport: can("import"),
        canExport: can("export"),
        canApprove: can("approve"),
        canReject: can("reject"),
        canCancel: can("cancel"),
        canAssign: can("assign"),
        canManagePermission: can("managePermission"),
    }

    permissions.canManage = computed(() =>
        MANAGE_ACTIONS.some((action) => {
            const permissionCode = normalizePermissionCode(permissionMap[action])

            return permissionCode && authStore.hasPermission(permissionCode)
        }),
    )

    permissions.has = (permissionCode) =>
        computed(() => {
            const normalizedCode = normalizePermissionCode(permissionCode)

            return normalizedCode
                ? authStore.hasPermission(normalizedCode)
                : false
        })

    permissions.assert = (action) => {
        const permissionCode = normalizePermissionCode(permissionMap[action])

        return Boolean(
            permissionCode && authStore.hasPermission(permissionCode),
        )
    }

    return permissions
}
