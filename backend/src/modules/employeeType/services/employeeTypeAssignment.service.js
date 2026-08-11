import { Types } from "mongoose";

import { AppError } from "../../../shared/errors/AppError.js";
import Position from "../../organization/models/Position.js";
import EmployeeType from "../models/EmployeeType.js";

function toId(value) {
  return value?._id?.toString?.() || value?.id || value?.toString?.() || null;
}

function sameId(left, right) {
  const leftId = toId(left);
  const rightId = toId(right);
  return Boolean(leftId && rightId && leftId === rightId);
}

function ensureObjectId(value, field) {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError({
      statusCode: 400,
      code: "EMPLOYEE_TYPE_ASSIGNMENT_INVALID_ID",
      messageKey: "errors.validationFailed",
      fields: {
        [field]: ["errors.validationFailed"],
      },
    });
  }
}

function findPositionAssignment(employeeType, positionId) {
  if (employeeType?.positionAssignmentMode === "ALL_POSITIONS") {
    return {
      employeeTypeId: toId(employeeType._id || employeeType.id),
      employeeTypeChildId: null,
      employeeTypeChildCode: "",
      employeeTypeChildName: "",
    };
  }

  const directPositionIds = Array.isArray(employeeType?.positionIds)
    ? employeeType.positionIds
    : [];

  if (directPositionIds.some((item) => sameId(item, positionId))) {
    return {
      employeeTypeId: toId(employeeType._id || employeeType.id),
      employeeTypeChildId: null,
      employeeTypeChildCode: "",
      employeeTypeChildName: "",
    };
  }

  for (const child of employeeType?.children || []) {
    if (child.positionAssignmentMode === "ALL_POSITIONS") {
      return {
        employeeTypeId: toId(employeeType._id || employeeType.id),
        employeeTypeChildId: toId(child._id || child.id),
        employeeTypeChildCode: child.code || "",
        employeeTypeChildName: child.name || "",
      };
    }

    const childPositionIds = Array.isArray(child.positionIds)
      ? child.positionIds
      : [];

    if (childPositionIds.some((item) => sameId(item, positionId))) {
      return {
        employeeTypeId: toId(employeeType._id || employeeType.id),
        employeeTypeChildId: toId(child._id || child.id),
        employeeTypeChildCode: child.code || "",
        employeeTypeChildName: child.name || "",
      };
    }
  }

  return null;
}

function throwPositionNotConfigured() {
  throw new AppError({
    statusCode: 409,
    code: "EMPLOYEE_POSITION_EMPLOYEE_TYPE_NOT_CONFIGURED",
    messageKey: "errors.employee.profile.positionEmployeeTypeNotConfigured",
    fields: {
      positionId: ["errors.employee.profile.positionEmployeeTypeNotConfigured"],
    },
  });
}

function throwPositionAmbiguous() {
  throw new AppError({
    statusCode: 409,
    code: "EMPLOYEE_POSITION_EMPLOYEE_TYPE_AMBIGUOUS",
    messageKey: "errors.employee.profile.positionEmployeeTypeAmbiguous",
    fields: {
      positionId: ["errors.employee.profile.positionEmployeeTypeAmbiguous"],
    },
  });
}

async function persistAllPositionAssignment({
  employeeType,
  positionId,
  session,
}) {
  const normalizedPositionId = toId(positionId);
  if (!normalizedPositionId) return;

  if (employeeType.positionAssignmentMode === "ALL_POSITIONS") {
    if (
      !(employeeType.positionIds || []).some((item) => sameId(item, positionId))
    ) {
      await EmployeeType.updateOne(
        { _id: employeeType._id },
        { $addToSet: { positionIds: positionId } },
        { session },
      );
    }
    return;
  }

  const allPositionsChild = (employeeType.children || []).find(
    (child) => child.positionAssignmentMode === "ALL_POSITIONS",
  );

  if (!allPositionsChild) return;
  if (
    (allPositionsChild.positionIds || []).some((item) =>
      sameId(item, positionId),
    )
  )
    return;

  await EmployeeType.updateOne(
    {
      _id: employeeType._id,
      "children._id": allPositionsChild._id,
    },
    { $addToSet: { "children.$.positionIds": positionId } },
    { session },
  );
}

export async function resolveEmployeeTypeAssignmentByPosition({
  companyId,
  branchId,
  positionId,
  session = null,
}) {
  ensureObjectId(companyId, "companyId");
  ensureObjectId(branchId, "branchId");
  ensureObjectId(positionId, "positionId");

  let query = EmployeeType.find({
    companyId,
    branchId,
    status: "ACTIVE",
    $or: [
      { positionIds: positionId },
      { "children.positionIds": positionId },
      { positionAssignmentMode: "ALL_POSITIONS" },
      { "children.positionAssignmentMode": "ALL_POSITIONS" },
    ],
  })
    .select("_id positionAssignmentMode positionIds children")
    .limit(2);

  if (session) query = query.session(session);

  const employeeTypes = await query.lean();

  if (employeeTypes.length === 0) {
    throwPositionNotConfigured();
  }

  if (employeeTypes.length > 1) {
    throwPositionAmbiguous();
  }

  const assignment = findPositionAssignment(employeeTypes[0], positionId);

  if (!assignment) {
    throwPositionNotConfigured();
  }

  await persistAllPositionAssignment({
    employeeType: employeeTypes[0],
    positionId,
    session,
  });

  return assignment;
}

export async function getEmployeeTypeAssignmentMap({
  companyId,
  branchId,
  session = null,
}) {
  ensureObjectId(companyId, "companyId");
  ensureObjectId(branchId, "branchId");

  let employeeTypeQuery = EmployeeType.find({
    companyId,
    branchId,
    status: "ACTIVE",
  }).select("_id code name positionAssignmentMode positionIds children");
  let positionQuery = Position.find({
    companyId,
    branchId,
    status: "ACTIVE",
  }).select("_id");

  if (session) {
    employeeTypeQuery = employeeTypeQuery.session(session);
    positionQuery = positionQuery.session(session);
  }

  const [employeeTypes, positions] = await Promise.all([
    employeeTypeQuery.lean(),
    positionQuery.lean(),
  ]);
  const allPositionIds = positions.map((position) => toId(position._id));
  const assignments = new Map();

  const register = (positionId, assignment) => {
    const key = toId(positionId);
    if (!key) return;
    if (assignments.has(key)) throwPositionAmbiguous();
    assignments.set(key, assignment);
  };

  for (const employeeType of employeeTypes) {
    const parentAssignment = {
      employeeTypeId: toId(employeeType._id),
      employeeTypeChildId: null,
      employeeTypeChildCode: "",
      employeeTypeChildName: "",
    };
    const parentPositionIds =
      employeeType.positionAssignmentMode === "ALL_POSITIONS"
        ? allPositionIds
        : employeeType.positionIds || [];

    for (const positionId of parentPositionIds) {
      register(positionId, parentAssignment);
    }

    for (const child of employeeType.children || []) {
      const childAssignment = {
        employeeTypeId: toId(employeeType._id),
        employeeTypeChildId: toId(child._id),
        employeeTypeChildCode: child.code || "",
        employeeTypeChildName: child.name || "",
      };
      const childPositionIds =
        child.positionAssignmentMode === "ALL_POSITIONS"
          ? allPositionIds
          : child.positionIds || [];

      for (const positionId of childPositionIds) {
        register(positionId, childAssignment);
      }
    }
  }

  const allPositionSyncOperations = [];
  for (const employeeType of employeeTypes) {
    if (employeeType.positionAssignmentMode === "ALL_POSITIONS") {
      allPositionSyncOperations.push({
        updateOne: {
          filter: { _id: employeeType._id },
          update: { $addToSet: { positionIds: { $each: allPositionIds } } },
        },
      });
    }

    for (const child of employeeType.children || []) {
      if (child.positionAssignmentMode !== "ALL_POSITIONS") continue;
      allPositionSyncOperations.push({
        updateOne: {
          filter: { _id: employeeType._id },
          update: {
            $addToSet: {
              "children.$[child].positionIds": { $each: allPositionIds },
            },
          },
          arrayFilters: [{ "child._id": child._id }],
        },
      });
    }
  }

  if (allPositionSyncOperations.length) {
    await EmployeeType.bulkWrite(allPositionSyncOperations, { session });
  }

  return assignments;
}
