import crypto from "node:crypto"

import AttendancePayrollSchedule from "../models/AttendancePayrollSchedule.js"
import { assertAttendanceScope } from "../utils/attendanceScope.util.js"

const CLAIM_TIMEOUT_MS = 30 * 60 * 1000

function publicSchedule(schedule) {
    if (!schedule) {
        return {
            enabled: false,
            runTime: "08:00",
            timeZone: "Asia/Phnom_Penh",
            status: "IDLE",
            lastRunAt: null,
            lastFinishedAt: null,
            lastSuccessAt: null,
            lastImportedFile: "",
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
        lastRunAt: schedule.lastRunAt,
        lastFinishedAt: schedule.lastFinishedAt,
        lastSuccessAt: schedule.lastSuccessAt,
        lastImportedFile: schedule.lastImportedFile,
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

export async function requestPayrollRunNow({ companyId, branchId, user }) {
    assertAttendanceScope(user, companyId, branchId)
    const schedule = await AttendancePayrollSchedule.findOneAndUpdate(
        { companyId, branchId },
        {
            $set: {
                enabled: false,
                runNowRequestedAt: new Date(),
                lastError: "",
                cancelRequestedAt: null,
                updatedByAccountId: user.accountId,
            },
            $setOnInsert: {
                runTime: "08:00",
                timeZone: "Asia/Phnom_Penh",
                status: "IDLE",
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
    error,
}) {
    const now = new Date()
    const update = {
        status: outcome,
        lastFinishedAt: now,
        claimToken: null,
        claimedAt: null,
        lastError: outcome === "FAILED"
            ? error || "Payroll attendance bot failed."
            : "",
        cancelRequestedAt: null,
        progressPercent: outcome === "SUCCESS" ? 100 : 0,
        progressPhase: outcome,
        progressDetail: outcome === "SUCCESS"
            ? "Attendance import completed. Payroll closed."
            : "",
        progressUpdatedAt: now,
    }
    if (outcome === "SUCCESS") {
        update.lastSuccessAt = now
        update.lastImportedFile = importedFile || ""
    }
    if (outcome === "CANCELLED") {
        update.lastCancelledAt = now
    }
    const schedule = await AttendancePayrollSchedule.findOneAndUpdate(
        { companyId, branchId, claimToken },
        { $set: update },
        { returnDocument: "after" },
    ).lean()
    return publicSchedule(schedule)
}
