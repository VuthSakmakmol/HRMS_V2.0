import {
    computed,
    reactive,
    ref,
} from "vue"

import {
    createLine,
    updateLine,
} from "../api/line.api.js"

export function createEmptyLineForm() {
    return {
        companyId: "",
        branchId: "",
        departmentId: "",
        code: "",
        name: "",
        allowedPositionIds: [],
        leaderPositionId: null,
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

export function useLineForm() {
    const mode = ref("create")
    const lineId = ref(null)
    const saving = ref(false)
    const errors = ref({})
    const form = reactive(createEmptyLineForm())
    const isEdit = computed(() => mode.value === "edit")

    function replaceForm(line = {}) {
        Object.assign(form, {
            ...createEmptyLineForm(),
            ...clone(line),
            companyId: line.companyId ?? line.company?.id ?? "",
            branchId: line.branchId ?? line.branch?.id ?? "",
            departmentId:
                line.departmentId ?? line.department?.id ?? "",
            allowedPositionIds:
                line.allowedPositionIds ??
                line.allowedPositions?.map((position) => position.id) ??
                [],
            leaderPositionId:
                line.leaderPositionId ?? line.leaderPosition?.id ?? null,
            status:
                line.status === "INACTIVE"
                    ? "INACTIVE"
                    : "ACTIVE",
        })
    }

    function openCreate() {
        mode.value = "create"
        lineId.value = null
        errors.value = {}
        replaceForm()
    }

    function openEdit(line) {
        mode.value = "edit"
        lineId.value = line.id ?? line._id
        errors.value = {}
        replaceForm(line)
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

            payload.leaderPositionId = payload.leaderPositionId || null

            return isEdit.value
                ? await updateLine(lineId.value, payload)
                : await createLine(payload)
        } catch (error) {
            errors.value = mapFieldErrors(error)
            throw error
        } finally {
            saving.value = false
        }
    }

    return {
        mode,
        lineId,
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
