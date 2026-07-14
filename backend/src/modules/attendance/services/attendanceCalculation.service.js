import {
    combineBusinessDateAndTime,
} from "../utils/attendanceDate.util.js"

const MINUTE_MS = 60_000

function roundMinutes(value, unit = 1, method = "CEIL") {
    if (!Number.isFinite(value) || value <= 0) {
        return 0
    }
    const safeUnit = Math.max(1, Number(unit) || 1)
    const ratio = value / safeUnit
    if (method === "FLOOR") return Math.floor(ratio) * safeUnit
    if (method === "NEAREST") return Math.round(ratio) * safeUnit
    return Math.ceil(ratio) * safeUnit
}

function unique(values) {
    return [...new Set(values.filter(Boolean))]
}

export function buildShiftSchedule({ workDate, shift }) {
    const scheduledStartAt = combineBusinessDateAndTime(workDate, shift.startTime)
    const scheduledEndAt = combineBusinessDateAndTime(
        workDate,
        shift.endTime,
        Boolean(shift.isOvernight),
    )
    const preShiftWindowMinutes = Number(shift.preShiftWindowMinutes ?? 240)
    const postShiftWindowMinutes = Number(shift.postShiftWindowMinutes ?? 240)

    return {
        scheduledStartAt,
        scheduledEndAt,
        scanWindowStartAt: new Date(scheduledStartAt.getTime() - preShiftWindowMinutes * MINUTE_MS),
        scanWindowEndAt: new Date(scheduledEndAt.getTime() + postShiftWindowMinutes * MINUTE_MS),
    }
}

function pickScanPair(scans) {
    const ordered = [...scans].sort(
        (left, right) => new Date(left.scannedAt) - new Date(right.scannedAt),
    )
    const issueCodes = []
    if (ordered.length === 0) {
        return { firstInAt: null, lastOutAt: null, ordered, issueCodes }
    }

    const explicitIns = ordered.filter((scan) => scan.direction === "IN")
    const explicitOuts = ordered.filter((scan) => scan.direction === "OUT")
    if (explicitIns.length > 1) issueCodes.push("MULTIPLE_IN_SCANS")
    if (explicitOuts.length > 1) issueCodes.push("MULTIPLE_OUT_SCANS")

    const firstInAt = explicitIns[0]?.scannedAt || ordered[0]?.scannedAt || null
    const lastOutAt = explicitOuts.at(-1)?.scannedAt || (ordered.length > 1 ? ordered.at(-1)?.scannedAt : null)

    if (ordered.length === 1) issueCodes.push("SINGLE_SCAN")
    if (!firstInAt) issueCodes.push("NO_IN_SCAN")
    if (!lastOutAt) issueCodes.push("NO_OUT_SCAN")
    if (firstInAt && lastOutAt && new Date(lastOutAt) <= new Date(firstInAt)) {
        issueCodes.push("OUT_BEFORE_IN")
    }

    return { firstInAt, lastOutAt, ordered, issueCodes: unique(issueCodes) }
}

export function calculateAttendanceResult({
    workDate,
    shift,
    policy,
    dayType = "WORKING_DAY",
    scans = [],
    correctedTimes = null,
}) {
    const schedule = buildShiftSchedule({ workDate, shift })
    const paired = correctedTimes
        ? {
              firstInAt: correctedTimes.firstInAt || null,
              lastOutAt: correctedTimes.lastOutAt || null,
              ordered: [],
              issueCodes: [],
          }
        : pickScanPair(scans)

    const firstInAt = paired.firstInAt ? new Date(paired.firstInAt) : null
    const lastOutAt = paired.lastOutAt ? new Date(paired.lastOutAt) : null
    const issueCodes = [...paired.issueCodes]
    const rawScanIds = paired.ordered.map((scan) => scan._id).filter(Boolean)

    if (!firstInAt && !lastOutAt) {
        if (dayType !== "WORKING_DAY") {
            return {
                ...schedule,
                firstInAt: null,
                lastOutAt: null,
                workedMinutes: 0,
                lateMinutes: 0,
                earlyLeaveMinutes: 0,
                dayType,
                status: dayType === "HOLIDAY" ? "HOLIDAY" : "REST_DAY",
                verificationStatus: "VERIFIED",
                issueCodes: [],
                rawScanIds,
            }
        }

        if (policy?.autoGenerateAbsent === false) {
            return null
        }

        return {
            ...schedule,
            firstInAt: null,
            lastOutAt: null,
            workedMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            dayType,
            status: "ABSENT",
            verificationStatus: "VERIFIED",
            issueCodes: [],
            rawScanIds,
        }
    }

    if (!firstInAt) {
        issueCodes.push("NO_IN_SCAN")
        return {
            ...schedule,
            firstInAt: null,
            lastOutAt,
            workedMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            dayType,
            status: "MISSING_IN",
            verificationStatus: "NEEDS_REVIEW",
            issueCodes: unique(issueCodes),
            rawScanIds,
        }
    }

    if (!lastOutAt || lastOutAt.getTime() === firstInAt.getTime()) {
        issueCodes.push("NO_OUT_SCAN")
        return {
            ...schedule,
            firstInAt,
            lastOutAt: null,
            workedMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            dayType,
            status: "MISSING_OUT",
            verificationStatus: "NEEDS_REVIEW",
            issueCodes: unique(issueCodes),
            rawScanIds,
        }
    }

    if (lastOutAt < firstInAt) {
        issueCodes.push("OUT_BEFORE_IN")
        return {
            ...schedule,
            firstInAt,
            lastOutAt,
            workedMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            dayType,
            status: "MISSING_OUT",
            verificationStatus: "NEEDS_REVIEW",
            issueCodes: unique(issueCodes),
            rawScanIds,
        }
    }

    const workedMinutes = Math.max(0, Math.round((lastOutAt - firstInAt) / MINUTE_MS))
    const graceIn = Number(policy?.graceInMinutes ?? shift.graceInMinutes ?? 0)
    const graceOut = Number(policy?.graceOutMinutes ?? shift.graceOutMinutes ?? 0)
    const lateThreshold = new Date(schedule.scheduledStartAt.getTime() + graceIn * MINUTE_MS)
    const earlyThreshold = new Date(schedule.scheduledEndAt.getTime() - graceOut * MINUTE_MS)
    const rawLate = firstInAt > lateThreshold
        ? Math.round((firstInAt - schedule.scheduledStartAt) / MINUTE_MS)
        : 0
    const rawEarly = lastOutAt < earlyThreshold
        ? Math.round((schedule.scheduledEndAt - lastOutAt) / MINUTE_MS)
        : 0
    const lateMinutes = roundMinutes(rawLate, policy?.lateRoundUnitMinutes, policy?.lateRoundMethod)
    const earlyLeaveMinutes = roundMinutes(rawEarly, policy?.earlyLeaveRoundUnitMinutes, policy?.earlyLeaveRoundMethod)

    let status = "PRESENT"
    if (lateMinutes > 0 && earlyLeaveMinutes > 0) status = "LATE_AND_EARLY_LEAVE"
    else if (lateMinutes > 0) status = "LATE"
    else if (earlyLeaveMinutes > 0) status = "EARLY_LEAVE"

    if (workedMinutes > 24 * 60) issueCodes.push("EXCESSIVE_WORK_DURATION")
    if (Number(policy?.minimumWorkedMinutes) > 0 && workedMinutes < policy.minimumWorkedMinutes) {
        issueCodes.push("INSUFFICIENT_WORKED_MINUTES")
    }

    return {
        ...schedule,
        firstInAt,
        lastOutAt,
        workedMinutes,
        lateMinutes,
        earlyLeaveMinutes,
        dayType,
        status,
        verificationStatus: issueCodes.length > 0 ? "NEEDS_REVIEW" : "VERIFIED",
        issueCodes: unique(issueCodes),
        rawScanIds,
    }
}
