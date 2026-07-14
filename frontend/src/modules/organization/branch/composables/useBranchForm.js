import { computed, reactive, ref } from "vue"
import { createBranch, updateBranch } from "../api/branch.api.js"

export function createEmptyBranchForm() {
    return {
        companyId: "",
        code: "",
        name: "",
        shortName: "",
        status: "ACTIVE",
        isHeadOffice: false,
        timezone: "Asia/Phnom_Penh",
        contact: { email: "", phone: "" },
        address: {
            addressLine1: "",
            addressLine2: "",
            city: "Phnom Penh",
            stateProvince: "",
            postalCode: "",
            countryCode: "KH",
        },
    }
}

const clone = (value) => JSON.parse(JSON.stringify(value))
function mapFieldErrors(error) {
    const fields = error?.response?.data?.error?.fields ?? error?.fields ?? {}
    return Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
            key,
            Array.isArray(value) ? value[0] : value,
        ]),
    )
}

export function useBranchForm() {
    const mode = ref("create")
    const branchId = ref(null)
    const saving = ref(false)
    const errors = ref({})
    const form = reactive(createEmptyBranchForm())
    const isEdit = computed(() => mode.value === "edit")

    function replaceForm(branch = {}) {
        const empty = createEmptyBranchForm()
        Object.assign(
            form,
            clone({
                ...empty,
                ...branch,
                companyId: branch.companyId ?? branch.company?.id ?? "",
                status: branch.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
            }),
        )
        form.contact = clone({ ...empty.contact, ...(branch.contact ?? {}) })
        form.address = clone({ ...empty.address, ...(branch.address ?? {}) })
    }

    function openCreate() {
        mode.value = "create"
        branchId.value = null
        errors.value = {}
        replaceForm()
    }
    function openEdit(branch) {
        mode.value = "edit"
        branchId.value = branch.id ?? branch._id
        errors.value = {}
        replaceForm(branch)
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
    function normalizeCountryCode() {
        form.address.countryCode = String(form.address.countryCode || "")
            .toUpperCase()
            .replace(/[^A-Z]/g, "")
            .slice(0, 2)
    }

    async function save() {
        saving.value = true
        errors.value = {}
        try {
            const payload = clone(form)
            const result = isEdit.value
                ? await updateBranch(branchId.value, payload)
                : await createBranch(payload)
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
        branchId,
        form,
        errors,
        saving,
        isEdit,
        openCreate,
        openEdit,
        save,
        clearError,
        normalizeCode,
        normalizeCountryCode,
    }
}
