import "dotenv/config"
import { z } from "zod"

const optionalString = z.preprocess((value) => {
    if (typeof value !== "string") {
        return value
    }

    const normalizedValue = value.trim()

    return normalizedValue === "" ? undefined : normalizedValue
}, z.string().trim().min(1).optional())

const environmentSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    PORT: z.coerce.number().int().min(1).max(65535).default(4000),

    CLIENT_URL: z.string().url().default("http://localhost:5173"),

    MONGO_URI: optionalString,

    REQUEST_BODY_LIMIT: z.string().trim().default("2mb"),

    JWT_ACCESS_SECRET: z.string().trim().min(32),

    JWT_ACCESS_EXPIRES_IN: z.string().trim().min(1).default("8h"),

    SEED_ROOT_LOGIN: optionalString,

    SEED_ROOT_PASSWORD: optionalString,

    SEED_ROOT_DISPLAY_NAME: optionalString,
})

const parsedEnvironment = environmentSchema.safeParse(process.env)

if (!parsedEnvironment.success) {
    console.error("Invalid environment configuration:")

    for (const issue of parsedEnvironment.error.issues) {
        console.error(`- ${issue.path.join(".")}: ${issue.message}`)
    }

    process.exit(1)
}

export const env = Object.freeze(parsedEnvironment.data)