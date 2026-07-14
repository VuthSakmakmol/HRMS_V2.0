import {
    verifyAttendanceRange as runAttendanceVerification,
} from "./attendanceVerification.service.js"

export async function verifyAttendanceRange({ payload, user }) {
    return runAttendanceVerification({ payload, user })
}
