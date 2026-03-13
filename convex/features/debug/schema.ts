import { defineTable } from "convex/server";
import { v } from "convex/values";

export const debugSchema = {
    debugSnapshots: defineTable({
        type: v.string(),      // "status" | "health" | "heartbeat"
        data: v.any(),
        capturedAt: v.float64(),
        tenantId: v.optional(v.string()),
    })
        .index("by_type", ["type"])
        .index("by_capturedAt", ["capturedAt"])
        .index("by_tenant", ["tenantId"]),

    rpcCalls: defineTable({
        method: v.string(),
        params: v.optional(v.any()),
        result: v.optional(v.any()),
        error: v.optional(v.string()),
        calledAt: v.float64(),
        durationMs: v.optional(v.float64()),
        tenantId: v.optional(v.string()),
    })
        .index("by_method", ["method"])
        .index("by_calledAt", ["calledAt"])
        .index("by_tenant", ["tenantId"]),

    syncAuditLog: defineTable({
        domain: v.string(),           // "agents" | "sessions" | "channels" | "nodes" | "logs" | "skills" | "config" | "crons"
        inserted: v.optional(v.float64()),
        updated: v.optional(v.float64()),
        unchanged: v.optional(v.float64()),
        deleted: v.optional(v.float64()),
        upserted: v.optional(v.float64()),
        failed: v.optional(v.float64()),
        error: v.optional(v.string()),
        status: v.string(),           // "ok" | "error" | "partial"
        syncedAt: v.float64(),
        tenantId: v.optional(v.string()),
    })
        .index("by_domain", ["domain"])
        .index("by_syncedAt", ["syncedAt"])
        .index("by_tenant", ["tenantId"]),
};
