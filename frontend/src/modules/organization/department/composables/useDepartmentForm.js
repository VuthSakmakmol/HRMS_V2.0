import {
    computed,
    reactive,
    ref,
} from "vue"

import {
    createDepartment,
    updateDepartment,
} from "../api/department.api.js"

export function createEmptyDepartmentForm() {
    return {
        companyId: "",
        branchId: "",
        parentDepartmentId: "",
        code: "",
        name: "",
        shortName: "",
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

export function useDepartmentForm() {
    const mode = ref("create")
    const departmentId = ref(null)
    const saving = ref(false)
    const errors = ref({})
    const form = reactive(createEmptyDepartmentForm())
    const isEdit = computed(() => mode.value === "edit")

    function replaceForm(department = {}) {
        const empty = createEmptyDepartmentForm()

        Object.assign(
            form,
            clone({
                ...empty,
                ...department,
                companyId:
                    department.companyId ??
                    department.company?.id ??
                    "",
                branchId:
                    department.branchId ??
                    department.branch?.id ??
                    "",
                parentDepartmentId:
                    department.parentDepartmentId ??
                    department.parentDepartment?.id ??
                    "",
                status:
                    department.status === "INACTIVE"
                        ? "INACTIVE"
                        : "ACTIVE",
            }),
        )
    }

    function openCreate() {
        mode.value = "create"
        departmentId.value = null
        errors.value = {}
        replaceForm()
    }

    function openEdit(department) {
        mode.value = "edit"
        departmentId.value = department.id ?? department._id
        errors.value = {}
        replaceForm(department)
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
            }

            payload.parentDepartmentId =
                payload.parentDepartmentId || null

            const result = isEdit.value
                ? await updateDepartment(
                      departmentId.value,
                      payload,
                  )
                : await createDepartment(payload)

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
        departmentId,
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
