export const ATTENDANCE_PERMISSIONS = Object.freeze({
    RECORD_VIEW: "ATTENDANCE.RECORD.VIEW",
    RECORD_CREATE: "ATTENDANCE.RECORD.CREATE",
    RECORD_UPDATE: "ATTENDANCE.RECORD.UPDATE",
    RECORD_IMPORT: "ATTENDANCE.RECORD.IMPORT",
    RECORD_EXPORT: "ATTENDANCE.RECORD.EXPORT",
    POLICY_CREATE: "ATTENDANCE.POLICY.CREATE",
    POLICY_UPDATE: "ATTENDANCE.POLICY.UPDATE",
    POLICY_ARCHIVE: "ATTENDANCE.POLICY.ARCHIVE",
    SCAN_IMPORT: "ATTENDANCE.SCAN.IMPORT",
    VERIFICATION_RUN: "ATTENDANCE.VERIFICATION.RUN",
})

export const attendanceColumns = [
    { field: "attendanceDate", header: "Date", frozen: true, width: "8rem", minWidth: "8rem" },
    { field: "employeeCode", header: "Employee ID", width: "9rem", minWidth: "9rem" },
    { field: "employeeName", header: "Employee", width: "14rem", minWidth: "14rem" },
    { field: "department", header: "Department", width: "12rem", minWidth: "12rem" },
    { field: "position", header: "Position", width: "12rem", minWidth: "12rem" },
    { field: "line", header: "Line", width: "10rem", minWidth: "10rem" },
    { field: "shift", header: "Shift", width: "9rem", minWidth: "9rem" },
    { field: "firstInAt", header: "First In", width: "8rem", minWidth: "8rem" },
    { field: "lastOutAt", header: "Last Out", width: "8rem", minWidth: "8rem" },
    { field: "vacation", header: "Vacation", width: "10rem", minWidth: "10rem" },
    { field: "workedMinutes", header: "Worked", width: "8rem", minWidth: "8rem" },
    { field: "lateMinutes", header: "Late", width: "7rem", minWidth: "7rem" },
    { field: "earlyLeaveMinutes", header: "Early Leave", width: "8rem", minWidth: "8rem" },
    { field: "status", header: "Status", width: "11rem", minWidth: "11rem" },
    { field: "verificationStatus", header: "Verification", width: "10rem", minWidth: "10rem" },
    { field: "source", header: "Source", width: "9rem", minWidth: "9rem" },
]

export const attendanceStatusOptions = ["ALL", "PRESENT", "LATE", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE", "MISSING_IN", "MISSING_OUT", "ABSENT", "REST_DAY", "HOLIDAY"].map((value) => ({ label: value.replaceAll("_", " "), value }))
export const verificationOptions = ["ALL", "VERIFIED", "NEEDS_REVIEW", "CORRECTED"].map((value) => ({ label: value.replaceAll("_", " "), value }))

export const rawScanColumns = [
    { field: "employeeCode", header: "Employee ID", frozen: true, width: "10rem", minWidth: "10rem" },
    { field: "employeeName", header: "Employee", width: "14rem", minWidth: "14rem" },
    { field: "scannedAt", header: "Scanned At", width: "12rem", minWidth: "12rem" },
    { field: "direction", header: "Direction", width: "8rem", minWidth: "8rem" },
    { field: "deviceCode", header: "Device", width: "11rem", minWidth: "11rem" },
    { field: "source", header: "Source", width: "10rem", minWidth: "10rem" },
    { field: "importBatchId", header: "Import Batch", width: "18rem", minWidth: "18rem" },
]
