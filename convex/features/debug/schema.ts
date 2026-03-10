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
};
