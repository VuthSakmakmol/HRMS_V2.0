import Account from "../../access/models/Account.js"
import { AppError } from "../../../shared/errors/AppError.js"
import AttendanceDailyEmailSchedule from "../models/AttendanceDailyEmailSchedule.js"
import CalendarDay from "../../calendar/models/CalendarDay.js"
import { resolveCalendarDay } from "../../calendar/services/calendar.service.js"
import { assertAttendanceScope } from "../utils/attendanceScope.util.js"
import { sendAttendanceDailyEmail } from "./attendanceDailyEmail.service.js"

const DEFAULT_TIME_ZONE = "Asia/Phnom_Penh"
const RETRY_AFTER_MS = 5 * 60 * 1000
const CALENDAR_DAY_TYPES = [
    "WORKING_DAY",
    "WEEKEND",
    "HOLIDAY",
    "SPECIAL_WORKING_DAY",
    "COMPANY_EVENT",
    "CLOSED_DAY",
]
const DEFAULT_ALLOWED_DAY_TYPES = ["WORKING_DAY", "SPECIAL_WORKING_DAY"]
const DAY_TYPE_LABELS = {
    WORKING_DAY: "Working Day",
    WEEKEND: "Weekend / Sunday",
    HOLIDAY: "Holiday",
    SPECIAL_WORKING_DAY: "Special Working Day",
    COMPANY_EVENT: "Company Event",
    CLOSED_DAY: "Closed Day",
}

function validateTimeZone(timeZone) {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date())
        return timeZone
    } catch {
        throw new AppError({
            statusCode: 422,
            code: "INVALID_TIME_ZONE",
            messageKey: "errors.validationFailed",
        })
    }
}

function localClock(now, timeZone) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        }).formatToParts(now).map((part) => [part.type, part.value]),
    )

    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        time: `${parts.hour}:${parts.minute}`,
    }
}

function nextCalendarDate(date) {
    const [year, month, day] = date.split("-").map(Number)
    const next = new Date(Date.UTC(year, month - 1, day + 1))
    return next.toISOString().slice(0, 10)
}

function publicSchedule(schedule) {
    if (!schedule) {
        return {
            enabled: false,
            sendTime: "08:00",
            timeZone: DEFAULT_TIME_ZONE,
            allowedDayTypes: DEFAULT_ALLOWED_DAY_TYPES,
            lastSentDate: null,
            lastSentAt: null,
            lastError: "",
        }
    }

    return {
        id: String(schedule._id),
        enabled: schedule.enabled,
        sendTime: schedule.sendTime,
        timeZone: schedule.timeZone,
        allowedDayTypes: Array.isArray(schedule.allowedDayTypes)
            ? schedule.allowedDayTypes
            : DEFAULT_ALLOWED_DAY_TYPES,
        activeFromDate: schedule.activeFromDate || null,
        lastSentDate: schedule.lastSentDate,
        lastSentAt: schedule.lastSentAt,
        lastSkippedDate: schedule.lastSkippedDate || null,
        lastSkippedDayType: schedule.lastSkippedDayType || "",
        lastError: schedule.lastError || "",
        updatedAt: schedule.updatedAt,
    }
}

async function getDayTypeOptions(companyId, branchId) {
    const existingTypes = await CalendarDay.distinct("dayType", {
        status: "ACTIVE",
        $or: [
            { scopeLevel: "GLOBAL" },
            { scopeLevel: "COMPANY", companyId },
            { scopeLevel: "BRANCH", branchId },
        ],
    })
    const visibleTypes = new Set(["WORKING_DAY", "WEEKEND", ...existingTypes])

    return CALENDAR_DAY_TYPES
        .filter((value) => visibleTypes.has(value))
        .map((value) => ({ value, label: DAY_TYPE_LABELS[value] || value }))
}

export async function getAttendanceDailyEmailSchedule({ companyId, branchId, user }) {
    assertAttendanceScope(user, companyId, branchId)
    const [schedule, dayTypeOptions] = await Promise.all([
        AttendanceDailyEmailSchedule.findOne({ companyId, branchId }).lean(),
        getDayTypeOptions(companyId, branchId),
    ])
    return { ...publicSchedule(schedule), dayTypeOptions }
}

export async function saveAttendanceDailyEmailSchedule({ companyId, branchId, payload, user }) {
    assertAttendanceScope(user, companyId, branchId)

    const sendTime = String(payload.sendTime || "")
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) {
        throw new AppError({
            statusCode: 422,
            code: "INVALID_SEND_TIME",
            messageKey: "errors.validationFailed",
        })
    }

    const timeZone = validateTimeZone(String(payload.timeZone || DEFAULT_TIME_ZONE))
    const allowedDayTypes = [...new Set(payload.allowedDayTypes || [])]
    if (allowedDayTypes.some((value) => !CALENDAR_DAY_TYPES.includes(value))) {
        throw new AppError({ statusCode: 422, code: "INVALID_CALENDAR_DAY_TYPE", messageKey: "errors.validationFailed" })
    }
    const clock = localClock(new Date(), timeZone)
    const activeFromDate = clock.time >= sendTime ? nextCalendarDate(clock.date) : clock.date
    const schedule = await AttendanceDailyEmailSchedule.findOneAndUpdate(
        { companyId, branchId },
        {
            $set: {
                enabled: payload.enabled === true,
                sendTime,
                timeZone,
                allowedDayTypes,
                activeFromDate,
                configuredByAccountId: user.accountId,
                lastError: "",
            },
            $setOnInsert: { companyId, branchId },
        },
        { new: true, upsert: true, runValidators: true },
    ).lean()

    return { ...publicSchedule(schedule), dayTypeOptions: await getDayTypeOptions(companyId, branchId) }
}

async function claimSchedule(schedule, date, now) {
    const retryBefore = new Date(now.getTime() - RETRY_AFTER_MS)
    return AttendanceDailyEmailSchedule.findOneAndUpdate(
        {
            _id: schedule._id,
            enabled: true,
            lastSentDate: { $ne: date },
            $or: [
                { lastAttemptDate: { $ne: date } },
                { lastAttemptAt: { $lt: retryBefore } },
                { lastAttemptAt: null },
            ],
        },
        {
            $set: {
                lastAttemptDate: date,
                lastAttemptAt: now,
                lastError: "",
            },
        },
        { new: true },
    ).lean()
}

async function runSchedule(schedule, date, now) {
    const claimed = await claimSchedule(schedule, date, now)
    if (!claimed) return

    try {
        const account = await Account.findOne({
            _id: claimed.configuredByAccountId,
            status: "ACTIVE",
        }).lean()

        if (!account) throw new Error("The account that configured this schedule is no longer active.")

        const calendarDay = await resolveCalendarDay({
            query: {
                date,
                companyId: String(claimed.companyId),
                branchId: String(claimed.branchId),
            },
            user: { ...account, accountId: account._id },
        })
        const allowedDayTypes = Array.isArray(claimed.allowedDayTypes)
            ? claimed.allowedDayTypes
            : DEFAULT_ALLOWED_DAY_TYPES

        if (!allowedDayTypes.includes(calendarDay.dayType)) {
            await AttendanceDailyEmailSchedule.updateOne(
                { _id: claimed._id },
                {
                    $set: {
                        lastSentDate: date,
                        lastSkippedDate: date,
                        lastSkippedDayType: calendarDay.dayType,
                        lastError: "",
                    },
                },
            )
            console.log(`[attendance-email] skipped ${date} (${calendarDay.dayType})`)
            return
        }

        await sendAttendanceDailyEmail({
            date,
            companyId: claimed.companyId,
            branchId: claimed.branchId,
            force: false,
            user: { ...account, accountId: account._id },
            triggerType: "AUTOMATIC",
        })

        await AttendanceDailyEmailSchedule.updateOne(
            { _id: claimed._id },
            { $set: { lastSentDate: date, lastSentAt: new Date(), lastError: "" } },
        )
        console.log(`[attendance-email] automatic report sent for ${date}`)
    } catch (error) {
        if (error?.code === "ATTENDANCE_DAILY_EMAIL_ALREADY_SENT") {
            await AttendanceDailyEmailSchedule.updateOne(
                { _id: claimed._id },
                { $set: { lastSentDate: date, lastSentAt: new Date(), lastError: "" } },
            )
            return
        }

        const message = String(error?.message || "Automatic attendance email failed").slice(0, 1000)
        await AttendanceDailyEmailSchedule.updateOne(
            { _id: claimed._id },
            { $set: { lastError: message } },
        )
        console.error(`[attendance-email] automatic send failed for ${date}:`, message)
    }
}

export async function processDueAttendanceDailyEmailSchedules(now = new Date()) {
    const schedules = await AttendanceDailyEmailSchedule.find({ enabled: true }).lean()

    for (const schedule of schedules) {
        const clock = localClock(now, schedule.timeZone || DEFAULT_TIME_ZONE)
        if (
            clock.time < schedule.sendTime ||
            schedule.lastSentDate === clock.date ||
            (schedule.activeFromDate && clock.date < schedule.activeFromDate)
        ) continue
        await runSchedule(schedule, clock.date, now)
    }
}

export function startAttendanceDailyEmailScheduler() {
    let running = false

    const tick = async () => {
        if (running) return
        running = true
        try {
            await processDueAttendanceDailyEmailSchedules()
        } catch (error) {
            console.error("[attendance-email] scheduler check failed:", error)
        } finally {
            running = false
        }
    }

    void tick()
    const timer = setInterval(tick, 30_000)
    timer.unref()
    return () => clearInterval(timer)
}
