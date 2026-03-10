import { defineTable } from "convex/server";
import { v } from "convex/values";

export const usageSchema = {
    usageRecords: defineTable({
        sessionKey: v.string(),
        agentId: v.optional(v.string()),
        model: v.optional(v.string()),
        inputTokens: v.float64(),
        outputTokens: v.float64(),
        totalTokens: v.float64(),
        estimatedCost: v.optional(v.float64()),
        date: v.string(),    // "YYYY-MM-DD"
        timestamp: v.float64(),
        hasErrors: v.optional(v.boolean()),
        tenantId: v.optional(v.string()),
    })
        .index("by_sessionKey", ["sessionKey"])
        .index("by_date", ["date"])
        .index("by_agentId", ["agentId"])
        .index("by_model", ["model"])
        .index("by_timestamp", ["timestamp"])
        .index("by_tenant", ["tenantId"])
        .index("by_tenant_date", ["tenantId", "date"]),
};
