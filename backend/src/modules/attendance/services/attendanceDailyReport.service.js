import ExcelJS from "exceljs";

import Employee from "../../employee/models/Employee.js";
import Department from "../../organization/models/Department.js";
import Position from "../../organization/models/Position.js";
import CalendarDay from "../../calendar/models/CalendarDay.js";
import HrDashboardTarget from "../../hrDashboardTarget/models/HrDashboardTarget.js";
import AttendanceRecord from "../models/AttendanceRecord.js";
import { AppError } from "../../../shared/errors/AppError.js";
import {
  attendanceScopeFilter,
  assertAttendanceScope,
} from "../utils/attendanceScope.util.js";
import {
  endOfBusinessDay,
  startOfBusinessDay,
  toBusinessDateKey,
} from "../utils/attendanceDate.util.js";

const LEAVE_CODES = ["ML", "AL", "UL", "SL"];
const FACE_SCAN_EMPLOYMENT_STATUS = "WORKING";
const MATERNITY_LEAVE_EMPLOYMENT_STATUS = "MATERNITY_LEAVE";
const SEWER_POSITION_TITLES = new Set(["SEWER", "SEWER-JUMPER"]);
const CODE_ALIASES = {
  MATERNITY: "ML",
  MATERNITY_LEAVE: "ML",
  ML: "ML",
  ANNUAL: "AL",
  ANNUAL_LEAVE: "AL",
  AL: "AL",
  UNPAID: "UL",
  UNPAID_LEAVE: "UL",
  UL: "UL",
  SICK: "SL",
  SICK_LEAVE: "SL",
  SL: "SL",
};

function dateKey(date) {
  return toBusinessDateKey(date);
}

function monthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month || "")) {
    throw new AppError({
      statusCode: 422,
      code: "VALIDATION_FAILED",
      messageKey: "errors.validationFailed",
    });
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const firstKey = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const lastKey = `${year}-${String(monthNumber).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const start = startOfBusinessDay(firstKey);
  const end = endOfBusinessDay(lastKey);
  const days = Array.from({ length: lastDay }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 1, index + 1));
    const key = `${year}-${String(monthNumber).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
    return { key, day: index + 1, weekday: date.getUTCDay() };
  });
  return { start, end, days };
}

function normalizedCode(record) {
  const value =
    record.absenceCode ||
    record.leaveCode ||
    record.leaveTypeCode ||
    record.attendanceCode ||
    record.correctionCode;
  return (
    CODE_ALIASES[
      String(value || "")
        .trim()
        .replace(/[\s-]+/g, "_")
        .toUpperCase()
    ] || (record.status === "ABSENT" ? "AB" : "")
  );
}

function average(values, workingIndexes) {
  const actual = workingIndexes.map((index) => Number(values[index] || 0));
  return actual.length
    ? actual.reduce((sum, value) => sum + value, 0) / actual.length
    : 0;
}

function activeOnDay(employee, dayStart, dayEnd) {
  return (
    employee.joinDate <= dayEnd &&
    (!employee.resignDate || employee.resignDate >= dayStart)
  );
}

function employeeId(value) {
  return String(value.employeeId || value._id || "");
}

function uniqueEmployeeCount(rows) {
  return new Set(rows.map(employeeId).filter(Boolean)).size;
}

function hasAnyFaceScan(record) {
  return Boolean(record.firstInAt || record.lastOutAt);
}

function normalizedPositionTitle(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

function attendancePresence(expectedEmployees, rows) {
  const expectedEmployeeIds = new Set(
    expectedEmployees.map(employeeId).filter(Boolean),
  );
  const scannedEmployeeIds = new Set(
    rows
      .filter(hasAnyFaceScan)
      .map(employeeId)
      .filter((id) => id && expectedEmployeeIds.has(id)),
  );

  // A WORKING employee is present when at least one scan exists. They are
  // absent only when both scans are blank (or no scan row was received).
  // Leave/vacation codes remain report history and never override this rule.
  return {
    faceScans: scannedEmployeeIds.size,
    absent: Math.max(expectedEmployeeIds.size - scannedEmployeeIds.size, 0),
  };
}

export async function buildAttendanceDailyReport({
  query,
  user,
  onProgress = () => {},
}) {
  const companyId = query.companyId;
  const branchId = query.branchId;
  if (!companyId || !branchId) {
    throw new AppError({
      statusCode: 422,
      code: "WORKSPACE_REQUIRED",
      messageKey: "errors.workspaceRequired",
    });
  }
  assertAttendanceScope(user, companyId, branchId);
  onProgress({
    phase: "PREPARING",
    percent: 5,
    processedRows: 0,
    totalRows: 0,
  });
  const { start, end, days } = monthRange(query.month);
  const dimension = { companyId, branchId };
  for (const key of ["departmentId", "positionId", "lineId"])
    if (query[key]) dimension[key] = query[key];

  let loadedSources = 0;
  const trackSource = async (promise) => {
    const value = await promise;
    loadedSources += 1;
    onProgress({
      phase: "LOADING_DATA",
      percent: 5 + loadedSources * 6,
      processedRows: loadedSources,
      totalRows: 5,
    });
    return value;
  };

  const [year, monthNumber] = query.month.split("-").map(Number);
  const [
    employees,
    records,
    calendarDays,
    departments,
    positions,
    attendanceTargetRecords,
  ] = await Promise.all([
    trackSource(
      Employee.find({
        ...dimension,
        ...attendanceScopeFilter(user),
        recordStatus: { $ne: "ARCHIVED" },
        joinDate: { $lte: end },
        $or: [{ resignDate: null }, { resignDate: { $gte: start } }],
      })
        .select(
          "_id joinDate resignDate employmentStatus departmentId positionId employeeTypeId employeeTypeChildId",
        )
        .lean(),
    ),
    trackSource(
      AttendanceRecord.find({
        ...dimension,
        ...attendanceScopeFilter(user),
        attendanceDate: { $gte: start, $lte: end },
      })
        .select(
          "employeeId attendanceDate departmentId positionId status firstInAt lastOutAt attendanceCode absenceCode leaveCode leaveTypeCode correctionCode",
        )
        .lean(),
    ),
    trackSource(
      CalendarDay.find({
        status: "ACTIVE",
        dateKey: { $gte: days[0].key, $lte: days.at(-1).key },
        $or: [{ scopeLevel: "GLOBAL" }, { companyId }, { branchId }],
      }).lean(),
    ),
    trackSource(
      Department.find({ companyId, branchId, status: { $ne: "ARCHIVED" } })
        .select("code name")
        .lean(),
    ),
    trackSource(
      Position.find({ companyId, branchId, status: { $ne: "ARCHIVED" } })
        .select("code title departmentId")
        .lean(),
    ),
    HrDashboardTarget.find({
      companyId,
      branchId,
      metric: "ABSENCE_RATE",
      year,
      month: { $in: [monthNumber, 0] },
      status: "ACTIVE",
    })
      .sort({ employeeTypeId: 1, month: -1, updatedAt: -1 })
      .select("targetScope employeeTypeId employeeTypeChildId targetRate month")
      .lean(),
  ]);
  onProgress({
    phase: "LOADING_DATA",
    percent: 35,
    processedRows: 5,
    totalRows: 5,
  });

  // Payroll keeps non-working employees as blank attendance rows for history.
  // Only WORKING employees belong to the expected face-scan population and
  // attendance-rate denominators. The stored attendance records are untouched.
  const workingEmployees = employees.filter(
    (employee) => employee.employmentStatus === FACE_SCAN_EMPLOYMENT_STATUS,
  );

  const targetKey = (value) =>
    `${String(value.employeeTypeId || "")}|${String(value.employeeTypeChildId || "")}`;
  const overallTarget = attendanceTargetRecords.find(
    (target) => target.targetScope === "OVERALL" && !target.employeeTypeId,
  );
  const targetByEmployeeType = new Map();
  for (const target of attendanceTargetRecords) {
    const key = targetKey(target);
    if (
      target.targetScope !== "OVERALL" &&
      target.employeeTypeId &&
      !targetByEmployeeType.has(key)
    ) {
      targetByEmployeeType.set(key, target);
    }
  }
  const employeeTypeCounts = new Map();
  for (const employee of workingEmployees) {
    const key = targetKey(employee);
    if (employee.employeeTypeId) {
      employeeTypeCounts.set(key, (employeeTypeCounts.get(key) || 0) + 1);
    }
  }
  const targetSources = [...targetByEmployeeType.entries()]
    .map(([key, target]) => ({
      employeeTypeId: String(target.employeeTypeId),
      employeeTypeChildId: target.employeeTypeChildId
        ? String(target.employeeTypeChildId)
        : null,
      rate: Number(target.targetRate),
      month: Number(target.month),
      employeeCount: employeeTypeCounts.get(key) || 0,
    }))
    .filter((item) => item.employeeCount > 0);
  const coveredEmployees = targetSources.reduce(
    (sum, item) => sum + item.employeeCount,
    0,
  );
  const weightedTargetRate = coveredEmployees
    ? targetSources.reduce(
        (sum, item) => sum + item.rate * item.employeeCount,
        0,
      ) / coveredEmployees
    : null;

  const calendarByDate = new Map();
  const scopeRank = { GLOBAL: 1, COMPANY: 2, BRANCH: 3 };
  for (const item of calendarDays) {
    const current = calendarByDate.get(item.dateKey);
    if (
      !current ||
      (scopeRank[item.scopeLevel] || 0) > (scopeRank[current.scopeLevel] || 0)
    ) {
      calendarByDate.set(item.dateKey, item);
    }
  }
  const reportDays = days.map((day) => {
    const calendar = calendarByDate.get(day.key);
    const dayType =
      calendar?.dayType || (day.weekday === 0 ? "WEEKEND" : "WORKING_DAY");
    return {
      ...day,
      dayType,
      name: calendar?.name || "",
      working: !["WEEKEND", "HOLIDAY", "CLOSED_DAY"].includes(dayType),
    };
  });
  const workingIndexes = reportDays
    .map((day, index) => (day.working ? index : -1))
    .filter((index) => index >= 0);
  const recordsByDay = new Map(reportDays.map((day) => [day.key, []]));
  for (const record of records)
    recordsByDay.get(dateKey(record.attendanceDate))?.push(record);
  const reportedWorkingIndexes = reportDays
    .map((day, index) =>
      day.working && (recordsByDay.get(day.key) || []).length ? index : -1,
    )
    .filter((index) => index >= 0);

  const employeesByDepartment = new Map();
  const employeesByPosition = new Map();
  for (const employee of workingEmployees) {
    const departmentKey = String(employee.departmentId || "");
    const positionKey = String(employee.positionId || "");
    if (!employeesByDepartment.has(departmentKey))
      employeesByDepartment.set(departmentKey, []);
    if (!employeesByPosition.has(positionKey))
      employeesByPosition.set(positionKey, []);
    employeesByDepartment.get(departmentKey).push(employee);
    employeesByPosition.get(positionKey).push(employee);
  }

  const daily = reportDays.map((day) => {
    const dayStart = startOfBusinessDay(day.key);
    const dayEnd = endOfBusinessDay(day.key);
    const activeEmployees = workingEmployees.filter((employee) =>
      activeOnDay(employee, dayStart, dayEnd),
    );
    const activeEmployeeIds = new Set(
      activeEmployees.map((employee) => String(employee._id)),
    );
    const dayRecords = recordsByDay.get(day.key) || [];
    const hasAttendanceData = dayRecords.length > 0;
    const rows = dayRecords.filter((row) =>
      activeEmployeeIds.has(String(row.employeeId || "")),
    );
    const presence = hasAttendanceData
      ? attendancePresence(activeEmployees, rows)
      : { faceScans: 0, absent: 0 };
    const leave = Object.fromEntries(
      LEAVE_CODES.map((code) => [
        code,
        uniqueEmployeeCount(
          rows.filter((row) => normalizedCode(row) === code),
        ),
      ]),
    );
    return {
      totalEmployees: activeEmployees.length,
      faceScans: presence.faceScans,
      absent: presence.absent,
      leave,
      absentRate: hasAttendanceData && activeEmployees.length
        ? (presence.absent / activeEmployees.length) * 100
        : 0,
    };
  });
  onProgress({
    phase: "CALCULATING_SUMMARY",
    percent: 55,
    processedRows: reportDays.length,
    totalRows: reportDays.length,
  });

  const departmentMap = new Map(
    departments.map((item) => [String(item._id), item]),
  );
  const isSewingDepartment = (department) => {
    const identity = `${department?.code || ""} ${department?.name || ""}`
      .trim()
      .toUpperCase();
    return (
      /(^|[\s_-])SEW(?:ING)?([\s_-]|$)/.test(identity) ||
      identity.includes("SEWING")
    );
  };
  const sewingDepartmentIds = new Set(
    departments.filter(isSewingDepartment).map((item) => String(item._id)),
  );
  const sewerPositionIds = new Set(
    positions
      .filter(
        (item) =>
          sewingDepartmentIds.has(String(item.departmentId || "")) &&
          SEWER_POSITION_TITLES.has(normalizedPositionTitle(item.title)),
      )
      .map((item) => String(item._id)),
  );

  const sewerDaily = reportDays.map((day) => {
    if (!day.working) {
      return {
        totalSewer: null,
        maternityLeaveRate: null,
        annualUnpaidLeaveRate: null,
        sickLeaveRate: null,
        absentWithoutInformRate: null,
        sewerCome: null,
        totalAbsentRate: null,
      };
    }

    const dayStart = startOfBusinessDay(day.key);
    const dayEnd = endOfBusinessDay(day.key);
    const activeSewerEmployees = workingEmployees.filter(
      (employee) =>
        sewingDepartmentIds.has(String(employee.departmentId || "")) &&
        sewerPositionIds.has(String(employee.positionId || "")) &&
        activeOnDay(employee, dayStart, dayEnd),
    );
    const activeMaternitySewerEmployees = employees.filter(
      (employee) =>
        employee.employmentStatus === MATERNITY_LEAVE_EMPLOYMENT_STATUS &&
        sewingDepartmentIds.has(String(employee.departmentId || "")) &&
        sewerPositionIds.has(String(employee.positionId || "")) &&
        activeOnDay(employee, dayStart, dayEnd),
    );
    const sewerEmployeeIds = new Set(
      activeSewerEmployees.map((employee) => String(employee._id)),
    );
    const maternitySewerEmployeeIds = new Set(
      activeMaternitySewerEmployees.map((employee) => String(employee._id)),
    );
    const dayRecords = recordsByDay.get(day.key) || [];
    const sewerRecords = dayRecords.filter((record) =>
      sewerEmployeeIds.has(String(record.employeeId)),
    );
    if (!dayRecords.length) {
      return {
        totalSewer: activeSewerEmployees.length,
        maternityLeaveCount: 0,
        maternityLeaveRate: 0,
        annualUnpaidLeaveCount: 0,
        annualUnpaidLeaveRate: 0,
        sickLeaveCount: 0,
        sickLeaveRate: 0,
        absentWithoutInformCount: 0,
        absentWithoutInformRate: 0,
        sewerCome: 0,
        totalAbsentCount: 0,
        totalAbsentRate: 0,
      };
    }
    const scannedEmployeeIds = new Set(
      sewerRecords
        .filter((record) => record.firstInAt || record.lastOutAt)
        .map((record) => String(record.employeeId)),
    );
    const leaveEmployeeIds = Object.fromEntries(
      LEAVE_CODES.map((code) => [
        code,
        new Set(
          sewerRecords
            .filter((record) => normalizedCode(record) === code)
            .map((record) => String(record.employeeId)),
        ),
      ]),
    );
    // Payroll moves maternity employees out of WORKING while keeping their
    // attendance row blank for history. They must remain excluded from the
    // face-scan denominator, but still appear in the Sewer Maternity Leave
    // breakdown when an attendance row was imported for this date.
    for (const record of dayRecords) {
      const recordEmployeeId = String(record.employeeId || "");
      if (maternitySewerEmployeeIds.has(recordEmployeeId)) {
        leaveEmployeeIds.ML.add(recordEmployeeId);
      }
    }
    const informedAbsentIds = new Set([
      ...leaveEmployeeIds.ML,
      ...leaveEmployeeIds.AL,
      ...leaveEmployeeIds.UL,
      ...leaveEmployeeIds.SL,
    ]);
    const totalSewer = activeSewerEmployees.length;
    const sewerCome = scannedEmployeeIds.size;
    const missingEmployeeIds = new Set(
      [...sewerEmployeeIds].filter(
        (employeeId) => !scannedEmployeeIds.has(employeeId),
      ),
    );
    const informedMissingCount = [...informedAbsentIds].filter((employeeId) =>
      missingEmployeeIds.has(employeeId),
    ).length;
    const missingScan = missingEmployeeIds.size;
    const absentWithoutInform = Math.max(missingScan - informedMissingCount, 0);
    const rate = (value) => (totalSewer ? (value / totalSewer) * 100 : 0);

    return {
      totalSewer,
      maternityLeaveCount: leaveEmployeeIds.ML.size,
      maternityLeaveRate: rate(leaveEmployeeIds.ML.size),
      annualUnpaidLeaveCount: new Set([
        ...leaveEmployeeIds.AL,
        ...leaveEmployeeIds.UL,
      ]).size,
      annualUnpaidLeaveRate: rate(
        new Set([...leaveEmployeeIds.AL, ...leaveEmployeeIds.UL]).size,
      ),
      sickLeaveCount: leaveEmployeeIds.SL.size,
      sickLeaveRate: rate(leaveEmployeeIds.SL.size),
      absentWithoutInformCount: absentWithoutInform,
      absentWithoutInformRate: rate(absentWithoutInform),
      sewerCome,
      totalAbsentCount: missingScan,
      totalAbsentRate: rate(missingScan),
    };
  });

  const sewerMetric = (field) => sewerDaily.map((item) => item[field]);
  const sewerAverage = (field) =>
    average(sewerMetric(field), reportedWorkingIndexes);
  const groupDefinitions = [
    ...departments.map((item) => ({
      key: `D:${item._id}`,
      level: 0,
      label: item.name,
      departmentId: String(item._id),
    })),
    ...positions
      .filter((item) => sewingDepartmentIds.has(String(item.departmentId)))
      .map((item) => ({
        key: `P:${item._id}`,
        level: 1,
        label: `- ${item.title}`,
        departmentId: String(item.departmentId),
        positionId: String(item._id),
      })),
  ].sort((a, b) => {
    const aIsSewing = sewingDepartmentIds.has(a.departmentId);
    const bIsSewing = sewingDepartmentIds.has(b.departmentId);
    if (aIsSewing !== bIsSewing) return aIsSewing ? -1 : 1;

    const departmentCompare = (
      departmentMap.get(a.departmentId)?.name || ""
    ).localeCompare(departmentMap.get(b.departmentId)?.name || "");
    if (departmentCompare) return departmentCompare;
    return a.level - b.level || a.label.localeCompare(b.label);
  });
  const groupRows = [];
  for (const [groupIndex, group] of groupDefinitions.entries()) {
    const groupEmployees = group.positionId
      ? employeesByPosition.get(group.positionId) || []
      : employeesByDepartment.get(group.departmentId) || [];
    const values = reportDays.map((day) => {
      if (!day.working) return null;
      if (!(recordsByDay.get(day.key) || []).length) {
        return { count: 0, rate: 0 };
      }
      const dayStart = startOfBusinessDay(day.key);
      const dayEnd = endOfBusinessDay(day.key);
      const activeGroupEmployees = groupEmployees.filter((employee) =>
        activeOnDay(employee, dayStart, dayEnd),
      );
      const activeGroupEmployeeIds = new Set(
        activeGroupEmployees.map((employee) => String(employee._id)),
      );
      const groupRecords = (recordsByDay.get(day.key) || []).filter((record) =>
        activeGroupEmployeeIds.has(String(record.employeeId)),
      );
      const { absent } = attendancePresence(
        activeGroupEmployees,
        groupRecords,
      );
      return {
        count: absent,
        rate: activeGroupEmployees.length
          ? (absent / activeGroupEmployees.length) * 100
          : 0,
      };
    });
    onProgress({
      phase: "CALCULATING_DEPARTMENTS",
      percent:
        55 +
        Math.round(
          ((groupIndex + 1) / Math.max(groupDefinitions.length, 1)) * 40,
        ),
      processedRows: groupIndex + 1,
      totalRows: groupDefinitions.length,
    });
    const counts = values.map((value) => value?.count ?? null);
    const rates = values.map((value) => value?.rate ?? null);
    const row = {
      ...group,
      values: rates,
      counts,
      average: average(rates, reportedWorkingIndexes),
      averageCount: average(counts, reportedWorkingIndexes),
    };
    if (
      row.values.some((value) => value !== 0 && value !== null) ||
      row.level === 0
    ) {
      groupRows.push(row);
    }
    await new Promise((resolve) => setImmediate(resolve));
  }

  return {
    month: query.month,
    attendanceTarget: overallTarget
      ? {
          rate: Number(overallTarget.targetRate),
          method: "OVERALL",
          month: Number(overallTarget.month),
          coveredEmployees,
          totalEmployees: workingEmployees.length,
          sources: targetSources,
        }
      : null,
    days: reportDays,
    summary: {
      totalEmployees: daily.map((item) => item.totalEmployees),
      faceScans: daily.map((item) => item.faceScans),
      leaves: Object.fromEntries(
        LEAVE_CODES.map((code) => [
          code,
          daily.map((item) => item.leave[code]),
        ]),
      ),
      absent: daily.map((item) => item.absent),
      absentRate: daily.map((item) => item.absentRate),
      averages: {
        totalEmployees: average(
          daily.map((item) => item.totalEmployees),
          workingIndexes,
        ),
        faceScans: average(
          daily.map((item) => item.faceScans),
          reportedWorkingIndexes,
        ),
        leaves: Object.fromEntries(
          LEAVE_CODES.map((code) => [
            code,
            average(
              daily.map((item) => item.leave[code]),
              reportedWorkingIndexes,
            ),
          ]),
        ),
        absent: average(
          daily.map((item) => item.absent),
          reportedWorkingIndexes,
        ),
        absentRate: average(
          daily.map((item) => item.absentRate),
          reportedWorkingIndexes,
        ),
      },
    },
    sewerAbsentRate: {
      totalSewer: sewerMetric("totalSewer"),
      maternityLeaveCount: sewerMetric("maternityLeaveCount"),
      maternityLeaveRate: sewerMetric("maternityLeaveRate"),
      annualUnpaidLeaveCount: sewerMetric("annualUnpaidLeaveCount"),
      annualUnpaidLeaveRate: sewerMetric("annualUnpaidLeaveRate"),
      sickLeaveCount: sewerMetric("sickLeaveCount"),
      sickLeaveRate: sewerMetric("sickLeaveRate"),
      absentWithoutInformCount: sewerMetric("absentWithoutInformCount"),
      absentWithoutInformRate: sewerMetric("absentWithoutInformRate"),
      sewerCome: sewerMetric("sewerCome"),
      totalAbsentCount: sewerMetric("totalAbsentCount"),
      totalAbsentRate: sewerMetric("totalAbsentRate"),
      averages: {
        totalSewer: sewerAverage("totalSewer"),
        maternityLeaveCount: sewerAverage("maternityLeaveCount"),
        maternityLeaveRate: sewerAverage("maternityLeaveRate"),
        annualUnpaidLeaveCount: sewerAverage("annualUnpaidLeaveCount"),
        annualUnpaidLeaveRate: sewerAverage("annualUnpaidLeaveRate"),
        sickLeaveCount: sewerAverage("sickLeaveCount"),
        sickLeaveRate: sewerAverage("sickLeaveRate"),
        absentWithoutInformCount: sewerAverage("absentWithoutInformCount"),
        absentWithoutInformRate: sewerAverage("absentWithoutInformRate"),
        sewerCome: sewerAverage("sewerCome"),
        totalAbsentCount: sewerAverage("totalAbsentCount"),
        totalAbsentRate: sewerAverage("totalAbsentRate"),
      },
    },
    groupRows,
  };
}

function percentFill(value, targetRate) {
  if (targetRate === null) return "C6EFCE";
  if (value < Math.max(targetRate - 2, 0)) return "C6EFCE";
  if (value < targetRate) return "FFEB9C";
  return "FFC7CE";
}

export async function buildAttendanceDailyReportWorkbook(
  report,
  onProgress = () => {},
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Daily Attendance");
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
  sheet.columns = [
    { width: 24 },
    ...report.days.map(() => ({ width: 6 })),
    { width: 7 },
  ];
  const addRow = (label, values, avg, percent = false) => {
    const row = sheet.addRow([
      label,
      ...values.map((value) =>
        value === null ? "" : percent ? value / 100 : value,
      ),
      percent ? avg / 100 : avg,
    ]);
    if (percent)
      row.eachCell((cell, column) => {
        if (column > 1 && typeof cell.value === "number") {
          cell.numFmt = "0.0%";
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: percentFill(
                cell.value * 100,
                report.attendanceTarget?.rate ?? null,
              ),
            },
          };
        }
      });
    return row;
  };
  sheet.addRow([
    "Attendance Daily Report",
    ...report.days.map((day) => day.day),
    "Avg",
  ]);
  addRow(
    "TOTAL EMPLOYEE",
    report.summary.totalEmployees,
    report.summary.averages.totalEmployees,
  );
  addRow(
    "FACE SCAN",
    report.summary.faceScans,
    report.summary.averages.faceScans,
  );
  addRow(
    "- MATERNITY LEAVE",
    report.summary.leaves.ML,
    report.summary.averages.leaves.ML,
  );
  addRow(
    "- ANNUAL LEAVE",
    report.summary.leaves.AL,
    report.summary.averages.leaves.AL,
  );
  addRow(
    "- UNPAID LEAVE",
    report.summary.leaves.UL,
    report.summary.averages.leaves.UL,
  );
  addRow(
    "- SICK LEAVE",
    report.summary.leaves.SL,
    report.summary.averages.leaves.SL,
  );
  addRow(
    "ABSENT RATE",
    report.summary.absentRate,
    report.summary.averages.absentRate,
    true,
  );
  sheet.addRow([]);
  sheet.addRow(["FORGET FINGER SCAN"]);
  for (const [index, item] of report.groupRows.entries()) {
    addRow(item.label, item.values, item.average, true);
    onProgress({
      phase: "BUILDING_EXCEL",
      percent:
        70 +
        Math.round(((index + 1) / Math.max(report.groupRows.length, 1)) * 25),
      processedRows: index + 1,
      totalRows: report.groupRows.length,
    });
    await new Promise((resolve) => setImmediate(resolve));
  }
  sheet.addRow([]);
  sheet.addRow(["SEWER ABSENT RATE"]);
  addRow(
    "TOTAL SEWER",
    report.sewerAbsentRate.totalSewer,
    report.sewerAbsentRate.averages.totalSewer,
  );
  addRow(
    "- MATERNITY LEAVE",
    report.sewerAbsentRate.maternityLeaveRate,
    report.sewerAbsentRate.averages.maternityLeaveRate,
    true,
  );
  addRow(
    "- ANNUAL LEAVE / UNPAID",
    report.sewerAbsentRate.annualUnpaidLeaveRate,
    report.sewerAbsentRate.averages.annualUnpaidLeaveRate,
    true,
  );
  addRow(
    "- SICK LEAVE",
    report.sewerAbsentRate.sickLeaveRate,
    report.sewerAbsentRate.averages.sickLeaveRate,
    true,
  );
  addRow(
    "- ABSENT WITHOUT INFORM",
    report.sewerAbsentRate.absentWithoutInformRate,
    report.sewerAbsentRate.averages.absentWithoutInformRate,
    true,
  );
  addRow(
    "SEWER COME",
    report.sewerAbsentRate.sewerCome,
    report.sewerAbsentRate.averages.sewerCome,
  );
  addRow(
    "TOTAL ABSENT RATE",
    report.sewerAbsentRate.totalAbsentRate,
    report.sewerAbsentRate.averages.totalAbsentRate,
    true,
  );
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "1F4E78" },
  };
  sheet.eachRow((row) =>
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "9EADBD" } },
        left: { style: "thin", color: { argb: "9EADBD" } },
        bottom: { style: "thin", color: { argb: "9EADBD" } },
        right: { style: "thin", color: { argb: "9EADBD" } },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: cell.col === 1 ? "left" : "center",
      };
    }),
  );
  return workbook;
}
