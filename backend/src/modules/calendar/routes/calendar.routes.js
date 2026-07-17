import { Router } from "express"
import multer from "multer"
import { requireAuthentication, requirePermission } from "../../access/middleware/auth.middleware.js"
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js"
import { validateRequest } from "../../../shared/middleware/validateRequest.js"
import { archiveCalendarDayController, createCalendarDayController, downloadCalendarTemplateController, exportCalendarDaysController, getCalendarDayController, importCalendarDaysController, listCalendarDaysController, resolveCalendarDayController, resolveCalendarRangeController, updateCalendarDayController } from "../controllers/calendar.controller.js"
import { calendarDayCreateSchema, calendarDayIdParamSchema, calendarDayListQuerySchema, calendarDayUpdateSchema, calendarResolveDayQuerySchema, calendarResolveRangeQuerySchema } from "../schemas/calendar.schema.js"

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } })
const P = Object.freeze({ VIEW: "CALENDAR.DAY.VIEW", CREATE: "CALENDAR.DAY.CREATE", UPDATE: "CALENDAR.DAY.UPDATE", ARCHIVE: "CALENDAR.DAY.ARCHIVE", IMPORT: "CALENDAR.DAY.IMPORT", EXPORT: "CALENDAR.DAY.EXPORT" })
router.use(requireAuthentication)
router.get("/resolve/day", validateRequest({ query: calendarResolveDayQuerySchema }), asyncHandler(resolveCalendarDayController))
router.get("/resolve/range", validateRequest({ query: calendarResolveRangeQuerySchema }), asyncHandler(resolveCalendarRangeController))
router.get("/days/import-template", requirePermission(P.VIEW), asyncHandler(downloadCalendarTemplateController))
router.get("/days/export", requirePermission(P.EXPORT), validateRequest({ query: calendarDayListQuerySchema }), asyncHandler(exportCalendarDaysController))
router.post("/days/import", requirePermission(P.IMPORT), upload.single("file"), asyncHandler(importCalendarDaysController))
router.get("/days", requirePermission(P.VIEW), validateRequest({ query: calendarDayListQuerySchema }), asyncHandler(listCalendarDaysController))
router.post("/days", requirePermission(P.CREATE), validateRequest({ body: calendarDayCreateSchema }), asyncHandler(createCalendarDayController))
router.get("/days/:calendarDayId", requirePermission(P.VIEW), validateRequest({ params: calendarDayIdParamSchema }), asyncHandler(getCalendarDayController))
router.patch("/days/:calendarDayId", requirePermission(P.UPDATE), validateRequest({ params: calendarDayIdParamSchema, body: calendarDayUpdateSchema }), asyncHandler(updateCalendarDayController))
router.patch("/days/:calendarDayId/archive", requirePermission(P.ARCHIVE), validateRequest({ params: calendarDayIdParamSchema }), asyncHandler(archiveCalendarDayController))
export default router
