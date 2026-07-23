import nodemailer from "nodemailer"

import Account from "../../access/models/Account.js"
import HrDashboardTarget from "../../hrDashboardTarget/models/HrDashboardTarget.js"
import AttendanceImportIssue from "../models/AttendanceImportIssue.js"
import AttendanceDailyEmailLog from "../models/AttendanceDailyEmailLog.js"
import AttendanceRecord from "../models/AttendanceRecord.js"
import { env } from "../../../config/env.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    startOfBusinessDay,
    endOfBusinessDay,
    toBusinessDateKey,
} from "../utils/attendanceDate.util.js"
import { assertAttendanceScope } from "../utils/attendanceScope.util.js"
import {
    buildAttendanceDailyReport,
    buildAttendanceDailyReportWorkbook,
} from "./attendanceDailyReport.service.js"

function emailRecipients() {
    const to = env.ATTENDANCE_EMAIL_TO
    const cc = String(env.ATTENDANCE_EMAIL_CC || "")
        .split(",")
        .map((address) => address.trim())
        .filter(Boolean)

    if (!to) {
        throw new AppError({
            statusCode: 503,
            code: "ATTENDANCE_EMAIL_NOT_CONFIGURED",
            messageKey: "errors.attendance.emailNotConfigured",
        })
    }

    return { to, cc }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
}

function transporter() {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) {
        throw new AppError({
            statusCode: 503,
            code: "ATTENDANCE_EMAIL_NOT_CONFIGURED",
            messageKey: "errors.attendance.emailNotConfigured",
        })
    }

    return nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
        connectionTimeout: 30_000,
        greetingTimeout: 30_000,
        socketTimeout: 60_000,
    })
}

function formatNumber(value) {
    return Math.round(Number(value || 0)).toLocaleString("en-US")
}

function percentText(value) {
    return value === null || value === undefined ? "" : `${Number(value).toFixed(1)}%`
}

function rateColor(value, targetRate) {
    if (value === null || value === undefined) return "#c6efd8"
    if (targetRate === null) return "#c6efce"
    if (Number(value) < Math.max(targetRate - 2, 0)) return "#c6efce"
    if (Number(value) < targetRate) return "#ffeb9c"
    return "#ffc7ce"
}

function formatReportDate(date) {
    const [year, month, day] = date.split("-").map(Number)
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)))
}

function compactReportDate(date) {
    const [year, month, day] = date.split("-")
    return `${day}${month}${year}`
}

async function resolveLatestAttendanceDate({ companyId, branchId, requestedDate }) {
    const month = requestedDate.slice(0, 7)
    const firstDate = `${month}-01`
    const [year, monthNumber] = month.split("-").map(Number)
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
    const lastDate = `${month}-${String(lastDay).padStart(2, "0")}`

    const latest = await AttendanceRecord.findOne({
        companyId,
        branchId,
        attendanceDate: {
            $gte: startOfBusinessDay(firstDate),
            $lte: endOfBusinessDay(lastDate),
        },
    })
        .sort({ attendanceDate: -1 })
        .select("attendanceDate")
        .lean()

    if (!latest?.attendanceDate) {
        throw new AppError({
            statusCode: 422,
            code: "ATTENDANCE_REPORT_NO_DATA",
            messageKey: "errors.attendance.reportNoData",
        })
    }

    return toBusinessDateKey(latest.attendanceDate)
}

async function loadAttendanceTarget({ companyId, branchId, date }) {
    const [year, month] = date.split("-").map(Number)
    const targets = await HrDashboardTarget.find({
        companyId,
        branchId,
        metric: "ABSENCE_RATE",
        year,
        status: "ACTIVE",
        month: { $in: [month, 0] },
        targetScope: "OVERALL",
        employeeTypeId: null,
    })
        .sort({ month: -1, updatedAt: -1 })
        .select("targetRate month")
        .lean()

    return targets.length ? Number(targets[0].targetRate) : null
}

function reportHtml({ date, report, attendanceTarget }) {
    const cell = "border:1px solid #86acd0;padding:4px 5px;text-align:center;white-space:nowrap;font-size:11px"
    const labelCell = `${cell};text-align:left;min-width:210px;background:#275988;color:#fff`
    const headCell = `${cell};background:#185487;color:#fff;font-weight:700`
    const dayHeaders = report.days.map((day) => (
        `<th style="${headCell};${day.working ? "" : "background:#c6efd8;color:#185487"}">${day.day}</th>`
    )).join("")
    const row = (label, values, average, percent = false, labelStyle = "") => {
        const valuesHtml = values.map((value) => {
            const background = percent ? rateColor(value, attendanceTarget) : (value === null ? "#c6efd8" : "#185487")
            const color = percent ? (attendanceTarget !== null && Number(value) >= attendanceTarget ? "#d00000" : "#006100") : "#fff"
            const text = percent ? percentText(value) : (value === null ? "" : formatNumber(value))
            return `<td style="${cell};background:${background};color:${color}">${text}</td>`
        }).join("")
        const averageText = percent ? percentText(average) : formatNumber(average)
        return `<tr><td style="${labelCell};${labelStyle}">${escapeHtml(label)}</td>${valuesHtml}<td style="${cell};background:${percent ? rateColor(average, attendanceTarget) : "#185487"};color:${percent && attendanceTarget !== null && Number(average) >= attendanceTarget ? "#d00000" : percent ? "#006100" : "#fff"}">${averageText}</td></tr>`
    }
    const section = (label) => `<tr><td colspan="${report.days.length + 2}" style="${labelCell};font-weight:700">${escapeHtml(label)}</td></tr>`

    const dayIndex = report.days.findIndex((day) => day.key === date)
    const overallRate = report.summary.absentRate[dayIndex]
    const sewerRate = report.sewerAbsentRate.totalAbsentRate[dayIndex]
    const targetText = attendanceTarget === null ? "Target not configured" : `Target &lt; ${percentText(attendanceTarget)}`

    return `<!doctype html><html><body style="margin:0;background:#fff;font-family:Arial,sans-serif;color:#17365d">
<div style="margin:16px;background:#fff;padding:2px">
<p style="font-size:16px;margin:0 0 28px">${escapeHtml(env.ATTENDANCE_EMAIL_GREETING)}</p>
<p style="font-size:16px;margin:0 0 8px">${escapeHtml(env.ATTENDANCE_EMAIL_INTRO)} <span style="background:#fff200;padding:2px 5px">${escapeHtml(formatReportDate(date))}</span></p>
<div style="font-size:16px;margin:0 0 26px;padding-left:30px;line-height:1.55">
<div>- &nbsp; ${escapeHtml(env.ATTENDANCE_EMAIL_OVERALL_LABEL)} <span style="background:#fff200;padding:1px 4px">${percentText(overallRate)}</span> &nbsp; (${targetText})</div>
<div>- &nbsp; ${escapeHtml(env.ATTENDANCE_EMAIL_SEWER_LABEL)} <span style="background:#fff200;padding:1px 4px">${percentText(sewerRate)}</span></div>
</div>
<div style="overflow-x:auto"><table role="presentation" style="border-collapse:collapse;width:100%"><thead><tr><th style="${headCell};text-align:left">Daily Summary</th>${dayHeaders}<th style="${headCell}">Avg</th></tr></thead><tbody>
${row("TOTAL EMPLOYEE", report.summary.totalEmployees, report.summary.averages.totalEmployees)}
${row("FACE SCAN", report.summary.faceScans, report.summary.averages.faceScans)}
${row("- MATERNITY LEAVE", report.summary.leaves.ML, report.summary.averages.leaves.ML)}
${row("- ANNUAL LEAVE", report.summary.leaves.AL, report.summary.averages.leaves.AL)}
${row("- UNPAID LEAVE", report.summary.leaves.UL, report.summary.averages.leaves.UL)}
${row("- SICK LEAVE", report.summary.leaves.SL, report.summary.averages.leaves.SL)}
${row("ABSENT RATE", report.summary.absentRate, report.summary.averages.absentRate, true, "background:#d00000;font-weight:700")}
${section("FORGET FINGER SCAN")}
${report.groupRows.map((item) => row(item.label, item.values, item.average, true)).join("")}
${section("SEWER ABSENT RATE")}
${row("TOTAL SEWER", report.sewerAbsentRate.totalSewer, report.sewerAbsentRate.averages.totalSewer)}
${row("- MATERNITY LEAVE", report.sewerAbsentRate.maternityLeaveRate, report.sewerAbsentRate.averages.maternityLeaveRate, true)}
${row("- ANNUAL LEAVE / UNPAID", report.sewerAbsentRate.annualUnpaidLeaveRate, report.sewerAbsentRate.averages.annualUnpaidLeaveRate, true)}
${row("- SICK LEAVE", report.sewerAbsentRate.sickLeaveRate, report.sewerAbsentRate.averages.sickLeaveRate, true)}
${row("- ABSENT WITHOUT INFORM", report.sewerAbsentRate.absentWithoutInformRate, report.sewerAbsentRate.averages.absentWithoutInformRate, true)}
${row("SEWER COME", report.sewerAbsentRate.sewerCome, report.sewerAbsentRate.averages.sewerCome)}
${row("TOTAL ABSENT RATE", report.sewerAbsentRate.totalAbsentRate, report.sewerAbsentRate.averages.totalAbsentRate, true, "background:#ffdc73;color:#664d00;font-weight:700")}
</tbody></table></div></div></body></html>`
}

export async function getAttendanceDailyEmailStatus({ date, companyId, branchId, user }) {
    assertAttendanceScope(user, companyId, branchId)
    const { to } = emailRecipients()
    const reportDate = await resolveLatestAttendanceDate({
        companyId,
        branchId,
        requestedDate: date,
    })
    const latest = await AttendanceDailyEmailLog.findOne({
        companyId,
        branchId,
        reportDate,
        to,
    }).sort({ sentAt: -1 }).lean()

    return latest ? {
        sent: true,
        reportDate,
        sentAt: latest.sentAt,
        sentByName: latest.sentByName,
    } : { sent: false, reportDate }
}

export async function sendAttendanceDailyEmail({
    date,
    companyId,
    branchId,
    force,
    user,
    triggerType = "MANUAL",
}) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
        throw new AppError({ statusCode: 422, code: "VALIDATION_FAILED", messageKey: "errors.validationFailed" })
    }
    assertAttendanceScope(user, companyId, branchId)
    const { to, cc } = emailRecipients()
    const reportDate = await resolveLatestAttendanceDate({
        companyId,
        branchId,
        requestedDate: date,
    })

    const existing = await AttendanceDailyEmailLog.findOne({
        companyId,
        branchId,
        reportDate,
        to,
    }).sort({ sentAt: -1 }).lean()

    if (existing && !force) {
        throw new AppError({
            statusCode: 409,
            code: "ATTENDANCE_DAILY_EMAIL_ALREADY_SENT",
            messageKey: "errors.attendance.dailyEmailAlreadySent",
            details: { sentAt: existing.sentAt, sentByName: existing.sentByName },
        })
    }

    const month = reportDate.slice(0, 7)
    const report = await buildAttendanceDailyReport({ query: { month, companyId, branchId }, user })
    const dayIndex = report.days.findIndex((day) => day.key === reportDate)
    if (dayIndex < 0) {
        throw new AppError({ statusCode: 422, code: "REPORT_DATE_NOT_FOUND", messageKey: "errors.validationFailed" })
    }

    const [account, unmatched] = await Promise.all([
        Account.findById(user.accountId).select("displayName loginId").lean(),
        AttendanceImportIssue.countDocuments({
            companyId,
            branchId,
            attendanceDate: { $gte: startOfBusinessDay(reportDate), $lte: endOfBusinessDay(reportDate) },
            status: "NO_EMPLOYEE_MATCH",
        }),
    ])
    const attendanceTarget = report.attendanceTarget?.rate ?? await loadAttendanceTarget({
        companyId,
        branchId,
        date: reportDate,
    })

    const leave = report.summary.leaves
    const totalEmployees = report.summary.totalEmployees[dayIndex] || 0
    const faceScans = report.summary.faceScans[dayIndex] || 0
    const annualLeave = leave.AL[dayIndex] || 0
    const maternityLeave = leave.ML[dayIndex] || 0
    const sickLeave = leave.SL[dayIndex] || 0
    const unpaidLeave = leave.UL[dayIndex] || 0
    const summary = {
        totalEmployees,
        faceScans,
        absent: Math.max(
            totalEmployees - faceScans - annualLeave - maternityLeave - sickLeave - unpaidLeave,
            0,
        ),
        annualLeave,
        maternityLeave,
        sickLeave,
        unpaidLeave,
        unmatched,
    }
    const senderName = triggerType === "AUTOMATIC"
        ? "Automatic attendance schedule"
        : account?.displayName || account?.loginId || user.displayName || "HRMS user"
    const subject = `${env.ATTENDANCE_EMAIL_SUBJECT_PREFIX} ${formatReportDate(reportDate).replaceAll(" ", "-")}`
    const workbook = await buildAttendanceDailyReportWorkbook(report)
    const workbookBuffer = Buffer.from(await workbook.xlsx.writeBuffer())
    const info = await transporter().sendMail({
        from: env.SMTP_FROM,
        to,
        cc,
        subject,
        html: reportHtml({ date: reportDate, report, attendanceTarget }),
        attachments: [
            {
                filename: `Daily_Att_Report_${compactReportDate(reportDate)}.xlsx`,
                content: workbookBuffer,
                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
        ],
    })

    const log = await AttendanceDailyEmailLog.create({
        companyId,
        branchId,
        reportDate,
        to,
        cc,
        subject,
        messageId: info.messageId || "",
        summarySnapshot: summary,
        sentByAccountId: user.accountId,
        sentByName: senderName,
        triggerType,
        sentAt: new Date(),
    })

    return {
        log,
        reportDate,
        requestedDate: date,
        attendanceTarget,
        summary,
        recipients: { to, cc },
    }
}
