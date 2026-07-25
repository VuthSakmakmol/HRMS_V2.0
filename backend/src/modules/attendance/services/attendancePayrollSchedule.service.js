import crypto from "node:crypto"

import AttendancePayrollSchedule from "../models/AttendancePayrollSchedule.js"
import { assertAttendanceScope } from "../utils/attendanceScope.util.js"

const CLAIM_TIMEOUT_MS = 30 * 60 * 1000

function cambodiaParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Phnom_Penh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date)
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return {
        date: `${value.year}-${value.month}-${value.day}`,
        time: `${value.hour}:${value.minute}`,
    }
}

function localDateKey(date) {
    return date ? cambodiaParts(new Date(date)).date : ""
}

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
            runNowPending: false,
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
        runNowPending: Boolean(
            schedule.runNowRequestedAt
            && (!schedule.lastFinishedAt
                || schedule.runNowRequestedAt > schedule.lastFinishedAt),
        ),
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
                enabled: payload.enabled,
                runTime: payload.runTime,
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
                runNowRequestedAt: new Date(),
                lastError: "",
                updatedByAccountId: user.accountId,
            },
            $setOnInsert: {
                enabled: false,
                runTime: "08:00",
                timeZone: "Asia/Phnom_Penh",
                status: "IDLE",
            },
        },
        { upsert: true, returnDocument: "after" },
    ).lean()
    return publicSchedule(schedule)
}

export async function claimDuePayrollRun({ companyId, branchId }) {
    const schedule = await AttendancePayrollSchedule.findOne({
        companyId,
        branchId,
    })
    if (!schedule) return { shouldRun: false }

    const now = new Date()
    const current = cambodiaParts(now)
    const scheduledDue = schedule.enabled
        && current.time >= schedule.runTime
        && localDateKey(schedule.lastSuccessAt) !== current.date
    const runNowDue = Boolean(
        schedule.runNowRequestedAt
        && (!schedule.lastFinishedAt
            || schedule.runNowRequestedAt > schedule.lastFinishedAt),
    )
    const claimExpired = !schedule.claimedAt
        || now.getTime() - schedule.claimedAt.getTime() > CLAIM_TIMEOUT_MS

    if ((!scheduledDue && !runNowDue)
        || (schedule.status === "RUNNING" && !claimExpired)) {
        return { shouldRun: false, schedule: publicSchedule(schedule.toObject()) }
    }

    const claimToken = crypto.randomUUID()
    const claimed = await AttendancePayrollSchedule.findOneAndUpdate(
        {
            _id: schedule._id,
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

export async function finishPayrollRun({
    companyId,
    branchId,
    claimToken,
    success,
    importedFile,
    error,
}) {
    const now = new Date()
    const update = {
        status: success ? "SUCCESS" : "FAILED",
        lastFinishedAt: now,
        claimToken: null,
        claimedAt: null,
        lastError: success ? "" : error || "Payroll attendance bot failed.",
    }
    if (success) {
        update.lastSuccessAt = now
        update.lastImportedFile = importedFile || ""
    }
    const schedule = await AttendancePayrollSchedule.findOneAndUpdate(
        { companyId, branchId, claimToken },
        { $set: update },
        { returnDocument: "after" },
    ).lean()
    return publicSchedule(schedule)
}
