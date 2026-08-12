import { computed, reactive, ref } from "vue";
import {
  createEmployee,
  fetchEmployee,
  updateEmployee,
} from "../api/employee.api.js";
import { EMPLOYEE_FORM_SECTIONS } from "../config/employee.form-sections.js";
import {
  EXIT_EMPLOYMENT_STATUSES,
  firstEmployeeErrorSection,
  validateEmployeeForm,
  validateEmployeeSection,
} from "../config/employee.form-validation.js";

const emptyAddress = () => ({
  countryId: "",
  provinceId: "",
  districtId: "",
  communeId: "",
  villageId: "",
  detail: "",
});
const emptyDocuments = () => ({
  idCardNo: "",
  idCardExpireDate: "",
  nssfNo: "",
  passportNo: "",
  passportExpireDate: "",
  visaExpireDate: "",
  medicalCheckNo: "",
  medicalCheckDate: "",
  workingBookNo: "",
});

export function createEmptyEmployeeForm() {
  return {
    employeeCode: "",
    profileImageUrl: "",
    createAccount: true,
    defaultRoleId: null,
    khmerFirstName: "",
    khmerLastName: "",
    englishFirstName: "",
    englishLastName: "",
    displayName: "",
    gender: "UNKNOWN",
    dateOfBirth: "",
    email: "",
    phoneNumber: "",
    agentPhoneNumber: "",
    agentPerson: "",
    note: "",
    maritalStatus: "UNKNOWN",
    spouseName: "",
    spouseContactNumber: "",
    education: "",
    religion: "",
    nationality: "",
    birthAddress: emptyAddress(),
    permanentAddress: emptyAddress(),
    companyId: "",
    branchId: "",
    departmentId: "",
    positionId: "",
    lineId: "",
    shiftId: "",
    joinDate: "",
    employmentStatus: "WORKING",
    resignDate: "",
    resignReason: "",
    maternityLeaveStartDate: "",
    maternityLeaveEndDate: "",
    maternityExpectedReturnDate: "",
    exitReasonId: null,
    documents: emptyDocuments(),
    recruitmentChannelId: null,
    introducerEmployeeId: null,
    machineSkills: {
      singleNeedle: 0,
      overlock: 0,
      coverstitch: 0,
      totalMachines: 0,
    },
    approvalPolicyId: null,
    recordStatus: "ACTIVE",
  };
}

export function useEmployeeForm() {
  const visible = ref(false),
    saving = ref(false),
    loading = ref(false),
    mode = ref("create"),
    employeeId = ref(null),
    activeSection = ref(0),
    errors = ref({});
  const form = reactive(createEmptyEmployeeForm());
  const editing = computed(() => mode.value === "edit");

  function assign(source = {}) {
    const empty = createEmptyEmployeeForm();
    Object.assign(form, empty, source);
    for (const key of ["birthAddress", "permanentAddress"])
      form[key] = { ...empty[key], ...(source[key] || {}) };
    form.documents = { ...empty.documents, ...(source.documents || {}) };
    form.machineSkills = {
      ...empty.machineSkills,
      ...(source.machineSkills || {}),
    };
  }

  function openCreate() {
    mode.value = "create";
    employeeId.value = null;
    activeSection.value = 0;
    errors.value = {};
    assign();
    visible.value = true;
  }
  async function openEdit(id) {
    mode.value = "edit";
    employeeId.value = id;
    activeSection.value = 0;
    errors.value = {};
    visible.value = true;
    loading.value = true;
    try {
      assign(await fetchEmployee(id));
    } finally {
      loading.value = false;
    }
  }
  function clearError(field) {
    if (errors.value[field]) delete errors.value[field];
  }
  function next() {
    const sectionErrors = validateEmployeeSection(form, activeSection.value, {
      editing: editing.value,
    });
    if (Object.keys(sectionErrors).length) {
      errors.value = { ...errors.value, ...sectionErrors };
      return false;
    }
    if (activeSection.value < EMPLOYEE_FORM_SECTIONS.length - 1)
      activeSection.value += 1;
    return true;
  }
  function previous() {
    if (activeSection.value > 0) activeSection.value -= 1;
  }

  async function save() {
    saving.value = true;
    errors.value = {};
    try {
      // `form` is a Vue reactive Proxy. Browser structuredClone() cannot
      // clone Vue proxies and throws DataCloneError before the API request
      // is sent. Convert the reactive form into the same plain JSON shape
      // that will be submitted to the backend.
      const payload = JSON.parse(JSON.stringify(form));
      delete payload.sourceOfHiring;
      delete payload.remark;
      // Employee Type / Child are derived by the backend from Position.
      // Never submit stale values loaded from an existing employee.
      delete payload.employeeTypeId;
      delete payload.employeeTypeChildId;
      delete payload.employeeTypeChildCode;
      delete payload.employeeTypeChildName;
      delete payload.employeeType;
      delete payload.employeeTypeChild;
      delete payload.employeeTypeLabel;
      delete payload.employeeTypeReviewRequired;
      delete payload.employeeTypeReviewReason;
      if (payload.maritalStatus !== "MARRIED") {
        payload.spouseName = "";
        payload.spouseContactNumber = "";
      }
      if (!EXIT_EMPLOYMENT_STATUSES.has(payload.employmentStatus)) {
        payload.resignDate = null;
        payload.exitReasonId = null;
        payload.resignReason = "";
      }

      const formErrors = validateEmployeeForm(payload, {
        editing: editing.value,
      });
      if (Object.keys(formErrors).length) {
        errors.value = formErrors;
        const firstInvalidSection = EMPLOYEE_FORM_SECTIONS.findIndex(
          (_section, index) =>
            Object.keys(
              validateEmployeeSection(payload, index, {
                editing: editing.value,
              }),
            ).length > 0,
        );
        if (firstInvalidSection >= 0) activeSection.value = firstInvalidSection;

        const error = new Error(
          "Complete the required or invalid employee fields before saving.",
        );
        error.fields = formErrors;
        throw error;
      }

      if (editing.value) {
        delete payload.employeeCode;
        delete payload.companyId;
        delete payload.branchId;
        delete payload.createAccount;
        delete payload.defaultRoleId;
      }
      const employee = editing.value
        ? await updateEmployee(employeeId.value, payload)
        : await createEmployee(payload);
      visible.value = false;
      return employee;
    } catch (error) {
      errors.value =
        error?.fields ?? error?.response?.data?.error?.fields ?? {};
      const firstInvalidSection = firstEmployeeErrorSection(errors.value);
      if (firstInvalidSection >= 0) activeSection.value = firstInvalidSection;
      throw error;
    } finally {
      saving.value = false;
    }
  }

  return {
    visible,
    saving,
    loading,
    mode,
    editing,
    employeeId,
    activeSection,
    form,
    errors,
    openCreate,
    openEdit,
    clearError,
    next,
    previous,
    save,
  };
}
