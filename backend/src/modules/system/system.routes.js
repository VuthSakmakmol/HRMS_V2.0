import { Router } from "express"
import { getDatabaseHealth } from "../../config/database.js"

const router = Router()

router.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            service: "hrms-enterprise-api",
            status: "ok",
            timestamp: new Date().toISOString(),
            database: getDatabaseHealth(),
            requestId: req.requestId,
        },
    })
})

export default router