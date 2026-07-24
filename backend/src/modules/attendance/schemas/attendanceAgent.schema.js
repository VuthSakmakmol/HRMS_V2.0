import { z } from "zod"

const scanSchema = z.object({
    employeeCode: z.string().trim().min(1).max(40).transform((value) => value.toUpperCase()),
    scannedAt: z.iso.datetime({ offset: true }),
    deviceCode: z.string().trim().min(1).max(120),
    direction: z.enum(["IN", "OUT", "UNKNOWN"]).default("UNKNOWN"),
})

export const attendanceAgentSyncSchema = z.object({
    batchId: z.string().trim().min(1).max(120),
    scans: z.array(scanSchema).min(1).max(2000),
})
