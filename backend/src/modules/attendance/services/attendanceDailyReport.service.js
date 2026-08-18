import ExcelJS from "exceljs";
import mongoose from "mongoose";

import Employee from "../../employee/models/Employee.js";
import {
  buildMaternityPeriodMap,
  employeeIsOnMaternityDate,
  getMaternityPeriodsForEmployees,
} from "../../employee/services/employeeLifecycle.service.js";
import Department from "../../organization/models/Department.js";
import Position from "../../organization/models/Position.js";
import Shift from "../../shift/models/Shift.js";
import CalendarDay from "../../calendar/models/CalendarDay.js";
import HrDashboardTarget from "../../hrDashboardTarget/models/HrDashboardTarget.js";
import AttendanceRecord from "../models/AttendanceRecord.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { getCache, setCache } from "../../../shared/cache/memoryCache.js";
import {
  attendanceScopeFilter,
  assertAttendanceScope,
} from "../utils/attendanceScope.util.js";
import {
  endOfBusinessDay,
  getBusinessTimeZone,
  startOfBusinessDay,
  toBusinessDateKey,
} from "../utils/attendanceDate.util.js";

const LEAVE_CODES = ["ML", "AL", "SP", "UL", "SL"];
const SEWER_POSITION_TITLES = new Set(["SEWER", "SEWER-JUMPER"]);
const CODE_ALIASES = {
  MATERNITY: "ML",
  MATERNITY_LEAVE: "ML",
  ML: "ML",
  ANNUAL: "AL",
  ANNUAL_LEAVE: "AL",
  AL: "AL",
  SPECIAL_PERMISSION: "SP",
  SPECIAL_LEAVE: "SP",
  SPECIAL: "SP",
  SP: "SP",
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

function hasInformedVacationDescription(record) {
  const value = String(record?.vacationDescription || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return Boolean(value) && !["(blanks)", "blanks", "absent", "absence"].includes(value);
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

const ATTENDANCE_DAILY_REPORT_CACHE_PREFIX = "attendance:daily-report:";
const ATTENDANCE_DAILY_REPORT_CACHE_TTL_MS = 60_000;

function objectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function addStat(target, source) {
  target.recordCount += Number(source.recordCount || 0);
  target.faceScans += Number(source.faceScans || 0);
  target.ML += Number(source.ML || 0);
  target.AL += Number(source.AL || 0);
  target.SP += Number(source.SP || 0);
  target.UL += Number(source.UL || 0);
  target.SL += Number(source.SL || 0);
  target.informedMissing += Number(source.informedMissing || 0);
  return target;
}

function emptyStat() {
  return {
    recordCount: 0,
    faceScans: 0,
    ML: 0,
    AL: 0,
    SP: 0,
    UL: 0,
    SL: 0,
    informedMissing: 0,
  };
}

function putStat(map, key, stat) {
  const current = map.get(key) || emptyStat();
  addStat(current, stat);
  map.set(key, current);
}

function statKey(...values) {
  return values.map((value) => String(value || "")).join("|");
}

function cacheKeyForReport(query) {
  return `${ATTENDANCE_DAILY_REPORT_CACHE_PREFIX}${JSON.stringify({
    companyId: String(query.companyId || ""),
    branchId: String(query.branchId || ""),
    month: String(query.month || ""),
    reportDate: String(query.reportDate || ""),
    departmentId: String(query.departmentId || ""),
    positionId: String(query.positionId || ""),
    lineId: String(query.lineId || ""),
    shiftId: String(query.shiftId || ""),
  })}`;
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

  const reportCacheKey = cacheKeyForReport(query);
  const cached = getCache(reportCacheKey);
  if (cached) {
    onProgress({ phase: "COMPLETED", percent: 100, processedRows: 1, totalRows: 1 });
    return cached;
  }

  onProgress({ phase: "PREPARING", percent: 5, processedRows: 0, totalRows: 0 });

  const { start, end, days } = monthRange(query.month);
  const companyObjectId = objectId(companyId);
  const branchObjectId = objectId(branchId);
  const dimension = { companyId, branchId };
  const aggregateDimension = { companyId: companyObjectId, branchId: branchObjectId };
  for (const key of ["departmentId", "positionId", "lineId"]) {
    if (!query[key]) continue;
    dimension[key] = query[key];
    aggregateDimension[key] = objectId(query[key]);
  }

  const [year, monthNumber] = query.month.split("-").map(Number);
  let loadedSources = 0;
  const trackSource = async (promise, total = 6) => {
    const value = await promise;
    loadedSources += 1;
    onProgress({
      phase: "LOADING_DATA",
      percent: 5 + Math.round((loadedSources / total) * 25),
      processedRows: loadedSources,
      totalRows: total,
    });
    return value;
  };

  const [allEmployees, calendarDays, departments, positions, shifts, attendanceTargetRecords] = await Promise.all([
    trackSource(
      Employee.find({
        ...dimension,
        ...attendanceScopeFilter(user),
        recordStatus: "ACTIVE",
        joinDate: { $lte: end },
        $or: [{ resignDate: null }, { resignDate: { $gte: start } }],
      })
        .select("_id joinDate resignDate employmentStatus departmentId positionId shiftId employeeTypeId employeeTypeChildId")
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
    trackSource(
      Shift.find({ companyId, branchId, status: "ACTIVE" })
        .select("code name startTime endTime")
        .sort({ code: 1, name: 1 })
        .lean(),
    ),
    trackSource(
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
    ),
  ]);

  const selectedShiftId = String(query.shiftId || "");
  const employees = selectedShiftId
    ? allEmployees.filter((employee) => String(employee.shiftId || "") === selectedShiftId)
    : allEmployees;

  const allEmployeeIds = allEmployees.map((employee) => employee._id);
  const employeeById = new Map(
    allEmployees.map((employee) => [String(employee._id), employee]),
  );
  const maternityPeriods = await getMaternityPeriodsForEmployees({
    employeeIds: allEmployeeIds,
    dateFrom: days[0].key,
    dateTo: days.at(-1).key,
  });
  const maternityPeriodMap = buildMaternityPeriodMap(maternityPeriods);

  const expectedToWorkOnDay = (employee, dayKey, dayStart, dayEnd) =>
    activeOnDay(employee, dayStart, dayEnd) &&
    !employeeIsOnMaternityDate(employee._id, dayKey, maternityPeriodMap);

  onProgress({ phase: "AGGREGATING_ATTENDANCE", percent: 35, processedRows: 0, totalRows: allEmployees.length });

  const attendanceRows = allEmployeeIds.length
    ? await AttendanceRecord.find({
        ...aggregateDimension,
        attendanceDate: { $gte: start, $lte: end },
        employeeId: { $in: allEmployeeIds },
      })
        .select("employeeId attendanceDate departmentId positionId shiftId firstInAt lastOutAt leaveCode vacationDescription")
        .lean()
    : [];

  const detailedStatByKey = new Map();
  const mergeDetailed = ({ day, departmentId, positionId, shiftId }, fields) => {
    const key = statKey(day, departmentId, positionId, shiftId);
    const current = detailedStatByKey.get(key) || {
      day,
      departmentId: String(departmentId || ""),
      positionId: String(positionId || ""),
      shiftId: String(shiftId || ""),
      ...emptyStat(),
    };
    for (const [field, value] of Object.entries(fields)) {
      current[field] = Number(current[field] || 0) + Number(value || 0);
    }
    detailedStatByKey.set(key, current);
  };

  const daysWithAttendance = new Set();
  for (const row of attendanceRows) {
    const employee = employeeById.get(String(row.employeeId || ""));
    if (!employee) continue;

    const day = dateKey(row.attendanceDate);
    const dayStart = startOfBusinessDay(day);
    const dayEnd = endOfBusinessDay(day);
    if (!activeOnDay(employee, dayStart, dayEnd)) continue;

    daysWithAttendance.add(day);
    const onMaternity = employeeIsOnMaternityDate(
      employee._id,
      day,
      maternityPeriodMap,
    );
    const hasScan = hasAnyFaceScan(row);
    const leaveCode = String(row.leaveCode || "").toUpperCase();
    const fields = { recordCount: 1 };

    // Employee lifecycle is authoritative for maternity. Payroll Vacation ML
    // remains stored on AttendanceRecord as evidence, but does not create or
    // extend a maternity lifecycle period.
    if (!onMaternity && hasScan) fields.faceScans = 1;
    if (!onMaternity && ["AL", "SP", "UL", "SL"].includes(leaveCode)) fields[leaveCode] = 1;
    if (!onMaternity && !hasScan && (LEAVE_CODES.includes(leaveCode) || hasInformedVacationDescription(row))) {
      fields.informedMissing = 1;
    }

    mergeDetailed(
      {
        day,
        departmentId: row.departmentId,
        positionId: row.positionId,
        shiftId: row.shiftId,
      },
      fields,
    );
  }

  // System maternity periods are the reporting source of truth. Count ML by
  // date even after the Employee has automatically returned to WORKING. Only
  // populate days for which attendance was actually imported, avoiding future
  // schedule dates appearing as completed attendance.
  for (const employee of allEmployees) {
    for (const day of days) {
      if (!daysWithAttendance.has(day.key)) continue;
      const dayStart = startOfBusinessDay(day.key);
      const dayEnd = endOfBusinessDay(day.key);
      if (!activeOnDay(employee, dayStart, dayEnd)) continue;
      if (!employeeIsOnMaternityDate(employee._id, day.key, maternityPeriodMap)) continue;

      mergeDetailed(
        {
          day: day.key,
          departmentId: employee.departmentId,
          positionId: employee.positionId,
          shiftId: employee.shiftId,
        },
        { ML: 1 },
      );
    }
  }

  const attendanceStats = [...detailedStatByKey.values()];

  const statsByDay = new Map();
  const statsByDayShift = new Map();
  const statsByDayDepartment = new Map();
  const statsByDayDepartmentShift = new Map();
  const statsByDayPosition = new Map();
  const statsByDayPositionShift = new Map();
  const detailedStats = [];

  for (const row of attendanceStats) {
    const stat = {
      recordCount: row.recordCount,
      faceScans: row.faceScans,
      ML: row.ML,
      AL: row.AL,
      UL: row.UL,
      SL: row.SL,
      informedMissing: row.informedMissing,
    };
    const day = row.day;
    const departmentId = row.departmentId;
    const positionId = row.positionId;
    const shiftId = row.shiftId;
    putStat(statsByDay, day, stat);
    putStat(statsByDayShift, statKey(day, shiftId), stat);
    putStat(statsByDayDepartment, statKey(day, departmentId), stat);
    putStat(statsByDayDepartmentShift, statKey(day, departmentId, shiftId), stat);
    putStat(statsByDayPosition, statKey(day, positionId), stat);
    putStat(statsByDayPositionShift, statKey(day, positionId, shiftId), stat);
    detailedStats.push({ day, departmentId, positionId, shiftId, ...stat });
  }

  const selectedDayStat = (dayKey) => selectedShiftId
    ? (statsByDayShift.get(statKey(dayKey, selectedShiftId)) || emptyStat())
    : (statsByDay.get(dayKey) || emptyStat());
  const groupDayStat = (dayKey, group) => {
    if (group.positionId) {
      return selectedShiftId
        ? (statsByDayPositionShift.get(statKey(dayKey, group.positionId, selectedShiftId)) || emptyStat())
        : (statsByDayPosition.get(statKey(dayKey, group.positionId)) || emptyStat());
    }
    return selectedShiftId
      ? (statsByDayDepartmentShift.get(statKey(dayKey, group.departmentId, selectedShiftId)) || emptyStat())
      : (statsByDayDepartment.get(statKey(dayKey, group.departmentId)) || emptyStat());
  };

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
  const targetDayKey = days.at(-1).key;
  const targetDayStart = startOfBusinessDay(targetDayKey);
  const targetDayEnd = endOfBusinessDay(targetDayKey);
  const targetEmployees = employees.filter((employee) =>
    expectedToWorkOnDay(employee, targetDayKey, targetDayStart, targetDayEnd),
  );
  const employeeTypeCounts = new Map();
  for (const employee of targetEmployees) {
    const key = targetKey(employee);
    if (employee.employeeTypeId) {
      employeeTypeCounts.set(key, (employeeTypeCounts.get(key) || 0) + 1);
    }
  }
  const targetSources = [...targetByEmployeeType.entries()]
    .map(([key, target]) => ({
      employeeTypeId: String(target.employeeTypeId),
      employeeTypeChildId: target.employeeTypeChildId ? String(target.employeeTypeChildId) : null,
      rate: Number(target.targetRate),
      month: Number(target.month),
      employeeCount: employeeTypeCounts.get(key) || 0,
    }))
    .filter((item) => item.employeeCount > 0);
  const coveredEmployees = targetSources.reduce((sum, item) => sum + item.employeeCount, 0);

  const calendarByDate = new Map();
  const scopeRank = { GLOBAL: 1, COMPANY: 2, BRANCH: 3 };
  for (const item of calendarDays) {
    const current = calendarByDate.get(item.dateKey);
    if (!current || (scopeRank[item.scopeLevel] || 0) > (scopeRank[current.scopeLevel] || 0)) {
      calendarByDate.set(item.dateKey, item);
    }
  }
  const reportDays = days.map((day) => {
    const calendar = calendarByDate.get(day.key);
    const dayType = calendar?.dayType || (day.weekday === 0 ? "WEEKEND" : "WORKING_DAY");
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
  const reportedWorkingIndexes = reportDays
    .map((day, index) => (day.working && selectedDayStat(day.key).recordCount ? index : -1))
    .filter((index) => index >= 0);

  onProgress({ phase: "CALCULATING_SUMMARY", percent: 65, processedRows: 0, totalRows: reportDays.length });

  const daily = reportDays.map((day) => {
    const dayStart = startOfBusinessDay(day.key);
    const dayEnd = endOfBusinessDay(day.key);
    const activeEmployees = employees.filter((employee) => expectedToWorkOnDay(employee, day.key, dayStart, dayEnd));
    const stat = selectedDayStat(day.key);
    const hasAttendanceData = stat.recordCount > 0;
    const faceScans = hasAttendanceData ? Math.min(stat.faceScans, activeEmployees.length) : 0;
    const absent = hasAttendanceData ? Math.max(activeEmployees.length - faceScans, 0) : 0;
    return {
      totalEmployees: activeEmployees.length,
      faceScans,
      absent,
      leave: {
        ML: stat.ML,
        AL: stat.AL,
        SP: stat.SP,
        UL: stat.UL,
        SL: stat.SL,
      },
      absentRate: hasAttendanceData && activeEmployees.length
        ? (absent / activeEmployees.length) * 100
        : 0,
    };
  });

  const departmentMap = new Map(departments.map((item) => [String(item._id), item]));
  const isSewingDepartment = (department) => {
    const identity = `${department?.code || ""} ${department?.name || ""}`.trim().toUpperCase();
    return /(^|[\s_-])SEW(?:ING)?([\s_-]|$)/.test(identity) || identity.includes("SEWING");
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

  const sewerEmployees = employees.filter(
    (employee) =>
      sewingDepartmentIds.has(String(employee.departmentId || "")) &&
      sewerPositionIds.has(String(employee.positionId || "")),
  );
  const sewerDaily = reportDays.map((day) => {
    if (!day.working) {
      return {
        totalSewer: null,
        maternityLeaveCount: null,
        maternityLeaveRate: null,
        annualUnpaidLeaveCount: null,
        annualUnpaidLeaveRate: null,
        sickLeaveCount: null,
        sickLeaveRate: null,
        absentWithoutInformCount: null,
        absentWithoutInformRate: null,
        sewerCome: null,
        totalAbsentCount: null,
        totalAbsentRate: null,
      };
    }

    const dayStart = startOfBusinessDay(day.key);
    const dayEnd = endOfBusinessDay(day.key);
    const totalSewer = sewerEmployees.filter((employee) => expectedToWorkOnDay(employee, day.key, dayStart, dayEnd)).length;
    const sewerStat = detailedStats
      .filter(
        (stat) =>
          stat.day === day.key &&
          sewerPositionIds.has(stat.positionId) &&
          sewingDepartmentIds.has(stat.departmentId) &&
          (!selectedShiftId || stat.shiftId === selectedShiftId),
      )
      .reduce((acc, stat) => addStat(acc, stat), emptyStat());

    if (!selectedDayStat(day.key).recordCount) {
      return {
        totalSewer,
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

    const sewerCome = Math.min(sewerStat.faceScans, totalSewer);
    const missingScan = Math.max(totalSewer - sewerCome, 0);
    const absentWithoutInform = Math.max(missingScan - sewerStat.informedMissing, 0);
    const annualUnpaid = sewerStat.AL + sewerStat.UL;
    const rate = (value) => (totalSewer ? (value / totalSewer) * 100 : 0);
    return {
      totalSewer,
      maternityLeaveCount: sewerStat.ML,
      maternityLeaveRate: rate(sewerStat.ML),
      annualUnpaidLeaveCount: annualUnpaid,
      annualUnpaidLeaveRate: rate(annualUnpaid),
      sickLeaveCount: sewerStat.SL,
      sickLeaveRate: rate(sewerStat.SL),
      absentWithoutInformCount: absentWithoutInform,
      absentWithoutInformRate: rate(absentWithoutInform),
      sewerCome,
      totalAbsentCount: missingScan,
      totalAbsentRate: rate(missingScan),
    };
  });

  const sewerMetric = (field) => sewerDaily.map((item) => item[field]);
  const sewerAverage = (field) => average(sewerMetric(field), reportedWorkingIndexes);

  const employeesByDepartment = new Map();
  const employeesByPosition = new Map();
  for (const employee of employees) {
    const departmentKey = String(employee.departmentId || "");
    const positionKey = String(employee.positionId || "");
    if (!employeesByDepartment.has(departmentKey)) employeesByDepartment.set(departmentKey, []);
    if (!employeesByPosition.has(positionKey)) employeesByPosition.set(positionKey, []);
    employeesByDepartment.get(departmentKey).push(employee);
    employeesByPosition.get(positionKey).push(employee);
  }

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
    const departmentCompare = (departmentMap.get(a.departmentId)?.name || "").localeCompare(
      departmentMap.get(b.departmentId)?.name || "",
    );
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
      const dayGlobalStat = selectedDayStat(day.key);
      if (!dayGlobalStat.recordCount) return { count: 0, rate: 0 };
      const dayStart = startOfBusinessDay(day.key);
      const dayEnd = endOfBusinessDay(day.key);
      const totalEmployees = groupEmployees.filter((employee) => expectedToWorkOnDay(employee, day.key, dayStart, dayEnd)).length;
      const groupStat = groupDayStat(day.key, group);
      const faceScans = Math.min(groupStat.faceScans, totalEmployees);
      const absent = Math.max(totalEmployees - faceScans, 0);
      return {
        count: absent,
        rate: totalEmployees ? (absent / totalEmployees) * 100 : 0,
      };
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
    if (row.values.some((value) => value !== 0 && value !== null) || row.level === 0) {
      groupRows.push(row);
    }
    onProgress({
      phase: "CALCULATING_DEPARTMENTS",
      percent: 75 + Math.round(((groupIndex + 1) / Math.max(groupDefinitions.length, 1)) * 20),
      processedRows: groupIndex + 1,
      totalRows: groupDefinitions.length,
    });
  }

  const selectedReportDateKey = /^\d{4}-\d{2}-\d{2}$/.test(query.reportDate || "")
    ? query.reportDate
    : reportDays.find((day) => statsByDay.get(day.key)?.recordCount)?.key || reportDays[0]?.key;
  const selectedReportDay = reportDays.find((day) => day.key === selectedReportDateKey);
  const selectedDayStart = startOfBusinessDay(selectedReportDateKey);
  const selectedDayEnd = endOfBusinessDay(selectedReportDateKey);
  const selectedDateAllStat = statsByDay.get(selectedReportDateKey) || emptyStat();
  const shiftComparison = shifts.map((shift) => {
    const shiftId = String(shift._id);
    const shiftEmployees = allEmployees.filter(
      (employee) =>
        String(employee.shiftId || "") === shiftId &&
        expectedToWorkOnDay(
          employee,
          selectedReportDateKey,
          selectedDayStart,
          selectedDayEnd,
        ),
    );
    const shiftStat = statsByDayShift.get(statKey(selectedReportDateKey, shiftId)) || emptyStat();
    const faceScans = selectedReportDay?.working && selectedDateAllStat.recordCount
      ? Math.min(shiftStat.faceScans, shiftEmployees.length)
      : 0;
    const absent = selectedReportDay?.working && selectedDateAllStat.recordCount
      ? Math.max(shiftEmployees.length - faceScans, 0)
      : 0;
    return {
      id: shiftId,
      code: shift.code,
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      overnight: String(shift.endTime || "") <= String(shift.startTime || ""),
      totalEmployees: shiftEmployees.length,
      faceScans,
      absent,
      absentRate: shiftEmployees.length ? (absent / shiftEmployees.length) * 100 : 0,
    };
  });

  const report = {
    month: query.month,
    reportDate: selectedReportDateKey,
    selectedShiftId: selectedShiftId || null,
    selectedShift: selectedShiftId
      ? shiftComparison.find((shift) => shift.id === selectedShiftId) || null
      : null,
    shiftComparison,
    attendanceTarget: overallTarget
      ? {
          rate: Number(overallTarget.targetRate),
          method: "OVERALL",
          month: Number(overallTarget.month),
          coveredEmployees,
          totalEmployees: targetEmployees.length,
          sources: targetSources,
        }
      : null,
    days: reportDays,
    summary: {
      totalEmployees: daily.map((item) => item.totalEmployees),
      faceScans: daily.map((item) => item.faceScans),
      leaves: Object.fromEntries(
        LEAVE_CODES.map((code) => [code, daily.map((item) => item.leave[code])]),
      ),
      absent: daily.map((item) => item.absent),
      absentRate: daily.map((item) => item.absentRate),
      averages: {
        totalEmployees: average(daily.map((item) => item.totalEmployees), workingIndexes),
        faceScans: average(daily.map((item) => item.faceScans), reportedWorkingIndexes),
        leaves: Object.fromEntries(
          LEAVE_CODES.map((code) => [
            code,
            average(daily.map((item) => item.leave[code]), reportedWorkingIndexes),
          ]),
        ),
        absent: average(daily.map((item) => item.absent), reportedWorkingIndexes),
        absentRate: average(daily.map((item) => item.absentRate), reportedWorkingIndexes),
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

  onProgress({ phase: "COMPLETED", percent: 100, processedRows: groupRows.length, totalRows: groupRows.length });
  return setCache(reportCacheKey, report, ATTENDANCE_DAILY_REPORT_CACHE_TTL_MS);
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
