import AttendancePayrollSchedule from "../../attendance/models/AttendancePayrollSchedule.js"
import { addBusinessDays, toBusinessDateKey } from "../../attendance/utils/attendanceDate.util.js"
import {
    autoReturnMaternityEmployees,
    evaluateAbandonmentForWorkspace,
} from "./employeeLifecycle.service.js"

const INTERVAL_MS = 15 * 60 * 1000
let timer = null
let running = false

async function runEmployeeLifecycleCycle() {
    if (running) return
    running = true
    try {
        await autoReturnMaternityEmployees()

        const todayKey = toBusinessDateKey(new Date())
        const yesterdayKey = addBusinessDays(todayKey, -1)
        const schedules = await AttendancePayrollSchedule.find({
            lastImportedDate: { $ne: null },
            lastSuccessAt: { $ne: null },
        })
            .select("companyId branchId lastImportedDate")
            .lean()

        for (const schedule of schedules) {
            const importedKey = String(schedule.lastImportedDate || "")
            if (!/^\d{4}-\d{2}-\d{2}$/.test(importedKey)) continue
            const throughDate = importedKey < yesterdayKey ? importedKey : yesterdayKey
            if (!throughDate) continue
            await evaluateAbandonmentForWorkspace({
                companyId: schedule.companyId,
                branchId: schedule.branchId,
                throughDate,
            })
        }
    } catch (error) {
        console.error("[employee-lifecycle] cycle failed:", error)
    } finally {
        running = false
    }
}

export function startEmployeeLifecycleScheduler() {
    if (timer) return timer
    void runEmployeeLifecycleCycle()
    timer = setInterval(() => void runEmployeeLifecycleCycle(), INTERVAL_MS)
    timer.unref?.()
    return timer
}

export function stopEmployeeLifecycleScheduler() {
    if (!timer) return
    clearInterval(timer)
    timer = null
}
