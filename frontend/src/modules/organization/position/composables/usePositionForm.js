import {
    computed,
    reactive,
    ref,
} from "vue"

import {
    createPosition,
    updatePosition,
} from "../api/position.api.js"

export function createEmptyPositionForm() {
    return {
        companyId: "",
        branchId: "",
        departmentId: "",
        reportsToPositionId: "",
        code: "",
        title: "",
        level: 0,
        isManager: false,
        description: "",
        status: "ACTIVE",
    }
}

function clone(value) {
    return JSON.parse(JSON.stringify(value))
}

function mapFieldErrors(error) {
    const fields =
        error?.response?.data?.error?.fields ??
        error?.fields ??
        {}

    return Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
            key,
            Array.isArray(value) ? value[0] : value,
        ]),
    )
}

export function usePositionForm() {
    const mode = ref("create")
    const positionId = ref(null)
    const saving = ref(false)
    const errors = ref({})
    const form = reactive(createEmptyPositionForm())
    const isEdit = computed(() => mode.value === "edit")

    function replaceForm(position = {}) {
        const empty = createEmptyPositionForm()

        Object.assign(
            form,
            clone({
                ...empty,
                ...position,
                companyId:
                    position.companyId ??
                    position.company?.id ??
                    "",
                branchId:
                    position.branchId ??
                    position.branch?.id ??
                    "",
                departmentId:
                    position.departmentId ??
                    position.department?.id ??
                    "",
                reportsToPositionId:
                    position.reportsToPositionId ??
                    position.reportsToPosition?.id ??
                    "",
                level: Number(position.level ?? 0),
                isManager: Boolean(position.isManager),
                status:
                    position.status === "INACTIVE"
                        ? "INACTIVE"
                        : "ACTIVE",
            }),
        )
    }

    function openCreate() {
        mode.value = "create"
        positionId.value = null
        errors.value = {}
        replaceForm()
    }

    function openEdit(position) {
        mode.value = "edit"
        positionId.value = position.id ?? position._id
        errors.value = {}
        replaceForm(position)
    }

    function clearError(field) {
        if (!errors.value[field]) {
            return
        }

        const next = {
            ...errors.value,
        }

        delete next[field]
        errors.value = next
    }

    function normalizeCode() {
        form.code = String(form.code || "")
            .toUpperCase()
            .replace(/\s+/g, "_")
            .replace(/[^A-Z0-9_-]/g, "")

        clearError("code")
    }

    async function save() {
        saving.value = true
        errors.value = {}

        try {
            const payload = clone(form)

            if (isEdit.value) {
                delete payload.companyId
                delete payload.branchId
                delete payload.departmentId
            }

            payload.reportsToPositionId =
                payload.reportsToPositionId || null
            payload.level = Number(payload.level || 0)
            payload.isManager = Boolean(payload.isManager)

            const result = isEdit.value
                ? await updatePosition(
                      positionId.value,
                      payload,
                  )
                : await createPosition(payload)

            replaceForm(result)

            return result
        } catch (error) {
            errors.value = mapFieldErrors(error)
            throw error
        } finally {
            saving.value = false
        }
    }

    return {
        mode,
        positionId,
        saving,
        errors,
        form,
        isEdit,
        openCreate,
        openEdit,
        clearError,
        normalizeCode,
        save,
    }
}
