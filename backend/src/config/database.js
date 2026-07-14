import mongoose from "mongoose"
import { env } from "./env.js"

let databaseState = "not-configured"
let listenersRegistered = false

function registerConnectionListeners() {
    if (listenersRegistered) {
        return
    }

    listenersRegistered = true

    mongoose.connection.on("connected", () => {
        databaseState = "connected"
        console.log("[mongo] connected")
    })

    mongoose.connection.on("disconnected", () => {
        databaseState = "disconnected"
        console.warn("[mongo] disconnected")
    })

    mongoose.connection.on("reconnected", () => {
        databaseState = "connected"
        console.log("[mongo] reconnected")
    })

    mongoose.connection.on("error", (error) => {
        databaseState = "error"
        console.error("[mongo] connection error:", error.message)
    })
}

export async function connectDatabase() {
    if (!env.MONGO_URI) {
        console.warn("[mongo] MONGO_URI is not configured. Database connection is skipped.")
        return
    }

    mongoose.set("strictQuery", true)
    mongoose.set("autoIndex", env.NODE_ENV !== "production")
    registerConnectionListeners()

    try {
        databaseState = "connecting"

        await mongoose.connect(env.MONGO_URI, {
            serverSelectionTimeoutMS: 15_000,
            connectTimeoutMS: 15_000,
            socketTimeoutMS: 120_000,
            maxPoolSize: env.NODE_ENV === "production" ? 50 : 10,
            minPoolSize: env.NODE_ENV === "production" ? 5 : 0,
            maxIdleTimeMS: 60_000,
            retryWrites: true,
        })
    } catch (error) {
        databaseState = "error"
        throw error
    }
}

export async function disconnectDatabase() {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect()
    }
}

export function getDatabaseHealth() {
    return {
        configured: Boolean(env.MONGO_URI),
        state: databaseState,
        readyState: mongoose.connection.readyState,
        healthy: !env.MONGO_URI || mongoose.connection.readyState === 1,
    }
}
