import AttendanceRawScan from "../models/AttendanceRawScan.js"
import Employee from "../../employee/models/Employee.js"
import { verifyAttendanceRange } from "./attendanceBatch.service.js"
import { toBusinessDateKey } from "../utils/attendanceDate.util.js"

async function recalculateAffectedAttendance(validScans, employeeMap) {
    const groups = new Map()

    for (const scan of validScans) {
        const employee = employeeMap.get(scan.employeeCode)
        const key = `${employee.companyId}:${employee.branchId}`
        const workDate = toBusinessDateKey(new Date(scan.scannedAt))
        const group = groups.get(key) || {
            companyId: String(employee.companyId),
            branchId: String(employee.branchId),
            dateFrom: workDate,
            dateTo: workDate,
        }

        if (workDate < group.dateFrom) group.dateFrom = workDate
        if (workDate > group.dateTo) group.dateTo = workDate
        groups.set(key, group)
    }

    const summaries = []
    const systemUser = {
        accountId: null,
        isRootAdmin: true,
        roleAssignments: [],
    }

    for (const group of groups.values()) {
        const summary = await verifyAttendanceRange({
            payload: {
                ...group,
                overwriteCorrected: false,
            },
            user: systemUser,
        })
        summaries.push({
            companyId: group.companyId,
            branchId: group.branchId,
            dateFrom: group.dateFrom,
            dateTo: group.dateTo,
            ...summary,
        })
    }

    return summaries
}

export async function syncAgentScans({ payload }) {
    const employeeCodes = [...new Set(payload.scans.map((scan) => scan.employeeCode))]
    const employees = await Employee.find({
        employeeCode: { $in: employeeCodes },
        recordStatus: "ACTIVE",
    })
        .select("_id employeeCode companyId branchId")
        .lean()

    const employeeMap = new Map(
        employees.map((employee) => [employee.employeeCode, employee]),
    )
    const unknownEmployeeCodes = employeeCodes.filter(
        (employeeCode) => !employeeMap.has(employeeCode),
    )
    const validScans = payload.scans.filter((scan) =>
        employeeMap.has(scan.employeeCode),
    )

    const operations = validScans.map((scan) => {
        const employee = employeeMap.get(scan.employeeCode)
        const scannedAt = new Date(scan.scannedAt)

        return {
            updateOne: {
                filter: {
                    employeeCode: scan.employeeCode,
                    scannedAt,
                    deviceCode: scan.deviceCode,
                },
                update: {
                    $setOnInsert: {
                        employeeId: employee._id,
                        companyId: employee.companyId,
                        branchId: employee.branchId,
                        employeeCode: scan.employeeCode,
                        scannedAt,
                        deviceCode: scan.deviceCode,
                        direction: scan.direction,
                        source: "MACHINE_SYNC",
                        importBatchId: payload.batchId,
                        createdByAccountId: null,
                    },
                },
                upsert: true,
            },
        }
    })

    let insertedCount = 0

    if (operations.length) {
        const result = await AttendanceRawScan.bulkWrite(operations, {
            ordered: false,
        })
        insertedCount = result.upsertedCount || 0
    }

    const recalculationSummaries = await recalculateAffectedAttendance(
        validScans,
        employeeMap,
    )

    return {
        batchId: payload.batchId,
        receivedCount: payload.scans.length,
        acceptedCount: validScans.length,
        insertedCount,
        duplicateCount: Math.max(0, validScans.length - insertedCount),
        unknownEmployeeCount:
            payload.scans.length - validScans.length,
        unknownEmployeeCodes,
        recalculationSummaries,
    }
}
