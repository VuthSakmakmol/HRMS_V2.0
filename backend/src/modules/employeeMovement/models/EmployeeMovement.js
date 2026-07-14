
import mongoose from "mongoose"

const { Schema } = mongoose

function normalizeText(value) {
    if (typeof value !== "string") return value
    return value.trim().replace(/\s+/g, " ")
}

const assignmentSnapshotSchema = new Schema(
    {
        companyId: { type: Schema.Types.ObjectId, ref: "Company", default: null },
        branchId: { type: Schema.Types.ObjectId, ref: "Branch", default: null },
        departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
        positionId: { type: Schema.Types.ObjectId, ref: "Position", default: null },
        lineId: { type: Schema.Types.ObjectId, ref: "Line", default: null },
        shiftId: { type: Schema.Types.ObjectId, ref: "Shift", default: null },
        employeeTypeId: { type: Schema.Types.ObjectId, ref: "EmployeeType", default: null },
        employeeTypeChildId: { type: Schema.Types.ObjectId, default: null },
        employeeTypeChildCode: { type: String, trim: true, maxlength: 30, default: "" },
        employeeTypeChildName: { type: String, trim: true, maxlength: 120, set: normalizeText, default: "" },
        employmentStatus: { type: String, trim: true, maxlength: 40, default: "" },
    },
    { _id: false },
)

const employeeMovementSchema = new Schema(
    {
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },

        movementType: {
            type: String,
            enum: [
                "NEW_HIRE",
                "REJOIN",
                "RESIGN",
                "TERMINATE",
                "ABANDON",
                "PASSED_AWAY",
                "RETIRE",
                "TRANSFER",
                "DEPARTMENT_CHANGE",
                "POSITION_CHANGE",
                "LINE_CHANGE",
                "SHIFT_CHANGE",
                "EMPLOYEE_TYPE_CHANGE",
                "STATUS_CHANGE",
                "OTHER",
            ],
            required: true,
        },

        effectiveDate: {
            type: Date,
            required: true,
        },

        from: { type: assignmentSnapshotSchema, default: () => ({}) },
        to: { type: assignmentSnapshotSchema, default: () => ({}) },

        reason: {
            type: String,
            trim: true,
            maxlength: 500,
            set: normalizeText,
            default: "",
        },

        source: {
            type: String,
            enum: ["MANUAL", "EMPLOYEE_PROFILE", "IMPORT"],
            default: "MANUAL",
            required: true,
        },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
            default: "ACTIVE",
            required: true,
        },

        createdByAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
        updatedByAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    },
    {
        collection: "employee_movements",
        timestamps: true,
        versionKey: false,
    },
)

employeeMovementSchema.index({ employeeId: 1, effectiveDate: -1 }, { name: "idx_employee_movement_employee_date" })
employeeMovementSchema.index({ movementType: 1, effectiveDate: -1, status: 1 }, { name: "idx_employee_movement_type_date_status" })
employeeMovementSchema.index({ "to.companyId": 1, "to.branchId": 1, effectiveDate: -1, status: 1 }, { name: "idx_employee_movement_scope_date" })
employeeMovementSchema.index({ "to.departmentId": 1, "to.positionId": 1, "to.lineId": 1, effectiveDate: -1 }, { name: "idx_employee_movement_to_assignment" })

employeeMovementSchema.set("toJSON", {
    virtuals: true,
    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        return returnedObject
    },
})

const EmployeeMovement = mongoose.models.EmployeeMovement || mongoose.model("EmployeeMovement", employeeMovementSchema)

export default EmployeeMovement
