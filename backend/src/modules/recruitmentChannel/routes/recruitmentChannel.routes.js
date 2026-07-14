import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"

import {
    recruitmentChannelCreateSchema,
    recruitmentChannelIdParamSchema,
    recruitmentChannelListQuerySchema,
    recruitmentChannelUpdateSchema,
} from "../schemas/recruitmentChannel.schema.js"

import {
    archiveRecruitmentChannel,
    createRecruitmentChannel,
    getRecruitmentChannelById,
    listRecruitmentChannels,
    updateRecruitmentChannel,
} from "../services/recruitmentChannel.service.js"

const router = Router()

const PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.RECRUITMENT_CHANNEL.VIEW",
    CREATE: "ORGANIZATION.RECRUITMENT_CHANNEL.CREATE",
    UPDATE: "ORGANIZATION.RECRUITMENT_CHANNEL.UPDATE",
    ARCHIVE: "ORGANIZATION.RECRUITMENT_CHANNEL.ARCHIVE",
})

function parseRequest(schema, value) {
    const parsed = schema.safeParse(value)

    if (!parsed.success) {
        throw new AppError({
            statusCode: 422,
            code: "VALIDATION_FAILED",
            messageKey: "errors.validationFailed",
            fields: parsed.error.flatten().fieldErrors,
        })
    }

    return parsed.data
}

router.use(requireAuthentication)

router.get(
    "/",
    requirePermission(PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(recruitmentChannelListQuerySchema, req.query)
            const result = await listRecruitmentChannels({ query, user: req.auth.user })

            res.status(200).json({ success: true, data: result })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/",
    requirePermission(PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(recruitmentChannelCreateSchema, req.body)
            const recruitmentChannel = await createRecruitmentChannel({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({
                success: true,
                data: { recruitmentChannel },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:recruitmentChannelId",
    requirePermission(PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const params = parseRequest(recruitmentChannelIdParamSchema, req.params)
            const recruitmentChannel = await getRecruitmentChannelById(params)

            res.status(200).json({
                success: true,
                data: { recruitmentChannel },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:recruitmentChannelId",
    requirePermission(PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const params = parseRequest(recruitmentChannelIdParamSchema, req.params)
            const payload = parseRequest(recruitmentChannelUpdateSchema, req.body)
            const recruitmentChannel = await updateRecruitmentChannel({
                recruitmentChannelId: params.recruitmentChannelId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { recruitmentChannel },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:recruitmentChannelId/archive",
    requirePermission(PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const params = parseRequest(recruitmentChannelIdParamSchema, req.params)
            const recruitmentChannel = await archiveRecruitmentChannel({
                recruitmentChannelId: params.recruitmentChannelId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: { recruitmentChannel },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router
