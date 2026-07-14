export function requestMetrics(req, res, next) {
    const startedAt = process.hrtime.bigint()

    res.once("finish", () => {
        const durationMs =
            Number(process.hrtime.bigint() - startedAt) / 1_000_000

        if (durationMs >= 2000) {
            console.warn(
                [
                    "[api][slow]",
                    `[${req.requestId ?? "unknown"}]`,
                    req.method,
                    req.originalUrl,
                    res.statusCode,
                    `${durationMs.toFixed(1)}ms`,
                ].join(" "),
            )
        }
    })

    next()
}