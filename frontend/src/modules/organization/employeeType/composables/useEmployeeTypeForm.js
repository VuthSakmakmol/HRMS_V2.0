import { computed, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"

import {
    createEmployeeType,
    updateEmployeeType,
} from "../api/employeeType.api.js"

function emptyForm() {
    return {
        companyId: "",
        branchId: "",
        code: "",
        name: "",
        structureMode: "DIRECT",
        dashboardCategory: "",
        positionAssignmentMode: "SPECIFIC_POSITIONS",
        positionIds: [],
        children: [],
        description: "",
        status: "ACTIVE",
    }
}

function normalizeCode(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, "")
}

export function useEmployeeTypeForm() {
    const { t } = useI18n()
    const form = reactive(emptyForm())
    const errors = reactive({})
    const saving = ref(false)
    const savingMessage = ref("")
    const mode = ref("create")
    const employeeTypeId = ref(null)
    const isEdit = computed(() => mode.value === "edit")

    function reset() {
        Object.assign(form, emptyForm())
        Object.keys(errors).forEach((key) => delete errors[key])
        employeeTypeId.value = null
        savingMessage.value = ""
    }

    function openCreate(workspace = {}) {
        reset()
        mode.value = "create"
        form.companyId = workspace.companyId || ""
        form.branchId = workspace.branchId || ""
    }

    function openEdit(row) {
        reset()
        mode.value = "edit"
        employeeTypeId.value = row.id

        Object.assign(form, {
            companyId: row.companyId || row.company?.id || "",
            branchId: row.branchId || row.branch?.id || "",
            code: row.code || "",
            name: row.name || "",
            structureMode: row.children?.length ? "CHILD" : "DIRECT",
            dashboardCategory: row.dashboardCategory || "",
            positionAssignmentMode:
                row.positionAssignmentMode || "SPECIFIC_POSITIONS",
            positionIds: (row.positionIds || []).map(
                (position) => position.id || position._id || position,
            ),
            children: (row.children || []).map((child) => ({
                id: child.id,
                code: child.code || "",
                name: child.name || "",
                dashboardCategory: child.dashboardCategory || "",
                positionAssignmentMode:
                    child.positionAssignmentMode || "SPECIFIC_POSITIONS",
                positionIds: (child.positionIds || []).map(
                    (position) => position.id || position._id || position,
                ),
            })),
            description: row.description || "",
            status: row.status === "ARCHIVED" ? "INACTIVE" : row.status || "ACTIVE",
        })
    }

    function addChild() {
        form.structureMode = "CHILD"
        form.positionIds = []
        form.children.push({
            code: "",
            name: "",
            dashboardCategory: "",
            positionAssignmentMode: "SPECIFIC_POSITIONS",
            positionIds: [],
        })
    }

    function removeChild(index) {
        form.children.splice(index, 1)
    }

    function clearError(field) {
        delete errors[field]
    }

    function buildPayload() {
        return {
            companyId: form.companyId,
            branchId: form.branchId,
            code: normalizeCode(form.code),
            name: form.name.trim(),
            dashboardCategory: normalizeCode(form.dashboardCategory),
            positionAssignmentMode:
                form.structureMode === "DIRECT"
                    ? form.positionAssignmentMode
                    : "SPECIFIC_POSITIONS",
            positionIds:
                form.structureMode === "DIRECT" &&
                form.positionAssignmentMode === "SPECIFIC_POSITIONS"
                    ? [...form.positionIds]
                    : [],
            children:
                form.structureMode === "CHILD"
                    ? form.children.map((child) => ({
                          code: normalizeCode(child.code || child.name),
                          name: child.name.trim(),
                          dashboardCategory: normalizeCode(
                              child.dashboardCategory,
                          ),
                          positionAssignmentMode:
                              child.positionAssignmentMode,
                          positionIds:
                              child.positionAssignmentMode ===
                              "SPECIFIC_POSITIONS"
                                  ? [...child.positionIds]
                                  : [],
                      }))
                    : [],
            description: form.description.trim(),
            status: form.status,
        }
    }

    async function save() {
        saving.value = true
        savingMessage.value = t("organization.employeeType.savingBackend")
        Object.keys(errors).forEach((key) => delete errors[key])

        try {
            const payload = buildPayload()

            if (!isEdit.value) {
                return await createEmployeeType(payload)
            }

            try {
                return await updateEmployeeType(employeeTypeId.value, payload)
            } catch (caught) {
                const error = caught?.response?.data?.error || caught

                if (
                    error?.code !==
                    "ORGANIZATION_EMPLOYEE_TYPE_RECONCILIATION_CONFIRMATION_REQUIRED"
                ) {
                    throw caught
                }

                saving.value = false
                savingMessage.value = ""

                const summary = error?.details?.reconciliation || {}
                const confirmed = window.confirm(
                    `This assignment change affects ${Number(summary.totalAffected || 0)} employee(s).\n\n` +
                        `${Number(summary.reassigned || 0)} will follow the new Employee Type assignment.\n` +
                        `${Number(summary.reviewRequired || 0)} will be marked for HR review.\n\n` +
                        "Continue and record the changes in employee movement history?",
                )

                if (!confirmed) {
                    return null
                }

                saving.value = true
                savingMessage.value = t(
                    "organization.employeeType.reconcilingEmployees",
                )

                return await updateEmployeeType(employeeTypeId.value, {
                    ...payload,
                    confirmEmployeeReconciliation: true,
                })
            }
        } catch (caught) {
            Object.assign(
                errors,
                caught?.response?.data?.error?.fields || {},
            )
            throw caught
        } finally {
            saving.value = false
            savingMessage.value = ""
        }
    }

    return {
        form,
        errors,
        saving,
        savingMessage,
        mode,
        employeeTypeId,
        isEdit,
        openCreate,
        openEdit,
        addChild,
        removeChild,
        clearError,
        save,
    }
}
