import { computed, reactive, ref } from "vue"

import { createLine, updateLine } from "../api/line.api.js"

export function createEmptyLineForm() {
    return {
        companyId: "",
        branchId: "",
        positionIds: [],
        code: "",
        name: "",
        description: "",
        status: "ACTIVE",
    }
}

function clone(value) {
    return JSON.parse(JSON.stringify(value))
}

function normalizeIds(values = []) {
    return [
        ...new Set(
            (Array.isArray(values) ? values : [])
                .map((value) => String(value || ""))
                .filter(Boolean),
        ),
    ]
}

function linePositionIds(line = {}) {
    const direct = normalizeIds(line.positionIds)
    if (direct.length) return direct

    const fromPositions = normalizeIds(
        (Array.isArray(line.positions) ? line.positions : [])
            .map((position) => position?.id || position?._id),
    )
    if (fromPositions.length) return fromPositions

    const legacy = line.positionId ?? line.position?.id ?? line.position?._id ?? ""
    return legacy ? [String(legacy)] : []
}

function mapFieldErrors(error) {
    const fields = error?.response?.data?.error?.fields ?? error?.fields ?? {}
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
            positionIds: linePositionIds(line),
            status: line.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        })

        // Never send compatibility/derived fields back to the API.
        delete form.departmentId
        delete form.department
        delete form.departmentIds
        delete form.departments
        delete form.positionId
        delete form.position
        delete form.positions
    }

    function openCreate(workspace = {}) {
        mode.value = "create"
        lineId.value = null
        errors.value = {}
        replaceForm({
            companyId: workspace.companyId || "",
            branchId: workspace.branchId || "",
        })
    }

    function openEdit(line) {
        mode.value = "edit"
        lineId.value = line.id ?? line._id
        errors.value = {}
        replaceForm(line)
    }

    function clearError(field) {
        if (!errors.value[field]) return
        const next = { ...errors.value }
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

    function validateRequired() {
        const next = {}
        if (!Array.isArray(form.positionIds) || form.positionIds.length === 0) {
            next.positionIds = "errors.organization.line.positionRequired"
        }
        if (!String(form.code || "").trim()) {
            next.code = "errors.organization.line.codeRequired"
        }
        if (!String(form.name || "").trim()) {
            next.name = "errors.organization.line.nameRequired"
        }
        errors.value = { ...errors.value, ...next }
        return Object.keys(next).length === 0
    }

    async function save() {
        if (!validateRequired()) {
            const error = new Error("Complete the required Line fields before saving.")
            error.fields = errors.value
            throw error
        }

        saving.value = true
        errors.value = {}

        try {
            const payload = clone(form)
            payload.positionIds = normalizeIds(payload.positionIds)

            if (isEdit.value) {
                delete payload.companyId
                delete payload.branchId
            }

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
