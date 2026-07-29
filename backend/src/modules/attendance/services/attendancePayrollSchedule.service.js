import crypto from "node:crypto"

import { AppError } from "../../../shared/errors/AppError.js"
import AttendancePayrollSchedule from "../models/AttendancePayrollSchedule.js"
import { assertAttendanceScope } from "../utils/attendanceScope.util.js"

const CLAIM_TIMEOUT_MS = 30 * 60 * 1000
const DEFAULT_TIME_ZONE = "Asia/Phnom_Penh"

function currentDateInTimeZone(timeZone = DEFAULT_TIME_ZONE) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).formatToParts(new Date()).map((part) => [part.type, part.value]),
    )
    return `${parts.year}-${parts.month}-${parts.day}`
}

function publicSchedule(schedule) {
    if (!schedule) {
        return {
            enabled: false,
            runTime: "08:00",
            timeZone: "Asia/Phnom_Penh",
            status: "IDLE",
            requestedDate: null,
            lastRunAt: null,
            lastFinishedAt: null,
            lastSuccessAt: null,
            lastImportedFile: "",
            lastImportedDate: null,
            lastImportedRowCount: 0,
            lastError: "",
            lastCancelledAt: null,
            runNowPending: false,
            cancelPending: false,
            canCancel: false,
            progressPercent: 0,
            progressPhase: "",
            progressDetail: "",
            progressUpdatedAt: null,
        }
    }
    return {
        id: String(schedule._id),
        companyId: String(schedule.companyId),
        branchId: String(schedule.branchId),
        enabled: schedule.enabled,
        runTime: schedule.runTime,
        timeZone: schedule.timeZone,
        status: schedule.status,
        requestedDate: schedule.requestedDate || null,
        lastRunAt: schedule.lastRunAt,
        lastFinishedAt: schedule.lastFinishedAt,
        lastSuccessAt: schedule.lastSuccessAt,
        lastImportedFile: schedule.lastImportedFile,
        lastImportedDate: schedule.lastImportedDate || null,
        lastImportedRowCount: schedule.lastImportedRowCount || 0,
        lastError: schedule.lastError,
        lastCancelledAt: schedule.lastCancelledAt,
        runNowPending: Boolean(
            schedule.runNowRequestedAt
            && (!schedule.lastFinishedAt
                || schedule.runNowRequestedAt > schedule.lastFinishedAt),
        ),
        cancelPending: schedule.status === "CANCEL_REQUESTED",
        canCancel: ["RUNNING", "CANCEL_REQUESTED"].includes(schedule.status)
            || Boolean(
                schedule.runNowRequestedAt
                && (!schedule.lastFinishedAt
                    || schedule.runNowRequestedAt > schedule.lastFinishedAt),
            ),
        progressPercent: schedule.progressPercent || 0,
        progressPhase: schedule.progressPhase || "",
        progressDetail: schedule.progressDetail || "",
        progressUpdatedAt: schedule.progressUpdatedAt || null,
    }
}

export async function getPayrollSchedule({ companyId, branchId, user }) {
    assertAttendanceScope(user, companyId, branchId)
    const schedule = await AttendancePayrollSchedule.findOne({
        companyId,
        branchId,
    }).lean()
    return publicSchedule(schedule)
}

export async function savePayrollSchedule({ payload, user }) {
    assertAttendanceScope(user, payload.companyId, payload.branchId)
    const schedule = await AttendancePayrollSchedule.findOneAndUpdate(
        { companyId: payload.companyId, branchId: payload.branchId },
        {
            $set: {
                enabled: false,
                timeZone: "Asia/Phnom_Penh",
                updatedByAccountId: user.accountId,
            },
            $setOnInsert: {
                status: "IDLE",
            },
        },
        {
            upsert: true,
            runValidators: true,
            returnDocument: "after",
        },
    ).lean()
    return publicSchedule(schedule)
}

export async function requestPayrollRunNow({
    companyId,
    branchId,
    reportDate,
    user,
}) {
    assertAttendanceScope(user, companyId, branchId)

    if (reportDate > currentDateInTimeZone()) {
        throw new AppError({
            statusCode: 422,
            code: "ATTENDANCE_PAYROLL_FUTURE_DATE",
            messageKey: "errors.validationFailed",
            fields: {
                reportDate: ["A future Payroll attendance date cannot be imported."],
            },
        })
    }

    const existing = await AttendancePayrollSchedule.findOne({
        companyId,
        branchId,
    }).lean()
    const existingPublic = publicSchedule(existing)
    if (existingPublic.canCancel) {
        throw new AppError({
            statusCode: 409,
            code: "ATTENDANCE_PAYROLL_RUN_ACTIVE",
            messageKey: "errors.validationFailed",
        })
    }

    const requestedAt = new Date()
    const schedule = await AttendancePayrollSchedule.findOneAndUpdate(
        { companyId, branchId },
        {
            $set: {
                enabled: false,
                status: "QUEUED",
                requestedDate: reportDate,
                runNowRequestedAt: requestedAt,
                lastError: "",
                cancelRequestedAt: null,
                progressPercent: 0,
                progressPhase: "QUEUED",
                progressDetail:
                    `Waiting for the Payroll computer to import ${reportDate}.`,
                progressUpdatedAt: requestedAt,
                updatedByAccountId: user.accountId,
            },
            $setOnInsert: {
                runTime: "08:00",
                timeZone: "Asia/Phnom_Penh",
            },
        },
        { upsert: true, returnDocument: "after" },
    ).lean()
    return publicSchedule(schedule)
}

export async function updatePayrollRunProgress({
    companyId,
    branchId,
    claimToken,
    percent,
    phase,
    detail,
}) {
    const schedule = await AttendancePayrollSchedule.findOneAndUpdate(
        {
            companyId,
            branchId,
            claimToken,
            status: { $in: ["RUNNING", "CANCEL_REQUESTED"] },
        },
        {
            $set: {
                progressPercent: percent,
                progressPhase: phase,
                progressDetail: detail || "",
                progressUpdatedAt: new Date(),
            },
        },
        { returnDocument: "after" },
    ).lean()
    return publicSchedule(schedule)
}

export async function requestPayrollRunCancellation({
    companyId,
    branchId,
    user,
}) {
    assertAttendanceScope(user, companyId, branchId)
    const schedule = await AttendancePayrollSchedule.findOne({
        companyId,
        branchId,
    })

    if (!schedule) return publicSchedule(null)

    const now = new Date()
    const isRunning = ["RUNNING", "CANCEL_REQUESTED"].includes(schedule.status)

    schedule.cancelRequestedAt = now
    schedule.runNowRequestedAt = null
    schedule.updatedByAccountId = user.accountId
    schedule.lastError = ""

    if (isRunning) {
        schedule.status = "CANCEL_REQUESTED"
    } else {
        schedule.status = "CANCELLED"
        schedule.lastCancelledAt = now
        schedule.lastFinishedAt = now
        schedule.claimedAt = null
        schedule.claimToken = null
    }

    await schedule.save()
    return publicSchedule(schedule.toObject())
}

export async function claimDuePayrollRun({ companyId, branchId }) {
    const schedule = await AttendancePayrollSchedule.findOne({
        companyId,
        branchId,
    })
    if (!schedule) return { shouldRun: false }

    const now = new Date()
    const runNowDue = Boolean(
        schedule.runNowRequestedAt
        && (!schedule.lastFinishedAt
            || schedule.runNowRequestedAt > schedule.lastFinishedAt),
    )
    if (schedule.status === "CANCEL_REQUESTED") {
        return { shouldRun: false, schedule: publicSchedule(schedule.toObject()) }
    }
    const claimExpired = !schedule.claimedAt
        || now.getTime() - schedule.claimedAt.getTime() > CLAIM_TIMEOUT_MS

    if ((!runNowDue)
        || (schedule.status === "RUNNING" && !claimExpired)) {
        return { shouldRun: false, schedule: publicSchedule(schedule.toObject()) }
    }

    const claimToken = crypto.randomUUID()
    const claimed = await AttendancePayrollSchedule.findOneAndUpdate(
        {
            _id: schedule._id,
            status: { $ne: "CANCEL_REQUESTED" },
            $or: [
                { status: { $ne: "RUNNING" } },
                { claimedAt: { $lt: new Date(now.getTime() - CLAIM_TIMEOUT_MS) } },
            ],
        },
        {
            $set: {
                status: "RUNNING",
                claimedAt: now,
                claimToken,
                lastRunAt: now,
                lastError: "",
                cancelRequestedAt: null,
                progressPercent: 1,
                progressPhase: "STARTING",
                progressDetail: "Payroll computer claimed the run.",
                progressUpdatedAt: now,
            },
        },
        { returnDocument: "after" },
    ).lean()

    if (!claimed) return { shouldRun: false }
    return {
        shouldRun: true,
        claimToken,
        reportDate: claimed.requestedDate,
        schedule: publicSchedule(claimed),
    }
}

export async function getPayrollRunStatus({
    companyId,
    branchId,
    claimToken,
}) {
    const schedule = await AttendancePayrollSchedule.findOne({
        companyId,
        branchId,
        claimToken,
    }).lean()

    if (!schedule) {
        return { active: false, cancelRequested: true }
    }

    return {
        active: true,
        cancelRequested: schedule.status === "CANCEL_REQUESTED"
            || Boolean(schedule.cancelRequestedAt),
        status: schedule.status,
    }
}

export async function finishPayrollRun({
    companyId,
    branchId,
    claimToken,
    outcome,
    importedFile,
    reportDate,
    rowCount,
    error,
}) {
    const now = new Date()
    const scheduleBeforeFinish = await AttendancePayrollSchedule.findOne({
        companyId,
        branchId,
        claimToken,
    }).lean()
    if (!scheduleBeforeFinish) return publicSchedule(null)

    const dateMismatch = outcome === "SUCCESS"
        && reportDate !== scheduleBeforeFinish.requestedDate
    const normalizedOutcome = dateMismatch ? "FAILED" : outcome
    const normalizedError = dateMismatch
        ? `Payroll returned ${reportDate || "no date"}, but HRMS requested ${scheduleBeforeFinish.requestedDate}.`
        : error

    const update = {
        status: normalizedOutcome,
        lastFinishedAt: now,
        claimToken: null,
        claimedAt: null,
        lastError: normalizedOutcome === "FAILED"
            ? normalizedError || "Payroll attendance bot failed."
            : "",
        cancelRequestedAt: null,
        progressPercent: normalizedOutcome === "SUCCESS" ? 100 : 0,
        progressPhase: normalizedOutcome,
        progressDetail: normalizedOutcome === "SUCCESS"
            ? `Attendance for ${reportDate} imported. Payroll and generated windows closed.`
            : normalizedOutcome === "CANCELLED"
                ? "Payroll attendance import cancelled."
                : normalizedError || "Payroll attendance import failed.",
        progressUpdatedAt: now,
    }
    if (normalizedOutcome === "SUCCESS") {
        update.lastSuccessAt = now
        update.lastImportedFile = importedFile || ""
        update.lastImportedDate = reportDate
        update.lastImportedRowCount = rowCount || 0
    }
    if (normalizedOutcome === "CANCELLED") {
        update.lastCancelledAt = now
    }
    const updateOperation = { $set: update }
    if (normalizedOutcome === "SUCCESS") {
        updateOperation.$push = {
            successfulImports: {
                $each: [{
                    reportDate,
                    importedAt: now,
                    importedFile: importedFile || "",
                    rowCount: rowCount || 0,
                }],
                $slice: -90,
            },
        }
    }
    const schedule = await AttendancePayrollSchedule.findOneAndUpdate(
        { companyId, branchId, claimToken },
        updateOperation,
        { returnDocument: "after" },
    ).lean()
    return publicSchedule(schedule)
}
