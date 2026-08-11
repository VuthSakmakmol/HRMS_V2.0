<script setup>
import Select from "primevue/select";

const props = defineProps({
  form: { type: Object, required: true },
  options: { type: Object, default: () => ({}) },
  errors: { type: Object, default: () => ({}) },
  disabled: Boolean,
  editing: Boolean,
});

const emit = defineEmits([
  "company-change",
  "branch-change",
  "department-change",
]);

const fields = [
  { key: "companyId", label: "Company" },
  { key: "branchId", label: "Branch" },
  { key: "departmentId", label: "Department" },
  { key: "positionId", label: "Position" },
  { key: "lineId", label: "Line" },
  { key: "shiftId", label: "Shift" },
];

function isFieldDisabled(fieldKey) {
  if (props.disabled) return true;

  if (["companyId", "branchId"].includes(fieldKey)) {
    return true;
  }

  if (fieldKey === "departmentId" && !props.form.branchId) {
    return true;
  }

  if (fieldKey === "positionId" && !props.form.departmentId) {
    return true;
  }

  if (["lineId", "shiftId"].includes(fieldKey) && !props.form.branchId) {
    return true;
  }

  return false;
}

function handleFieldChange(fieldKey) {
  if (fieldKey === "companyId") {
    emit("company-change");
    return;
  }

  if (fieldKey === "branchId") {
    emit("branch-change");
    return;
  }

  if (fieldKey === "departmentId") {
    emit("department-change");
  }
}

function getError(fieldKey) {
  const error = props.errors?.[fieldKey];

  if (!error) return "";
  return Array.isArray(error) ? error[0] || "" : error;
}
</script>

<template>
  <div class="employee-section-grid">
    <label
      v-for="field in fields"
      :key="field.key"
      class="enterprise-form-field"
    >
      <span>{{ field.label }} *</span>

      <Select
        v-model="form[field.key]"
        :options="options[field.key] || []"
        option-label="label"
        option-value="value"
        option-disabled="disabled"
        filter
        :disabled="isFieldDisabled(field.key)"
        @change="handleFieldChange(field.key)"
      />

      <small v-if="getError(field.key)">
        {{ getError(field.key) }}
      </small>

      <small
        v-else-if="field.key === 'positionId'"
        class="employee-assignment-hint"
      >
        Employee Type and Child Type are assigned automatically from Position.
      </small>
    </label>
  </div>
</template>

<style scoped>
.employee-assignment-hint {
  color: var(--p-text-muted-color, #64748b) !important;
}
</style>
