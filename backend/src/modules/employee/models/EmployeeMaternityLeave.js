import mongoose from "mongoose"

const { Schema } = mongoose

const employeeMaternityLeaveSchema = new Schema(
    {
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
            index: true,
        },
        companyId: {
            type: Schema.Types.ObjectId,
            ref: "Company",
            required: true,
            index: true,
        },
        branchId: {
            type: Schema.Types.ObjectId,
            ref: "Branch",
            required: true,
            index: true,
        },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        expectedReturnDate: { type: Date, required: true },
        actualReturnDate: { type: Date, default: null },
        status: {
            type: String,
            enum: ["ACTIVE", "COMPLETED", "CANCELLED"],
            default: "ACTIVE",
            required: true,
        },
        source: {
            type: String,
            enum: ["EMPLOYEE_PROFILE", "SYSTEM"],
            default: "EMPLOYEE_PROFILE",
            required: true,
        },
        createdByAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
        updatedByAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    },
    {
        collection: "employee_maternity_leaves",
        timestamps: true,
        versionKey: false,
    },
)

employeeMaternityLeaveSchema.index(
    { employeeId: 1, startDate: 1 },
    { unique: true, name: "uq_employee_maternity_start" },
)
employeeMaternityLeaveSchema.index(
    { companyId: 1, branchId: 1, startDate: 1, endDate: 1, status: 1 },
    { name: "idx_maternity_scope_period" },
)
employeeMaternityLeaveSchema.index(
    { expectedReturnDate: 1, status: 1 },
    { name: "idx_maternity_expected_return_status" },
)

const EmployeeMaternityLeave =
    mongoose.models.EmployeeMaternityLeave ||
    mongoose.model("EmployeeMaternityLeave", employeeMaternityLeaveSchema)

export default EmployeeMaternityLeave
