import { defineTable } from "convex/server";
import { v } from "convex/values";

export const logsSchema = {
    gatewayLogs: defineTable({
        level: v.string(),  // "trace" | "debug" | "info" | "warn" | "error"
        source: v.string(), // "gateway" | "channels" | "ws" | "session" | "cron" etc.
        message: v.string(),
        details: v.optional(v.any()),
        timestamp: v.float64(),
        tenantId: v.optional(v.string()),
    })
        .index("by_level", ["level"])
        .index("by_source", ["source"])
        .index("by_timestamp", ["timestamp"])
        .index("by_level_timestamp", ["level", "timestamp"])
        .index("by_tenant", ["tenantId"]),
};
