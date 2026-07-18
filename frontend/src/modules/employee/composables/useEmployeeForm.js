import { computed, reactive, ref } from "vue"
import { createEmployee, fetchEmployee, updateEmployee } from "../api/employee.api.js"
import { EMPLOYEE_FORM_SECTIONS } from "../config/employee.form-sections.js"

const emptyAddress = () => ({ countryId: "", provinceId: "", districtId: "", communeId: "", villageId: "", detail: "" })
const emptyDocuments = () => ({ idCardNo: "", idCardExpireDate: "", nssfNo: "", passportNo: "", passportExpireDate: "", visaExpireDate: "", medicalCheckNo: "", medicalCheckDate: "", workingBookNo: "" })

export function createEmptyEmployeeForm() {
    return {
        employeeCode: "", profileImageUrl: "", createAccount: true, defaultRoleId: null,
        khmerFirstName: "", khmerLastName: "", englishFirstName: "", englishLastName: "", displayName: "",
        gender: "UNKNOWN", dateOfBirth: "", email: "", phoneNumber: "", agentPhoneNumber: "", agentPerson: "", note: "",
        maritalStatus: "UNKNOWN", spouseName: "", spouseContactNumber: "", education: "", religion: "", nationality: "Khmer",
        birthAddress: emptyAddress(), livingAddress: emptyAddress(), permanentAddress: emptyAddress(), emergencyContactAddress: emptyAddress(), familyAddress: emptyAddress(),
        companyId: "", branchId: "", departmentId: "", positionId: "", lineId: "", shiftId: "",
        joinDate: "", employmentStatus: "WORKING", resignDate: "", resignReason: "", exitReasonId: null, remark: "",
        documents: emptyDocuments(), sourceOfHiring: "", recruitmentChannelId: null, introducerEmployeeId: null,
        employeeTypeId: null, employeeTypeChildId: null, employeeTypeChildCode: "", employeeTypeChildName: "",
        machineSkills: { singleNeedle: 0, overlock: 0, coverstitch: 0, totalMachines: 0 },
        approvalPolicyId: null, recordStatus: "ACTIVE",
    }
}

export function useEmployeeForm() {
    const visible = ref(false), saving = ref(false), loading = ref(false), mode = ref("create"), employeeId = ref(null), activeSection = ref(0), errors = ref({})
    const form = reactive(createEmptyEmployeeForm())
    const editing = computed(() => mode.value === "edit")

    function assign(source = {}) {
        const empty = createEmptyEmployeeForm()
        Object.assign(form, empty, source)
        for (const key of ["birthAddress", "livingAddress", "permanentAddress", "emergencyContactAddress", "familyAddress"]) form[key] = { ...empty[key], ...(source[key] || {}) }
        form.documents = { ...empty.documents, ...(source.documents || {}) }
        form.machineSkills = { ...empty.machineSkills, ...(source.machineSkills || {}) }
    }

    function openCreate() { mode.value = "create"; employeeId.value = null; activeSection.value = 0; errors.value = {}; assign(); visible.value = true }
    async function openEdit(id) { mode.value = "edit"; employeeId.value = id; activeSection.value = 0; errors.value = {}; visible.value = true; loading.value = true; try { assign(await fetchEmployee(id)) } finally { loading.value = false } }
    function clearError(field) { if (errors.value[field]) delete errors.value[field] }
    function next() { if (activeSection.value < EMPLOYEE_FORM_SECTIONS.length - 1) activeSection.value += 1 }
    function previous() { if (activeSection.value > 0) activeSection.value -= 1 }

    async function save() {
        saving.value = true; errors.value = {}
        try {
            const payload = structuredClone(form)
            if (editing.value) { delete payload.companyId; delete payload.branchId; delete payload.createAccount; delete payload.defaultRoleId }
            const employee = editing.value ? await updateEmployee(employeeId.value, payload) : await createEmployee(payload)
            visible.value = false
            return employee
        } catch (error) {
            errors.value = error?.response?.data?.error?.fields ?? {}
            throw error
        } finally { saving.value = false }
    }

    return { visible, saving, loading, mode, editing, employeeId, activeSection, form, errors, openCreate, openEdit, clearError, next, previous, save }
}
