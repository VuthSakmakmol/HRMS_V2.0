import { computed, reactive, ref } from "vue"
import {
    createCompany,
    updateCompany,
} from "../api/company.api.js"

export function createEmptyCompanyForm() {
    return {
        code: "",
        legalName: "",
        displayName: "",
        registrationNumber: "",
        taxNumber: "",
        status: "ACTIVE",
        settings: {
            defaultLocale: "en-US",
            timezone: "Asia/Phnom_Penh",
            currencyCode: "USD",
            weekStartsOn: 1,
        },
        contact: {
            email: "",
            phone: "",
            website: "",
        },
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

function clone(value) {
    return JSON.parse(JSON.stringify(value))
}

function normalizeCompany(company) {
    const empty = createEmptyCompanyForm()

    return {
        ...empty,
        ...company,
        status: company?.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
        settings: {
            ...empty.settings,
            ...(company?.settings ?? {}),
            weekStartsOn: Number(company?.settings?.weekStartsOn ?? 1),
        },
        contact: {
            ...empty.contact,
            ...(company?.contact ?? {}),
        },
        address: {
            ...empty.address,
            ...(company?.address ?? {}),
        },
    }
}

function mapFieldErrors(error) {
    const fields = error?.response?.data?.error?.fields ?? error?.fields ?? {}
    const mapped = {}

    for (const [field, value] of Object.entries(fields)) {
        mapped[field] = Array.isArray(value) ? value[0] : value
    }

    return mapped
}

export function useCompanyForm() {
    const mode = ref("create")
    const companyId = ref(null)
    const saving = ref(false)
    const errors = ref({})
    const form = reactive(createEmptyCompanyForm())
    const initialSnapshot = ref(JSON.stringify(createEmptyCompanyForm()))

    const isEdit = computed(() => mode.value === "edit")
    const isDirty = computed(() => JSON.stringify(form) !== initialSnapshot.value)

    function replaceForm(value) {
        const normalized = normalizeCompany(value)

        Object.assign(form, clone(normalized))
        form.settings = clone(normalized.settings)
        form.contact = clone(normalized.contact)
        form.address = clone(normalized.address)
        initialSnapshot.value = JSON.stringify(form)
    }

    function openCreate() {
        mode.value = "create"
        companyId.value = null
        errors.value = {}
        replaceForm(createEmptyCompanyForm())
    }

    function openEdit(company) {
        mode.value = "edit"
        companyId.value = company.id ?? company._id
        errors.value = {}
        replaceForm(company)
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

    function normalizeCurrencyCode() {
        form.settings.currencyCode = String(form.settings.currencyCode || "")
            .toUpperCase()
            .replace(/[^A-Z]/g, "")
            .slice(0, 3)
    }

    function buildPayload() {
        return clone({
            code: form.code,
            legalName: form.legalName,
            displayName: form.displayName,
            registrationNumber: form.registrationNumber,
            taxNumber: form.taxNumber,
            status: form.status,
            settings: form.settings,
            contact: form.contact,
            address: form.address,
        })
    }

    async function save() {
        saving.value = true
        errors.value = {}

        try {
            const payload = buildPayload()
            const result = isEdit.value
                ? await updateCompany(companyId.value, payload)
                : await createCompany(payload)

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
        companyId,
        form,
        errors,
        saving,
        isEdit,
        isDirty,
        openCreate,
        openEdit,
        save,
        clearError,
        normalizeCode,
        normalizeCountryCode,
        normalizeCurrencyCode,
    }
}
