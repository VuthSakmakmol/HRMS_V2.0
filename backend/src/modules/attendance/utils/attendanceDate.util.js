const DEFAULT_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || "Asia/Phnom_Penh"

function partsInZone(date, timeZone = DEFAULT_TIME_ZONE) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    })
    const parts = Object.fromEntries(
        formatter.formatToParts(date).map((part) => [part.type, part.value]),
    )
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
    }
}

export function getBusinessTimeZone() {
    return DEFAULT_TIME_ZONE
}

export function assertDateKey(value) {
    const key = typeof value === "string" ? value.slice(0, 10) : toBusinessDateKey(value)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        throw new TypeError(`Invalid business date: ${value}`)
    }
    return key
}

export function toBusinessDateKey(value, timeZone = DEFAULT_TIME_ZONE) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value
    }
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) {
        throw new TypeError(`Invalid date: ${value}`)
    }
    const { year, month, day } = partsInZone(date, timeZone)
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function zonedDateTimeToUtc(dateKey, time = "00:00:00", timeZone = DEFAULT_TIME_ZONE) {
    const key = assertDateKey(dateKey)
    const [year, month, day] = key.split("-").map(Number)
    const [hour = 0, minute = 0, second = 0] = String(time).split(":").map(Number)
    const desiredUtcLike = Date.UTC(year, month - 1, day, hour, minute, second, 0)
    let candidate = new Date(desiredUtcLike)

    for (let attempt = 0; attempt < 4; attempt += 1) {
        const actual = partsInZone(candidate, timeZone)
        const actualUtcLike = Date.UTC(
            actual.year,
            actual.month - 1,
            actual.day,
            actual.hour,
            actual.minute,
            actual.second,
            0,
        )
        const difference = desiredUtcLike - actualUtcLike
        if (difference === 0) {
            break
        }
        candidate = new Date(candidate.getTime() + difference)
    }

    return candidate
}

export function startOfBusinessDay(value, timeZone = DEFAULT_TIME_ZONE) {
    return zonedDateTimeToUtc(assertDateKey(value), "00:00:00", timeZone)
}

export function endOfBusinessDay(value, timeZone = DEFAULT_TIME_ZONE) {
    const next = addBusinessDays(assertDateKey(value), 1)
    return new Date(startOfBusinessDay(next, timeZone).getTime() - 1)
}

export function addBusinessDays(value, amount) {
    const key = assertDateKey(value)
    const [year, month, day] = key.split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day + amount, 12, 0, 0, 0))
    return date.toISOString().slice(0, 10)
}

export function enumerateBusinessDates(dateFrom, dateTo) {
    const result = []
    for (let cursor = assertDateKey(dateFrom); cursor <= assertDateKey(dateTo); cursor = addBusinessDays(cursor, 1)) {
        result.push(cursor)
    }
    return result
}

export function combineBusinessDateAndTime(dateKey, time, addOneDay = false, timeZone = DEFAULT_TIME_ZONE) {
    return zonedDateTimeToUtc(
        addOneDay ? addBusinessDays(dateKey, 1) : assertDateKey(dateKey),
        `${time}:00`.slice(0, 8),
        timeZone,
    )
}

export function businessWeekday(value, timeZone = DEFAULT_TIME_ZONE) {
    const date = startOfBusinessDay(value, timeZone)
    const short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date)
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short)
}
