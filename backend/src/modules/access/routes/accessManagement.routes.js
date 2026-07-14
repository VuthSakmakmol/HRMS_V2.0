import { Router } from "express";
import { AppError } from "../../../shared/errors/AppError.js";
import {
  requireAuthentication,
  requirePermission,
} from "../middleware/auth.middleware.js";
import {
  idParamSchema,
  roleListSchema,
  roleCreateSchema,
  roleUpdateSchema,
  accountListSchema,
  accountCreateSchema,
  accountUpdateSchema,
  resetPasswordSchema,
} from "../schemas/accessManagement.schema.js";
import {
  listPermissions,
  listRoleLookup,
  listScopeLookup,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  listAccounts,
  createAccount,
  updateAccount,
  resetAccountPassword,
} from "../services/accessManagement.service.js";
const router = Router();
const parse = (schema, value) => {
  const r = schema.safeParse(value);
  if (!r.success)
    throw new AppError({
      statusCode: 422,
      code: "VALIDATION_FAILED",
      messageKey: "errors.validationFailed",
      fields: r.error.flatten().fieldErrors,
    });
  return r.data;
};
router.use(requireAuthentication);
router.get(
  "/permissions",
  requirePermission("ACCESS.PERMISSION.VIEW"),
  async (req, res, next) => {
    try {
      res.json({ success: true, data: await listPermissions() });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/lookups/roles",
  requirePermission("ACCESS.ROLE.VIEW"),
  async (req, res, next) => {
    try {
      res.json({ success: true, data: await listRoleLookup() });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/lookups/scopes",
  requirePermission("ACCESS.ROLE.VIEW"),
  async (req, res, next) => {
    try {
      res.json({ success: true, data: await listScopeLookup() });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/roles",
  requirePermission("ACCESS.ROLE.VIEW"),
  async (req, res, next) => {
    try {
      res.json({
        success: true,
        data: await listRoles({ query: parse(roleListSchema, req.query) }),
      });
    } catch (e) {
      next(e);
    }
  },
);
router.post(
  "/roles",
  requirePermission("ACCESS.ROLE.CREATE"),
  async (req, res, next) => {
    try {
      res
        .status(201)
        .json({
          success: true,
          data: {
            role: await createRole({
              payload: parse(roleCreateSchema, req.body),
              user: req.auth.user,
            }),
          },
        });
    } catch (e) {
      next(e);
    }
  },
);
router.patch(
  "/roles/:id",
  requirePermission("ACCESS.ROLE.UPDATE"),
  async (req, res, next) => {
    try {
      res.json({
        success: true,
        data: {
          role: await updateRole({
            id: parse(idParamSchema, req.params).id,
            payload: parse(roleUpdateSchema, req.body),
            user: req.auth.user,
          }),
        },
      });
    } catch (e) {
      next(e);
    }
  },
);
router.delete(
  "/roles/:id",
  requirePermission("ACCESS.ROLE.DELETE"),
  async (req, res, next) => {
    try {
      await deleteRole({ id: parse(idParamSchema, req.params).id });
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/accounts",
  requirePermission("ACCESS.ACCOUNT.VIEW"),
  async (req, res, next) => {
    try {
      res.json({
        success: true,
        data: await listAccounts({
          query: parse(accountListSchema, req.query),
        }),
      });
    } catch (e) {
      next(e);
    }
  },
);
router.post(
  "/accounts",
  requirePermission("ACCESS.ACCOUNT.CREATE"),
  async (req, res, next) => {
    try {
      res
        .status(201)
        .json({
          success: true,
          data: {
            account: await createAccount({
              payload: parse(accountCreateSchema, req.body),
              user: req.auth.user,
            }),
          },
        });
    } catch (e) {
      next(e);
    }
  },
);
router.patch(
  "/accounts/:id",
  requirePermission("ACCESS.ACCOUNT.UPDATE"),
  async (req, res, next) => {
    try {
      res.json({
        success: true,
        data: {
          account: await updateAccount({
            id: parse(idParamSchema, req.params).id,
            payload: parse(accountUpdateSchema, req.body),
            user: req.auth.user,
          }),
        },
      });
    } catch (e) {
      next(e);
    }
  },
);
router.post(
  "/accounts/:id/reset-password",
  requirePermission("ACCESS.ACCOUNT.RESET_PASSWORD"),
  async (req, res, next) => {
    try {
      await resetAccountPassword({
        id: parse(idParamSchema, req.params).id,
        password: parse(resetPasswordSchema, req.body).password,
        user: req.auth.user,
      });
      res.json({ success: true, data: {} });
    } catch (e) {
      next(e);
    }
  },
);
export default router;
