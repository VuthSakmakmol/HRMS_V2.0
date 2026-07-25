import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"

import { env } from "./config/env.js"

import systemRoutes from "./modules/system/system.routes.js"
import authRoutes from "./modules/access/routes/auth.routes.js"
import accessManagementRoutes from "./modules/access/routes/accessManagement.routes.js"
import companyRoutes from "./modules/organization/routes/company.routes.js"
import branchRoutes from "./modules/organization/routes/branch.routes.js"
import departmentRoutes from "./modules/organization/routes/department.routes.js"
import positionRoutes from "./modules/organization/routes/position.routes.js"
import lineRoutes from "./modules/line/routes/line.routes.js"
import shiftRoutes from "./modules/shift/routes/shift.routes.js"
import employeeTypeRoutes from "./modules/employeeType/routes/employeeType.routes.js"
import locationRoutes from "./modules/location/routes/location.routes.js"
import employeeRoutes from "./modules/employee/routes/employee.routes.js"
import employeeMovementRoutes from "./modules/employeeMovement/routes/employeeMovement.routes.js"
import manpowerPlanRoutes from "./modules/manpowerPlan/routes/manpowerPlan.routes.js"
import approvalRoutes from "./modules/approval/routes/approval.routes.js"
import calendarRoutes from "./modules/calendar/routes/calendar.routes.js"
import hrDashboardRoutes from "./modules/hrDashboard/routes/hrDashboard.routes.js"
import attendanceRoutes from "./modules/attendance/routes/attendance.routes.js"
import attendancePolicyRoutes from "./modules/attendance/routes/attendancePolicy.routes.js"
import attendanceScanRoutes from "./modules/attendance/routes/attendanceScan.routes.js"
import attendanceVerificationRoutes from "./modules/attendance/routes/attendanceVerification.routes.js"
import recruitmentChannelRoutes from "./modules/recruitmentChannel/routes/recruitmentChannel.routes.js"
import hrDashboardTargetRoutes from "./modules/hrDashboardTarget/routes/hrDashboardTarget.routes.js"
import exitReasonRoutes from "./modules/exitReason/routes/exitReason.routes.js"


import { AppError } from "./shared/errors/AppError.js"
import { errorHandler } from "./shared/middleware/errorHandler.js"
import { notFound } from "./shared/middleware/notFound.js"
import { requestContext } from "./shared/middleware/requestContext.js"
import { requestMetrics } from "./shared/middleware/requestMetrics.js"


const allowedOrigins = new Set(
    env.CLIENT_URL.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
)

const app = express()

app.disable("x-powered-by")
app.set("trust proxy", 1)

app.use(requestContext)
app.use(requestMetrics)

app.use(
    helmet({
        crossOriginResourcePolicy: false,
    }),
)

app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.has(origin)) {
                return callback(null, true)
            }

            return callback(
                new AppError({
                    statusCode: 403,
                    code: "CORS_ORIGIN_DENIED",
                    messageKey: "errors.corsOriginDenied",
                }),
            )
        },
        credentials: true,
    }),
)

app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }))
app.use(express.urlencoded({ extended: false, limit: env.REQUEST_BODY_LIMIT }))

app.use(
    morgan(
        env.NODE_ENV === "production"
            ? "combined"
            : ":method :url :status :response-time ms",
    ),
)

app.use("/api/v1", systemRoutes)
app.use("/api/v1/auth", authRoutes)
app.use("/api/v1/access", accessManagementRoutes)
app.use("/api/v1/organization/companies", companyRoutes)
app.use("/api/v1/organization/branches", branchRoutes)
app.use("/api/v1/organization/departments", departmentRoutes)
app.use("/api/v1/organization/positions", positionRoutes)
app.use("/api/v1/organization/lines", lineRoutes)
app.use("/api/v1/organization/shifts", shiftRoutes)
app.use("/api/v1/organization/employee-types", employeeTypeRoutes)
app.use("/api/v1/organization/locations", locationRoutes)
app.use("/api/v1/employees", employeeRoutes)
app.use("/api/v1/employee-movements", employeeMovementRoutes)
app.use("/api/v1/reports/manpower-plans", manpowerPlanRoutes)
app.use("/api/v1/approvals", approvalRoutes)
app.use("/api/v1/calendar", calendarRoutes)
app.use("/api/v1/hr-dashboard", hrDashboardRoutes)
app.use("/api/v1/attendance", attendanceRoutes)
app.use("/api/v1/attendance/policies", attendancePolicyRoutes)
app.use("/api/v1/attendance/scans", attendanceScanRoutes)
app.use("/api/v1/attendance/verification", attendanceVerificationRoutes)
app.use("/api/v1/organization/recruitment-channels", recruitmentChannelRoutes)
app.use("/api/v1/reports/hr-dashboard-targets", hrDashboardTargetRoutes)
app.use("/api/v1/organization/exit-reasons", exitReasonRoutes)

app.use(notFound)
app.use(errorHandler)

export default app
