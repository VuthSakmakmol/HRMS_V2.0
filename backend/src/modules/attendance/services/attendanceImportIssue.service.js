import AttendanceImportIssue from "../models/AttendanceImportIssue.js"
import { attendanceScopeFilter } from "../utils/attendanceScope.util.js"

export async function listAttendanceImportIssues({ query, user }) {
    const filter = {
        ...attendanceScopeFilter(user),
    }

    if (query.companyId) filter.companyId = query.companyId
    if (query.branchId) filter.branchId = query.branchId
    if (query.status !== "ALL") filter.status = query.status
    if (query.search) {
        filter.employeeCode = { $regex: query.search, $options: "i" }
    }

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
        items: items.map((item) => ({
            ...item,
            id: item._id.toString(),
            _id: undefined,
            importBatchId: item.importBatchId.toString(),
        })),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
    }
}
