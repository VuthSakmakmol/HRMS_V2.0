import AttendanceImportIssue from "../models/AttendanceImportIssue.js"
import { endOfBusinessDay, startOfBusinessDay } from "../utils/attendanceDate.util.js"
import { attendanceScopeFilter } from "../utils/attendanceScope.util.js"

function buildImportIssueFilter(query, user) {
    const filter = {
        ...attendanceScopeFilter(user),
    }

    if (query.companyId) filter.companyId = query.companyId
    if (query.branchId) filter.branchId = query.branchId
    if (query.status !== "ALL") filter.status = query.status
    if (query.dateFrom || query.dateTo) {
        filter.attendanceDate = {}
        if (query.dateFrom) {
            filter.attendanceDate.$gte = startOfBusinessDay(query.dateFrom)
        }
        if (query.dateTo) {
            filter.attendanceDate.$lte = endOfBusinessDay(query.dateTo)
        }
    }
    if (query.search) {
        filter.employeeCode = { $regex: query.search, $options: "i" }
    }

    return filter
}

function mapImportIssue(item) {
    return {
        ...item,
        id: item._id.toString(),
        _id: undefined,
        importBatchId: item.importBatchId.toString(),
    }
}

export async function listAttendanceImportIssues({ query, user }) {
    const filter = buildImportIssueFilter(query, user)
    const skip = (query.page - 1) * query.limit
    const [items, total] = await Promise.all([
        AttendanceImportIssue.find(filter)
            .sort({ attendanceDate: -1, sourceRow: 1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        AttendanceImportIssue.countDocuments(filter),
    ])

    return {
        items: items.map(mapImportIssue),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
    }
}

export async function getAttendanceImportIssueExportRows({ query, user }) {
    const filter = buildImportIssueFilter(query, user)
    const items = await AttendanceImportIssue.find(filter)
        .sort({ attendanceDate: -1, employeeCode: 1, sourceRow: 1 })
        .limit(50_000)
        .lean()

    return items.map(mapImportIssue)
}
