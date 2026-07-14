import http from "node:http"

import app from "./app.js"
import { connectDatabase, disconnectDatabase } from "./config/database.js"
import { env } from "./config/env.js"

const server = http.createServer(app)

// Long Excel imports/exports should not silently die while the UI is waiting.
// Keep reverse-proxy timeouts in production aligned with this setting.
server.requestTimeout = 0
server.headersTimeout = 0
server.timeout = 0
server.keepAliveTimeout = 65_000

async function startServer() {
    try {
        await connectDatabase()

        server.listen(env.PORT, () => {
            console.log(`[api] running at http://localhost:${env.PORT}`)
        })
    } catch (error) {
        console.error("[api] startup failed:", error)
        process.exit(1)
    }
}

function shutdown(signal) {
    console.log(`[api] received ${signal}, shutting down...`)

    server.close(async () => {
        await disconnectDatabase()
        process.exit(0)
    })

    setTimeout(() => {
        process.exit(1)
    }, 10000).unref()
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

startServer()