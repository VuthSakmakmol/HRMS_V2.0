function buildMeta(req, extraMeta = undefined) {
    return {
        requestId: req.requestId,
        generatedAt: new Date().toISOString(),
        ...(extraMeta || {}),
    }
}

export function sendSuccess(
    req,
    res,
    {
        statusCode = 200,
        data = undefined,
        messageKey = undefined,
        meta = undefined,
    } = {},
) {
    return res.status(statusCode).json({
        success: true,
        data,
        messageKey,
        meta: buildMeta(req, meta),
    })
}

export function sendList(req, res, { items, pagination, meta } = {}) {
    return sendSuccess(req, res, {
        data: {
            items: items || [],
            pagination,
        },
        meta,
    })
}
